#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (!process.env.TRADE_NATIVE_ROOT) throw new Error('TRADE_NATIVE_ROOT must point to the pinned local CKB SDK workspace');
if (!process.env.TRADE_GATE2_BUILD_DIR) throw new Error('TRADE_GATE2_BUILD_DIR must point to the freshly rebuilt Gate 2 ELFs');
const C = require(path.join(process.env.TRADE_NATIVE_ROOT, 'src', 'lib.cjs'));
const sdk = require(path.join(process.env.TRADE_NATIVE_ROOT, 'node_modules', '@nervosnetwork', 'ckb-sdk-utils'));
const gate2Dir = path.resolve(__dirname, '..');

function readLines(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}
function pointKey(hash, index) { return `${hash.toLowerCase()}:${BigInt(index).toString()}`; }
function h256(value) { return Buffer.from(value.slice(2), 'hex'); }
function hashScript(script) { return sdk.scriptToHash(script).toLowerCase(); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function dataBytes(value) { return Buffer.from(value.slice(2), 'hex'); }
function normalizeRpcTransaction(raw) {
  const tx = C.camel(raw);
  for (const dep of tx.cellDeps) if (dep.depType === 'dep_group') dep.depType = 'depGroup';
  return tx;
}
function tokenAmount(data) {
  const bytes = dataBytes(data);
  assert(bytes.length === 16 || bytes.length === 48, `unsupported xUDT data length ${bytes.length}`);
  for (let i = 8; i < 16; i++) assert.equal(bytes[i], 0, 'xUDT amount exceeds u64');
  return bytes.readBigUInt64LE(0);
}
function leafBalance(value) { return Buffer.from(value, 'hex').readBigUInt64LE(0); }
function tmsWitness(tx) {
  const witness = tx.witnesses.find(value => value.startsWith('0x544d5331'));
  if (!witness) return null;
  const bytes = dataBytes(witness);
  assert(bytes.length >= 12, 'truncated TMS1 header');
  const count = bytes.readUInt16LE(6);
  const proofBytes = bytes.readUInt32LE(8);
  const proofStart = 12 + count * 96;
  const proofEnd = proofStart + proofBytes;
  assert(count > 0 && proofEnd <= bytes.length, 'truncated TMS1 entries or proof');
  const updates = [];
  for (let i = 0; i < count; i++) {
    const start = 12 + i * 96;
    updates.push({
      owner: `0x${bytes.subarray(start, start + 32).toString('hex')}`,
      old: bytes.subarray(start + 32, start + 64).toString('hex'),
      next: bytes.subarray(start + 64, start + 96).toString('hex'),
    });
  }
  return { op: bytes[5], count, proofBytes, witnessBytes: bytes.length, updates,
    extra: bytes.subarray(proofEnd), compiledProof: bytes.subarray(proofStart, proofEnd) };
}
function recordCell(output, data) {
  return {
    capacity: BigInt(output.capacity),
    lock: output.lock,
    lockHash: hashScript(output.lock),
    typeHash: output.type ? hashScript(output.type) : null,
    output,
    data,
  };
}
function sumAmounts(cells) { return cells.reduce((total, cell) => total + tokenAmount(cell.data), 0n); }
function findCells(cells, predicate) { return cells.filter(predicate); }
function expectOne(cells, label) {
  assert.equal(cells.length, 1, `${label}: expected one cell, found ${cells.length}`);
  return cells[0];
}
function curvePrice(base, step, q, soldAtStart) {
  return base * q + step * (q * soldAtStart + q * (q - 1n) / 2n);
}
function argsInteger(args, offset) { return h256(args).readBigUInt64LE(offset); }

function main() {
  assert(process.argv.length === 4,
    'Usage: node verify-combined-1024-accounting.cjs <native-run-dir> <canonical-history-bundle.json>');
  const runDir = path.resolve(process.argv[2]);
  const bundlePath = path.resolve(process.argv[3]);
  const events = readLines(path.join(runDir, 'events.jsonl'));
  const rpcRows = readLines(path.join(runDir, 'rpc.jsonl'));
  const summary = JSON.parse(fs.readFileSync(path.join(runDir, 'summary.json'), 'utf8'));
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const transitionHistory = bundle.history;
  assert.equal(bundle.format, 'trade-v2-recovery-bundle-v1');
  assert.equal(bundle.collection.source, 'canonical-full-block-scan');
  assert.equal(bundle.collection.indexer_used, false);
  assert.equal(bundle.collection.live_outpoint_checked_with_get_live_cell, true);
  assert.equal(bundle.collection.start_tip.hash, bundle.collection.end_tip.hash, 'history scan tip changed');
  assert.equal(bundle.collection.canonical_candidate_block_hashes_checked, transitionHistory.length);

  const recoveryRun = spawnSync('cargo', [
    'run', '--quiet', '--locked', '--offline', '--manifest-path', path.join(gate2Dir, 'recovery', 'Cargo.toml'), '--',
    'replay', bundlePath, '-',
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  assert.equal(recoveryRun.status, 0, `independent Rust Merkle replay failed: ${recoveryRun.stderr}`);
  const recovery = JSON.parse(recoveryRun.stdout);
  assert.equal(recovery.transitions.length, transitionHistory.length);

  const genesisRow = rpcRows.find(row => row.method === 'get_block_by_number' && row.params?.[0] === '0x0');
  assert(genesisRow?.response?.result, 'run evidence does not contain the native genesis block');
  const genesis = C.camel(genesisRow.response.result);
  const cells = new Map();
  for (const blockTx of genesis.transactions) {
    for (let i = 0; i < blockTx.outputs.length; i++) {
      cells.set(pointKey(blockTx.hash, i), recordCell(blockTx.outputs[i], blockTx.outputsData[i]));
    }
  }

  const marketHash = hashScript(summary.scripts.market);
  const marketMarkerHash = hashScript(summary.scripts.marker);
  const custodyHash = hashScript(summary.scripts.custody);
  const custodyMarkerHash = hashScript(summary.scripts.custodyMarker);
  const tokenHash = hashScript(summary.scripts.token);
  const expectedHashes = {
    market_smt: summary.hashes.market_smt,
    custody_smt: summary.hashes.custody_smt,
    marker_candidate: summary.hashes.marker_candidate,
    custody_marker: summary.hashes.custody_marker,
  };
  for (const [name, expected] of Object.entries(expectedHashes)) {
    assert.equal(C.hash(fs.readFileSync(path.join(process.env.TRADE_GATE2_BUILD_DIR, name))).toLowerCase(),
      expected.toLowerCase(), `${name} ELF code hash differs from the native run`);
  }
  assert.equal(summary.scripts.token.codeHash.toLowerCase(), summary.hashes.xudt.toLowerCase(), 'xUDT code hash differs from native run');
  assert.equal(summary.scripts.market.codeHash.toLowerCase(), summary.hashes.market_smt.toLowerCase(), 'market code hash differs from native run');
  assert.equal(summary.scripts.custody.codeHash.toLowerCase(), summary.hashes.custody_smt.toLowerCase(), 'custody code hash differs from native run');

  const marketArgs = summary.scripts.market.args;
  const base = argsInteger(marketArgs, 32);
  const step = argsInteger(marketArgs, 40);
  const supply = argsInteger(marketArgs, 48);
  const marketArgsBytes = h256(marketArgs);
  assert.equal(marketArgsBytes.length, 88);
  const namedSourceFiles = ['market_smt.c', 'custody_smt.c', 'custody_marker.c', 'marker_candidate.c', 'owner_lineage_candidate.c', 'smt_transition.h'];
  const sourceHashes = {};
  for (const name of namedSourceFiles) {
    const sourcePath = path.join(gate2Dir, name);
    if (fs.existsSync(sourcePath)) sourceHashes[name] = sha256(fs.readFileSync(sourcePath));
  }
  const elfHashes = {};
  for (const name of Object.keys(expectedHashes)) elfHashes[name] = sha256(fs.readFileSync(path.join(process.env.TRADE_GATE2_BUILD_DIR, name)));

  const canonicalByHash = new Map(transitionHistory.map(row => [row.tx_hash.toLowerCase(), row]));
  assert.equal(canonicalByHash.size, transitionHistory.length, 'canonical bundle contains duplicate transition tx hashes');
  const eventByHash = new Map(events.map(event => [event.hash.toLowerCase(), event]));
  assert.equal(events.length, new Set(events.map(event => event.hash.toLowerCase())).size,
    'native event log contains duplicate transaction hashes');
  assert.equal(events.filter(event => tmsWitness(event.tx)).length, transitionHistory.length,
    'canonical history bundle does not contain every committed TMS1 transition');
  assert.equal(recovery.transitions.length, transitionHistory.length);

  for (const row of transitionHistory) {
    const key = row.tx_hash.toLowerCase();
    const event = eventByHash.get(key);
    assert(event, `canonical transition ${key} is missing from native event records`);
    assert.equal(event.committed?.tx_status?.status, 'committed', `${key} event is not committed`);
    assert.equal(event.committed.tx_status.block_hash.toLowerCase(), row.block_hash.toLowerCase(), `${key} canonical block hash differs`);
    assert.equal(BigInt(event.committed.tx_status.block_number), BigInt(row.block_number), `${key} canonical block height differs`);
    assert.equal(C.U.rawTransactionToHash(event.tx).toLowerCase(), key, `${key} event transaction hash differs`);
    const canonicalTx = normalizeRpcTransaction(row.transaction);
    assert.equal(C.U.rawTransactionToHash(canonicalTx).toLowerCase(), key, `${key} canonical transaction hash differs`);
    assert.equal(sdk.serializeTransaction(event.tx), sdk.serializeTransaction(canonicalTx),
      `${key} native event transaction does not match the committed canonical transaction body and witnesses`);
  }

  const currentCustody = { point: null, amount: 0n, root: Buffer.alloc(32), capacity: null };
  const currentCustodyMarker = { point: null, capacity: null };
  const currentMarket = { point: null, inventory: 0n, capacity: null, markerPoint: null, markerCapacity: null };
  const ownerTotalsByTransition = new Map(recovery.transitions.map(row => [row.tx_hash.toLowerCase(), BigInt(row.reconstructed_entitlement_total)]));
  const authenticatedOwners = new Set();
  const externalByLock = new Map();
  let globalAssetSupply = 0n;
  let initialMarketCapacity = null;
  let totalBuyPrice = 0n;
  let totalSellPayout = 0n;
  let totalFee = 0n;
  let totalCapacityChecks = 0;
  let txBytes = 0;
  let totalEstimatedCycles = 0n;
  let maxEstimatedCycles = 0n;
  const accounting = [];
  const transitionOrder = [];

  for (const event of events) {
    assert.equal(event.committed?.tx_status?.status, 'committed', `${event.label} not committed`);
    assert.equal(C.U.rawTransactionToHash(event.tx).toLowerCase(), event.hash.toLowerCase(), `${event.label} hash mismatch`);
    const inputCells = event.tx.inputs.map(input => {
      const key = pointKey(input.previousOutput.txHash, input.previousOutput.index);
      const cell = cells.get(key);
      assert(cell, `${event.label} input ${key} is absent from genesis or prior committed outputs`);
      return { key, cell };
    });
    const inputs = inputCells.map(value => value.cell);
    const inputCapacity = inputs.reduce((total, cell) => total + cell.capacity, 0n);
    const outputCapacity = event.tx.outputs.reduce((total, output) => total + BigInt(output.capacity), 0n);
    assert(inputCapacity >= outputCapacity, `${event.label} has negative capacity fee`);
    const fee = inputCapacity - outputCapacity;
    totalFee += fee;
    const serialized = sdk.serializeTransaction(event.tx);
    txBytes += Buffer.from(serialized.slice(2), 'hex').length;
    const cycles = BigInt(event.cycles?.cycles ?? '0x0');
    totalEstimatedCycles += cycles;
    if (cycles > maxEstimatedCycles) maxEstimatedCycles = cycles;

    const inputAssetCells = inputs.filter(cell => cell.typeHash === tokenHash);
    const inputAssetAmount = sumAmounts(inputAssetCells);
    const outputCells = event.tx.outputs.map((output, i) => recordCell(output, event.tx.outputsData[i]));
    const outputAssetCells = outputCells.filter(cell => cell.typeHash === tokenHash);
    const outputAssetAmount = sumAmounts(outputAssetCells);
    if (inputAssetAmount !== outputAssetAmount) {
      assert.equal(event.label, 'issue_fixed_supply', 'xUDT supply changed outside the authorized fixed-supply issue transaction');
      assert.equal(inputAssetAmount, 0n);
      assert.equal(outputAssetAmount, supply);
    }
    globalAssetSupply = globalAssetSupply - inputAssetAmount + outputAssetAmount;
    if (event.label === 'issue_fixed_supply') assert.equal(globalAssetSupply, supply);
    else if (globalAssetSupply > 0n) assert.equal(globalAssetSupply, supply, `${event.label} changed fixed total supply`);

    const flowByLock = new Map();
    const accumulate = (map, cell, sign) => {
      if (cell.typeHash !== tokenHash) return;
      const prior = map.get(cell.lockHash) || 0n;
      map.set(cell.lockHash, prior + sign * tokenAmount(cell.data));
    };
    for (const cell of inputs) accumulate(flowByLock, cell, -1n);
    for (const cell of outputCells) accumulate(flowByLock, cell, 1n);
    for (const [lockHash, change] of flowByLock) externalByLock.set(lockHash, (externalByLock.get(lockHash) || 0n) + change);

    for (let i = 0; i < event.tx.outputs.length; i++) {
      const output = event.tx.outputs[i];
      const dataBytesLength = dataBytes(event.tx.outputsData[i]).length;
      const occupied = BigInt(8 * (sdk.cellOccupied(output) + dataBytesLength));
      assert(BigInt(output.capacity) >= occupied, `${event.label} output ${i} below occupied capacity`);
      totalCapacityChecks++;
    }

    const tms = tmsWitness(event.tx);
    let marketRecord = null;
    if (tms) {
      for (const update of tms.updates) authenticatedOwners.add(update.owner.toLowerCase());
      const canonical = canonicalByHash.get(event.hash.toLowerCase());
      assert(canonical, `${event.label} TMS1 body is not in the canonical history bundle`);
      const rustTransition = recovery.transitions.find(row => row.tx_hash.toLowerCase() === event.hash.toLowerCase());
      assert(rustTransition, `${event.label} has no independent Rust root replay result`);
      transitionOrder.push({ hash: event.hash, block_number: canonical.block_number, tx_index: canonical.tx_index, op: tms.op });

      const custodyInputs = inputs.filter(cell => cell.lockHash === custodyHash && cell.typeHash === tokenHash);
      const custodyOutputs = outputCells.filter(cell => cell.lockHash === custodyHash && cell.typeHash === tokenHash);
      const custodyMarkerInputs = inputs.filter(cell => cell.lockHash === custodyHash && cell.typeHash === custodyMarkerHash);
      const custodyMarkerOutputs = outputCells.filter(cell => cell.lockHash === custodyHash && cell.typeHash === custodyMarkerHash);
      const isInit = tms.op === 0;
      assert.equal(custodyInputs.length, isInit ? 0 : 1, `${event.label} custody input count`);
      assert.equal(custodyOutputs.length, 1, `${event.label} custody output count`);
      assert.equal(custodyMarkerInputs.length, isInit ? 0 : 1, `${event.label} custody marker input count`);
      assert.equal(custodyMarkerOutputs.length, 1, `${event.label} custody marker output count`);
      const custodyOutIndex = outputCells.indexOf(custodyOutputs[0]);
      const custodyPoint = pointKey(event.hash, custodyOutIndex);
      const custodyData = dataBytes(custodyOutputs[0].data);
      assert.equal(custodyData.length, 48);
      const custodyAmount = tokenAmount(custodyOutputs[0].data);
      const custodyRoot = custodyData.subarray(16, 48);
      assert.equal(`0x${custodyRoot.toString('hex')}`.toLowerCase(), rustTransition.root.toLowerCase(),
        `${event.label} custody root differs from independent proof replay`);
      assert.equal(custodyAmount, BigInt(rustTransition.custody_amount), `${event.label} custody amount differs from independent replay`);
      assert.equal(custodyAmount, ownerTotalsByTransition.get(event.hash.toLowerCase()), `${event.label} owner total differs from actual custody xUDT`);
      if (!isInit) {
        assert.equal(inputCells.filter(value => value.key === currentCustody.point).length, 1,
          `${event.label} does not consume the prior canonical custody singleton`);
        assert.equal(custodyInputs[0].capacity, custodyOutputs[0].capacity, `${event.label} changed custody capacity`);
        const previousCustodyData = dataBytes(custodyInputs[0].data);
        assert.equal(tokenAmount(custodyInputs[0].data), currentCustody.amount, `${event.label} custody input amount breaks lineage`);
        assert.equal(previousCustodyData.subarray(16, 48).toString('hex'), currentCustody.root.toString('hex'),
          `${event.label} custody input root breaks lineage`);
        assert.equal(custodyMarkerInputs[0].capacity, custodyMarkerOutputs[0].capacity, `${event.label} changed custody marker capacity`);
        assert.equal(inputCells.filter(value => value.key === currentCustodyMarker.point).length, 1,
          `${event.label} does not consume the prior custody marker singleton`);
      }
      const custodyMarkerPayload = dataBytes(custodyMarkerOutputs[0].data);
      assert.equal(custodyMarkerPayload.length, 64);
      assert.equal(custodyMarkerPayload.subarray(0, 32).toString('hex'), custodyHash.slice(2));
      assert.equal(custodyMarkerPayload.subarray(32, 64).toString('hex'), tokenHash.slice(2));
      currentCustody.point = custodyPoint;
      currentCustody.amount = custodyAmount;
      currentCustody.root = custodyRoot;
      currentCustody.capacity = custodyOutputs[0].capacity;
      const markerOutIndex = outputCells.indexOf(custodyMarkerOutputs[0]);
      currentCustodyMarker.point = pointKey(event.hash, markerOutIndex);
      currentCustodyMarker.capacity = custodyMarkerOutputs[0].capacity;

      const marketOps = new Set([0, 1, 2, 4]);
      if (marketOps.has(tms.op)) {
        const marketInputs = inputs.filter(cell => cell.lockHash === marketHash && cell.typeHash === tokenHash);
        const marketOutputs = outputCells.filter(cell => cell.lockHash === marketHash && cell.typeHash === tokenHash);
        const markerInputs = inputs.filter(cell => cell.lockHash === marketHash && cell.typeHash === marketMarkerHash);
        const markerOutputs = outputCells.filter(cell => cell.lockHash === marketHash && cell.typeHash === marketMarkerHash);
        const marketInput = expectOne(marketInputs, `${event.label} market inventory input`);
        const marketOutput = expectOne(marketOutputs, `${event.label} market inventory output`);
        const markerInput = expectOne(markerInputs, `${event.label} market marker input`);
        const markerOutput = expectOne(markerOutputs, `${event.label} market marker output`);
        if (currentMarket.point !== null) {
          assert.equal(inputCells.filter(value => value.key === currentMarket.point).length, 1,
            `${event.label} does not consume prior market inventory singleton`);
          assert.equal(inputCells.filter(value => value.key === currentMarket.markerPoint).length, 1,
            `${event.label} does not consume prior market marker singleton`);
          assert.equal(marketInput.capacity, currentMarket.capacity, `${event.label} market reserve capacity breaks lineage`);
          assert.equal(markerInput.capacity, currentMarket.markerCapacity, `${event.label} marker capacity breaks lineage`);
        }
        const marketInputData = dataBytes(marketInput.data), marketOutputData = dataBytes(marketOutput.data);
        assert.equal(marketInputData.length, tms.op === 0 ? 16 : 48);
        assert.equal(marketOutputData.length, 48);
        const before = tokenAmount(marketInput.data), after = tokenAmount(marketOutput.data);
        if (currentMarket.point !== null) assert.equal(before, currentMarket.inventory,
          `${event.label} market inventory breaks singleton lineage`);
        if (tms.op !== 0) assert.equal(marketInputData.subarray(16).toString('hex'), custodyMarkerHash.slice(2));
        assert.equal(marketOutputData.subarray(16).toString('hex'), custodyMarkerHash.slice(2));
        assert.equal(markerInput.capacity, markerOutput.capacity, `${event.label} changed market marker capacity`);
        assert.equal(dataBytes(markerInput.data).toString('hex'), dataBytes(markerOutput.data).toString('hex'),
          `${event.label} changes the market marker identity`);
        const markerPayload = dataBytes(markerOutput.data);
        assert.equal(markerPayload.length, 64);
        assert.equal(markerPayload.subarray(0, 32).toString('hex'), marketHash.slice(2));
        assert.equal(markerPayload.subarray(32, 64).toString('hex'), tokenHash.slice(2));

        let quantity = 0n;
        let price = 0n;
        if (tms.op === 0) {
          quantity = tms.updates.reduce((sum, update) => sum + leafBalance(update.next) - leafBalance(update.old), 0n);
          assert.equal(before, supply, 'initial purchase must consume the complete issued inventory');
          price = curvePrice(base, step, quantity, 0n);
          initialMarketCapacity = marketInput.capacity;
        } else if (tms.op === 1) {
          quantity = tms.updates.reduce((sum, update) => sum + leafBalance(update.next) - leafBalance(update.old), 0n);
          assert(after < before, 'buy must reduce market inventory');
          assert.equal(before - after, quantity, 'market inventory decrease differs from owner allocation');
          price = curvePrice(base, step, quantity, supply - before);
        } else if (tms.op === 2) {
          const meta = dataBytes(event.tx.witnesses[event.tx.inputs.length + 1]);
          assert.equal(meta.length, tms.count * 24, 'batch buyer metadata length differs from TMS update count');
          let allocated = 0n;
          const shares = [];
          for (let i = 0; i < tms.count; i++) {
            const q = meta.readBigUInt64LE(i * 24);
            const maxPrice = meta.readBigUInt64LE(i * 24 + 8);
            const share = meta.readBigUInt64LE(i * 24 + 16);
            const row = tms.updates.find(update => update.owner.toLowerCase() === hashScript(inputs[4 + i].lock));
            assert(row, `${event.label} batch participant has no authenticated owner update`);
            assert.equal(leafBalance(row.next) - leafBalance(row.old), q, `${event.label} owner quantity differs from batch metadata`);
            const participantPrice = curvePrice(base, step, q, supply - before + allocated);
            assert(participantPrice <= maxPrice, `${event.label} buyer signed price bound is exceeded`);
            assert.equal(inputs[4 + i].capacity - outputCells[4 + i].capacity, participantPrice + share,
              `${event.label} participant capacity does not pay exact curve price plus fee share`);
            price += participantPrice;
            quantity += q;
            allocated += q;
            shares.push(share);
          }
          assert.equal(before - after, quantity, `${event.label} market inventory decrease differs from batch allocation`);
          assert.equal(fee, shares.reduce((sum, share) => sum + share, 0n), `${event.label} transaction fee differs from declared buyer shares`);
        } else {
          assert(after > before, 'curve sell must restore market inventory');
          quantity = after - before;
          const ownerDelta = tms.updates.reduce((sum, update) => sum + leafBalance(update.old) - leafBalance(update.next), 0n);
          assert.equal(ownerDelta, quantity, `${event.label} seller entitlement delta differs from returned inventory`);
          price = curvePrice(base, step, quantity, supply - before - quantity);
          const sellerInput = inputs[4], sellerOutput = outputCells[4];
          assert.equal(sellerInput.lockHash, tms.updates[0].owner.toLowerCase(), `${event.label} payout input is not the authenticated owner`);
          assert.equal(sellerOutput.lockHash, sellerInput.lockHash, `${event.label} curve payout changed owner lock`);
          assert.equal(sellerOutput.capacity - sellerInput.capacity, price - fee,
            `${event.label} seller capacity delta differs from exact reserve payout minus fee`);
          totalSellPayout += price;
        }
        const marketDelta = marketOutput.capacity - marketInput.capacity;
        const expectedMarketDelta = tms.op === 4 ? -price : price;
        assert.equal(marketDelta, expectedMarketDelta, `${event.label} market reserve movement differs from curve price`);
        if (tms.op !== 4) totalBuyPrice += price;
        const marketOutIndex = outputCells.indexOf(marketOutput);
        const markerOutIndex = outputCells.indexOf(markerOutput);
        currentMarket.point = pointKey(event.hash, marketOutIndex);
        currentMarket.inventory = after;
        currentMarket.capacity = marketOutput.capacity;
        currentMarket.markerPoint = pointKey(event.hash, markerOutIndex);
        currentMarket.markerCapacity = markerOutput.capacity;
        marketRecord = {
          quantity: quantity.toString(), price_shannons: price.toString(), reserve_capacity_delta: marketDelta.toString(),
          inventory_before: before.toString(), inventory_after: after.toString(),
          capacity_before: marketInput.capacity.toString(), capacity_after: marketOutput.capacity.toString(),
        };
      } else {
        assert.equal(inputs.filter(cell => cell.lockHash === marketHash && cell.typeHash === tokenHash).length, 0,
          `${event.label} unexpectedly spends market inventory`);
      }

      if (tms.op === 5) {
        const delta = tms.updates.reduce((sum, update) => sum + leafBalance(update.old) - leafBalance(update.next), 0n);
        const externalOutputs = outputCells.filter(cell => cell.typeHash === tokenHash && cell.lockHash !== marketHash && cell.lockHash !== custodyHash);
        const withdrawal = expectOne(externalOutputs, `${event.label} external xUDT output`);
        assert.equal(tokenAmount(withdrawal.data), delta, `${event.label} external xUDT amount differs from entitlement withdrawal`);
        assert.equal(withdrawal.lockHash, tms.updates[0].owner.toLowerCase(), `${event.label} withdrawal output is not owner controlled`);
      }
      if (tms.op === 8) {
        assert.equal(tms.extra.length, 210, `${event.label} offline order extra has wrong length`);
        const payoutLock = `0x${tms.extra.subarray(80, 112).toString('hex')}`;
        const minimum = tms.extra.readBigUInt64LE(8);
        assert.equal(outputCells[3].lockHash, payoutLock.toLowerCase(), `${event.label} payout differs from signed order lock`);
        assert(BigInt(outputCells[3].capacity) >= minimum, `${event.label} payout is below signed minimum`);
      }
    } else if (event.label === 'external_xudt_curve_redemption') {
      const marketInput = expectOne(inputs.filter(cell => cell.lockHash === marketHash && cell.typeHash === tokenHash),
        `${event.label} market inventory input`);
      const marketOutput = expectOne(outputCells.filter(cell => cell.lockHash === marketHash && cell.typeHash === tokenHash),
        `${event.label} market inventory output`);
      const markerInput = expectOne(inputs.filter(cell => cell.lockHash === marketHash && cell.typeHash === marketMarkerHash),
        `${event.label} market marker input`);
      const markerOutput = expectOne(outputCells.filter(cell => cell.lockHash === marketHash && cell.typeHash === marketMarkerHash),
        `${event.label} market marker output`);
      assert(currentMarket.point, `${event.label} precedes market initialization`);
      assert.equal(inputCells.filter(value => value.key === currentMarket.point).length, 1,
        `${event.label} does not consume prior market inventory singleton`);
      assert.equal(inputCells.filter(value => value.key === currentMarket.markerPoint).length, 1,
        `${event.label} does not consume prior market marker singleton`);
      assert.equal(marketInput.capacity, currentMarket.capacity, `${event.label} market reserve capacity breaks lineage`);
      assert.equal(markerInput.capacity, currentMarket.markerCapacity, `${event.label} marker capacity breaks lineage`);
      const beforeData = dataBytes(marketInput.data), afterData = dataBytes(marketOutput.data);
      assert.equal(beforeData.length, 48);
      assert.equal(afterData.length, 48);
      assert.equal(beforeData.subarray(16).toString('hex'), custodyMarkerHash.slice(2));
      assert.equal(afterData.subarray(16).toString('hex'), custodyMarkerHash.slice(2));
      assert.equal(markerInput.capacity, markerOutput.capacity);
      assert.equal(dataBytes(markerInput.data).toString('hex'), dataBytes(markerOutput.data).toString('hex'),
        `${event.label} changes the market marker identity`);
      const markerPayload = dataBytes(markerOutput.data);
      assert.equal(markerPayload.subarray(0, 32).toString('hex'), marketHash.slice(2));
      assert.equal(markerPayload.subarray(32, 64).toString('hex'), tokenHash.slice(2));

      const before = tokenAmount(marketInput.data), after = tokenAmount(marketOutput.data);
      const externalInput = expectOne(inputs.filter(cell => cell.typeHash === tokenHash &&
        cell.lockHash !== marketHash && cell.lockHash !== custodyHash), `${event.label} external xUDT input`);
      const externalOutput = expectOne(outputCells.filter(cell => cell.typeHash === tokenHash &&
        cell.lockHash !== marketHash && cell.lockHash !== custodyHash), `${event.label} external xUDT output`);
      const quantity = tokenAmount(externalInput.data);
      assert.equal(externalOutput.lockHash, externalInput.lockHash, `${event.label} changes the external xUDT owner lock`);
      assert.equal(tokenAmount(externalOutput.data), 0n, `${event.label} must consume the withdrawn xUDT amount`);
      assert.equal(after - before, quantity, `${event.label} inventory increase differs from redeemed xUDT`);
      const price = curvePrice(base, step, quantity, supply - before - quantity);
      const sellerInput = expectOne(inputs.filter(cell => cell.typeHash === null && cell.lockHash === externalInput.lockHash),
        `${event.label} seller fee input`);
      const sellerOutput = expectOne(outputCells.filter(cell => cell.typeHash === null && cell.lockHash === externalInput.lockHash),
        `${event.label} seller payout`);
      assert.equal(sellerOutput.capacity - sellerInput.capacity, price - fee,
        `${event.label} payout differs from curve reserve less actual fee`);
      assert.equal(marketOutput.capacity - marketInput.capacity, -price,
        `${event.label} reserve movement differs from curve price`);
      totalSellPayout += price;
      currentMarket.point = pointKey(event.hash, outputCells.indexOf(marketOutput));
      currentMarket.inventory = after;
      currentMarket.capacity = marketOutput.capacity;
      currentMarket.markerPoint = pointKey(event.hash, outputCells.indexOf(markerOutput));
      currentMarket.markerCapacity = markerOutput.capacity;
      marketRecord = {
        quantity: quantity.toString(), price_shannons: price.toString(),
        reserve_capacity_delta: (-price).toString(), inventory_before: before.toString(),
        inventory_after: after.toString(), capacity_before: marketInput.capacity.toString(),
        capacity_after: marketOutput.capacity.toString(),
      };
    }

    if (currentCustody.point !== null && currentMarket.point !== null) {
      const externalTotal = [...externalByLock.entries()]
        .filter(([lockHash]) => lockHash !== marketHash && lockHash !== custodyHash)
        .reduce((sum, [, amount]) => sum + amount, 0n);
      assert.equal(currentMarket.inventory + currentCustody.amount + externalTotal, supply,
        `${event.label} inventory + custody + external xUDT does not equal fixed supply`);
      assert.equal(globalAssetSupply, supply, `${event.label} total live xUDT supply differs from fixed supply`);
      const canonical = canonicalByHash.get(event.hash.toLowerCase());
      accounting.push({
        label: event.label, hash: event.hash,
        canonical_block: canonical?.block_number ?? event.committed.tx_status.block_number,
        canonical_tx_index: canonical?.tx_index ?? null, operation: tms?.op ?? null, updated_owners: tms?.count ?? 0,
        custody_amount: currentCustody.amount.toString(),
        owner_entitlements: tms ? ownerTotalsByTransition.get(event.hash.toLowerCase()).toString() : null,
        market_inventory: currentMarket.inventory.toString(), external_xudt: externalTotal.toString(), fixed_supply: supply.toString(),
        market: marketRecord, transaction_fee_shannons: fee.toString(), serialized_bytes: Buffer.from(serialized.slice(2), 'hex').length,
        market_capacity_shannons: currentMarket.capacity?.toString() ?? null,
      });
    }

    for (const { key } of inputCells) cells.delete(key);
    for (let i = 0; i < outputCells.length; i++) cells.set(pointKey(event.hash, i), outputCells[i]);
  }

  assert.equal(accounting.filter(row => row.operation !== null).length, transitionHistory.length);
  assert.equal(authenticatedOwners.size, summary.owners, 'unique owner identities reconstructed from canonical witnesses differ from run owner count');
  assert.equal(currentCustody.point, pointKey(summary.finalCustody.txHash, summary.finalCustody.index));
  assert.equal(currentMarket.point, pointKey(summary.finalMarket.txHash, summary.finalMarket.index));
  assert.equal(currentCustody.amount, BigInt(summary.internalEntitlements));
  assert.equal(currentMarket.inventory, BigInt(summary.marketInventory));
  assert.equal(currentMarket.capacity, BigInt(summary.finalMarketCapacity));
  const finalExternal = [...externalByLock.entries()]
    .filter(([lockHash]) => lockHash !== marketHash && lockHash !== custodyHash)
    .reduce((sum, [, amount]) => sum + amount, 0n);
  assert.equal(currentMarket.inventory + currentCustody.amount + finalExternal, supply);

  const marketOccupied = BigInt(8 * (sdk.cellOccupied(cells.get(currentMarket.point).output) + dataBytes(cells.get(currentMarket.point).data).length));
  const initialReserveCapacity = initialMarketCapacity - marketOccupied;
  const finalReserveCapacity = currentMarket.capacity - marketOccupied;
  const peakMarketRow = accounting.reduce((peak, row) =>
    BigInt(row.market_capacity_shannons || '0') > BigInt(peak.market_capacity_shannons || '0') ? row : peak);
  const ownerBatchRows = accounting.filter(row => row.operation === 2);
  assert.equal(finalReserveCapacity - initialReserveCapacity, totalBuyPrice - totalSellPayout,
    'net market reserve does not equal cumulative curve prices and payouts');

  const report = {
    format: 'trade-v2-combined-canonical-accounting-replay-v1',
    native_run: path.basename(runDir),
    canonical_bundle: path.basename(bundlePath),
    native_transactions: events.length,
    canonical_tms_transactions: transitionHistory.length,
    canonical_transaction_bodies_witnesses_matched: true,
    transaction_order: transitionOrder,
    independent_rust_merkle_replay: {
      verifier: 'gate2/recovery Rust verifier',
      transitions: recovery.transitions.length,
      authenticated_owner_identities: authenticatedOwners.size,
      final_root: recovery.ownership_root,
      final_entitlements: recovery.entitlement_total,
    },
    source_sha256: sourceHashes,
    accounting_verifier_sha256: sha256(fs.readFileSync(__filename)),
    fresh_elf_sha256: elfHashes,
    script_hashes: expectedHashes,
    fixed_supply: supply.toString(),
    final_market_inventory: currentMarket.inventory.toString(),
    final_custody_amount: currentCustody.amount.toString(),
    final_external_xudt: finalExternal.toString(),
    owner_batch_transactions: ownerBatchRows.length,
    owner_batch_updates: ownerBatchRows.reduce((sum, row) => sum + row.updated_owners, 0),
    peak_market_capacity_shannons: peakMarketRow.market_capacity_shannons,
    peak_market_capacity_transition: peakMarketRow.label,
    total_curve_buy_price_shannons: totalBuyPrice.toString(),
    total_curve_sell_payout_shannons: totalSellPayout.toString(),
    initial_market_capacity_shannons: initialMarketCapacity.toString(),
    final_market_capacity_shannons: currentMarket.capacity.toString(),
    initial_reserve_capacity_shannons: initialReserveCapacity.toString(),
    final_reserve_capacity_shannons: finalReserveCapacity.toString(),
    total_committed_transaction_fees_shannons: totalFee.toString(),
    total_estimated_ckb_vm_cycles: totalEstimatedCycles.toString(),
    max_transaction_estimated_ckb_vm_cycles: maxEstimatedCycles.toString(),
    serialized_transaction_bytes_total: txBytes,
    occupied_output_cells_checked: totalCapacityChecks,
    every_transition_conserved_supply_entitlements_inventory_external_tokens_and_reserve: true,
    every_transition_checked: accounting,
  };
  const out = path.join(path.dirname(bundlePath), 'combined-accounting-replay.json');
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    result: 'PASS', output: out, canonicalTransitions: transitionHistory.length,
    owners: authenticatedOwners.size, fixedSupply: supply.toString(),
    final: { inventory: currentMarket.inventory.toString(), custody: currentCustody.amount.toString(), external: finalExternal.toString() },
    reserve: { initial: initialReserveCapacity.toString(), final: finalReserveCapacity.toString() },
    peakMarketCapacity: { shannons: peakMarketRow.market_capacity_shannons, transition: peakMarketRow.label },
    ownerBatches: { transactions: ownerBatchRows.length, updates: ownerBatchRows.reduce((sum, row) => sum + row.updated_owners, 0) },
    totalFees: totalFee.toString(), occupiedOutputChecks: totalCapacityChecks,
  }, null, 2));
}

main();

const crypto = require('node:crypto');
globalThis.__smtAttackDirectory = "/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/trade-v2-token/gate2/security/evidence/native-smt-1794427785208";
const C = require(process.env.TRADE_NATIVE_ROOT + '/src/lib.cjs');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { ccc } = require(process.env.TRADE_NATIVE_ROOT + '/node_modules/@ckb-ccc/core');
const signGroup = require(process.env.TRADE_NATIVE_ROOT + '/node_modules/@nervosnetwork/ckb-sdk-core/lib/signWitnessGroup.js').default;
const { fs, UNIT, fee, hex, hx, b, le, hash, locks, keys, U } = C;

const out = "/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/trade-v2-token/gate2/security/evidence/native-smt-1794427785208";
const build = process.env.TRADE_GATE2_BUILD_DIR || path.join(__dirname, '..', 'build');
const ckbBin = process.env.CKB_BIN || path.join(C.ROOT, 'tools/ckb');
const rpcPort = Number(process.env.TRADE_ORDER_RPC_PORT || 19224);
const template = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'trade-gate2-order-template-')), 'chain');
const chain = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'trade-gate2-order-chain-')), 'chain');
const SUPPLY = 2000n;
const ORDER_EXTRA_BYTES = 210;
fs.mkdirSync(out, { recursive: true });

function disposableKey() {
  for (;;) {
    const key = '0x' + require('node:crypto').randomBytes(32).toString('hex');
    try { U.privateKeyToPublicKey(key); return key; } catch {}
  }
}
for (let i = 0; i < 3; i++) {
  const key = disposableKey();
  keys.push(key);
  locks.push({ codeHash: locks[0].codeHash, hashType: 'type', args: '0x' + U.blake160(U.privateKeyToPublicKey(key), 'hex') });
}

let child, secp, rpcId = 0;
function record(file, value) {
  fs.appendFileSync(path.join(out, file), JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v) + '\n');
}
async function rpc(method, params = []) {
  const response = await fetch(`http://127.0.0.1:${rpcPort}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  });
  const json = await response.json();
  record('rpc.jsonl', { method, params, response: json });
  if (json.error) throw Error(JSON.stringify(json.error));
  return json.result;
}
const cell = (capacity, lock, type, data = '0x') => ({ capacity: BigInt(capacity), lock, type, data });
function tx(inputs, outputs, deps = []) {
  return {
    version: '0x0', cellDeps: [secp, ...deps], headerDeps: [],
    inputs: inputs.map(x => ({ previousOutput: x.outPoint, since: '0x0' })),
    outputs: outputs.map(x => ({ capacity: hex(x.capacity), lock: x.lock, ...(x.type ? { type: x.type } : {}) })),
    outputsData: outputs.map(x => x.data), witnesses: inputs.map(() => '0x'),
  };
}
function sign(t, inputs, role) {
  t = structuredClone(t);
  const indices = inputs.map((x, i) => U.scriptToHash(x.lock) === U.scriptToHash(locks[role]) ? i : -1).filter(i => i >= 0);
  assert(indices.length, `missing test signer ${role}`);
  const first = indices[0], group = [{ lock: '', inputType: '', outputType: '' }, ...indices.slice(1).map(i => t.witnesses[i]), ...t.witnesses.slice(inputs.length)];
  t.witnesses[first] = signGroup(keys[role], U.rawTransactionToHash(t), group)[0];
  return t;
}
async function commit(label, signed) {
  const cycles = await rpc('estimate_cycles', [C.snake(signed)]);
  const txHash = await rpc('send_transaction', [C.snake(signed), 'passthrough']);
  let result;
  for (let i = 0; i < 60; i++) {
    result = await rpc('get_transaction', [txHash]);
    if (result.tx_status.status === 'committed') break;
    await rpc('generate_block');
  }
  assert.equal(result.tx_status.status, 'committed', `${label} not committed`);
  record('events.jsonl', { label, hash: txHash, cycles, tx: signed, committed: result });
  console.log(`${label} ${txHash} cycles=${cycles.cycles}`);
  return signed.outputs.map((x, i) => ({ ...x, capacity: BigInt(x.capacity), data: signed.outputsData[i], outPoint: { txHash, index: hex(i) } }));
}
async function reject(label, signed, expectedCode) {
  let error;
  try { await rpc('estimate_cycles', [C.snake(signed)]); } catch (e) { error = e; }
  assert(error, `${label} was accepted`);
  const json = JSON.parse(error.message);
  assert.match(json.message, new RegExp(`ValidationFailure: see error code ${expectedCode}\\b`), json.message);
  record('rejections.jsonl', { label, expectedCode, error: error.message, tx: signed });
  console.log(`rejected ${label} code=${expectedCode}`);
}
function proofInput(domain, op, owners, updates) {
  const row = x => ({ owner_lock_hash: x.owner, balance: String(x.balance), revision: String(x.revision), active: x.balance > 0n });
  return { domain, op, owners: owners.map(row), updates: updates.map(row) };
}
function makeProof(domain, op, owners, updates, extra = Buffer.alloc(0)) {
  const data = JSON.stringify(proofInput(domain, op, owners, updates));
  const result = execFileSync('cargo', [
    'run', '--quiet', '--locked', '--manifest-path', path.join(__dirname, '..', 'smt-tools', 'Cargo.toml'), '--', 'proof', '-', '-',
  ], { input: data, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const parsed = JSON.parse(result);
  return { root: parsed.new_root, witness: hx(Buffer.concat([b(parsed.contract_witness.hex), extra])) };
}
function custodyData(amount, root) { return hx(Buffer.concat([le(amount, 16), b(root)])); }
function orderMessage(domain, custodyHash, seller, revision, quantity, minimum, payout, orderId) {
  return `TRADE V2 MERKLE TOKEN SALE v1\nGenesis: ${domain.genesis_hash}\nMarket: ${domain.market_script_hash}\nAsset: ${domain.xudt_type_script_hash}\nCustody: ${custodyHash}\nSeller: ${seller}\nRevision: ${revision}\nQuantity: ${quantity}\nMinimum shannons: ${minimum}\nPayout: ${payout}\nOrder id: ${orderId}\nBuyer: any\nExpiry: none`;
}
async function signedOrder(domain, custodyHash, sellerRole, seller, revision, quantity, minimum, payout, orderId) {
  const message = orderMessage(domain, custodyHash, seller, revision, quantity, minimum, payout, orderId);
  const signer = new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(), keys[sellerRole]);
  const signature = b(await signer.signMessageRaw(message));
  const publicKey = b(ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(message), hx(signature)));
  assert.equal(signature.length, 65);
  assert.equal(publicKey.length, 33);
  const extra = Buffer.concat([le(quantity), le(minimum), b(orderId), b(seller), b(payout), publicKey, signature]);
  assert.equal(extra.length, ORDER_EXTRA_BYTES);
  return { extra, signature, publicKey };
}
const ZERO32 = Buffer.alloc(32);
const cloneRows = rows => rows.map(x => ({ ...x }));

async function main() {
  execFileSync(process.execPath, [path.join(C.ROOT, 'src/setup.cjs'), template], { stdio: 'inherit' });
  const spec = fs.readFileSync(path.join(template, 'specs/dev.toml'), 'utf8');
  const names = ['marker_candidate', 'market_smt', 'owner_lineage_candidate', 'custody_smt', 'custody_marker'];
  fs.writeFileSync(path.join(out, 'dev.toml'), spec);
  fs.mkdirSync(chain, { recursive: true });
  for (const name of ['limit_order', 'xudt', 'ickb_logic', 'owned_owner']) {
    fs.copyFileSync(path.join(template, name), path.join(chain, name));
  }
  execFileSync(ckbBin, ['init', '-C', chain, '--chain', 'dev', '--force', '--import-spec', path.join(template, 'specs/dev.toml'),
    '--rpc-port', String(rpcPort), '--p2p-port', String(rpcPort + 1)], { stdio: 'inherit' });
  const runConfig = fs.readFileSync(path.join(template, 'ckb.toml'), 'utf8').replaceAll('19224', '19234').replaceAll('19225', '19235');
  fs.writeFileSync(path.join(chain, 'ckb.toml'), runConfig);
  const ckbConfig = fs.readFileSync(path.join(chain, 'ckb.toml'), 'utf8')
    .replace(/127\.0\.0\.1:19224/g, `127.0.0.1:${rpcPort}`)
    .replace(/\/ip4\/127\.0\.0\.1\/tcp\/19225/g, `/ip4/127.0.0.1/tcp/${rpcPort + 1}`);
  fs.writeFileSync(path.join(chain, 'ckb.toml'), ckbConfig);
  fs.copyFileSync(path.join(template, 'specs/dev.toml'), path.join(chain, 'specs/dev.toml'));
  child = spawn(ckbBin, ['run', '-C', chain, '--ba-advanced'], {
    stdio: ['ignore', fs.openSync(path.join(out, 'node.log'), 'w'), 'ignore'],
  });
  let ready = false;
  for (let i = 0; i < 180; i++) {
    try { await rpc('get_tip_header'); ready = true; break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert(ready, 'CKB 0.210.0 dev chain did not start');

  const genesis = await rpc('get_block_by_number', ['0x0']);
  secp = { outPoint: { txHash: genesis.transactions[1].hash, index: '0x0' }, depType: 'depGroup' };
  const hashes = Object.fromEntries(names.map(name => [name, hash(fs.readFileSync(path.join(build, name)))]));
  hashes.xudt = hash(fs.readFileSync(path.join(C.ROOT, 'vendor/ickb/build/release/xudt')));
  const deps = {}, wallets = [];
  for (const blockTx of genesis.transactions) for (let i = 0; i < blockTx.outputs.length; i++) {
    const dataHash = hash(b(blockTx.outputs_data[i]));
    if (dataHash === hashes.xudt) deps.xudt = { outPoint: { txHash: blockTx.hash, index: hex(i) }, depType: 'code' };
    for (let role = 0; role < 3; role++) if (blockTx.outputs[i].lock.args === locks[role].args) {
      wallets[role] = { ...C.camel(blockTx.outputs[i]), capacity: BigInt(blockTx.outputs[i].capacity), data: blockTx.outputs_data[i], outPoint: { txHash: blockTx.hash, index: hex(i) } };
    }
  }
  assert(deps.xudt, `missing xUDT code cell ${hashes.xudt}`);
  for (let i = 0; i < 12; i++) await rpc('generate_block');

  const codeCapacity = 100_000n * UNIT;
  const codeCells = names.map(name => cell(codeCapacity, locks[2], undefined, hx(fs.readFileSync(path.join(build, name)))));
  const deployInputs = [wallets[2]];
  const deployTx = tx(deployInputs, [
    ...codeCells, cell(wallets[2].capacity - BigInt(names.length) * codeCapacity - fee, locks[2]),
  ]);
  const deployed = await commit('deploy_fresh_gate2_elf_code_cells', sign(deployTx, deployInputs, 2));
  for (let i = 0; i < names.length; i++) deps[names[i]] = { outPoint: deployed[i].outPoint, depType: 'code' };
  const setupFunding = deployed[names.length];

  const anchor = wallets[0], anchorBytes = Buffer.concat([b(anchor.outPoint.txHash), le(BigInt(anchor.outPoint.index), 4)]);
  const marker = { codeHash: hashes.marker_candidate, hashType: 'data1', args: hash(Buffer.concat([le(0), anchorBytes, le(1)])) };
  const market = { codeHash: hashes.market_smt, hashType: 'data1', args: hx(Buffer.concat([b(hash(anchorBytes)), le(10n * UNIT), le(UNIT), le(SUPPLY), b(U.scriptToHash(marker))])) };
  const owner = { codeHash: hashes.owner_lineage_candidate, hashType: 'data1', args: hx(Buffer.concat([anchorBytes, b(hashes.xudt), b(U.scriptToHash(market)), le(SUPPLY, 16)])) };
  const token = { codeHash: hashes.xudt, hashType: 'data1', args: U.scriptToHash(owner) };
  const marketMarkerData = hx(Buffer.concat([b(U.scriptToHash(market)), b(U.scriptToHash(token))]));
  const custodyMarker = { codeHash: hashes.custody_marker, hashType: 'data1', args: U.scriptToHash(market) };
  const custody = { codeHash: hashes.custody_smt, hashType: 'data1', args: hx(Buffer.concat([b(U.scriptToHash(market)), b(U.scriptToHash(token)), b(genesis.header.hash), b(U.scriptToHash(custodyMarker))])) };
  const custodyMarkerData = hx(Buffer.concat([b(U.scriptToHash(custody)), b(U.scriptToHash(token))]));
  const domain = { genesis_hash: genesis.header.hash, market_script_hash: U.scriptToHash(market), xudt_type_script_hash: U.scriptToHash(token), custody_marker_type_hash: U.scriptToHash(custodyMarker) };

  const setupTx = tx([setupFunding], [
    cell(200n * UNIT, owner), cell(2000n * UNIT, locks[3]), cell(2000n * UNIT, locks[4]), cell(1000n * UNIT, locks[5]), cell(200n * UNIT, owner),
    cell(setupFunding.capacity - 5400n * UNIT - fee, locks[2]),
  ]);
  const setup = await commit('fund_offline_seller_buyer_and_solver', sign(setupTx, [setupFunding], 2));
  const issueTx = tx([anchor, setup[0]], [
    cell(300n * UNIT, market, token, hx(le(SUPPLY, 16))), cell(300n * UNIT, market, marker, marketMarkerData),
    cell(anchor.capacity + setup[0].capacity - 600n * UNIT - fee, locks[0]),
  ], [deps.owner_lineage_candidate, deps.xudt, deps.marker_candidate]);
  const issued = await commit('issue_fixed_supply', sign(issueTx, [anchor, setup[0]], 0));

  const seller = U.scriptToHash(locks[3]), buyer = U.scriptToHash(locks[4]);
  const initial = makeProof(domain, 0, [], [{ owner: seller, balance: 7n, revision: 0n }], le(91n * UNIT));
  const initialTx = tx([issued[0], issued[1], setup[1]], [
    cell(issued[0].capacity + 91n * UNIT, market, token, hx(Buffer.concat([le(SUPPLY - 7n, 16), b(domain.custody_marker_type_hash)]))),
    cell(issued[1].capacity, market, marker, marketMarkerData), cell(350n * UNIT, custody, token, custodyData(7n, initial.root)),
    cell(350n * UNIT, custody, custodyMarker, custodyMarkerData), cell(setup[1].capacity - 91n * UNIT - 700n * UNIT - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  initialTx.headerDeps = [genesis.header.hash];
  initialTx.witnesses.push(initial.witness);
  const bought = await commit('offline_seller_initial_purchase', sign(initialTx, [issued[0], issued[1], setup[1]], 3));

  const rows0 = [{ owner: seller, balance: 7n, revision: 0n }];
  const enrollment = makeProof(domain, 1, rows0, [{ owner: buyer, balance: 2n, revision: 1n }]);
  const enrollTx = tx([bought[0], bought[1], bought[2], bought[3], setup[2]], [
    cell(bought[0].capacity + 35n * UNIT, market, token, hx(Buffer.concat([le(SUPPLY - 9n, 16), b(domain.custody_marker_type_hash)]))),
    cell(bought[1].capacity, market, marker, marketMarkerData), cell(bought[2].capacity, custody, token, custodyData(9n, enrollment.root)),
    cell(bought[3].capacity, custody, custodyMarker, custodyMarkerData), cell(setup[2].capacity - 35n * UNIT - fee, locks[4]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  enrollTx.headerDeps = [genesis.header.hash];
  enrollTx.witnesses.push(enrollment.witness);
  const enrolled = await commit('new_buyer_enrollment', sign(enrollTx, [bought[0], bought[1], bought[2], bought[3], setup[2]], 4));
  let rows = [...rows0, { owner: buyer, balance: 2n, revision: 1n }];
  let custodyCell = enrolled[2], markerCell = enrolled[3], buyerWallet = enrolled[4];

  const buyerCanceled = { owner: buyer, balance: 2n, revision: 2n };
  const cancelBuyer = makeProof(domain, 7, rows, [buyerCanceled]);
  const cancelBuyerInputs = [custodyCell, markerCell, buyerWallet];
  const cancelBuyerTx = tx(cancelBuyerInputs, [
    cell(custodyCell.capacity, custody, token, custodyData(9n, cancelBuyer.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData), cell(buyerWallet.capacity - fee, locks[4]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  cancelBuyerTx.witnesses.push(cancelBuyer.witness);
  const buyerCanceledCells = await commit('unrelated_buyer_revision_change', sign(cancelBuyerTx, cancelBuyerInputs, 4));
  rows[1] = buyerCanceled;
  custodyCell = buyerCanceledCells[0]; markerCell = buyerCanceledCells[1]; buyerWallet = buyerCanceledCells[2];

  const minProceeds = 70n * UNIT, quantity = 3n, orderId = '0x' + 'a1'.repeat(32), payout = seller;
  const order = await signedOrder(domain, U.scriptToHash(custody), 3, seller, 0n, quantity, minProceeds, payout, orderId);
  const sellerAfter = { owner: seller, balance: 4n, revision: 1n };
  const buyerAfter = { owner: buyer, balance: 5n, revision: 3n };
  const transferRows = makeProof(domain, 8, rows, [sellerAfter, buyerAfter], order.extra);
  function fillTransaction(proof, payer = buyerWallet, sellerOutputLock = locks[3], payoutCapacity = minProceeds,
                           payerChange = payer.capacity - minProceeds - fee) {
    const inputs = [custodyCell, markerCell, payer];
    const fill = tx(inputs, [
      cell(custodyCell.capacity, custody, token, custodyData(9n, proof.root)),
      cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData),
      cell(payerChange, locks[4]), cell(payoutCapacity, sellerOutputLock),
    ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
    fill.headerDeps = [genesis.header.hash];
    fill.witnesses.push(proof.witness);
    return { inputs, fill };
  }
  const good = fillTransaction(transferRows);
  const badPayout = fillTransaction(transferRows, buyerWallet, locks[5]);
  await reject('signed_payout_lock_redirect', sign(badPayout.fill, badPayout.inputs, 4), 34);
  const shortBy = UNIT;
  const badMinimum = fillTransaction(transferRows, buyerWallet, locks[3], minProceeds - shortBy,
    buyerWallet.capacity - minProceeds + shortBy - fee);
  await reject('minimum_proceeds_underpayment', sign(badMinimum.fill, badMinimum.inputs, 4), 34);
  const badSignature = structuredClone(good.fill);
  const orderWitness = b(badSignature.witnesses[3]);
  orderWitness[orderWitness.length - 1] ^= 1;
  badSignature.witnesses[3] = hx(orderWitness);
  await reject('tampered_offline_signature', sign(badSignature, good.inputs, 4), 38);

  const filled = await commit('offline_order_fill_after_unrelated_root_change', sign(good.fill, good.inputs, 4));
  rows = [sellerAfter, buyerAfter];
  custodyCell = filled[0]; markerCell = filled[1];
  const solverRemainder = filled[2];

  const replaySeller = { owner: seller, balance: 1n, revision: 2n };
  const replayBuyer = { owner: buyer, balance: 8n, revision: 4n };
  const replayProof = makeProof(domain, 8, rows, [replaySeller, replayBuyer], order.extra);
  const originalOrderReplay = fillTransaction(replayProof, solverRemainder);
  const replaySigned = sign(originalOrderReplay.fill, originalOrderReplay.inputs, 4);
  await reject('consumed_order_revision_replay', replaySigned, 38);

  const secondOrder = await signedOrder(domain, U.scriptToHash(custody), 3, seller, 1n, 1n, minProceeds, payout, '0x' + 'b2'.repeat(32));
  const canceledSeller = { owner: seller, balance: 4n, revision: 2n };
  const cancelSellerProof = makeProof(domain, 7, rows, [canceledSeller]);
  const sellerWallet = bought[4];
  const cancelSellerInputs = [custodyCell, markerCell, sellerWallet];
  const cancelSellerTx = tx(cancelSellerInputs, [
    cell(custodyCell.capacity, custody, token, custodyData(9n, cancelSellerProof.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData), cell(sellerWallet.capacity - fee, locks[3]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  cancelSellerTx.witnesses.push(cancelSellerProof.witness);
  const canceledSellerCells = await commit('seller_owner_cancels_next_revision', sign(cancelSellerTx, cancelSellerInputs, 3));
  rows = [canceledSeller, buyerAfter]; custodyCell = canceledSellerCells[0]; markerCell = canceledSellerCells[1];
  const canceledRows = makeProof(domain, 8, rows, [
    { owner: seller, balance: 3n, revision: 3n }, { owner: buyer, balance: 6n, revision: 4n },
  ], secondOrder.extra);
  const canceledReplay = tx([custodyCell, markerCell, solverRemainder], [
    cell(custodyCell.capacity, custody, token, custodyData(9n, canceledRows.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(solverRemainder.capacity - minProceeds - fee, locks[4]), cell(minProceeds, locks[3]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  canceledReplay.headerDeps = [genesis.header.hash]; canceledReplay.witnesses.push(canceledRows.witness);
  await reject('canceled_order_revision_replay', sign(canceledReplay, [custodyCell, markerCell, solverRemainder], 4), 38);


  const smtAttackDirectory = globalThis.__smtAttackDirectory;
  function smtAttackCellData(amount, root) {
    return hx(Buffer.concat([le(amount, 16), b(root)]));
  }
  async function expectCustodyReject(label, signed, expectedCode = 8, alteredCondition = label) {
    const rawTransactionHash = U.rawTransactionToHash(signed);
    const fullSignedTransactionSha256 = crypto.createHash('sha256').update(JSON.stringify(signed)).digest('hex');
    const witnessesSha256 = crypto.createHash('sha256').update(JSON.stringify(signed.witnesses)).digest('hex');
    let error;
    try {
      await rpc('estimate_cycles', [C.snake(signed)]);
    } catch (e) {
      error = e;
    }
    assert(error, label + ' was accepted by CKB-VM');
    const details = JSON.parse(error.message);
    const message = details.message || '';
    assert.match(message, new RegExp('source: Inputs\\[\\d+\\]\\.Lock, cause: ValidationFailure: see error code ' + expectedCode + '\\b'), message);
    assert(message.includes(hashes.custody_smt.slice(2)), 'rejection did not identify the fresh custody_smt code hash: ' + message);
    let broadcastError;
    try {
      await rpc('send_transaction', [C.snake(signed), 'passthrough']);
    } catch (e) {
      broadcastError = e;
    }
    assert(broadcastError, label + ' unexpectedly entered the transaction pool');
    const recordValue = {
      label,
      rawTransactionHash,
      fullSignedTransactionSha256,
      witnessesSha256,
      rejectingSource: 'Inputs[0].Lock',
      rejectingCode: expectedCode,
      rejectingCodeHash: hashes.custody_smt,
      alteredCondition,
      estimateCyclesError: error.message,
      sendTransactionError: broadcastError.message,
      transaction: signed,
    };
    record('smt-attacks.jsonl', recordValue);
    fs.writeFileSync(path.join(smtAttackDirectory, label + '.json'), JSON.stringify(recordValue, null, 2));
    console.log('rejected ' + label + ' ' + rawTransactionHash + ' custody_smt:' + expectedCode);
  }
  async function expectMarketReject(label, signed, expectedCode, alteredCondition) {
    const rawTransactionHash = U.rawTransactionToHash(signed);
    const fullSignedTransactionSha256 = crypto.createHash('sha256').update(JSON.stringify(signed)).digest('hex');
    const witnessesSha256 = crypto.createHash('sha256').update(JSON.stringify(signed.witnesses)).digest('hex');
    let error;
    try { await rpc('estimate_cycles', [C.snake(signed)]); } catch (e) { error = e; }
    assert(error, label + ' was accepted by CKB-VM');
    const details = JSON.parse(error.message);
    const message = details.message || '';
    assert.match(message, new RegExp('source: Inputs\\[\\d+\\]\\.Lock, cause: ValidationFailure: see error code ' + expectedCode + '\\b'), message);
    assert(message.includes(hashes.market_smt.slice(2)), 'rejection did not identify the fresh market_smt code hash: ' + message);
    let broadcastError;
    try { await rpc('send_transaction', [C.snake(signed), 'passthrough']); } catch (e) { broadcastError = e; }
    assert(broadcastError, label + ' unexpectedly entered the transaction pool');
    const recordValue = {
      label, rawTransactionHash, fullSignedTransactionSha256, witnessesSha256,
      rejectingSource: 'Inputs[0].Lock', rejectingCode: expectedCode,
      rejectingCodeHash: hashes.market_smt, alteredCondition,
      estimateCyclesError: error.message, sendTransactionError: broadcastError.message, transaction: signed,
    };
    record('market-attacks.jsonl', recordValue);
    fs.writeFileSync(path.join(smtAttackDirectory, label + '.json'), JSON.stringify(recordValue, null, 2));
    console.log('rejected ' + label + ' ' + rawTransactionHash + ' market_smt:' + expectedCode);
  }
  async function expectSellerFeeCapReject(label, signed, alteredCondition) {
    const rawTransactionHash = U.rawTransactionToHash(signed);
    const fullSignedTransactionSha256 = crypto.createHash('sha256').update(JSON.stringify(signed)).digest('hex');
    const witnessesSha256 = crypto.createHash('sha256').update(JSON.stringify(signed.witnesses)).digest('hex');
    let error;
    try { await rpc('estimate_cycles', [C.snake(signed)]); } catch (e) { error = e; }
    assert(error, label + ' was accepted by CKB-VM');
    const details = JSON.parse(error.message);
    const message = details.message || '';
    const marketHit = /source: Inputs\[\d+\]\.Lock, cause: ValidationFailure: see error code 28\b/.test(message) &&
      message.includes(hashes.market_smt.slice(2));
    const custodyHit = /source: Inputs\[\d+\]\.Lock, cause: ValidationFailure: see error code 6\b/.test(message) &&
      message.includes(hashes.custody_smt.slice(2));
    assert(marketHit || custodyHit, 'seller underpayment did not hit the curve payout or custody fee-cap guard: ' + message);
    let sendError;
    try { await rpc('send_transaction', [C.snake(signed), 'passthrough']); } catch (e) { sendError = e; }
    assert(sendError, label + ' unexpectedly entered the transaction pool');
    const rejectingCode = marketHit ? 28 : 6;
    const rejectingCodeHash = marketHit ? hashes.market_smt : hashes.custody_smt;
    const value = {
      label, rawTransactionHash, fullSignedTransactionSha256, witnessesSha256,
      rejectingSource: message.match(/source: (Inputs\[\d+\]\.Lock)/)[1], rejectingCode,
      rejectingCodeHash, alteredCondition, estimateCyclesError: error.message,
      sendTransactionError: sendError.message, transaction: signed,
    };
    record('market-attacks.jsonl', value);
    fs.writeFileSync(path.join(smtAttackDirectory, label + '.json'), JSON.stringify(value, null, 2));
    console.log('rejected ' + label + ' ' + rawTransactionHash + ' fee-cap:' + rejectingCodeHash);
  }
  async function recordAcceptedControl(label, signed, targetScript) {
    const cycles = await rpc('estimate_cycles', [C.snake(signed)]);
    const value = {
      label,
      rawTransactionHash: U.rawTransactionToHash(signed),
      fullSignedTransactionSha256: crypto.createHash('sha256').update(JSON.stringify(signed)).digest('hex'),
      witnessesSha256: crypto.createHash('sha256').update(JSON.stringify(signed.witnesses)).digest('hex'),
      targetScript,
      codeHash: targetScript === 'market_smt' ? hashes.market_smt : hashes.custody_smt,
      estimateCycles: cycles,
      transaction: signed,
    };
    record('positive-controls.jsonl', value);
    fs.writeFileSync(path.join(smtAttackDirectory, label + '.json'), JSON.stringify(value, null, 2));
    return cycles;
  }

  // A real operation-1 purchase is the positive control and leaves a live,
  // freshly authenticated owner state for both rejected mutations below.
  const buyerAfterAdditionalBuy = { owner: buyer, balance: 6n, revision: 4n };
  const positiveBuyProof = makeProof(domain, 1, rows, [buyerAfterAdditionalBuy]);
  const purchaseInputs = [enrolled[0], enrolled[1], custodyCell, markerCell, solverRemainder];
  const additionalBuy = tx(purchaseInputs, [
    cell(enrolled[0].capacity + 19n * UNIT, market, token,
      hx(Buffer.concat([le(SUPPLY - 10n, 16), b(domain.custody_marker_type_hash)]))),
    cell(enrolled[1].capacity, market, marker, marketMarkerData),
    cell(custodyCell.capacity, custody, token, custodyData(10n, positiveBuyProof.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(solverRemainder.capacity - 19n * UNIT - fee, locks[4]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  additionalBuy.headerDeps = [genesis.header.hash];
  additionalBuy.witnesses.push(positiveBuyProof.witness);
  const additionalBuyResult = await commit('smt_attack_positive_control_additional_purchase', sign(additionalBuy, purchaseInputs, 4));
  rows[1] = buyerAfterAdditionalBuy;
  const attackCustody = additionalBuyResult[2], attackMarker = additionalBuyResult[3], attackBuyerWallet = additionalBuyResult[4];

  const solverOwner = U.scriptToHash(locks[5]);
  const solverEnrollment = { owner: solverOwner, balance: 1n, revision: 1n };
  const validEnrollmentProof = makeProof(domain, 1, rows, [solverEnrollment]);
  const attackFunding = setup[3];
  const attackInputs = [attackCustody, attackMarker, attackFunding];

  function proofBytes(proof) { return b(proof.witness); }
  function updateOffset(witness, ownerHash) {
    const count = witness[6];
    for (let i = 0; i < count; i++) {
      const start = 12 + i * 96;
      if (witness.subarray(start, start + 32).equals(b(ownerHash))) return start;
    }
    throw new Error('owner missing from TMS1 witness: ' + ownerHash);
  }
  function rawRevisionProof(owner, balance, revision) {
    const input = JSON.stringify(proofInput(domain, 1, rows, [{ owner, balance, revision }]));
    const raw = execFileSync('cargo', [
      'run', '--quiet', '--locked', '--manifest-path', path.join(__dirname, '..', 'smt-tools', 'Cargo.toml'), '--',
      'proof-adversarial-revision', '-', '-',
    ], { input, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    const parsed = JSON.parse(raw);
    return { root: parsed.new_root, witness: hx(b(parsed.contract_witness.hex)) };
  }

  // Keep the authenticated leaf update and declared xUDT quantity consistent,
  // but corrupt a byte inside the compiled proof.
  const tamperedProof = structuredClone(validEnrollmentProof);
  const tamperedWitness = b(tamperedProof.witness);
  const updateCount = tamperedWitness[6] | (tamperedWitness[7] << 8);
  const proofStart = 12 + updateCount * 96;
  assert(proofStart < tamperedWitness.length, 'compiled multiproof unexpectedly empty');
  tamperedWitness[proofStart] ^= 1;
  tamperedProof.witness = hx(tamperedWitness);
  const tamperedTx = tx(attackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - fee, locks[5]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  tamperedTx.headerDeps = [genesis.header.hash];
  tamperedTx.witnesses.push(tamperedProof.witness);
  await expectCustodyReject('tampered_compiled_multiproof', sign(tamperedTx, attackInputs, 5), 8,
    'one compiled multiproof opcode bit flipped; old/new roots otherwise declared from valid enrollment');

  // Claim an active old leaf for the solver even though its key is absent from
  // the committed root. The forged leaf remains canonical, so the CSMT check
  // must reject the root rather than the TMS1 parser.
  const forgedMembershipProof = structuredClone(validEnrollmentProof);
  const forgedMembershipWitness = proofBytes(forgedMembershipProof);
  const membershipStart = updateOffset(forgedMembershipWitness, solverOwner);
  forgedMembershipWitness.fill(0, membershipStart + 32, membershipStart + 64);
  forgedMembershipWitness[membershipStart + 32] = 1;
  forgedMembershipWitness[membershipStart + 48] = 1;
  forgedMembershipProof.witness = hx(forgedMembershipWitness);
  const forgedMembershipTx = tx(attackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - fee, locks[5]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  forgedMembershipTx.headerDeps = [genesis.header.hash];
  forgedMembershipTx.witnesses.push(forgedMembershipProof.witness);
  await expectCustodyReject('forged_membership_claim_for_absent_solver', sign(forgedMembershipTx, attackInputs, 5), 8,
    'old leaf changed from canonical absence to active balance 1 revision 0 without changing the committed old root');

  // Conversely, claim absence for the already enrolled buyer while using a
  // real next-state proof and matching +1 custody quantity.
  const buyerAfterBuy = { owner: buyer, balance: 7n, revision: 5n };
  const validBuyerBuyProof = makeProof(domain, 1, rows, [buyerAfterBuy]);
  const forgedNonMembershipProof = structuredClone(validBuyerBuyProof);
  const forgedNonMembershipWitness = proofBytes(forgedNonMembershipProof);
  const buyerEntry = updateOffset(forgedNonMembershipWitness, buyer);
  forgedNonMembershipWitness.fill(0, buyerEntry + 32, buyerEntry + 64);
  forgedNonMembershipProof.witness = hx(forgedNonMembershipWitness);
  const buyerAttackInputs = [attackCustody, attackMarker, attackBuyerWallet];
  const forgedNonMembershipTx = tx(buyerAttackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, validBuyerBuyProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackBuyerWallet.capacity - fee, locks[4]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  forgedNonMembershipTx.headerDeps = [genesis.header.hash];
  forgedNonMembershipTx.witnesses.push(forgedNonMembershipProof.witness);
  await expectCustodyReject('forged_nonmembership_claim_for_enrolled_buyer', sign(forgedNonMembershipTx, buyerAttackInputs, 4), 8,
    'old leaf changed from enrolled buyer balance 6 revision 4 to canonical absence while output root and custody delta claim balance 7');

  // A canonical-shape check is distinct from a Merkle root failure.
  const invalidNewLeafProof = structuredClone(validEnrollmentProof);
  const invalidNewLeafWitness = proofBytes(invalidNewLeafProof);
  invalidNewLeafWitness[membershipStart + 64 + 16] = 3;
  invalidNewLeafProof.witness = hx(invalidNewLeafWitness);
  const invalidNewLeafTx = tx(attackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - fee, locks[5]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  invalidNewLeafTx.headerDeps = [genesis.header.hash];
  invalidNewLeafTx.witnesses.push(invalidNewLeafProof.witness);
  await expectCustodyReject('invalid_new_leaf_state_tag', sign(invalidNewLeafTx, attackInputs, 5), 7,
    'new active entitlement leaf state tag changed from 1 to non-canonical value 3');

  // Build a proof with correct roots but a skipped revision. Only the test
  // proof command bypasses its host-side revision check; the native lock sees
  // the exact proposed transition and must reject it.
  const badRevision = rawRevisionProof(buyer, 7n, 99n);
  const badRevisionTx = tx(buyerAttackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, badRevision.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackBuyerWallet.capacity - fee, locks[4]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  badRevisionTx.headerDeps = [genesis.header.hash];
  badRevisionTx.witnesses.push(badRevision.witness);
  await expectCustodyReject('skipped_owner_revision_with_valid_old_and_new_roots', sign(badRevisionTx, buyerAttackInputs, 4), 9,
    'buyer balance increases from 6 to 7 with a cryptographically valid root but revision jumps from 4 to 99');

  // The enrollment proof and quantity are valid, but the transaction is
  // signed by a different live owner. This must fail the owner-input binding.
  const unauthorizedInputs = [attackCustody, attackMarker, attackBuyerWallet];
  const unauthorizedTx = tx(unauthorizedInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(11n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackBuyerWallet.capacity - fee, locks[4]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  unauthorizedTx.headerDeps = [genesis.header.hash];
  unauthorizedTx.witnesses.push(validEnrollmentProof.witness);
  await expectCustodyReject('unauthorized_owner_input_for_solver_allocation', sign(unauthorizedTx, unauthorizedInputs, 4), 21,
    'valid solver enrollment and matching custody increase paid with buyer lock input instead of solver lock input');

  // Duplicate owner identity is tested on a valid two-owner offline transfer
  // shape. The previous committed offline fill is its native positive control.
  const duplicateOrder = await signedOrder(domain, U.scriptToHash(custody), 3, seller, 2n, 1n, 70n * UNIT, seller,
    '0x' + 'c3'.repeat(32));
  const duplicateRowsProof = makeProof(domain, 8, rows, [
    { owner: seller, balance: 3n, revision: 3n },
    { owner: buyer, balance: 7n, revision: 5n },
  ], duplicateOrder.extra);
  const duplicateWitness = proofBytes(duplicateRowsProof);
  const firstEntry = 12, secondEntry = 12 + 96;
  duplicateWitness.copy(duplicateWitness, secondEntry, firstEntry, firstEntry + 32);
  const duplicateProof = { root: duplicateRowsProof.root, witness: hx(duplicateWitness) };
  const duplicateInputs = [attackCustody, attackMarker, attackBuyerWallet];
  const duplicateTx = tx(duplicateInputs, [
    cell(attackCustody.capacity, custody, token, custodyData(10n, duplicateProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackBuyerWallet.capacity - 70n * UNIT - fee, locks[4]),
    cell(70n * UNIT, locks[3]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  duplicateTx.headerDeps = [genesis.header.hash];
  duplicateTx.witnesses.push(duplicateProof.witness);
  await expectCustodyReject('duplicate_owner_identity_in_transition', sign(duplicateTx, duplicateInputs, 4), 7,
    'second TMS1 owner identity replaced by the first owner identity in a otherwise balanced signed offline-fill transaction');

  // The proof is valid and adds one entitlement, while the custody xUDT data
  // claims two additional units. The custody lock must reject this mismatch.
  const inflatedTx = tx(attackInputs, [
    cell(attackCustody.capacity, custody, token, smtAttackCellData(12n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - fee, locks[5]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  inflatedTx.headerDeps = [genesis.header.hash];
  inflatedTx.witnesses.push(validEnrollmentProof.witness);
  await expectCustodyReject('valid_proof_inflated_unbacked_entitlement', sign(inflatedTx, attackInputs, 5), 8,
    'one unit added to actual custody data beyond the valid proof entitlement delta');

  // Produce a new native Gate 2 market purchase to control the reserve tests.
  const buyPrice = 20n * UNIT;
  const marketBuyInputs = [additionalBuyResult[0], additionalBuyResult[1], attackCustody, attackMarker, attackFunding];
  const marketBuy = tx(marketBuyInputs, [
    cell(additionalBuyResult[0].capacity + buyPrice, market, token,
      hx(Buffer.concat([le(SUPPLY - 11n, 16), b(domain.custody_marker_type_hash)]))),
    cell(additionalBuyResult[1].capacity, market, marker, marketMarkerData),
    cell(attackCustody.capacity, custody, token, custodyData(11n, validEnrollmentProof.root)),
    cell(attackMarker.capacity, custody, custodyMarker, custodyMarkerData),
    cell(attackFunding.capacity - buyPrice - fee, locks[5]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  marketBuy.headerDeps = [genesis.header.hash];
  marketBuy.witnesses.push(validEnrollmentProof.witness);
  const marketBuySigned = sign(marketBuy, marketBuyInputs, 5);
  await recordAcceptedControl('valid_gate2_market_buy_control', marketBuySigned, 'market_smt');

  const forgedCustodyRoot = structuredClone(marketBuySigned);
  const forgedCustodyData = b(forgedCustodyRoot.outputsData[2]);
  forgedCustodyData[16] ^= 1;
  forgedCustodyRoot.outputsData[2] = hx(forgedCustodyData);
  await expectCustodyReject('gate2_custody_output_root_substitution',
    sign(forgedCustodyRoot, marketBuyInputs, 5), 8,
    'correct owner updates and custody amount are retained while one byte of the declared new root is changed');

  const forgedMarketSuccessor = structuredClone(marketBuySigned);
  const forgedMarketArgs = b(forgedMarketSuccessor.outputs[0].lock.args);
  forgedMarketArgs[0] ^= 1;
  forgedMarketSuccessor.outputs[0].lock.args = hx(forgedMarketArgs);
  await expectMarketReject('gate2_forged_market_singleton_successor',
    sign(forgedMarketSuccessor, marketBuyInputs, 5), 21,
    'otherwise valid purchase changes the market singleton lock arguments instead of preserving the canonical lineage');

  const reserveExtraction = structuredClone(marketBuySigned);
  reserveExtraction.outputs[0].capacity = hex(BigInt(reserveExtraction.outputs[0].capacity) - UNIT);
  reserveExtraction.outputs[4].capacity = hex(BigInt(reserveExtraction.outputs[4].capacity) + UNIT);
  await expectMarketReject('gate2_market_reserve_extraction_one_ckb', sign(reserveExtraction, marketBuyInputs, 5), 28,
    'market inventory and custody transition are valid; one CKB is diverted from the required curve reserve to buyer change');
  const marketBuyResult = await commit('valid_gate2_market_buy_positive_control', marketBuySigned);
  rows.push(solverEnrollment);

  // Sell the sole solver unit. This is the zero-balance tombstone control for
  // subsequent lineage rebuy, with a matching reversible-curve reserve payout.
  const sellPrice = 20n * UNIT;
  const soldSolver = { owner: solverOwner, balance: 0n, revision: 2n };
  const sellProof = makeProof(domain, 4, rows, [soldSolver], Buffer.concat([le(1n), le(sellPrice)]));
  const sellInputs = [marketBuyResult[0], marketBuyResult[1], marketBuyResult[2], marketBuyResult[3], marketBuyResult[4]];
  const sellTx = tx(sellInputs, [
    cell(marketBuyResult[0].capacity - sellPrice, market, token,
      hx(Buffer.concat([le(SUPPLY - 10n, 16), b(domain.custody_marker_type_hash)]))),
    cell(marketBuyResult[1].capacity, market, marker, marketMarkerData),
    cell(marketBuyResult[2].capacity, custody, token, custodyData(10n, sellProof.root)),
    cell(marketBuyResult[3].capacity, custody, custodyMarker, custodyMarkerData),
    cell(marketBuyResult[4].capacity + sellPrice - fee, locks[5]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  sellTx.headerDeps = [genesis.header.hash];
  sellTx.witnesses.push(sellProof.witness);
  const sellSigned = sign(sellTx, sellInputs, 5);
  await recordAcceptedControl('valid_gate2_curve_sell_control', sellSigned, 'market_smt');

  const divertedPayout = structuredClone(sellSigned);
  divertedPayout.outputs[4].lock = locks[4];
  await expectMarketReject('gate2_curve_seller_payout_redirect', sign(divertedPayout, sellInputs, 5), 25,
    'curve sell payout output redirected from the owner lock to a different valid standard lock');

  const excessiveSellerFee = structuredClone(sellSigned);
  excessiveSellerFee.outputs[4].capacity = hex(BigInt(excessiveSellerFee.outputs[4].capacity) - UNIT);
  await expectSellerFeeCapReject('gate2_curve_seller_underpayment_exceeds_fee_limit', sign(excessiveSellerFee, sellInputs, 5),
    'seller receives one CKB less than the already fee-adjusted valid payout, making total transaction fee exceed the custody script limit');

  const inflatedPayout = structuredClone(sellSigned);
  inflatedPayout.outputs[4].capacity = hex(BigInt(inflatedPayout.outputs[4].capacity) + UNIT);
  inflatedPayout.outputs[0].capacity = hex(BigInt(inflatedPayout.outputs[0].capacity) - UNIT);
  await expectMarketReject('gate2_curve_payout_inflation_from_reserve', sign(inflatedPayout, sellInputs, 5), 28,
    'seller is paid one CKB above the curve payout by extracting one additional CKB from the market reserve');

  const soldSolverCells = await commit('valid_gate2_curve_sell_to_tombstone', sellSigned);
  rows[rows.findIndex(row => row.owner === solverOwner)] = soldSolver;
  const rebuySolver = { owner: solverOwner, balance: 1n, revision: 3n };
  const rebuyProof = makeProof(domain, 1, rows, [rebuySolver]);
  const rebuyInputs = [soldSolverCells[0], soldSolverCells[1], soldSolverCells[2], soldSolverCells[3], soldSolverCells[4]];
  const rebuyTx = tx(rebuyInputs, [
    cell(soldSolverCells[0].capacity + buyPrice, market, token,
      hx(Buffer.concat([le(SUPPLY - 11n, 16), b(domain.custody_marker_type_hash)]))),
    cell(soldSolverCells[1].capacity, market, marker, marketMarkerData),
    cell(soldSolverCells[2].capacity, custody, token, custodyData(11n, rebuyProof.root)),
    cell(soldSolverCells[3].capacity, custody, custodyMarker, custodyMarkerData),
    cell(soldSolverCells[4].capacity - buyPrice - fee, locks[5]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  rebuyTx.headerDeps = [genesis.header.hash];
  rebuyTx.witnesses.push(rebuyProof.witness);
  const rebuyCells = await commit('valid_gate2_same_lineage_rebuy_after_tombstone', sign(rebuyTx, rebuyInputs, 5));
  rows[rows.findIndex(row => row.owner === solverOwner)] = rebuySolver;
  custodyCell = rebuyCells[2];
  markerCell = rebuyCells[3];

  // Build a second, genuinely independent Gate 2 lineage from another anchor.
  const anchorB = wallets[1];
  const anchorBBytes = Buffer.concat([b(anchorB.outPoint.txHash), le(BigInt(anchorB.outPoint.index), 4)]);
  const markerB = { codeHash: hashes.marker_candidate, hashType: 'data1', args: hash(Buffer.concat([le(0), anchorBBytes, le(1)])) };
  const marketB = { codeHash: hashes.market_smt, hashType: 'data1', args: hx(Buffer.concat([
    b(hash(anchorBBytes)), le(10n * UNIT), le(UNIT), le(SUPPLY), b(U.scriptToHash(markerB)),
  ])) };
  const ownerB = { codeHash: hashes.owner_lineage_candidate, hashType: 'data1', args: hx(Buffer.concat([
    anchorBBytes, b(hashes.xudt), b(U.scriptToHash(marketB)), le(SUPPLY, 16),
  ])) };
  const tokenB = { codeHash: hashes.xudt, hashType: 'data1', args: U.scriptToHash(ownerB) };
  const marketMarkerDataB = hx(Buffer.concat([b(U.scriptToHash(marketB)), b(U.scriptToHash(tokenB))]));
  const custodyMarkerB = { codeHash: hashes.custody_marker, hashType: 'data1', args: U.scriptToHash(marketB) };
  const custodyB = { codeHash: hashes.custody_smt, hashType: 'data1', args: hx(Buffer.concat([
    b(U.scriptToHash(marketB)), b(U.scriptToHash(tokenB)), b(genesis.header.hash), b(U.scriptToHash(custodyMarkerB)),
  ])) };
  const custodyMarkerDataB = hx(Buffer.concat([b(U.scriptToHash(custodyB)), b(U.scriptToHash(tokenB))]));
  const domainB = {
    genesis_hash: genesis.header.hash,
    market_script_hash: U.scriptToHash(marketB),
    xudt_type_script_hash: U.scriptToHash(tokenB),
    custody_marker_type_hash: U.scriptToHash(custodyMarkerB),
  };
  assert.notEqual(domainB.market_script_hash, domain.market_script_hash);
  assert.notEqual(domainB.xudt_type_script_hash, domain.xudt_type_script_hash);
  assert.notEqual(U.scriptToHash(custodyB), U.scriptToHash(custody));
  fs.writeFileSync(path.join(smtAttackDirectory, 'two-market-identities.json'), JSON.stringify({
    marketA: { anchor: anchor.outPoint, market: U.scriptToHash(market), token: U.scriptToHash(token), custody: U.scriptToHash(custody), marker: U.scriptToHash(marker) },
    marketB: { anchor: anchorB.outPoint, market: domainB.market_script_hash, token: domainB.xudt_type_script_hash, custody: U.scriptToHash(custodyB), marker: U.scriptToHash(markerB) },
    distinct_market_token_custody_and_marker_lineages: true,
  }, null, 2));

  const ownerBSeedTx = tx([setup[5]], [
    cell(200n * UNIT, ownerB),
    cell(setup[5].capacity - 200n * UNIT - fee, locks[2]),
  ]);
  const ownerBSeed = await commit('fund_market_B_owner_lineage_cell', sign(ownerBSeedTx, [setup[5]], 2));
  const issueBInputs = [anchorB, ownerBSeed[0]];
  const issueBTx = tx(issueBInputs, [
    cell(300n * UNIT, marketB, tokenB, hx(le(SUPPLY, 16))),
    cell(300n * UNIT, marketB, markerB, marketMarkerDataB),
    cell(anchorB.capacity + ownerBSeed[0].capacity - 600n * UNIT - fee, locks[1]),
  ], [deps.owner_lineage_candidate, deps.xudt, deps.marker_candidate]);
  const issueBSigned = sign(issueBTx, issueBInputs, 1);
  const issuedB = await commit('issue_market_B_from_independent_anchor', issueBSigned);
  const fundBInputs = [issuedB[2]];
  const fundBTx = tx(fundBInputs, [
    cell(3000n * UNIT, locks[3]), cell(3000n * UNIT, locks[4]), cell(3000n * UNIT, locks[3]),
    cell(issuedB[2].capacity - 9000n * UNIT - fee, locks[1]),
  ]);
  const fundedB = await commit('fund_market_B_owner_wallets', sign(fundBTx, fundBInputs, 1));
  const sellerB = U.scriptToHash(locks[3]), buyerB = U.scriptToHash(locks[4]);
  const initialBProof = makeProof(domainB, 0, [], [{ owner: sellerB, balance: 7n, revision: 0n }], le(91n * UNIT));
  const initialBTx = tx([issuedB[0], issuedB[1], fundedB[0]], [
    cell(issuedB[0].capacity + 91n * UNIT, marketB, tokenB,
      hx(Buffer.concat([le(SUPPLY - 7n, 16), b(domainB.custody_marker_type_hash)]))),
    cell(issuedB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(350n * UNIT, custodyB, tokenB, custodyData(7n, initialBProof.root)),
    cell(350n * UNIT, custodyB, custodyMarkerB, custodyMarkerDataB),
    cell(fundedB[0].capacity - 791n * UNIT - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  initialBTx.headerDeps = [genesis.header.hash];
  initialBTx.witnesses.push(initialBProof.witness);
  const initializedB = await commit('initialize_market_B_positive_control', sign(initialBTx, [issuedB[0], issuedB[1], fundedB[0]], 3));
  let rowsB = [{ owner: sellerB, balance: 7n, revision: 0n }];
  const enrollBProof = makeProof(domainB, 1, rowsB, [{ owner: buyerB, balance: 2n, revision: 1n }]);
  const enrollBInputs = [initializedB[0], initializedB[1], initializedB[2], initializedB[3], fundedB[1]];
  const enrollBTx = tx(enrollBInputs, [
    cell(initializedB[0].capacity + 35n * UNIT, marketB, tokenB,
      hx(Buffer.concat([le(SUPPLY - 9n, 16), b(domainB.custody_marker_type_hash)]))),
    cell(initializedB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(initializedB[2].capacity, custodyB, tokenB, custodyData(9n, enrollBProof.root)),
    cell(initializedB[3].capacity, custodyB, custodyMarkerB, custodyMarkerDataB),
    cell(fundedB[1].capacity - 35n * UNIT - fee, locks[4]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  enrollBTx.headerDeps = [genesis.header.hash];
  enrollBTx.witnesses.push(enrollBProof.witness);
  const enrolledB = await commit('market_B_buyer_enrollment_positive_control', sign(enrollBTx, enrollBInputs, 4));
  rowsB = [...rowsB, { owner: buyerB, balance: 2n, revision: 1n }];

  const sellerBAfterFill = { owner: sellerB, balance: 4n, revision: 1n };
  const buyerBAfterFill = { owner: buyerB, balance: 5n, revision: 2n };
  const crossMarketOrderProof = makeProof(domainB, 8, rowsB, [sellerBAfterFill, buyerBAfterFill], order.extra);
  const makeBOrderFill = proof => {
    const inputs = [enrolledB[2], enrolledB[3], enrolledB[4]];
    const value = tx(inputs, [
      cell(enrolledB[2].capacity, custodyB, tokenB, custodyData(9n, proof.root)),
      cell(enrolledB[3].capacity, custodyB, custodyMarkerB, custodyMarkerDataB),
      cell(enrolledB[4].capacity - minProceeds - fee, locks[4]), cell(minProceeds, locks[3]),
    ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
    value.headerDeps = [genesis.header.hash];
    value.witnesses.push(proof.witness);
    return { inputs, tx: value };
  };
  const replayAOrderOnB = makeBOrderFill(crossMarketOrderProof);
  await expectCustodyReject('cross_market_A_offline_order_replay_on_B',
    sign(replayAOrderOnB.tx, replayAOrderOnB.inputs, 4), 38,
    'Market A seller signature is replayed against Market B custody and otherwise valid Market B owner revisions');
  const orderB = await signedOrder(domainB, U.scriptToHash(custodyB), 3, sellerB, 0n, 3n,
    minProceeds, sellerB, '0x' + 'b2'.repeat(32));
  const validBOrderProof = makeProof(domainB, 8, rowsB, [sellerBAfterFill, buyerBAfterFill], orderB.extra);
  const validBOrder = makeBOrderFill(validBOrderProof);
  const filledB = await commit('market_B_valid_offline_order_positive_control',
    sign(validBOrder.tx, validBOrder.inputs, 4));
  rowsB = [sellerBAfterFill, buyerBAfterFill];

  const buyerBAfterWithdrawal = { owner: buyerB, balance: 4n, revision: 3n };
  const withdrawBProof = makeProof(domainB, 5, rowsB, [buyerBAfterWithdrawal]);
  const withdrawBInputs = [filledB[0], filledB[1], filledB[2]];
  const withdrawBTx = tx(withdrawBInputs, [
    cell(filledB[0].capacity, custodyB, tokenB, custodyData(8n, withdrawBProof.root)),
    cell(filledB[1].capacity, custodyB, custodyMarkerB, custodyMarkerDataB),
    cell(142n * UNIT, locks[4], tokenB, hx(le(1n, 16))),
    cell(filledB[2].capacity - 142n * UNIT - fee, locks[4]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  withdrawBTx.witnesses.push(withdrawBProof.witness);
  const withdrawnB = await commit('market_B_external_withdrawal_positive_control', sign(withdrawBTx, withdrawBInputs, 4));
  rowsB = [sellerBAfterFill, buyerBAfterWithdrawal];
  const marketBSellPrice = 18n * UNIT;
  const marketBSellInputs = [enrolledB[0], enrolledB[1], withdrawnB[2], withdrawnB[3]];
  const marketBSellTx = tx(marketBSellInputs, [
    cell(enrolledB[0].capacity - marketBSellPrice, marketB, tokenB,
      hx(Buffer.concat([le(SUPPLY - 8n, 16), b(domainB.custody_marker_type_hash)]))),
    cell(enrolledB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(withdrawnB[2].capacity, locks[4], tokenB, hx(le(0n, 16))),
    cell(withdrawnB[3].capacity + marketBSellPrice - fee, locks[4]),
  ], [deps.market_smt, deps.marker_candidate, deps.xudt]);
  marketBSellTx.witnesses.push(hx(le(1n, 16)));
  const soldExternalB = await commit('market_B_external_redemption_positive_control', sign(marketBSellTx, marketBSellInputs, 4));

  const sellerAAfterWithdrawal = { owner: seller, balance: 3n, revision: 3n };
  const withdrawAProof = makeProof(domain, 5, rows, [sellerAAfterWithdrawal]);
  const withdrawAInputs = [custodyCell, markerCell, fundedB[2]];
  const withdrawATx = tx(withdrawAInputs, [
    cell(custodyCell.capacity, custody, token, custodyData(10n, withdrawAProof.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(142n * UNIT, locks[3], token, hx(le(1n, 16))),
    cell(fundedB[2].capacity - 142n * UNIT - fee, locks[3]),
  ], [deps.custody_smt, deps.custody_marker, deps.xudt]);
  withdrawATx.headerDeps = [genesis.header.hash];
  withdrawATx.witnesses.push(withdrawAProof.witness);
  const withdrawnA = await commit('market_A_external_withdrawal_for_substitution_controls', sign(withdrawATx, withdrawAInputs, 3));
  rows[rows.findIndex(row => row.owner === seller)] = sellerAAfterWithdrawal;
  custodyCell = withdrawnA[0];
  markerCell = withdrawnA[1];

  const crossMarketAssetInputs = [soldExternalB[0], soldExternalB[1], withdrawnA[2], withdrawnA[3]];
  const crossMarketAssetTx = tx(crossMarketAssetInputs, [
    cell(soldExternalB[0].capacity, marketB, tokenB, soldExternalB[0].data),
    cell(soldExternalB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(withdrawnA[2].capacity, locks[3], token, withdrawnA[2].data),
    cell(withdrawnA[3].capacity - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.xudt]);
  await expectMarketReject('cross_market_A_xudt_substituted_for_B_external_sale',
    sign(crossMarketAssetTx, crossMarketAssetInputs, 3), 41,
    'genuine Market A xUDT is supplied as the external sell asset to a valid Market B inventory and marker pair');

  const sellerACanceled = { owner: seller, balance: 3n, revision: 4n };
  const cancelAForBProof = makeProof(domain, 7, rows, [sellerACanceled]);
  const crossMarketCustodyInputs = [soldExternalB[0], soldExternalB[1], custodyCell, markerCell, withdrawnA[3]];
  const crossMarketCustodyTx = tx(crossMarketCustodyInputs, [
    cell(soldExternalB[0].capacity, marketB, tokenB, soldExternalB[0].data),
    cell(soldExternalB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(custodyCell.capacity, custody, token, custodyData(10n, cancelAForBProof.root)),
    cell(markerCell.capacity, custody, custodyMarker, custodyMarkerData),
    cell(withdrawnA[3].capacity - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  crossMarketCustodyTx.headerDeps = [genesis.header.hash];
  crossMarketCustodyTx.witnesses.push(cancelAForBProof.witness);
  await expectMarketReject('cross_market_A_custody_substituted_into_B_transition',
    sign(crossMarketCustodyTx, crossMarketCustodyInputs, 3), 22,
    'a cryptographically valid Market A custody cancellation is paired with Market B market inventory and marker singletons');

  const fakeMarketBAssetInputs = [withdrawnA[2], withdrawnA[3]];
  const fakeMarketBAssetTx = tx(fakeMarketBAssetInputs, [
    cell(300n * UNIT, marketB, token, withdrawnA[2].data),
    cell(withdrawnA[2].capacity + withdrawnA[3].capacity - 300n * UNIT - fee, locks[3]),
  ], [deps.xudt]);
  const fakeMarketBAsset = await commit('prepare_A_asset_locked_by_B_market_script', sign(fakeMarketBAssetTx, fakeMarketBAssetInputs, 3));
  const sellerBAfterCancel = { owner: sellerB, balance: 4n, revision: 2n };
  const cancelBForInventoryProof = makeProof(domainB, 7, rowsB, [sellerBAfterCancel]);
  const crossInventoryInputs = [fakeMarketBAsset[0], soldExternalB[1], withdrawnB[0], withdrawnB[1], filledB[3]];
  const crossInventoryTx = tx(crossInventoryInputs, [
    cell(fakeMarketBAsset[0].capacity, marketB, token, fakeMarketBAsset[0].data),
    cell(soldExternalB[1].capacity, marketB, markerB, marketMarkerDataB),
    cell(withdrawnB[0].capacity, custodyB, tokenB, custodyData(8n, cancelBForInventoryProof.root)),
    cell(withdrawnB[1].capacity, custodyB, custodyMarkerB, custodyMarkerDataB),
    cell(filledB[3].capacity - fee, locks[3]),
  ], [deps.market_smt, deps.marker_candidate, deps.custody_smt, deps.custody_marker, deps.xudt]);
  crossInventoryTx.headerDeps = [genesis.header.hash];
  crossInventoryTx.witnesses.push(cancelBForInventoryProof.witness);
  await expectMarketReject('cross_market_A_asset_used_as_B_inventory_singleton',
    sign(crossInventoryTx, crossInventoryInputs, 3), 22,
    'a real Market A xUDT holder transfers one token to the Market B lock, then attempts a valid B custody transition using it as B inventory');

  const tip = await rpc('get_tip_header');
  const summary = {
    evidence: out, chain: chain, ckbVersion: '0.210.0', genesis: genesis.header.hash, tip: tip.hash,
    hashes, ownersBefore: 2, ownersAfter: 2, orderQuantity: quantity.toString(), minimumProceeds: minProceeds.toString(),
    signedPayoutLockHash: payout, custodyAmountBeforeAndAfter: '9', offlineSellerInputPresent: false,
    rootChangedBeforeFill: true, orderFillCommitted: true, expiry: 'none; order does not expire',
  };
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('Evidence ' + out);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (child) child.kill(); });

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

if (!process.env.TRADE_NATIVE_ROOT) throw new Error('TRADE_NATIVE_ROOT must point to the pinned local CKB SDK workspace');
const C = require(path.join(process.env.TRADE_NATIVE_ROOT, 'src', 'lib.cjs'));
const sdk = require(path.join(process.env.TRADE_NATIVE_ROOT, 'node_modules', '@nervosnetwork', 'ckb-sdk-utils'));

function readLines(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
}

function pointKey(hash, index) {
  return `${hash.toLowerCase()}:${BigInt(index).toString()}`;
}

function cellRecord(output, data) {
  return {
    capacity: BigInt(output.capacity),
    lockHash: sdk.scriptToHash(output.lock).toLowerCase(),
    typeHash: output.type ? sdk.scriptToHash(output.type).toLowerCase() : null,
    output,
    data,
  };
}

function tmsWitness(tx) {
  const hex = tx.witnesses.find(value => value.startsWith('0x544d5331'));
  if (!hex) return null;
  const bytes = Buffer.from(hex.slice(2), 'hex');
  assert(bytes.length >= 12, 'truncated TMS1 header');
  const count = bytes.readUInt16LE(6);
  const proofBytes = bytes.readUInt32LE(8);
  const bodyStart = 12 + count * 96;
  assert(bytes.length >= bodyStart + proofBytes, 'truncated TMS1 entries or proof');
  const owners = [];
  const updates = [];
  for (let i = 0; i < count; i++) {
    const entry = bytes.subarray(12 + i * 96, 12 + (i + 1) * 96);
    const owner = `0x${entry.subarray(0, 32).toString('hex')}`;
    owners.push(owner);
    updates.push({ owner, old: entry.subarray(32, 64).toString('hex'), next: entry.subarray(64, 96).toString('hex') });
  }
  return {
    op: bytes[5],
    count,
    proofBytes,
    witnessBytes: bytes.length,
    extraBytes: bytes.length - bodyStart - proofBytes,
    owners,
    updates,
  };
}

function leafBalance(value) {
  const bytes = Buffer.from(value, 'hex');
  return bytes.readBigUInt64LE(0);
}

function xudtAmount(data) {
  const bytes = Buffer.from(data.slice(2), 'hex');
  assert.equal(bytes.length, 48, 'custody xUDT data must be amount16 || root32');
  for (let i = 8; i < 16; i++) assert.equal(bytes[i], 0, 'custody quantity exceeds u64');
  return bytes.readBigUInt64LE(0);
}

function measure(directory) {
  const events = readLines(path.join(directory, 'events.jsonl'));
  const rpc = readLines(path.join(directory, 'rpc.jsonl'));
  const summary = JSON.parse(fs.readFileSync(path.join(directory, 'summary.json'), 'utf8'));
  const genesisRow = rpc.find(row => row.method === 'get_block_by_number' && row.params?.[0] === '0x0');
  assert(genesisRow?.response?.result, 'genesis block was not recorded in rpc.jsonl');
  const cells = new Map();
  for (const rawTx of genesisRow.response.result.transactions) {
    const tx = C.camel(rawTx);
    for (let i = 0; i < tx.outputs.length; i++) {
      cells.set(pointKey(tx.hash, i), cellRecord(tx.outputs[i], tx.outputsData[i]));
    }
  }

  const owners = new Set();
  const batches = [];
  const fees = [];
  const serializedSizes = [];
  const capacityMargins = [];
  const witnessSizes = [];
  const proofSizes = [];
  const hashes = [];
  let checkedOutputs = 0;
  let authorizedBatchOwners = 0;
  const ownerLeaves = new Map();
  const custodyLockHash = sdk.scriptToHash(summary.scripts.custody).toLowerCase();
  const xudtTypeHash = sdk.scriptToHash(summary.scripts.token).toLowerCase();
  let currentRoot = null;
  const conservationTransitions = [];
  for (const event of events) {
    assert.equal(event.committed?.tx_status?.status, 'committed', `${event.label} is not recorded committed`);
    const tx = event.tx;
    assert.equal(C.U.rawTransactionToHash(tx).toLowerCase(), event.hash.toLowerCase(), `${event.label} transaction hash mismatch`);
    const inputs = tx.inputs.map(input => {
      const cell = cells.get(pointKey(input.previousOutput.txHash, input.previousOutput.index));
      assert(cell, `${event.label} input capacity was not found in genesis or prior committed outputs`);
      return cell;
    });
    const inputCapacity = inputs.reduce((sum, cell) => sum + cell.capacity, 0n);
    const outputCapacity = tx.outputs.reduce((sum, output) => sum + BigInt(output.capacity), 0n);
    assert(inputCapacity >= outputCapacity, `${event.label} has a negative fee`);
    const fee = inputCapacity - outputCapacity;
    fees.push(fee);

    for (let i = 0; i < tx.outputs.length; i++) {
      const output = tx.outputs[i];
      const data = tx.outputsData[i];
      const dataBytes = Buffer.from(data.slice(2), 'hex').length;
      const occupied = BigInt(8 * (sdk.cellOccupied(output) + dataBytes));
      const capacity = BigInt(output.capacity);
      assert(capacity >= occupied, `${event.label} output ${i} is below occupied capacity`);
      capacityMargins.push(capacity - occupied);
      checkedOutputs++;
      cells.set(pointKey(event.hash, i), cellRecord(output, data));
    }

    const serializedBytes = Buffer.from(sdk.serializeTransaction(tx).slice(2), 'hex').length;
    serializedSizes.push(serializedBytes);
    for (const witness of tx.witnesses) witnessSizes.push(Buffer.from(witness.slice(2), 'hex').length);
    const tms = tmsWitness(tx);
    if (tms) {
      const custodyInputs = inputs.filter(cell => cell.lockHash === custodyLockHash && cell.typeHash === xudtTypeHash);
      const custodyOutputs = tx.outputs.map((output, i) => cellRecord(output, tx.outputsData[i]))
        .filter(cell => cell.lockHash === custodyLockHash && cell.typeHash === xudtTypeHash);
      assert.equal(custodyInputs.length, tms.op === 0 ? 0 : 1, `${event.label} custody input count`);
      assert.equal(custodyOutputs.length, 1, `${event.label} custody output count`);
      const oldAmount = tms.op === 0 ? 0n : xudtAmount(custodyInputs[0].data);
      const oldRoot = tms.op === 0 ? Buffer.alloc(32) : Buffer.from(custodyInputs[0].data.slice(34), 'hex');
      if (currentRoot) assert(oldRoot.equals(currentRoot), `${event.label} did not spend the prior authenticated root`);
      let delta = 0n;
      for (const update of tms.updates) {
        const prior = ownerLeaves.get(update.owner) || '00'.repeat(32);
        assert.equal(update.old, prior, `${event.label} old owner leaf mismatch for ${update.owner}`);
        delta += leafBalance(update.next) - leafBalance(update.old);
        ownerLeaves.set(update.owner, update.next);
      }
      const newAmount = xudtAmount(custodyOutputs[0].data);
      assert.equal(oldAmount + delta, newAmount, `${event.label} custody amount does not match authenticated leaf deltas`);
      const entitlementTotal = [...ownerLeaves.values()].reduce((sum, value) => sum + leafBalance(value), 0n);
      assert.equal(entitlementTotal, newAmount, `${event.label} authenticated owner sum differs from custody xUDT amount`);
      currentRoot = Buffer.from(custodyOutputs[0].data.slice(34), 'hex');
      conservationTransitions.push({ label: event.label, hash: event.hash, operation: tms.op, updates: tms.count, custody_amount: newAmount.toString(), entitlement_total: entitlementTotal.toString() });
      for (const owner of tms.owners) owners.add(owner.toLowerCase());
      proofSizes.push(tms.proofBytes);
      if (tms.op === 2) {
        const inputOwners = new Set(inputs.map(cell => cell.lockHash));
        const missing = tms.owners.filter(owner => !inputOwners.has(owner.toLowerCase()));
        assert.deepEqual(missing, [], `${event.label} has a batch owner without an input locked by that owner`);
        authorizedBatchOwners += tms.owners.length;
        batches.push({
          label: event.label,
          hash: event.hash,
          cycles: BigInt(event.cycles.cycles).toString(),
          owners: tms.count,
          proof_bytes: tms.proofBytes,
          tms_witness_bytes: tms.witnessBytes,
          serialized_transaction_bytes: serializedBytes,
          fee_shannons: fee.toString(),
        });
      }
    }
    hashes.push({ label: event.label, hash: event.hash, block_number: event.committed.tx_status.block_number, block_hash: event.committed.tx_status.block_hash });
  }

  assert.equal(owners.size, summary.owners, 'distinct authenticated owner identities differ from the run owner count');
  const batchCycles = batches.map(batch => BigInt(batch.cycles));
  const min = values => values.reduce((a, b) => a < b ? a : b);
  const max = values => values.reduce((a, b) => a > b ? a : b);
  return {
    run: path.basename(directory),
    owners: owners.size,
    transactions: events.length,
    batch_count: batches.length,
    batch_owner_updates: authorizedBatchOwners,
    authenticated_entitlement_conservation: true,
    conservation_transitions: conservationTransitions,
    all_committed_hashes_verified: true,
    all_fees_reconstructed_from_parent_outputs: true,
    all_output_occupied_capacities_checked: checkedOutputs,
    fee_shannons: { min: min(fees).toString(), max: max(fees).toString(), total: fees.reduce((a, b) => a + b, 0n).toString() },
    batch_cycles: batchCycles.length ? { min: min(batchCycles).toString(), max: max(batchCycles).toString() } : null,
    batch_transaction_bytes: batches.length ? { min: Math.min(...batches.map(x => x.serialized_transaction_bytes)), max: Math.max(...batches.map(x => x.serialized_transaction_bytes)) } : null,
    all_transaction_bytes: { min: Math.min(...serializedSizes), max: Math.max(...serializedSizes) },
    witness_payload_bytes_max: Math.max(...witnessSizes),
    compiled_proof_bytes_max: Math.max(...proofSizes),
    minimum_occupied_capacity_margin_shannons: min(capacityMargins).toString(),
    batch_transactions: batches,
    committed_transaction_hashes: hashes,
  };
}

if (process.argv.length < 3) throw new Error('Usage: node measure.cjs <native-evidence-directory> [...]');
for (const directory of process.argv.slice(2)) console.log(JSON.stringify(measure(path.resolve(directory)), null, 2));

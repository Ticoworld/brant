const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const dir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: node verify-liquid-cells-private-devnet.cjs <evidence-directory>');
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const result = read('lifecycle.json');
const events = read('events.json');
const cases = read('cases.json');
const complete = read('complete.json');
const env = read('environment.json');
const checkpointIndex = events.findIndex(event => event.label.includes('checkpoint_with_published_da'));
const exitIndex = events.findIndex(event => event.label.includes('mature_owner_force_exit'));

assert.equal(result.classification, 'ACTUAL_PRIVATE_DEVNET_TRANSACTIONS');
assert.equal(result.upstream_commit, '47492b51673c94635ab23de2c55477625e94ccbf');
assert.match(env.versions.version, /^0\.210\.0/);
assert(checkpointIndex >= 0 && exitIndex > checkpointIndex);
assert.equal(events.length, complete.transactions);
assert.equal(result.transactions.length, events.length);
for (let i = 0; i < events.length; i++) {
  assert.equal(events[i].hash, result.transactions[i].hash);
  assert.equal(events[i].label, result.transactions[i].label);
  assert.equal(events[i].committed.tx_status.status, 'committed');
}
assert.equal(result.force_exit.blocks_mined_after_checkpoint, 1800);
assert.equal(result.force_exit.payout_shannons, '9999899000');
assert.equal(result.resulting_owner_payout.txHash, events[exitIndex].hash);
const rpcProof = read('rpc-reconstruction/rpc-proof-reconstruction.json');
const checkpointRpc = read('rpc-reconstruction/checkpoint-rpc-response.json');
assert.equal(rpcProof.checkpoint_hash, events[checkpointIndex].hash);
assert.equal(rpcProof.tx_status, 'committed');
assert.equal(checkpointRpc.result.tx_status.status, 'committed');
assert.equal(checkpointRpc.result.transaction.hash, events[checkpointIndex].hash);
assert.equal(rpcProof.inputs, 'committed CKB RPC transaction only; no fixture, indexer, or sequencer state');
const rpcWitness = Buffer.from(checkpointRpc.result.transaction.witnesses[0].slice(2), 'hex');
const rpcOutputData = Buffer.from(checkpointRpc.result.transaction.outputs_data[0].slice(2), 'hex');
const rpcRoot = `0x${rpcOutputData.subarray(0, 32).toString('hex')}`;
assert.equal(rpcProof.live_anchor_root, rpcRoot);
assert.equal(rpcProof.reconstructed_root, rpcRoot);
assert.equal(rpcProof.da_bytes, fs.statSync(path.join(dir, 'rpc-reconstruction/rpc-published-da.bin')).size);
assert.equal(rpcProof.public_values_bytes, fs.statSync(path.join(dir, 'rpc-reconstruction/rpc-public-values.bin')).size);
assert(rpcWitness.includes(fs.readFileSync(path.join(dir, 'rpc-reconstruction/rpc-published-da.bin'))), 'RPC DA bytes absent from fetched committed witness');
const proofOwnerRecord = rpcProof.da_records.find(record => record.key === rpcProof.owner_key);
assert(proofOwnerRecord, 'proof owner is absent from chain-published DA records');
assert.equal(proofOwnerRecord.balance_shannons, result.force_exit.payout_shannons);
const publicValues = fs.readFileSync(path.join(dir, 'rpc-reconstruction/rpc-public-values.bin'));
const asU128 = (bytes, offset) => BigInt(`0x${bytes.subarray(offset, offset + 16).toString('hex')}`);
const initialAccountedTotal = rpcProof.da_records.reduce((sum, record) => sum + BigInt(record.balance_shannons), 0n);
assert.equal(initialAccountedTotal, asU128(publicValues, 200), 'DA leaf totals must equal the committed checkpoint total');
if (result.anchor_lock_design.startsWith('deployed CKB-VM always-success')) {
  const genesisIndex = events.findIndex(event => event.label.includes('canonical_empty_anchor'));
  assert(genesisIndex >= 0);
  assert.deepEqual(events[genesisIndex].tx.outputs[0].lock, result.anchor_lock_script, 'genesis anchor does not use the reported permissionless lock');
  const checkpoint = events[checkpointIndex].tx;
  const exit = events[exitIndex].tx;
  assert.equal(checkpoint.inputs.length, 2, 'checkpoint expected anchor plus user-authorized deposit only');
  assert.equal(exit.inputs.length, 2, 'exit expected shared anchor plus independent fee input only');
  assert.equal(exit.inputs[0].previousOutput.txHash, events[checkpointIndex].hash, 'exit must consume checkpoint successor anchor');
  assert.equal(exit.inputs[0].previousOutput.index, '0x0');
  assert.deepEqual(exit.outputs[1].lock, result.owner_payout_lock_script, 'payout is not locked to proof owner');
  const witnessLock = hex => {
    const b = Buffer.from(hex.slice(2), 'hex');
    const start = b.readUInt32LE(4);
    const end = b.readUInt32LE(8);
    if (start === end) return Buffer.alloc(0);
    const field = b.subarray(start, end);
    return field.subarray(4, 4 + field.readUInt32LE(0));
  };
  assert.equal(witnessLock(exit.witnesses[0]).length, 0, 'anchor input must not carry an operator/owner lock signature');
  assert(witnessLock(exit.witnesses[1]).length > 0, 'independent fee input must carry its own authorization');
  const remainingTotal = initialAccountedTotal - BigInt(result.force_exit.payout_shannons);
  assert.equal(BigInt(result.successor_anchor.total_shannons), remainingTotal, 'exit must decrement total by exactly the exited leaf balance');
  assert.equal(remainingTotal, rpcProof.da_records.filter(record => record.key !== rpcProof.owner_key).reduce((sum, record) => sum + BigInt(record.balance_shannons), 0n), 'remaining total must equal the other DA-account balances');
  const checkpointData = Buffer.from(checkpoint.outputsData[0].slice(2), 'hex');
  const drainedData = Buffer.from(exit.outputsData[0].slice(2), 'hex');
  assert.equal(drainedData.readBigUInt64BE(72).toString(), checkpointData.readBigUInt64BE(72).toString(), 'force-exit must preserve last_epoch');
  const checkpointTotal = asU128(checkpointData, 40);
  const drainedTotal = asU128(drainedData, 40);
  const checkpointCapacity = BigInt(checkpoint.outputs[0].capacity);
  const drainedCapacity = BigInt(exit.outputs[0].capacity);
  const checkpointSlack = checkpointCapacity - checkpointTotal;
  const drainedSlack = drainedCapacity - drainedTotal;
  assert.equal(drainedSlack, checkpointSlack, 'force-exit must preserve anchor capacity slack');
  assert.equal(drainedSlack, BigInt(result.successor_anchor.slack_shannons));
  const anchorLock = exit.outputs[0].lock;
  const anchorType = exit.outputs[0].type;
  const occupiedBytes = 8 + 33 + (anchorLock.args.length - 2) / 2 + 33 + (anchorType.args.length - 2) / 2 + drainedData.length;
  assert(drainedCapacity >= BigInt(occupiedBytes) * 100_000_000n, 'successor anchor must remain above CKB occupied capacity');
}
assert.equal(cases.length, result.operator_signature_required_for_mature_exit ? 4 : 3);
for (const [index, code] of [59, 66, 67].entries()) {
  assert.match(cases[index].error, new RegExp(`error code ${code}\\b`));
}
if (result.operator_signature_required_for_mature_exit) {
  assert.match(cases[3].label, /operator_anchor_lock_without_operator_signature/);
  assert.match(cases[3].error, /Inputs\[0\]\.Lock|error code -2/);
}
const raw = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'raw.jsonl.gz'))).toString('utf8');
const rpc = raw.trim().split('\n').map(line => JSON.parse(line));
const sent = new Set(rpc.filter(row => row.method === 'send_transaction').map(row => row.response.result));
const chainCommitted = new Set(rpc.filter(row => row.method === 'get_transaction' && row.response.result?.tx_status?.status === 'committed').map(row => row.params[0]));
for (const event of events) {
  assert(sent.has(event.hash), `raw RPC has no send_transaction for ${event.hash}`);
  assert(chainCommitted.has(event.hash), `raw RPC has no committed get_transaction for ${event.hash}`);
}
console.log(`PASS: ${events.length} private-devnet transactions committed; ${cases.length} contract cases rejected; raw RPC evidence agrees.`);

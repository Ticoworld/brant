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

assert.equal(result.classification, 'ACTUAL_PRIVATE_DEVNET_TRANSACTIONS');
assert.equal(result.upstream_commit, '47492b51673c94635ab23de2c55477625e94ccbf');
assert.match(env.versions.version, /^0\.210\.0/);
assert.equal(events.length, 4);
assert.equal(complete.transactions, 4);
assert.equal(result.transactions.length, events.length);
for (let i = 0; i < events.length; i++) {
  assert.equal(events[i].hash, result.transactions[i].hash);
  assert.equal(events[i].label, result.transactions[i].label);
  assert.equal(events[i].committed.tx_status.status, 'committed');
}
assert.equal(result.force_exit.blocks_mined_after_checkpoint, 1800);
assert.equal(result.force_exit.payout_shannons, '9999899000');
assert.equal(result.resulting_owner_payout.txHash, events[3].hash);
const rpcProof = read('rpc-reconstruction/rpc-proof-reconstruction.json');
const checkpointRpc = read('rpc-reconstruction/checkpoint-rpc-response.json');
assert.equal(rpcProof.checkpoint_hash, events[2].hash);
assert.equal(rpcProof.tx_status, 'committed');
assert.equal(checkpointRpc.result.tx_status.status, 'committed');
assert.equal(checkpointRpc.result.transaction.hash, events[2].hash);
assert.equal(rpcProof.inputs, 'committed CKB RPC transaction only; no fixture, indexer, or sequencer state');
const rpcWitness = Buffer.from(checkpointRpc.result.transaction.witnesses[0].slice(2), 'hex');
const rpcOutputData = Buffer.from(checkpointRpc.result.transaction.outputs_data[0].slice(2), 'hex');
const rpcRoot = `0x${rpcOutputData.subarray(0, 32).toString('hex')}`;
assert.equal(rpcProof.live_anchor_root, rpcRoot);
assert.equal(rpcProof.reconstructed_root, rpcRoot);
assert.equal(rpcProof.da_bytes, fs.statSync(path.join(dir, 'rpc-reconstruction/rpc-published-da.bin')).size);
assert.equal(rpcProof.public_values_bytes, fs.statSync(path.join(dir, 'rpc-reconstruction/rpc-public-values.bin')).size);
assert(rpcWitness.includes(fs.readFileSync(path.join(dir, 'rpc-reconstruction/rpc-published-da.bin'))), 'RPC DA bytes absent from fetched committed witness');
assert.equal(cases.length, 3);
for (const [index, code] of [59, 66, 67].entries()) {
  assert.match(cases[index].error, new RegExp(`error code ${code}\\b`));
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

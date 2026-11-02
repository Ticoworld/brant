// Fresh-process replay of consecutive Liquid Cells checkpoints using committed CKB RPC data only.
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const [genesisHash, checkpointHashesJson, pubkeysJson, outputDir] = process.argv.slice(2);
if (!genesisHash || !checkpointHashesJson || !pubkeysJson || !outputDir) {
  throw new Error('usage: script <genesis-tx-hash> <checkpoint-hashes-json> <owner-pubkeys-json> <output-dir>');
}
const checkpointHashes = JSON.parse(checkpointHashesJson);
const pubkeys = JSON.parse(pubkeysJson);
assert(checkpointHashes.length >= 2, 'need multiple checkpoint transactions');
assert(pubkeys.length >= 1, 'need at least one claimant pubkey');
const rpcUrl = process.env.CKB_RPC_URL || 'http://127.0.0.1:19224';
const helperManifest = path.resolve(__dirname, '../scripts/force-exit-witness/Cargo.toml');
fs.mkdirSync(outputDir, { recursive: true });

function witnessField(data, index) {
  assert(data.length >= 16, 'WitnessArgs shorter than table header');
  assert.equal(data.readUInt32LE(0), data.length, 'WitnessArgs total size mismatch');
  const offsets = [data.readUInt32LE(4), data.readUInt32LE(8), data.readUInt32LE(12)];
  const begin = offsets[index];
  const end = index === 2 ? data.length : offsets[index + 1];
  assert(begin >= 16 && begin <= end && end <= data.length, 'WitnessArgs offset out of range');
  const field = data.subarray(begin, end);
  if (!field.length) return Buffer.alloc(0);
  assert(field.length >= 4, 'truncated optional Bytes');
  assert.equal(field.readUInt32LE(0), field.length - 4, 'Molecule Bytes length mismatch');
  return field.subarray(4);
}
function u64(bytes, offset) { return bytes.readBigUInt64BE(offset); }
function u128(bytes, offset) { return BigInt(`0x${bytes.subarray(offset, offset + 16).toString('hex')}`); }
async function getTransaction(hash) {
  const response = await fetch(rpcUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_transaction', params: [hash] }),
  }).then(r => r.json());
  if (response.error) throw new Error(response.error.message);
  assert.equal(response.result?.tx_status?.status, 'committed', `transaction ${hash} is not committed`);
  fs.writeFileSync(path.join(outputDir, `rpc-${hash.slice(2)}.json`), JSON.stringify(response, null, 2));
  return response.result.transaction;
}

(async () => {
  const baseTx = await getTransaction(genesisHash);
  let previousHash = genesisHash;
  let previousData = Buffer.from(baseTx.outputs_data[0].slice(2), 'hex');
  assert.equal(previousData.length, 80, 'base anchor data must be 80 bytes');
  const state = new Map();
  const history = [];
  let latestPv;

  for (let index = 0; index < checkpointHashes.length; index++) {
    const hash = checkpointHashes[index];
    const tx = await getTransaction(hash);
    assert.equal(tx.inputs.length, index === 0 ? 2 : 1, 'expected one anchor input and a deposit input only at genesis checkpoint');
    assert.equal(tx.inputs[0].previous_output.tx_hash, previousHash, 'checkpoint history is not a contiguous anchor lineage');
    assert.equal(tx.inputs[0].previous_output.index, '0x0');
    const witness = Buffer.from(tx.witnesses[0].slice(2), 'hex');
    const inputType = witnessField(witness, 1);
    const da = witnessField(witness, 2);
    assert.equal(inputType.length, 644, 'unexpected checkpoint proof/public-values witness length');
    assert.equal(da.length % 56, 0, 'published DA is not fixed-width records');
    const pv = inputType.subarray(356);
    const outputData = Buffer.from(tx.outputs_data[0].slice(2), 'hex');
    assert.equal(outputData.length, 80);
    assert(previousData.subarray(0, 32).equals(pv.subarray(40, 72)), 'public values previous root does not match prior anchor');
    assert.equal(u64(previousData, 32), u64(pv, 72), 'public values previous sequence does not match prior anchor');
    assert(outputData.subarray(0, 32).equals(pv.subarray(80, 112)), 'successor anchor root mismatch');
    assert.equal(u64(outputData, 32), u64(pv, 112), 'successor anchor sequence mismatch');
    assert.equal(u128(outputData, 40), u128(pv, 200), 'successor anchor total mismatch');
    assert.equal(u64(outputData, 72), u64(pv, 232), 'successor anchor epoch mismatch');

    const records = [];
    for (let offset = 0; offset < da.length; offset += 56) {
      const record = da.subarray(offset, offset + 56);
      const key = `0x${record.subarray(0, 32).toString('hex')}`;
      const balance = BigInt(`0x${record.subarray(32, 48).toString('hex')}`);
      const nonce = record.readBigUInt64BE(48);
      state.set(key, { key: Buffer.from(record.subarray(0, 32)), balance, nonce });
      records.push({ key, balance_shannons: balance.toString(), nonce: nonce.toString() });
    }
    history.push({ hash, sequence: u64(outputData, 32).toString(), root: `0x${outputData.subarray(0, 32).toString('hex')}`, total_shannons: u128(outputData, 40).toString(), last_epoch: u64(outputData, 72).toString(), da_records: records });
    previousData = outputData;
    previousHash = hash;
    latestPv = pv;
  }

  const snapshot = Buffer.concat([...state.values()].sort((a, b) => Buffer.compare(a.key, b.key)).map(record => {
    const output = Buffer.alloc(56);
    record.key.copy(output, 0);
    output.writeBigUInt64BE(0n, 32);
    let balance = record.balance;
    for (let i = 47; i >= 32; i--) { output[i] = Number(balance & 255n); balance >>= 8n; }
    output.writeBigUInt64BE(record.nonce, 48);
    return output;
  }));
  const snapshotPath = path.join(outputDir, 'replayed-full-state.bin');
  const pvPath = path.join(outputDir, 'latest-public-values.bin');
  fs.writeFileSync(snapshotPath, snapshot);
  fs.writeFileSync(pvPath, latestPv);
  const proofs = [];
  for (const [index, pubkey] of pubkeys.entries()) {
    const helper = cp.execFileSync(process.env.CARGO_BIN || 'cargo', [
      'run', '--offline', '--quiet', '--manifest-path', helperManifest, '--', snapshotPath, pvPath, pubkey,
    ], { encoding: 'utf8', env: process.env, maxBuffer: 2 * 1024 * 1024 });
    proofs.push(JSON.parse(helper.trim()));
    fs.writeFileSync(path.join(outputDir, `proof-${index}.json`), JSON.stringify(proofs[index], null, 2));
  }
  const totalFromLeaves = [...state.values()].reduce((sum, record) => sum + record.balance, 0n);
  assert.equal(totalFromLeaves, u128(previousData, 40), 'replayed account balances do not equal latest anchor total');
  const report = {
    genesis_transaction: genesisHash,
    checkpoint_transactions: history,
    checkpoint_count: history.length,
    latest_anchor: { transaction: previousHash, root: `0x${previousData.subarray(0, 32).toString('hex')}`, sequence: u64(previousData, 32).toString(), total_shannons: u128(previousData, 40).toString(), last_epoch: u64(previousData, 72).toString() },
    snapshot_record_count: state.size,
    snapshot_balance_total_shannons: totalFromLeaves.toString(),
    proofs,
    reconstruction_inputs: 'committed CKB RPC transactions and their published WitnessArgs DA/public-values only; no fixture, indexer, or sequencer files',
  };
  fs.writeFileSync(path.join(outputDir, 'history-reconstruction.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });

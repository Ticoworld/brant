// Fresh-process proof reconstruction. Reads only a committed checkpoint transaction
// from the local CKB RPC; it has no fixture/source/sequencer input.
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const [checkpointHash, pubkey, outputDir] = process.argv.slice(2);
if (!checkpointHash || !pubkey || !outputDir) throw new Error('usage: script <checkpoint-tx-hash> <owner-pubkey> <output-dir>');
const rpcUrl = process.env.CKB_RPC_URL || 'http://127.0.0.1:19224';
const helperManifest = path.resolve(__dirname, '../scripts/force-exit-witness/Cargo.toml');
fs.mkdirSync(outputDir, { recursive: true });

function witnessField(data, index) {
  assert(data.length >= 16, 'WitnessArgs shorter than table header');
  const total = data.readUInt32LE(0);
  assert.equal(total, data.length, 'WitnessArgs total size mismatch');
  const offsets = [data.readUInt32LE(4), data.readUInt32LE(8), data.readUInt32LE(12)];
  const begin = offsets[index];
  const end = index === 2 ? total : offsets[index + 1];
  assert(begin >= 16 && begin <= end && end <= total, 'WitnessArgs offset out of range');
  const field = data.subarray(begin, end);
  if (field.length === 0) return Buffer.alloc(0); // None
  assert(field.length >= 4, 'truncated optional Bytes');
  const length = field.readUInt32LE(0);
  assert.equal(length, field.length - 4, 'Molecule Bytes length mismatch');
  return field.subarray(4);
}

(async () => {
  const response = await fetch(rpcUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'get_transaction', params: [checkpointHash] }),
  }).then(r => r.json());
  if (response.error) throw new Error(response.error.message);
  assert.equal(response.result?.tx_status?.status, 'committed', 'checkpoint is not committed');
  const tx = response.result.transaction;
  assert(tx && tx.witnesses?.length && tx.outputs_data?.length, 'checkpoint transaction malformed');
  const witness = Buffer.from(tx.witnesses[0].slice(2), 'hex');
  const da = witnessField(witness, 2);
  const inputType = witnessField(witness, 1);
  assert.equal(inputType.length, 644, 'unexpected checkpoint proof/public-values witness length');
  const pv = inputType.subarray(356);
  assert.equal(pv.length, 288);
  const anchorData = Buffer.from(tx.outputs_data[0].slice(2), 'hex');
  assert.equal(anchorData.length, 80);
  const provenRoot = pv.subarray(80, 112);
  const chainRoot = anchorData.subarray(0, 32);
  assert(provenRoot.equals(chainRoot), 'live checkpoint anchor root differs from on-chain public values');
  const daPath = path.join(outputDir, 'rpc-published-da.bin');
  const pvPath = path.join(outputDir, 'rpc-public-values.bin');
  fs.writeFileSync(daPath, da);
  fs.writeFileSync(pvPath, pv);
  fs.writeFileSync(path.join(outputDir, 'checkpoint-rpc-response.json'), JSON.stringify(response, null, 2));
  const cargo = process.env.CARGO_BIN || 'cargo';
  const helper = cp.execFileSync(cargo, ['run', '--offline', '--quiet', '--manifest-path', helperManifest, '--', daPath, pvPath, pubkey], {
    encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
  });
  const proof = JSON.parse(helper.trim());
  assert.equal(proof.root, `0x${chainRoot.toString('hex')}`, 'reconstructed DA root differs from live anchor');
  fs.writeFileSync(path.join(outputDir, 'rpc-proof-reconstruction.json'), JSON.stringify({
    checkpoint_hash: checkpointHash,
    tx_status: response.result.tx_status.status,
    da_bytes: da.length,
    public_values_bytes: pv.length,
    live_anchor_root: `0x${chainRoot.toString('hex')}`,
    reconstructed_root: proof.root,
    nullified_root: proof.nullified_root,
    owner_key: proof.owner_key,
    balance_shannons: proof.balance_shannons,
    da_records: Array.from({ length: da.length / 56 }, (_, index) => {
      const record = da.subarray(index * 56, (index + 1) * 56);
      return {
        key: `0x${record.subarray(0, 32).toString('hex')}`,
        balance_shannons: BigInt(`0x${record.subarray(32, 48).toString('hex')}`).toString(),
        nonce: record.readBigUInt64BE(48).toString(),
      };
    }),
    witness_hex: proof.witness_hex,
    inputs: 'committed CKB RPC transaction only; no fixture, indexer, or sequencer state',
  }, null, 2));
  console.log(JSON.stringify(proof));
})().catch(error => { console.error(error); process.exitCode = 1; });

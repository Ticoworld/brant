import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {verifyExternalSell,verifyBatchBuy} from '../lib/pudge-market-service.ts';

const evidence = process.argv[2];
assert(evidence, 'Pass the isolated Gate 2 events.jsonl path');
const rows = readFileSync(evidence, 'utf8').trim().split(/\r?\n/).map(line => JSON.parse(line));
const raw = row => {
  assert(row.committed, 'Expected a committed native transaction');
  const tx = ccc.Transaction.from(row.tx);
  assert.equal(tx.hash(), row.hash);
  return {...cccA.JsonRpcTransformers.transactionFrom(tx), hash: row.hash};
};
const find = label => raw(rows.find(row => row.label === label));
const sell = find('external_xudt_curve_redemption');
const resolve = input => {
  const point = input.previous_output;
  const tx = raw(rows.find(row => row.hash === point.tx_hash));
  const index = Number(point.index);
  return {tx, output: tx.outputs[index], data: tx.outputs_data[index]};
};
const [inventory, marker, token, funding] = sell.inputs.map(resolve);
const asScript = cccA.JsonRpcTransformers.scriptTo;
const identity = {
  market: asScript(inventory.output.lock),
  token: asScript(inventory.output.type),
  marker: asScript(marker.output.type),
  markerData: marker.data,
};
const result = verifyExternalSell(inventory.tx, sell, identity, token, funding);
assert.equal(result.owner, asScript(token.output.lock).hash());
assert.equal(result.quantity, 1n);
const buys = ['initial_curve_purchase', 'new_buyer_enrollment'].map(find);
assert.notEqual(asScript(buys[0].outputs[4].lock).hash(), asScript(buys[1].outputs[4].lock).hash());
assert.equal(token.tx.hash, find('owner_authorized_external_withdrawal').hash);
console.log(sell.hash, result);
const batch = find('owners_4_batch_2');
const batchInputs = batch.inputs.map(resolve);
const batchIdentity = {
  ...identity,
  custody: asScript(batchInputs[2].output.lock),
  custodyMarker: asScript(batchInputs[3].output.type),
  custodyMarkerData: batchInputs[3].data,
};
const verify = tx => verifyBatchBuy(batchInputs[0].tx, batchInputs[2].tx, tx, batchIdentity, batchInputs.slice(4));
const executions = verify(batch);
assert.deepEqual(executions.map(row => row.quantity), [1n, 1n]);
assert.notEqual(executions[0].owner, executions[1].owner);
assert.equal(executions[1].amount - executions[0].amount, 100_000_000n);
for (const [mutate, expectedError] of [
  [tx => { tx.witnesses[7] = '0x'; }, /metadata/],
  [tx => { tx.outputs[4].capacity = '0x0'; }, /price or capacity/],
  [tx => { tx.outputs[5].lock = tx.outputs[4].lock; }, /funding identity/],
  [tx => { tx.inputs[0].previous_output.index = '0x1'; }, /predecessor/],
  [tx => { tx.outputs[0].type = null; }, /script identity/],
]) {
  const invalid = structuredClone(batch);
  mutate(invalid);
  assert.throws(() => verify(invalid), expectedError);
}
console.log(batch.hash, executions);

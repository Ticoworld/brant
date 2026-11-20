import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const bundle = JSON.parse(readFileSync(new URL('./fixtures/pudge-custody-after.json', import.meta.url)));
const withdrawals = bundle.history.filter(({transaction}) => transaction.inputs.length === 3 && transaction.outputs.length === 4);
assert.equal(withdrawals.length, 2);
let total = 0n;
for (const {transaction, tx_hash} of withdrawals) {
  const token = transaction.outputs[2];
  assert.deepEqual(token.type, bundle.xudt_type_script);
  assert.deepEqual(token.lock, transaction.outputs[3].lock);
  assert.equal(transaction.outputs[3].type, null);
  const amount = Buffer.from(transaction.outputs_data[2].slice(2), 'hex');
  assert.equal(amount.length, 16);
  total += amount.readBigUInt64LE() + (amount.readBigUInt64LE(8) << 64n);
  console.log(tx_hash + ':0x2', token.lock.args);
}
assert.equal(total, 2n);
console.log('Canonical withdrawals created 2 RVK in owner-locked outputs.');

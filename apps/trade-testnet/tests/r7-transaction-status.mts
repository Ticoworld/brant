import assert from 'node:assert/strict';
import { transactionStatus, transactionUnresolved } from '../lib/r7-transaction-status.ts';

for (const value of [null, {}, {tx_status:{status:'unknown'}}, {tx_status:{status:'future'}}]) {
  assert.equal(transactionStatus(value), 'unknown');
  assert.equal(transactionUnresolved(transactionStatus(value)), true);
}
for (const value of ['pending', 'proposed']) assert.equal(transactionStatus({tx_status:{status:value}}), 'pending');
for (const value of ['committed', 'rejected'] as const) {
  assert.equal(transactionStatus({tx_status:{status:value}}), value);
  assert.equal(transactionUnresolved(value), false);
}
// Simulated removal after a previously observed commit must re-lock actions.
assert.equal(transactionUnresolved(transactionStatus(null)), true);
console.log('R7 transaction status transitions passed (simulated RPC responses)');

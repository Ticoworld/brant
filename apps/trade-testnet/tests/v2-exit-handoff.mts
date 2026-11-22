import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {verifyInitializationSignature} from '../lib/v2-engine/initialization-signature.ts';

const report = JSON.parse(readFileSync(new URL(
  '../evidence/v2-independent-recovery-1794492388055/withdrawal.json', import.meta.url,
), 'utf8'));
const signed = ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(report.transaction));
const review = signed.clone();
review.witnesses[2] = '0x';
const inputs = [{lock: review.outputs[0].lock}, {lock: review.outputs[1].lock}, {lock: review.outputs[2].lock}];
const verify = (candidate: ccc.Transaction) =>
  verifyInitializationSignature(review, candidate, inputs, 2, report.owner_lock_hash);

assert.equal(signed.hash(), report.transaction_hash);
assert.equal(verify(signed), true);
assert.throws(() => verify(review), /signature witness/);

for (const change of [
  (tx: ccc.Transaction) => { tx.outputs[2].lock = tx.outputs[0].lock; },
  (tx: ccc.Transaction) => { tx.outputs[3].capacity -= 1n; },
  (tx: ccc.Transaction) => { tx.inputs[2].previousOutput.index += 1n; },
  (tx: ccc.Transaction) => { tx.outputsData[0] = '0x'; },
]) {
  const candidate = signed.clone();
  change(candidate);
  assert.throws(() => verify(candidate), /changed reviewed transaction/);
}

const changedProof = signed.clone();
changedProof.witnesses[3] = '0x';
assert.throws(() => verify(changedProof), /changed reviewed witnesses/);
assert.throws(() => verifyInitializationSignature(review, signed, inputs, 2, inputs[0].lock.hash()), /changed wallet/);
console.log('Retained isolated exit signature and review mutation checks passed');

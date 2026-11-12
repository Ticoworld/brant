import assert from 'node:assert/strict';
import { validateTransitionProof } from '../lib/v2-engine/proof.ts';
const old = '0x' + '11'.repeat(32), next = '0x' + '22'.repeat(32);
const result = {format:'trade-v2-smt-transition-v1', operation:1, old_root:old, new_root:next, contract_witness:{hex:'0x544d533101'}, proof:{csmt_old_root_verified:true,csmt_new_root_verified:true}};
assert.equal(validateTransitionProof(result, old, 1).root, next);
assert.throws(() => validateTransitionProof(result, next, 1));
assert.throws(() => validateTransitionProof(result, old, 4));
assert.throws(() => validateTransitionProof({...result, proof:{...result.proof,csmt_old_root_verified:false}}, old, 1));
console.log('Proof result guards passed');

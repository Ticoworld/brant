import assert from 'node:assert/strict';
import {invalidateExternalBalance,isExternalBalanceCurrent} from '../app/trader/external-balance.ts';
const key='owner:token:root';
const first={key,balance:3n,expiresAt:30_000};
assert(isExternalBalanceCurrent(first,key,10_000)); // refresh pending
const second={...first,expiresAt:45_000};
assert(isExternalBalanceCurrent(second,key,15_000)); // refresh succeeded
const failed=invalidateExternalBalance(second,key);
assert.equal(failed?.balance,3n);
assert(!isExternalBalanceCurrent(failed,key,16_000));
assert(!isExternalBalanceCurrent(failed,key,17_000)); // retry pending
assert(isExternalBalanceCurrent({...second,expiresAt:50_000},key,20_000));
assert(!isExternalBalanceCurrent(second,key,45_000));
for(const changed of ['other:token:root','owner:other:root','owner:token:other']) assert(!isExternalBalanceCurrent(second,changed,20_000));
console.log('PASS external balance refresh, failure, retry, expiry and identity');

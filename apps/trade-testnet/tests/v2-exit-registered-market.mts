import assert from 'node:assert/strict';
import {ccc} from '@ckb-ccc/core';
import {checkRegisteredTransaction, verifyRegisteredMarket} from '../exit-signer/registered-market.ts';
import {PUDGE_GATE2_GENESIS, PUDGE_GATE2_INITIALIZATION} from '../lib/v2-engine/pudge-public-registry.ts';

const client = new ccc.ClientPublicTestnet({url:'https://testnet.ckb.dev/', fallbacks: []});
await verifyRegisteredMarket(client);
const receipt = await client.getTransactionNoCache(PUDGE_GATE2_INITIALIZATION);
assert.ok(receipt);
const initial = receipt.transaction;
const owner = initial.outputs[4];
const tx = ccc.Transaction.from({
  headerDeps: [PUDGE_GATE2_GENESIS],
  cellDeps: [
    {outPoint:{txHash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:0},depType:'depGroup'},
    ...[0,2].map(index => ({outPoint:{txHash:'0x573be2deb4bd7cd28679e5f30a194b2774fd674bd4d96844898cc25dcc49897e',index},depType:'code' as const})),
    {outPoint:{txHash:'0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f',index:0},depType:'code'},
  ],
  inputs: [2,3,4].map(index => ({previousOutput:{txHash:PUDGE_GATE2_INITIALIZATION,index}})),
  outputs:[initial.outputs[2],initial.outputs[3],{lock:owner.lock,type:initial.outputs[2].type,capacity:14200000000n},owner],
  outputsData:[initial.outputsData[2],initial.outputsData[3],'0x','0x'],
});
checkRegisteredTransaction(tx);
for (const [mutate, error] of [
  [(t:ccc.Transaction) => {t.outputs[2].type!.args = '0x';}, /registered RVK/],
  [(t:ccc.Transaction) => {t.outputs[0].lock.args = '0x';}, /registered RVK\/CKB market/],
  [(t:ccc.Transaction) => {t.cellDeps[1].outPoint.index += 1n;}, /code dependency/],
  [(t:ccc.Transaction) => {t.headerDeps = [];}, /genesis header/],
  [(t:ccc.Transaction) => {t.headerDeps = [ccc.hexFrom(new Uint8Array(32))];}, /genesis header/],
] as const) {
  const changed = tx.clone();
  mutate(changed);
  assert.throws(() => checkRegisteredTransaction(changed), error);
}
console.log('Canonical Pudge identity and live dependencies verified, and transaction substitutions rejected');

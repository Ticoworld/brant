import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cccA} from '@ckb-ccc/core/advanced';
import {verifyExternalSell} from '../lib/pudge-market-service.ts';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/pudge-interleaved-sell.json',import.meta.url)));
const internal=fixture.transactions[fixture.sell].transaction;
const previous=fixture.transactions[internal.inputs[0].previous_output.tx_hash].transaction;
const withdrawal=fixture.transactions[internal.inputs[2].previous_output.tx_hash].transaction;
const fundingTx=fixture.transactions[internal.inputs[4].previous_output.tx_hash].transaction;
const token={output:withdrawal.outputs[2],data:withdrawal.outputs_data[2]};
const funding={output:fundingTx.outputs[2],data:fundingTx.outputs_data[2]};
const identity={
 market:cccA.JsonRpcTransformers.scriptTo(previous.outputs[0].lock),
 token:cccA.JsonRpcTransformers.scriptTo(previous.outputs[0].type),
 marker:cccA.JsonRpcTransformers.scriptTo(previous.outputs[1].type),
 markerData:previous.outputs_data[1],
};
const next={
 inputs:[...internal.inputs.slice(0,2),{previous_output:{tx_hash:withdrawal.hash,index:'0x2'}},internal.inputs[4]],
 outputs:[...internal.outputs.slice(0,2),token.output,internal.outputs[4]],
 outputs_data:[...internal.outputs_data.slice(0,2),'0x'+'00'.repeat(16),'0x'],
 witnesses:['0x','0x','0x','0x','0x01'+'00'.repeat(15)],
};
const expected=verifyExternalSell(previous,next,identity,token,funding);
assert.equal(expected.quantity,1n);
assert.equal(expected.amount,2_400_000_000n);
assert.equal(expected.owner,cccA.JsonRpcTransformers.scriptTo(token.output.lock).hash());

for(const [mutate,error] of [
 [tx=>{tx.inputs[0].previous_output.index='0x1';},/predecessor/],
 [tx=>{tx.outputs[2].type=null;},/token identity/],
 [tx=>{tx.outputs[3].lock.args='0x'+'11'.repeat(20);},/seller or funding/],
 [tx=>{tx.outputs_data[1]='0x';},/marker data/],
 [tx=>{tx.outputs_data[2]=token.data;},/quantity or inventory/],
 [tx=>{tx.witnesses[4]='0x';},/witness quantity/],
 [tx=>{tx.witnesses[4]='0x01'+'00'.repeat(7)+'ff'.repeat(8);},/minimum proceeds/],
 [tx=>{tx.outputs[0].capacity=previous.outputs[0].capacity;},/reserve/],
 [tx=>{tx.outputs[1].capacity='0x0';},/preserved capacity/],
 [tx=>{tx.outputs[3].capacity='0x0';},/payout or fee/],
]){
 const mutated=structuredClone(next);
 mutate(mutated);
 assert.throws(()=>verifyExternalSell(previous,mutated,identity,token,funding),error);
}
console.log('External Sell arithmetic and ten rejection checks passed using a synthetic transaction.');

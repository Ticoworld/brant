import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {appendMarketExecutions} from '../lib/pudge-market-service.ts';

const load = name => JSON.parse(readFileSync(new URL('./fixtures/native-competing-buys'+name+'.json',import.meta.url)));
const evidence=load('');
const initialRow=load('-initial').committed;
const winnerRow=evidence.winnerStatus;
const hash = tx => ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(tx)).hash();
assert.equal(hash(winnerRow.transaction),evidence.firstHash);
assert.equal(hash(evidence.competitor),evidence.secondHash);
assert.deepEqual(winnerRow.transaction.inputs,evidence.competitor.inputs);
assert(BigInt(evidence.firstCycles.cycles)>0n && BigInt(evidence.secondCycles.cycles)>0n);
assert.equal(winnerRow.tx_status.status,'committed');
assert.equal(evidence.loser.tx_status.status,'rejected');
assert.equal(evidence.rejection.code,-301);
assert.match(evidence.rejection.message,/Resolve failed Unknown/);
assert.notEqual(evidence.predecessor.status,'live');
const winner=winnerRow.transaction;
for(const [index,cell] of evidence.cells.entries()){
  assert.equal(cell.status,'live');
  assert.deepEqual(cell.cell.output,winner.outputs[index]);
  assert.equal(cell.cell.data.content,winner.outputs_data[index]);
}
const initial=initialRow.transaction;
const asScript=cccA.JsonRpcTransformers.scriptTo;
const identity={market:asScript(initial.outputs[0].lock),marker:asScript(initial.outputs[1].type),token:asScript(initial.outputs[0].type),custody:asScript(initial.outputs[2].lock),custodyMarker:asScript(initial.outputs[3].type),markerData:initial.outputs_data[1],custodyMarkerData:initial.outputs_data[3]};
const lineage=[initialRow,winnerRow].map(row=>({transaction:row.transaction,blockNumber:row.tx_status.block_number,timestampMs:'0'}));
const replay=async()=>{
  const history=[];
  await appendMarketExecutions(history,lineage,identity,async()=>assert.fail('Both singleton pairs resolve from the canonical predecessor'));
  return history;
};
const history=await replay();
assert.deepEqual(await replay(),history);
assert.equal(history.length,1);
assert.equal(history[0].hash,evidence.firstHash);
assert.equal(history[0].quantity,'1');
const amount=data=>Buffer.from(data.slice(2,34),'hex').readBigUInt64LE();
assert.equal(amount(winner.outputs_data[0]),1992n);
assert.equal(amount(winner.outputs_data[2]),8n);
assert.equal(amount(winner.witnesses[5].slice(0,2)+winner.witnesses[5].slice(154,170).padEnd(32,'0')),8n);
assert.equal(BigInt(winner.outputs[0].capacity)-BigInt(initial.outputs[0].capacity),BigInt(history[0].amountShannons));
console.log('Native competition replay passed',history[0]);

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {cccA} from '@ckb-ccc/core/advanced';
import {appendMarketExecutions} from '../lib/pudge-market-service.ts';

const directory = resolve(process.argv[2]);
const rows = JSON.parse('[' + readFileSync(resolve(directory, 'events.jsonl'), 'utf8').trim().split(/\r?\n/).join(',') + ']');
const summary = JSON.parse(readFileSync(resolve(directory, 'summary.json'), 'utf8'));
const transactions = new Map();
const headers = new Map();
const blocks = new Map();
const generated = new Set();
for (const line of readFileSync(resolve(directory, 'rpc.jsonl'), 'utf8').trim().split(/\r?\n/)) {
  const {method, params, response} = JSON.parse(line);
  const value = response.result;
  if (method === 'get_transaction' && value?.tx_status?.status === 'committed') transactions.set(params[0], value);
  if (method === 'generate_block' && typeof value === 'string') generated.add(value);
  if (value?.header?.hash) {
    headers.set(value.header.hash, value.header);
    blocks.set(value.header.number, value.header.hash);
  }
}
// The runner saves generated block hashes and committed positions, but omits
// most full headers. Timestamp zero is a display placeholder for this test.
for (const {tx_status:status} of transactions.values()) {
  assert(generated.has(status.block_hash) || headers.has(status.block_hash));
  assert.equal(blocks.get(status.block_number) ?? status.block_hash, status.block_hash);
  blocks.set(status.block_number, status.block_hash);
  if (!headers.has(status.block_hash))headers.set(status.block_hash,{hash:status.block_hash,number:status.block_number,timestamp:'0x0'});
}
const marketRows = rows.filter(row => /initial_curve_purchase|existing_owner_additional_purchase|new_buyer_enrollment|owners_4_batch_2|external_xudt_curve_redemption|^curve_sell_owner_|post_selldown_/.test(row.label));
const lineage = marketRows.map(row => {
  const record = transactions.get(row.hash);
  assert.equal(record.tx_status.status, 'committed');
  const {block_number,block_hash} = record.tx_status;
  const header = headers.get(block_hash);
  assert.equal(blocks.get(block_number),block_hash);
  return {transaction:record.transaction,blockNumber:block_number,timestampMs:header.timestamp};
});
const initial= lineage[0].transaction;
const [market,marker,custody,custodyMarker]=initial.outputs.map(cell=>cccA.JsonRpcTransformers.scriptTo(cell.lock));
const identity={
  market,
  marker:cccA.JsonRpcTransformers.scriptTo(initial.outputs[1].type),
  custody,
  custodyMarker:cccA.JsonRpcTransformers.scriptTo(initial.outputs[3].type),
  token:cccA.JsonRpcTransformers.scriptTo(initial.outputs[0].type),
  markerData:initial.outputs_data[1],
  custodyMarkerData:initial.outputs_data[3],
};
let calls=0;
const rpc=async (method,[key])=>{
  calls++;
  const result=({get_transaction:transactions,get_header:headers,get_block_hash:blocks})[method]?.get(key);
  assert(result, 'Missing retained RPC row '+method+' '+key);
  return result;
};
async function replay(label,events,segment){
  const start=performance.now(), before=calls;
  await appendMarketExecutions(events,segment,identity,rpc);
  console.log(label,{ms:Math.round(performance.now()-start),rpc:calls-before,rssMiB:Math.round(process.memoryUsage().rss/2**20)});
}
const cold=[];
await replay('cold',cold,lineage);
const incremental=[];
await replay('prefix',incremental,lineage.slice(0,4));
await replay('successors',incremental,lineage.slice(3));
assert.deepEqual(incremental,cold);
assert.equal(cold.length,lineage.length);
assert.equal(new Set(cold.map(event=>event.owner)).size,4);
assert.equal(new Set(cold.map(event=>event.hash+':'+(event.executionIndex??0))).size,cold.length);
const tip=lineage.at(-1).transaction;
assert.equal(tip.hash,summary.finalMarket.txHash);
assert.equal(tip.hash,summary.finalCustody.txHash);
assert.equal(BigInt(tip.outputs[0].capacity).toString(),summary.finalMarketCapacity);
assert.equal(tip.outputs_data[2].slice(34),summary.roots.final);
console.log('Verified successor executions:',cold.length);
const batchRow = lineage[3];
const batch = batchRow.transaction;
const proofBinary = resolve(directory, '../../recovery/target/release/trade-v2-recovery.exe');
const {spawnSync} = await import('node:child_process');
const history = lineage.slice(0,4).map(({transaction}) => {
  const {tx_status:status}=transactions.get(transaction.hash);
  return {tx_hash:transaction.hash,block_number:status.block_number,tx_index:status.tx_index,block_hash:status.block_hash,transaction};
});
const bundle={
  format:'trade-v2-recovery-bundle-v1',init_tx_hash:initial.hash,
  owner_lock_hash:cold[0].owner,custody_lock:initial.outputs[2].lock,xudt_type_script:initial.outputs[2].type,
  history,live:{tx_hash:batch.hash,index:'0x2',capacity:batch.outputs[2].capacity,output:batch.outputs[2],data:batch.outputs_data[2]},
};
const runProof = value => spawnSync(proofBinary,['replay','-','-'],{input:JSON.stringify(value),encoding:'utf8',timeout:10000});
const positive=runProof(bundle);
assert.ifError(positive.error);
assert.equal(positive.status,0,positive.stderr);
const invalid=structuredClone(bundle);
const mutated=invalid.history.at(-1).transaction;
const data=mutated.outputs_data[2];
mutated.outputs_data[2]=data.slice(0,34)+'00'.repeat(32);
invalid.live.data=mutated.outputs_data[2];
const negative=runProof(invalid);
assert.ifError(negative.error);
assert.notEqual(negative.status,0);
assert.match(negative.stderr,/new root proof/);
console.log('Native recovery verifies the batch custody root and rejects a changed successor root.');

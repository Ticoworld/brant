import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync,mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {getPudgeMarketData,getPudgeMarketDataForManifest,getPudgeCustodyAnchor,getPudgeDisplaySnapshot} from '../lib/pudge-market-service.ts';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/pudge-market-rpc.json',import.meta.url)));
process.env.ROVEKO_PUDGE_PROOF_CACHE_DIR??=mkdtempSync(join(tmpdir(),'brant-market-'));
process.env.ROVEKO_PUDGE_SNAPSHOT_KEY='ab'.repeat(32);
let calls=0,offline=false,earlier=false,reorg=false,interruptSuccessor=false,replacement=false;
const read=(method,params)=>fixture[JSON.stringify([method,params])];
const sellHash='0xe853a6fd0f5c6cd0d73c1822c0953b728b9e2860cf641d36c4c2bee22f7a9bd1';
const sell=read('get_transaction',[sellHash]).transaction;
const predecessors=sell.inputs.slice(0,4).map(input=>input.previous_output);
const checkpointFile=join(process.env.ROVEKO_PUDGE_PROOF_CACHE_DIR,'pudge-xudt-market.json');
const snapshot=()=>readFileSync(checkpointFile,'utf8');
const structural=({market,...anchor})=>{
 const {refreshedAt,...state}=market;
 return {...anchor,market:state};
};
globalThis.fetch=async(url,options)=>{
 assert.equal(url,'https://testnet.ckb.dev/');
 const input=JSON.parse(options.body);
 const lookup=({id,method,params})=>{
  calls++;
  if(interruptSuccessor&&method==='get_transaction'&&params[0]===sellHash)throw Error('Interrupted successor read');
  if(offline)throw Error('Simulated provider interruption');
  if(reorg&&method==='get_block_hash')return {id,result:'0x'+'00'.repeat(32)};
  if(reorg&&method==='get_transaction')throw Error('Replacement history unavailable');
  const key=JSON.stringify([method,params]);
  assert(Object.hasOwn(fixture,key)||method==='get_live_cell'||method==='get_block_hash',key);
  let result=fixture[key];
  if(result===undefined&&method==='get_live_cell'){
   const [point,withData]=params;
   result=withData?{status:'dead'}:read(method,[point,true]);
  }
  if(result===undefined&&method==='get_block_hash'){
   const row=read('get_transaction',[predecessors[2].tx_hash]);
   if(params[0]===row.tx_status.block_number)result=row.tx_status.block_hash;
  }
  assert.notEqual(result,undefined,key);
  if(replacement&&method==='get_block_hash'&&params[0]===read('get_tip_header',[]).number)return {id,result:'0x'+'99'.repeat(32)};
  if(earlier&&method==='get_tip_header'){
   const row=read('get_transaction',[predecessors[2].tx_hash]);
   result=read('get_header',[row.tx_status.block_hash]);
   if(replacement)result={...result,number:read('get_tip_header',[]).number,hash:'0x'+'99'.repeat(32)};
  }
  if(earlier&&method==='get_cells'){
   result=structuredClone(result);
   for(const cell of result.objects){
    if(cell.out_point.tx_hash===sellHash)cell.out_point=predecessors[Number(cell.out_point.index)];
   }
  }
  if(earlier&&method==='get_live_cell'){
   const point=params[0];
   const predecessor=predecessors.find(p=>p.tx_hash===point.tx_hash&&p.index===point.index);
   if(predecessor){
    const tx=read('get_transaction',[point.tx_hash]).transaction;
    const index=Number(point.index);
    result={status:'live',cell:{output:tx.outputs[index],data:{content:tx.outputs_data[index]}}};
   }
  }
  return {id,result};
 };
 return Response.json(Array.isArray(input)?input.map(lookup):lookup(input));
};
const measure=async(name,fn)=>{
 const start=performance.now(),first=calls;
 const value=await fn();
 console.log(name,{ms:Math.round(performance.now()-start),rpc:calls-first,rssMiB:Math.round(process.memoryUsage().rss/1024**2)});
 return value;
};
if(process.argv[2]==='replacement-cold'){
 earlier=true;
 replacement=true;
 console.log(JSON.stringify(structural(await getPudgeCustodyAnchor())));
 process.exit(0);
}
if(process.argv[2]==='restart'){
 const state=await measure('process restart',getPudgeCustodyAnchor);
 assert(calls<30,'Restart fell back to cold reconstruction');
 console.log(JSON.stringify(structural(state)));
 process.exit(0);
}
if(process.argv[2]==='incremental'){
 earlier=true;
 const before=await measure('checkpoint seed',getPudgeCustodyAnchor);
 assert.equal(before.custody,'13');
 assert.equal(before.market.history.length,8);
 const seedSnapshot=snapshot();
 earlier=false;
 interruptSuccessor=true;
 await assert.rejects(getPudgeCustodyAnchor,/Interrupted successor read/);
 assert.equal(snapshot(),seedSnapshot);
 assert.deepEqual((await getPudgeDisplaySnapshot()).history,before.market.history);
 interruptSuccessor=false;
 const rename=fs.promises.rename;
 let intercepted=false;
 fs.promises.rename=async (temporary,destination)=>{
  if(destination!==checkpointFile)return rename(temporary,destination);
  intercepted=true;
  assert.equal(JSON.parse(readFileSync(temporary,'utf8')).payload.length>0,true);
  throw Error('Injected checkpoint rename failure');
 };
 syncBuiltinESMExports();
 try{
  assert.deepEqual((await getPudgeCustodyAnchor()).market.history.map(event=>event.hash).slice(0,-1),before.market.history.map(event=>event.hash));
  assert(intercepted,'Checkpoint publication was not intercepted');
  assert.equal(snapshot(),seedSnapshot);
 }finally{
  fs.promises.rename=rename;
  syncBuiltinESMExports();
 }
 const recovered=spawnSync(process.execPath,['--experimental-strip-types',fileURLToPath(import.meta.url),'resume'],{encoding:'utf8',timeout:20000});
 assert.equal(recovered.status,0,recovered.stderr);
 console.log(recovered.stdout.trim());
 process.exit(0);
}
if(process.argv[2]==='resume'){
 const start=calls;
 const advanced=await measure('checkpoint successor',getPudgeCustodyAnchor);
 assert(calls-start<100,'Successor replay fell back to cold reconstruction');
 const repeated=await getPudgeCustodyAnchor();
 assert.deepEqual(structural(repeated),structural(advanced));
 assert.equal(new Set(repeated.market.history.map(event=>event.hash)).size,repeated.market.history.length);
 console.log(JSON.stringify(structural(advanced)));
 process.exit(0);
}
const cold=await measure('registered cold',getPudgeCustodyAnchor);
assert.equal(cold.market.historyState,'verified');
assert.equal(cold.market.history.length,9);
assert.equal(cold.market.history.at(-1).hash,'0xe853a6fd0f5c6cd0d73c1822c0953b728b9e2860cf641d36c4c2bee22f7a9bd1');
assert.equal(cold.inventory,'1986');
assert.equal(cold.custody,'12');
const manifest=await measure('manifest cold',()=>getPudgeMarketDataForManifest(JSON.stringify(cold.market.manifest)));
assert.deepEqual(manifest.history,cold.market.history);
for(const key of ['tip','inventory','custody','supply','custodyRoot','curve','buyOneShannons','sellOneShannons'])assert.deepEqual(manifest[key],cold.market[key],key);

for(const mode of ['restart','incremental']){
 const child=spawnSync(process.execPath,['--experimental-strip-types',fileURLToPath(import.meta.url),mode],{
  encoding:'utf8',env:{...process.env,ROVEKO_PUDGE_PROOF_CACHE_DIR:mode==='restart'?process.env.ROVEKO_PUDGE_PROOF_CACHE_DIR:mkdtempSync(join(tmpdir(),'brant-successor-'))},timeout:20000,
 });
 assert.equal(child.status,0,child.stderr);
 const lines=child.stdout.trim().split(/\r?\n/);
 const actual=JSON.parse(lines.pop());
 assert.deepEqual(actual,JSON.parse(JSON.stringify(structural(cold))));
 console.log(lines.join('\n'));
}
const originalSnapshot=snapshot();
offline=true;
await assert.rejects(getPudgeMarketData);
await assert.rejects(getPudgeCustodyAnchor);
const display=await getPudgeDisplaySnapshot();
assert.deepEqual(display.history,cold.market.history);
assert.deepEqual(display.tip,cold.market.tip);
assert.equal(display.historyState,'unavailable');

assert.equal(snapshot(),originalSnapshot);

offline=false;
reorg=true;
await assert.rejects(getPudgeCustodyAnchor);
assert.equal(await getPudgeDisplaySnapshot(),null);
assert.equal(snapshot(),originalSnapshot);
console.log('Verified history survives interruption and stale anchors cannot authorize current state.');

// The replacement chain retains the withdrawal prefix and omits the Sell.
reorg=false;
earlier=true;
replacement=true;
const replaced=await getPudgeCustodyAnchor();
assert.equal(replaced.market.history.length,cold.market.history.length-1);
assert.deepEqual(replaced.market.history,cold.market.history.slice(0,-1));
assert.equal(replaced.custody,'13');
assert.equal(new Set(replaced.market.history.map(event=>event.hash)).size,replaced.market.history.length);
const branchCold=spawnSync(process.execPath,['--experimental-strip-types',fileURLToPath(import.meta.url),'replacement-cold'],{
 encoding:'utf8',timeout:20000,env:{...process.env,ROVEKO_PUDGE_PROOF_CACHE_DIR:mkdtempSync(join(tmpdir(),'brant-replacement-'))},
});
assert.equal(branchCold.status,0,branchCold.stderr);
assert.deepEqual(JSON.parse(branchCold.stdout),JSON.parse(JSON.stringify(structural(replaced))));
console.log('Replacement without the orphaned Sell matches cold recovery.');

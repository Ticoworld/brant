// Read-only audit of the harness's known event history. NOT a recovery signing guard.
// Does not establish resistance to arbitrary discovered orders or fix upstream LO-01.
const C=require('./lib.cjs'),assert=require('node:assert/strict');
function review(events,a2Hash){
 const byHash=new Map(events.map(e=>[e.hash,e]));let mints=0,matches=0;
 const isOrder=o=>o.lock.codeHash===a2Hash&&o.lock.hashType==='data1'&&o.lock.args==='0x';
 function master(data,outPoint){const d=C.b(data);assert.equal(d.length,89);const action=d.readUInt32LE(16);if(action===0){const index=Number(BigInt(outPoint.index))+d.readInt32LE(52);assert(index>=0);return {txHash:outPoint.txHash,index:C.hex(index)};}assert.equal(action,1);return {txHash:C.hx(d.subarray(20,52)),index:C.hex(d.readUInt32LE(52))};}
 for(const e of events)for(let i=0;i<e.tx.outputs.length;i++){
  const o=e.tx.outputs[i];if(!isOrder(o))continue;
  const data=e.tx.outputsData[i],point={txHash:e.hash,index:C.hex(i)},mp=master(data,point),d=C.b(data);
  const creation=byHash.get(mp.txHash);assert(creation,'Master creation absent from known history');const mo=creation.tx.outputs[Number(BigInt(mp.index))];assert(mo?.type);assert.equal(C.U.scriptToHash(mo.type),C.U.scriptToHash(o.lock));
  if(d.readUInt32LE(16)===0){assert.equal(mp.txHash,e.hash);assert.equal(d.subarray(20,52).toString('hex'),'00'.repeat(32));mints++;}
  else {
   const previous=e.tx.inputs.flatMap(input=>{const pe=byHash.get(input.previousOutput.txHash);if(!pe)return [];const j=Number(BigInt(input.previousOutput.index)),po=pe.tx.outputs[j];if(!po||!isOrder(po))return [];const pmp=master(pe.tx.outputsData[j],input.previousOutput);return pmp.txHash===mp.txHash&&pmp.index===mp.index?[{po,data:pe.tx.outputsData[j]}]:[];});
   assert.equal(previous.length,1,'Expected one known authentic predecessor');assert.equal(C.U.scriptToHash(previous[0].po.type),C.U.scriptToHash(o.type));assert.equal(C.b(previous[0].data).subarray(56).toString('hex'),d.subarray(56).toString('hex'));matches++;
  }
 }
 return {status:'PASS',mints,matches,scope:'Read-only consistency of self-created event lineage; no arbitrary-forgery rejection or secure discovery proof'};
}
if(require.main===module){const dir=process.argv[2],events=JSON.parse(C.fs.readFileSync(dir+'/events.json')),env=JSON.parse(C.fs.readFileSync(dir+'/environment.json'));const result=review(events,env.codes.a2.hash);const last=events.find(e=>e.tx.outputs.some(o=>o.lock.codeHash===env.codes.a2.hash));assert(last);assert.throws(()=>review(events.filter(e=>e.hash!==last.hash),env.codes.a2.hash));result.validation='Removing a required mint history record is detected offline; no chain attack performed';console.log(JSON.stringify(result));}
module.exports={review};

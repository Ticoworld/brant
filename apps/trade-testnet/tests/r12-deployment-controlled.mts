import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {ccc} from '@ckb-ccc/core';
import {createDeploymentService, type DeploymentDependencies} from '../lib/deployment-service.ts';

// This key and every cell exist solely in this controlled fixture.
const key='0x'+'01'.padStart(64,'0'),sample='0x'+'42'.repeat(32);
const owner={codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type' as const,args:ccc.hashCkbShort(ccc.recoverMessageSecp256k1(sample,ccc.signMessageSecp256k1(sample,key)))};
const genesis='0x'+'12'.repeat(32),funding='0x'+'34'.repeat(32),dependency='0x'+'56'.repeat(32);
const code=await readFile('../../labs/wo15-merkle-intent/r7/build/merkle_intent');
const codeHash='0x6870b841e2b873ca563b95313bcac6f20e299d17c395e1f907d0723d4fa16c36';
assert.equal(ccc.hashCkb(code),codeHash);
const folder=await mkdtemp(path.join(tmpdir(),'trade-r12-controlled-'));
try {
 const dbFile=path.join(folder,'attempts.sqlite'),manifestFile=path.join(folder,'manifest.json');
 const db=new DatabaseSync(dbFile);db.exec('CREATE TABLE attempts (funding TEXT PRIMARY KEY, hash TEXT NOT NULL)');db.close();
 let state='pending',submissions=0,timeout=false,badCode=false,transaction:any;
 const rpc:DeploymentDependencies['rpc']=async(method,params)=>{
  if(method==='get_block_by_number')return {header:{hash:genesis}};
  if(method==='tx_pool_info')return {min_fee_rate:'0x3e8'};
  if(method==='send_transaction'){submissions++;transaction=params[0];if(timeout)throw Error('fixture timeout after accept');return ccc.Transaction.from((await import('@ckb-ccc/core/advanced')).cccA.JsonRpcTransformers.transactionTo(transaction)).hash()}
  if(method==='get_transaction')return {tx_status:{status:state},transaction};
  if(method==='get_live_cell'){
   const p=params[0] as {tx_hash:string};
   if(p.tx_hash===funding)return {status:'live',cell:{output:{lock:{code_hash:owner.codeHash,hash_type:'type',args:owner.args},capacity:'0x'+(9999986100000n).toString(16),type:null},data:{content:'0x'}}};
   if(p.tx_hash===dependency)return {status:'live'};
   return {status:'live',cell:{output:transaction.outputs[0],data:{content:badCode?'0x00':transaction.outputs_data[0]}}};
  }
  throw Error('Unexpected RPC '+method);
 };
 const journal={reserve(f:string,h:string){const db=new DatabaseSync(dbFile);try{db.prepare('INSERT INTO attempts VALUES (?,?)').run(f,h)}finally{db.close()}},has(h:string){const db=new DatabaseSync(dbFile);try{return !!db.prepare('SELECT hash FROM attempts WHERE hash=?').get(h)}finally{db.close()}}};
 const deps:DeploymentDependencies={rpc,genesis,network:'controlled-fixture',owner,funding:{txHash:funding,index:2,capacity:9999986100000n},dependency:{txHash:dependency,index:0},code:async()=>code,codeHash,codeLength:51072,codeCapacity:5113300000000n,journal,manifest:{async write(value){await writeFile(manifestFile,JSON.stringify(value),{flag:'wx'})}},broadcastAuthorized:()=>true};
 let service=createDeploymentService(deps);
 const review=await service.review(),tx=ccc.Transaction.from(review.transaction),blank=tx.witnesses[0];
 const h=new ccc.HasherCkb();h.update(review.hash);ccc.Transaction.hashWitnessToHasher(blank,h);tx.witnesses=[ccc.WitnessArgs.from({lock:ccc.signMessageSecp256k1(h.digest(),key)}).toHex()];
 const body=JSON.stringify(tx,(_,v)=>typeof v==='bigint'?v.toString():v);
 assert.equal(submissions,0);assert.deepEqual(await service.broadcast(body),{hash:review.hash,status:'submitted'});assert.equal(submissions,1);assert(journal.has(review.hash));
 await assert.rejects(service.broadcast(body));assert.equal(submissions,1);
 assert.deepEqual(await service.verify(review.hash),{status:'pending'});await assert.rejects(access(manifestFile));
 state='committed';badCode=true;await assert.rejects(service.verify(review.hash),/Committed output differs/);await assert.rejects(access(manifestFile));
 badCode=false;service=createDeploymentService(deps);const result=await service.verify(review.hash);assert.equal(result.status,'verified');
 const manifest=JSON.parse(await readFile(manifestFile,'utf8'));assert.equal(manifest.codeHash,codeHash);assert.equal(manifest.outPoint.txHash,review.hash);assert.equal(manifest.outPoint.index,'0x0');
 console.log('PASS signed deployment submitted exactly once; duplicate blocked; pending has no manifest');
 console.log('PASS incorrect code rejected; restart verified committed output and wrote manifest');
 console.log('fixture transaction:',review.hash,'code hash:',codeHash);
 // Separate timeout attempt: accepted by RPC but the response is lost.
 const db2=new DatabaseSync(dbFile);db2.exec('DELETE FROM attempts');db2.close();await rm(manifestFile);transaction=undefined;state='pending';timeout=true;submissions=0;
 await assert.rejects(service.broadcast(body),/requires reconciliation/);assert.equal(submissions,1);assert(journal.has(review.hash));
 service=createDeploymentService(deps);assert.deepEqual(await service.verify(review.hash),{status:'pending'});await assert.rejects(access(manifestFile));
 await assert.rejects(service.broadcast(body));assert.equal(submissions,1);state='committed';assert.equal((await service.verify(review.hash)).status,'verified');
 console.log('PASS timeout after acceptance; restart reconciled pending and committed without resubmission');
} finally {await rm(folder,{recursive:true,force:true})}

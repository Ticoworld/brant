import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeploymentService} from '../lib/deployment-service.ts';
const owner={codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type' as const,args:'0x'+'11'.repeat(20)};
const genesis='0x'+'12'.repeat(32),funding='0x'+'34'.repeat(32),dependency='0x'+'56'.repeat(32),calls:string[]=[];
let manifests=0;
const service=createDeploymentService({
 rpc:async(method,params)=>{calls.push(method);if(method==='get_block_by_number')return {header:{hash:genesis}};if(method==='get_live_cell'){const p=params[0] as {tx_hash:string};return p.tx_hash===funding?{status:'live',cell:{output:{lock:{code_hash:owner.codeHash,hash_type:owner.hashType,args:owner.args},capacity:'0x'+(9999986100000n).toString(16),type:null},data:{content:'0x'}}}:{status:'live'}};if(method==='tx_pool_info')return {min_fee_rate:'0x3e8'};if(method==='get_transaction')return {tx_status:{status:'pending'}};throw Error('Unexpected RPC '+method)},
 genesis,network:'isolated-fixture',owner,funding:{txHash:funding,index:2,capacity:9999986100000n},dependency:{txHash:dependency,index:0},
 code:()=>readFile('../../labs/wo15-merkle-intent/r7/build/merkle_intent'),codeHash:'0x6870b841e2b873ca563b95313bcac6f20e299d17c395e1f907d0723d4fa16c36',codeLength:51072,codeCapacity:5113300000000n,
 journal:{reserve(){throw Error('unexpected reserve')},has(){return true}},manifest:{async write(){manifests++}},broadcastAuthorized:()=>false
});
const review=await service.review();assert.equal(review.genesis,genesis);assert.equal(review.codeBytes,51072);assert.equal(review.input,'9999986100000');
await assert.rejects(service.broadcast('{}'),/Broadcast disabled/);
assert.deepEqual(await service.verify('0x'+'ab'.repeat(32)),{status:'pending'});assert.equal(manifests,0);assert(!calls.includes('send_transaction'));
console.log('PASS controlled RPC review; disabled broadcast; pending verification writes no manifest');

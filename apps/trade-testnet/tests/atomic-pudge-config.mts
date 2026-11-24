import {marketNetwork} from '../lib/v2-engine/market-network-server.ts';
import assert from 'node:assert/strict';
import {parseAtomicPudgeConfig,verifyAtomicPudgeDeployment} from '../lib/v2-engine/atomic-pudge-config.ts';
import {sharedLaunchDependencies} from '../lib/v2-engine/shared-launch.ts';
import {atomicV2Codes} from '../lib/v2-engine/atomic-launch-v2.ts';
import {PUDGE_GATE2_GENESIS} from '../lib/v2-engine/pudge-public-registry.ts';
const hash=(n:string)=>'0x'+n.repeat(64),creator=hash('1'),txHash=hash('2'),blockHash=hash('3');
const deps=Object.fromEntries(Object.entries(sharedLaunchDependencies(PUDGE_GATE2_GENESIS)).map(([k,v])=>[k,{...v,depType:k==='secp'?'depGroup':'code'}]));
for(const [name,index,code] of [['market',0,atomicV2Codes.market],['custodyMarker',1,atomicV2Codes.custodyMarker],['ownerLock',2,atomicV2Codes.initializer]] as const)deps[name]={outPoint:{txHash,index:'0x'+index},dataHash:code,depType:'code'};
const manifest={version:1,genesis:PUDGE_GATE2_GENESIS,creator,deployment:{txHash,blockHash},dependencies:deps};
assert.equal(parseAtomicPudgeConfig(JSON.stringify(manifest),creator).dependencies.ownerLock.dataHash,atomicV2Codes.initializer);
for(const change of [m=>{m.creator=hash('4');},m=>{m.genesis=hash('5');},m=>{m.deployment.txHash=null;},m=>{m.dependencies.market.dataHash=hash('6');},m=>{m.dependencies.xudt.outPoint.txHash=hash('7');},m=>{m.dependencies.ownerLock.outPoint.index='0x1';},m=>{m.dependencies.secp.depType='code';} ] as ((m:any)=>void)[]){const bad=structuredClone(manifest);change(bad);assert.throws(()=>parseAtomicPudgeConfig(JSON.stringify(bad),creator));}
let methods:string[]=[];await verifyAtomicPudgeDeployment(async method=>{methods.push(method);return method==='get_transaction'?{tx_status:{status:'committed',block_hash:blockHash,block_number:'0x1'}}:blockHash;},manifest.deployment);assert.deepEqual(methods,['get_transaction','get_block_hash']);
await assert.rejects(()=>verifyAtomicPudgeDeployment(async method=>method==='get_transaction'?{tx_status:{status:'committed',block_hash:blockHash,block_number:'0x1'}}:hash('8'),manifest.deployment),/canonical/);
console.log('Atomic Pudge config: pinned identities, restricted creator, null drafts and reorg rejection passed.');

const environment=['NODE_ENV','BRANT_ISOLATED_CONFIG','BRANT_ISOLATED_TEST','BRANT_ATOMIC_PUDGE_QUALIFICATION','BRANT_ATOMIC_PUDGE_MANIFEST','BRANT_LAUNCH_APPROVED_CREATOR'] as const;
const env=process.env as Record<string,string|undefined>;
const saved=Object.fromEntries(environment.map(name=>[name,env[name]]));
try{
 for(const name of environment)delete env[name];
 env.NODE_ENV='production';const defaults=marketNetwork();assert.equal(defaults.genesis,PUDGE_GATE2_GENESIS);assert.equal(defaults.atomic,undefined);assert.equal(defaults.fixture,undefined);
 env.BRANT_ATOMIC_PUDGE_QUALIFICATION='1';assert.throws(()=>marketNetwork(),/manifest/);
 env.BRANT_ATOMIC_PUDGE_QUALIFICATION='0';env.BRANT_ATOMIC_PUDGE_MANIFEST='/missing/disabled-file';assert.equal(marketNetwork().atomic,undefined);
 env.BRANT_ISOLATED_CONFIG='/missing/isolated-file';env.BRANT_ISOLATED_TEST='1';assert.throws(()=>marketNetwork(),/disabled/);
}finally{for(const name of environment){if(saved[name]===undefined)delete env[name];else env[name]=saved[name];}}
console.log('Production defaults stay legacy; missing qualification and isolated production overrides fail closed.');

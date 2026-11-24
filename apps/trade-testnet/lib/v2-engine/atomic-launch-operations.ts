import {verifyAtomicPudgeDeployment} from './atomic-pudge-config.ts';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {planAtomicLaunchV2} from './atomic-launch-v2.ts';
import {openAtomicLaunchDelivery} from './atomic-launch-delivery.ts';
import {discoverFunding} from './multi-funding.ts';
import {generateAtomicLaunchProof} from './pudge-launch-proof-server.ts';
import type {marketNetwork} from './market-network-server.ts';
type Rpc=Parameters<typeof planAtomicLaunchV2>[0];
const hash=/^0x[0-9a-f]{64}$/;
const json=(v:unknown)=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?String(x):x));
export function atomicLaunchOperations(rpc:Rpc,network:ReturnType<typeof marketNetwork>,send:((t:ccc.Transaction)=>Promise<string>)|undefined,authorize:(owner:string)=>boolean){
 const fixture=network.atomic||network.fixture!;
 const dependencies={market:fixture.market,marker:fixture.marker,custody:fixture.custody,custodyMarker:fixture.custodyMarker,initializer:fixture.ownerLock,xudt:fixture.xudt,secp:{...fixture.secp,depType:'depGroup' as const}};
 const open=(query:Rpc=rpc)=>{if(!process.env.BRANT_LAUNCH_SQLITE_PATH)throw Error('Launch storage unavailable');return openAtomicLaunchDelivery(process.env.BRANT_LAUNCH_SQLITE_PATH,query);};
 const status=(s:NonNullable<ReturnType<ReturnType<typeof open>['find']>>)=>{
  const tx=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(s.reviewed as never));
  const metadata=JSON.parse(new TextDecoder().decode(ccc.bytesFrom(tx.witnesses.at(-1)!))).metadata;
  return {family:'atomic',metadata,published:s.state==='published',enabled:Boolean(send&&authorize(s.owner)),market:s.market,transaction:s.reviewed,inputs:s.inputs,entries:s.state==='reviewed'?[]:[{stage:'atomic',state:s.state==='published'?'confirmed':'submitted',txHash:tx.hash()}]};
 };
 return async(action:string,input:Record<string,unknown>,timing?:(name:string,ms:number)=>void)=>{
  const counted:Rpc=async(method,params)=>{const start=performance.now();try{return await rpc(method,params);}finally{timing?.('rpc_'+method,performance.now()-start);}};
  const store=open(counted);try{
   if(network.atomicReceipt&&['prepare','submit','resubmit'].includes(action))await verifyAtomicPudgeDeployment(counted,network.atomicReceipt);
   if(action==='sessions'){if(typeof input.owner!=='string'||!hash.test(input.owner))throw Error('Invalid owner');return store.sessions(network.genesis,input.owner).map(s=>({...status(s),market:s.market}));}
   if(action==='prepare'){
    const creator=ccc.Script.from(input.creator as ccc.ScriptLike);
    if(network.atomic&&!authorize(creator.hash()))throw Error('Creator is not approved for atomic qualification');
    const cells=(await discoverFunding(counted,counted,creator)).filter(c=>!c.type&&c.data==='0x').map(c=>({...c,type:undefined})).sort((a,b)=>a.capacity>b.capacity?-1:a.capacity<b.capacity?1:JSON.stringify(a.outPoint).localeCompare(JSON.stringify(b.outPoint))).slice(0,64);
    if(!cells.length)throw Error('Insufficient atomic funding');
    const integer=(key:string,fallback:bigint)=>{const v=input[key];if(v===undefined)return fallback;if(typeof v!=='string'||!/^\d{1,20}$/.test(v))throw Error('Invalid launch terms');return BigInt(v);};
    const plan=await planAtomicLaunchV2(counted,{...(network.atomic?{publicQualification:{approvedCreator:creator.hash()}}:{isolatedDevelopment:true as const}),genesis:network.genesis,anchor:cells[0],funding:cells.slice(1),supply:integer('supply',2000n),base:integer('base',1000000000n),step:integer('increment',100000000n),quantity:integer('quantity',7n),fee:1000000n,dependencies,metadata:input.metadata,proof:async(...args)=>{const start=performance.now();try{return await generateAtomicLaunchProof(...args);}finally{timing?.('proof',performance.now()-start);}}});
    await store.reserve(plan,cells,Object.values(dependencies),input.logo as string|undefined);
    const a=plan.accounting;
    return {family:'atomic',market:plan.authorization.market,token:plan.scripts.token.hash(),transaction:cccA.JsonRpcTransformers.transactionFrom(plan.transaction),inputs:json(cells),enabled:Boolean(send&&authorize(creator.hash())),descriptor:{family:'atomic',market:plan.authorization.market},accounting:json({eligibleFunding:cells.reduce((n,c)=>n+c.capacity,0n),locked:130000000000n+a.reserve,change:a.change,curveReserve:a.reserve,fees:a.fee,stageFees:{setup:a.fee,issuance:0n,purchase:0n}})};
   }
   const {market,owner}=input;if(typeof market!=='string'||!hash.test(market)||typeof owner!=='string'||!hash.test(owner))throw Error('Invalid atomic session');
   const session=store.find(market,owner);if(!session)return null;if(session.genesis!==network.genesis)throw Error('Atomic session network differs');
   if(action==='session')return status(session);
   if(action==='resubmit'){if(!send||!authorize(owner))throw Error('Launch execution is disabled');await store.resubmit(market,owner,send);return status(store.read(market,owner));}
   if(action==='submit'){
    if(!send||!authorize(owner))throw Error('Launch execution is disabled');
    await store.submit(market,owner,ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(input.signed as never)),send);
    return status(store.read(market,owner));
   }
   if(action==='reconcile'||action==='publish'||action==='retry-publication'){
    await store.reconcile(market,owner);return status(store.read(market,owner));
   }
   throw Error('Unsupported atomic action');
  }finally{store.close();}
 };
}

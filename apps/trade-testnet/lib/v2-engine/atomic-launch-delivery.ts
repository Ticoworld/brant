import {DatabaseSync} from 'node:sqlite';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {verifyInitializationSignature} from './initialization-signature.ts';
import {verifyInitializationLive} from './initialization-live.ts';
import {verifyInitializationStage} from './initialization-lifecycle.ts';
import {verifyAtomicMetadataAuthorization} from './atomic-launch-v2.ts';
import {validateLaunchLogo} from './launch-logo-server.ts';

type Rpc=Parameters<typeof verifyInitializationLive>[0];
type Inputs=Parameters<typeof verifyInitializationLive>[2];
type Dependencies=Parameters<typeof verifyInitializationLive>[3];
type Plan=Awaited<ReturnType<typeof import('./atomic-launch-v2.ts').planAtomicLaunchV2>>;
type Snapshot={genesis:string;market:string;owner:string;reviewed:unknown;signed?:unknown;inputs:unknown[];dependencies:Dependencies;logo?:string;state:'reviewed'|'submitted'|'published';receipt?:unknown;publication?:unknown};
const encode=(x:unknown)=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v);
const decodeTx=(x:unknown)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(x as never));
/** Durable atomic delivery in the application's existing SQLite database. All
 * transitions compare the immutable snapshot, including unknown submissions. */
export function openAtomicLaunchDelivery(path:string,rpc:Rpc){
 const db=new DatabaseSync(path);db.exec(`PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS atomic_launch_delivery(market TEXT PRIMARY KEY,tx_hash TEXT UNIQUE NOT NULL,snapshot TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS atomic_launch_funding(point TEXT PRIMARY KEY,market TEXT NOT NULL);`);
 function load(market:string){const row=db.prepare('SELECT snapshot FROM atomic_launch_delivery WHERE market=?').get(market);if(typeof row?.snapshot!=='string')throw Error('Atomic review unavailable');return {raw:row.snapshot,value:JSON.parse(row.snapshot) as Snapshot};}
 function save(market:string,raw:string,value:Snapshot){if(db.prepare('UPDATE atomic_launch_delivery SET snapshot=? WHERE market=? AND snapshot=?').run(encode(value),market,raw).changes!==1)throw Error('Atomic session changed concurrently');}
 function inputs(value:Snapshot):Inputs{return value.inputs.map(raw=>{const c=raw as Inputs[number];return {...c,capacity:BigInt(c.capacity)};});}
 return {
  close:()=>db.close(),
  find(market:string,owner:string){const row=db.prepare('SELECT snapshot FROM atomic_launch_delivery WHERE market=?').get(market);if(typeof row?.snapshot!=='string')return null;const value=JSON.parse(row.snapshot) as Snapshot;return value.owner===owner?value:null;},
  candidate(market:string){const row=db.prepare("SELECT snapshot FROM atomic_launch_delivery WHERE market=? AND json_extract(snapshot,'$.state')='published'").get(market);return typeof row?.snapshot==='string'?JSON.parse(row.snapshot) as Snapshot:null;},
  candidates(genesis:string,after:string){return db.prepare("SELECT market FROM atomic_launch_delivery WHERE market>? AND json_extract(snapshot,'$.genesis')=? AND json_extract(snapshot,'$.state')='published' ORDER BY market LIMIT 5").all(after,genesis).map(r=>String(r.market));},
  sessions(genesis:string,owner:string){return db.prepare("SELECT snapshot FROM atomic_launch_delivery WHERE json_extract(snapshot,'$.genesis')=? AND json_extract(snapshot,'$.owner')=? ORDER BY rowid DESC LIMIT 50").all(genesis,owner).map(r=>JSON.parse(String(r.snapshot)) as Snapshot);},
  read(market:string,owner:string){const {value}=load(market);if(value.owner!==owner)throw Error('Atomic creator differs');return value;},
  async reserve(plan:Plan,creatorInputs:Inputs,dependencies:Dependencies,logo?:string){
   const {genesis,market,owner,metadata}=plan.authorization;
   // Logos must already be normalized before the transaction review is signed.
   if(logo!==undefined||metadata.logoHash){const normalized=await validateLaunchLogo(logo,metadata.logoHash);if(normalized!==logo)throw Error('Normalize logo before atomic review');}
   if(creatorInputs.some(c=>ccc.Script.from(c.lock).hash()!==owner)||plan.transaction.inputs.length!==creatorInputs.length||creatorInputs.some((c,i)=>plan.transaction.inputs[i].previousOutput.txHash!==c.outPoint.txHash||plan.transaction.inputs[i].previousOutput.index!==BigInt(c.outPoint.index)))throw Error('Atomic funding identity differs');
   const snapshot:Snapshot={genesis,market,owner,reviewed:cccA.JsonRpcTransformers.transactionFrom(plan.transaction),inputs:JSON.parse(encode(creatorInputs)),dependencies:structuredClone(dependencies),logo,state:'reviewed'};
   const existing=db.prepare('SELECT snapshot FROM atomic_launch_delivery WHERE market=?').get(market);if(existing){if(existing.snapshot!==encode(snapshot))throw Error('Atomic immutable review differs');return snapshot;}
   db.exec('BEGIN IMMEDIATE');try{
    db.prepare('INSERT INTO atomic_launch_delivery VALUES(?,?,?)').run(market,plan.transaction.hash(),encode(snapshot));
    for(const c of creatorInputs)db.prepare('INSERT INTO atomic_launch_funding VALUES(?,?)').run(`${genesis}:${c.outPoint.txHash}:${BigInt(c.outPoint.index)}`,market);
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   return snapshot;
  },
  async submit(market:string,owner:string,signed:ccc.Transaction,send:(tx:ccc.Transaction)=>Promise<string>){
   const {raw,value}=load(market);if(value.owner!==owner||value.state!=='reviewed')throw Error('Atomic review is not available for submission');
   const reviewed=decodeTx(value.reviewed),creatorInputs=inputs(value);
   verifyInitializationSignature(reviewed,signed,creatorInputs,0,owner);
   verifyAtomicMetadataAuthorization(signed,creatorInputs,value);
   await verifyInitializationLive(rpc,value.genesis,creatorInputs,value.dependencies);
   const next={...value,state:'submitted' as const,signed:cccA.JsonRpcTransformers.transactionFrom(signed)};
   save(market,raw,next); // Persist before broadcast. Errors must retain this hash.
   if(await send(signed.clone())!==reviewed.hash())throw Error('Atomic acknowledgement differs; reconcile saved transaction');
   return {state:'submitted',txHash:reviewed.hash()};
  },
  async resubmit(market:string,owner:string,send:(tx:ccc.Transaction)=>Promise<string>){
   const {value}=load(market);if(value.owner!==owner||value.state!=='submitted'||!value.signed)throw Error('No pending atomic transaction');
   const signed=decodeTx(value.signed),reviewed=decodeTx(value.reviewed),creatorInputs=inputs(value);
   const row=await rpc('get_transaction',[reviewed.hash()]) as {transaction?:unknown;tx_status?:{status?:string}}|null;
   if(row?.transaction||row?.tx_status?.status&&row.tx_status.status!=='unknown')return {state:'submitted',txHash:reviewed.hash()};
   verifyInitializationSignature(reviewed,signed,creatorInputs,0,owner);verifyAtomicMetadataAuthorization(signed,creatorInputs,value);
   await verifyInitializationLive(rpc,value.genesis,creatorInputs,value.dependencies);
   if(await send(signed.clone())!==reviewed.hash())throw Error('Atomic acknowledgement differs; retain pending transaction');
   return {state:'submitted',txHash:reviewed.hash()};
  },
  async reconcile(market:string,owner:string){
   const {raw,value}=load(market);if(value.owner!==owner||!value.signed||value.state==='reviewed')throw Error('No submitted atomic transaction');
   const signed=decodeTx(value.signed),creatorInputs=inputs(value);
   verifyInitializationSignature(decodeTx(value.reviewed),signed,creatorInputs,0,owner);
   const metadata=verifyAtomicMetadataAuthorization(signed,creatorInputs,value);
   // Historical outputs may already be spent; canonical receipt, not liveness,
   // establishes issuance. Successor recovery is a separate obligation.
   const receipt=await verifyInitializationStage(rpc,value.genesis,'purchase',signed,creatorInputs.map(c=>c.outPoint),[0,1,2,3],false);
   if(value.logo!==undefined||metadata.logoHash){const logo=await validateLaunchLogo(value.logo,metadata.logoHash);if(logo!==value.logo)throw Error('Atomic logo differs from authorization');}
   const publication={version:1,genesis:value.genesis,market,owner,token:signed.outputs[0].type!.hash(),metadata,receipt,transactionHash:signed.hash()};
   save(market,raw,{...value,state:'published',receipt,publication});
   return {state:'published',publication};
  },
 };
}

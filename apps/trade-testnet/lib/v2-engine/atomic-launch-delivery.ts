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
type Snapshot={genesis:string;market:string;owner:string;reviewed:unknown;signed?:unknown;inputs:unknown[];dependencies:Dependencies;logo?:string;reviewId?:string;expiresAt?:number;state:'reviewed'|'submitted'|'published'|'cancelled';receipt?:unknown;publication?:unknown};
const encode=(x:unknown)=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?String(v):v);
const decodeTx=(x:unknown)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(x as never));
/** Durable atomic delivery in the application's existing SQLite database. All
 * transitions compare the immutable snapshot, including unknown submissions. */
export function openAtomicLaunchDelivery(path:string,rpc:Rpc){
 const db=new DatabaseSync(path);db.exec(`PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS atomic_launch_delivery(market TEXT PRIMARY KEY,tx_hash TEXT UNIQUE NOT NULL,snapshot TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS atomic_launch_funding(point TEXT PRIMARY KEY,market TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS atomic_launch_review_history(review_id TEXT PRIMARY KEY,market TEXT NOT NULL,snapshot TEXT NOT NULL,reason TEXT NOT NULL,recorded_at INTEGER NOT NULL);`);
 // Adopt old unsigned reviews once; never rewrite submitted or published data.
 db.prepare("UPDATE atomic_launch_delivery SET snapshot=json_set(snapshot,'$.reviewId',tx_hash,'$.expiresAt',?) WHERE json_extract(snapshot,'$.state')='reviewed' AND json_extract(snapshot,'$.signed') IS NULL AND json_extract(snapshot,'$.expiresAt') IS NULL").run(Date.now()+15*60*1000);
 db.exec('BEGIN IMMEDIATE');try{
  const expired=db.prepare("SELECT market,snapshot FROM atomic_launch_delivery WHERE json_extract(snapshot,'$.state')='reviewed' AND json_extract(snapshot,'$.signed') IS NULL AND json_extract(snapshot,'$.expiresAt')<=?").all(Date.now());
  for(const row of expired){
   const value=JSON.parse(String(row.snapshot)) as Snapshot;
   db.prepare('INSERT OR IGNORE INTO atomic_launch_review_history VALUES(?,?,?,?,?)').run(value.reviewId!,value.market,String(row.snapshot),'expired',Date.now());
   db.prepare('UPDATE atomic_launch_delivery SET snapshot=? WHERE market=? AND snapshot=?').run(encode({...value,state:'cancelled'}),row.market,row.snapshot);
   db.prepare('DELETE FROM atomic_launch_funding WHERE market=?').run(row.market);
  }
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');db.close();throw error;}
 function load(market:string){const row=db.prepare('SELECT snapshot FROM atomic_launch_delivery WHERE market=?').get(market);if(typeof row?.snapshot!=='string')throw Error('Atomic review unavailable');return {raw:row.snapshot,value:JSON.parse(row.snapshot) as Snapshot};}
 function save(market:string,raw:string,value:Snapshot){if(db.prepare('UPDATE atomic_launch_delivery SET snapshot=? WHERE market=? AND snapshot=?').run(encode(value),market,raw).changes!==1)throw Error('Atomic session changed concurrently');}
 function inputs(value:Snapshot):Inputs{return value.inputs.map(raw=>{const c=raw as Inputs[number];return {...c,capacity:BigInt(c.capacity)};});}
 return {
  close:()=>db.close(),
  protectedLegacyAnchors(genesis:string){
   if(!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='shared_launch'").get())return [];
   return db.prepare('SELECT anchor_key FROM shared_launch WHERE anchor_key LIKE ?').all(genesis+':%').map(row=>String(row.anchor_key).slice(genesis.length+1));
  },
  cancel(market:string,owner:string){
   db.exec('BEGIN IMMEDIATE');try{
    const {raw,value}=load(market);
    if(value.owner!==owner)throw Error('Atomic creator differs');
    if(value.state==='cancelled'){db.exec('COMMIT');return {state:'cancelled' as const};}
    if(value.state!=='reviewed'||value.signed)throw Error('Submitted atomic transaction must be reconciled');
    save(market,raw,{...value,state:'cancelled'});
    db.prepare('DELETE FROM atomic_launch_funding WHERE market=?').run(market);
    db.exec('COMMIT');return {state:'cancelled' as const};
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  find(market:string,owner:string){const row=db.prepare('SELECT snapshot FROM atomic_launch_delivery WHERE market=?').get(market);if(typeof row?.snapshot!=='string')return null;const value=JSON.parse(row.snapshot) as Snapshot;return value.owner===owner?value:null;},
  candidate(market:string){const row=db.prepare("SELECT snapshot FROM atomic_launch_delivery WHERE market=? AND json_extract(snapshot,'$.state')='published'").get(market);return typeof row?.snapshot==='string'?JSON.parse(row.snapshot) as Snapshot:null;},
  candidates(genesis:string,after:string){return db.prepare("SELECT market FROM atomic_launch_delivery WHERE market>? AND json_extract(snapshot,'$.genesis')=? AND json_extract(snapshot,'$.state')='published' ORDER BY market LIMIT 5").all(after,genesis).map(r=>String(r.market));},
  sessions(genesis:string,owner:string){return db.prepare("SELECT snapshot FROM atomic_launch_delivery WHERE json_extract(snapshot,'$.genesis')=? AND json_extract(snapshot,'$.owner')=? ORDER BY rowid DESC LIMIT 50").all(genesis,owner).map(r=>JSON.parse(String(r.snapshot)) as Snapshot);},
  read(market:string,owner:string){const {value}=load(market);if(value.owner!==owner)throw Error('Atomic creator differs');return value;},
  async transactionStatus(market:string,owner:string){
   const {value}=load(market);if(value.owner!==owner)throw Error('Atomic creator differs');
   if(value.state!=='submitted')return {state:value.state};
   const row=await rpc('get_transaction',[decodeTx(value.reviewed).hash()]) as {tx_status?:{status?:string}}|null;
   return {state:row?.tx_status?.status==='committed'?'confirmed':'submitted'};
  },
  async reserve(plan:Plan,creatorInputs:Inputs,dependencies:Dependencies,logo?:string){
   const {genesis,market,owner,metadata}=plan.authorization;
   // Logos must already be normalized before the transaction review is signed.
   if(logo!==undefined||metadata.logoHash){const normalized=await validateLaunchLogo(logo,metadata.logoHash);if(normalized!==logo)throw Error('Normalize logo before atomic review');}
   if(creatorInputs.some(c=>ccc.Script.from(c.lock).hash()!==owner)||plan.transaction.inputs.length!==creatorInputs.length||creatorInputs.some((c,i)=>plan.transaction.inputs[i].previousOutput.txHash!==c.outPoint.txHash||plan.transaction.inputs[i].previousOutput.index!==BigInt(c.outPoint.index)))throw Error('Atomic funding identity differs');
   const snapshot:Snapshot={genesis,market,owner,reviewed:cccA.JsonRpcTransformers.transactionFrom(plan.transaction),inputs:JSON.parse(encode(creatorInputs)),dependencies:structuredClone(dependencies),logo,state:'reviewed'};
   db.exec('BEGIN IMMEDIATE');try{
    const archive=(value:Snapshot,reason:string)=>{
     db.prepare('INSERT OR IGNORE INTO atomic_launch_review_history VALUES(?,?,?,?,?)').run(value.reviewId??decodeTx(value.reviewed).hash(),value.market,encode(value),reason,Date.now());
     db.prepare('DELETE FROM atomic_launch_funding WHERE market=?').run(value.market);
    };
    const existing=db.prepare('SELECT snapshot FROM atomic_launch_delivery WHERE market=?').get(market);
    if(typeof existing?.snapshot==='string'){
     const value=JSON.parse(existing.snapshot) as Snapshot;
     if(value.state==='reviewed'&&(!value.expiresAt||value.expiresAt>Date.now())&&encode(value.reviewed)===encode(snapshot.reviewed)&&value.logo===logo){db.exec('COMMIT');return value;}
     if(value.signed||!['reviewed','cancelled'].includes(value.state))throw Error('Existing atomic transaction must be reconciled');
     archive(value,'superseded');
     snapshot.reviewId=crypto.randomUUID();snapshot.expiresAt=Date.now()+15*60*1000;
     save(market,existing.snapshot,snapshot);
     db.prepare('UPDATE atomic_launch_delivery SET tx_hash=? WHERE market=?').run(plan.transaction.hash(),market);
    }else{
     snapshot.reviewId=crypto.randomUUID();snapshot.expiresAt=Date.now()+15*60*1000;
     db.prepare('INSERT INTO atomic_launch_delivery VALUES(?,?,?)').run(market,plan.transaction.hash(),encode(snapshot));
    }
    for(const c of creatorInputs){
     const point=`${genesis}:${c.outPoint.txHash}:${BigInt(c.outPoint.index)}`;
     const reserved=db.prepare('SELECT market FROM atomic_launch_funding WHERE point=?').get(point);
     if(reserved&&reserved.market!==market){
      const prior=load(String(reserved.market));
      if(prior.value.owner!==owner||prior.value.signed||prior.value.state!=='reviewed')throw Error('Funding reserved by a pending transaction');
      archive(prior.value,'superseded');save(prior.value.market,prior.raw,{...prior.value,state:'cancelled'});
     }
     db.prepare('INSERT OR IGNORE INTO atomic_launch_funding VALUES(?,?)').run(point,market);
    }
    db.exec('COMMIT');
   }catch(e){db.exec('ROLLBACK');throw e;}
   return snapshot;
  },
  async submit(market:string,owner:string,signed:ccc.Transaction,send:(tx:ccc.Transaction)=>Promise<string>){
   const {raw,value}=load(market);if(value.owner!==owner||value.state!=='reviewed')throw Error('Atomic review is not available for submission');
   if(value.expiresAt&&value.expiresAt<=Date.now())throw Error('Atomic review expired; prepare again');
   const reviewed=decodeTx(value.reviewed),creatorInputs=inputs(value);
   verifyInitializationSignature(reviewed,signed,creatorInputs,0,owner);
   verifyAtomicMetadataAuthorization(signed,creatorInputs,value);
   await verifyInitializationLive(rpc,value.genesis,creatorInputs,value.dependencies);
   if(value.expiresAt&&value.expiresAt<=Date.now())throw Error('Atomic review expired; prepare again');
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

'use client';
import {useState,useRef} from 'react';
import {useSigner} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {deriveMarketIdentity} from '../../../lib/v2-engine/initialization.ts';
import {prepareLocalInitializationStage} from '../../../lib/v2-engine/initialization-orchestrator.ts';
import {verifyInitializationStage} from '../../../lib/v2-engine/initialization-lifecycle.ts';
import {verifyInitializationSignature} from '../../../lib/v2-engine/initialization-signature.ts';
import {verifyCodeDeployment} from '../../../lib/v2-engine/deployment-verification.ts';
import {createLocalManifest} from '../../../lib/v2-engine/local-manifest.ts';
import {fetchLocalFixtureBootstrap} from '../../../lib/v2-engine/local-fixture.ts';

type Stage='setup'|'issuance'|'purchase';
type Point={txHash:string;index:string};
type Receipt={stage:Stage;txHash:string;blockHash:string;outputs:Point[]};
type Saved={stage:Stage;tx:unknown;inputs:Point[];indices:number[];receipt?:Receipt};
type Wallet=ReturnType<typeof useSigner>;
const UNIT=100_000_000n, key='roveko-local-initialization-v1';
const steps:Stage[]=['setup','issuance','purchase'];
const txFrom=(raw:unknown)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(raw as never));
const points=(tx:ccc.Transaction)=>tx.inputs.map(i=>({txHash:i.previousOutput.txHash,index:ccc.numToHex(i.previousOutput.index)}));

/** Test-only owner-controlled path. Never uses this fixture on a public node. */
export default function LocalInitialization({signer}:{signer:Wallet}){
 const [message,setMessage]=useState('Fixture initialization: connect disposable wallet 2 for setup.'),[review,setReview]=useState<{stage:Stage;tx:ccc.Transaction;inputs:Parameters<typeof verifyInitializationSignature>[2];owner:string;refresh:()=>Promise<{transaction:ccc.Transaction;hash:string}>}|null>(null),[revision,setRevision]=useState(0),[marketReady,setMarketReady]=useState(false);
 const signed=useRef<ccc.Transaction|null>(null), activeSigner=useRef(signer);activeSigner.current=signer;
 const rpc=async(method:string,params:unknown[])=>{const r=await fetch('/api/local-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(!r.ok||j.error)throw Error('Private RPC failed');return j.result;};
 const readJournal=(genesis:string):Saved[]=>{const raw=localStorage.getItem(key+':'+genesis);if(!raw)return [];const j=JSON.parse(raw);if(!Array.isArray(j)||j.length>3)throw Error('Invalid fixture initialization journal');return j;};
 const fixture=async()=>{if((await rpc('get_blockchain_info',[]) as {chain?:string})?.chain!=='ckb_dev')throw Error('Disposable ckb_dev node required');const response=await fetchLocalFixtureBootstrap();if(!response.ok)throw Error('Fixture bootstrap unavailable');const f=await response.json();if(!f.genesis||await rpc('get_block_hash',['0x0'])!==f.genesis)throw Error('Fixture genesis mismatch');
  if(process.env.NEXT_PUBLIC_ROVEKO_REQUIRE_DEPLOYED_CODES==='1'){
   const raw=localStorage.getItem('roveko-local-code-confirmed:'+f.genesis);if(!raw)throw Error('Confirm local code deployment first');const saved=JSON.parse(raw),names=['custody_smt','market_smt','custody_marker','marker_candidate','owner_lineage_candidate'];
   if(saved.genesis!==f.genesis||!/^0x[0-9a-f]{64}$/i.test(saved.txHash)||!Array.isArray(saved.codeHashes)||saved.codeHashes.length!==names.length||names.some((n,i)=>saved.codeHashes[i]?.toLowerCase()!==f.hashes[n]?.toLowerCase()))throw Error('Invalid confirmed code record');
   const chain=await rpc('get_transaction',[saved.txHash]);if(!chain?.transaction)throw Error('Confirmed code transaction unavailable');const codeTx=txFrom(chain.transaction);
   const verified=await verifyCodeDeployment(rpc,codeTx,f.genesis,saved.codeHashes);if(verified.hash.toLowerCase()!==saved.txHash.toLowerCase())throw Error('Code deployment mismatch');
   names.forEach((name,i)=>{f.deps[name]={outPoint:{txHash:verified.hash,index:'0x'+i.toString(16)},depType:'code'};});
  }
  return f;};
 async function cell(p:Point){const v=await rpc('get_live_cell',[{tx_hash:p.txHash,index:p.index},true]);if(v.status!=='live'||!v.cell)throw Error('Required fixture cell is unavailable');const s=(x:{code_hash:string;hash_type:string;args:string})=>({codeHash:x.code_hash,hashType:x.hash_type,args:x.args});return {outPoint:p,capacity:BigInt(v.cell.output.capacity),lock:s(v.cell.output.lock),...(v.cell.output.type?{type:s(v.cell.output.type)}:{}),data:v.cell.data.content};}
 async function prepare(){try{
  if(!signer)throw Error('Connect disposable wallet');const f=await fixture(),j=readJournal(f.genesis);
  if(j.some((v,i)=>v.stage!==steps[i]||!v.receipt))throw Error('Previous attempt requires confirmation');
  const stage=steps[j.length];if(!stage)throw Error('Initialization already recorded');
  const role=stage==='issuance'?0:2, owner=ccc.Script.from(f.wallets[role].lock);
  if((await signer.getRecommendedAddressObj()).script.hash()!==owner.hash())throw Error(`Connect disposable wallet ${role} for ${stage}`);
  const identity=deriveMarketIdentity({anchor:f.wallets[0].outPoint,genesis:f.genesis,base:10n*UNIT,step:UNIT,supply:2000n,codes:{market:f.hashes.market_smt,marker:f.hashes.marker_candidate,owner:f.hashes.owner_lineage_candidate,custody:f.hashes.custody_smt,custodyMarker:f.hashes.custody_marker,xudt:f.hashes.xudt}});
  const genesis=await rpc('get_block_by_number',['0x0']);const secp={outPoint:{txHash:genesis.transactions[1].hash,index:'0x0'},depType:'depGroup'};
  const depNames=stage==='setup'?[]:stage==='issuance'?['owner_lineage_candidate','xudt','marker_candidate']:['market_smt','marker_candidate','custody_smt','custody_marker','xudt'];
  const depLike=[secp,...depNames.map(n=>f.deps[n])];
  const deps=await Promise.all(depLike.map(async(d:{outPoint:Point},i:number)=>{const v=await rpc('get_live_cell',[{tx_hash:d.outPoint.txHash,index:d.outPoint.index},true]);if(v.status!=='live'||!v.cell?.data?.content)throw Error('Fixture dependency unavailable');const dataHash=ccc.hashCkb(v.cell.data.content);if(i>0&&dataHash!==f.hashes[depNames[i-1]])throw Error('Fixture dependency mismatch');return {outPoint:d.outPoint,dataHash};}));
  const previous=j.at(-1),prior=previous?{transaction:txFrom(previous.tx),requiredInputs:previous.inputs,liveIndices:previous.indices}:undefined;
  let request:Parameters<typeof prepareLocalInitializationStage>[2], inputs:Awaited<ReturnType<typeof cell>>[];
  if(stage==='setup'){
    inputs=[await cell(f.wallets[2].outPoint)];request={stage,params:{identity,anchor:f.wallets[0].outPoint,inputs,ownerCapacity:200n*UNIT,buyerCapacity:2000n*UNIT,fee:1_000_000n,secpDep:secp}};
  }else if(stage==='issuance'){
    if(!previous?.receipt)throw Error('Missing setup receipt');inputs=[await cell(f.wallets[0].outPoint),await cell(previous.receipt.outputs[0])];request={stage,previous:previous.receipt,params:{identity,anchor:inputs[0],ownerCell:inputs[1],supply:2000n,inventoryCapacity:300n*UNIT,markerCapacity:300n*UNIT,fee:1_000_000n,deps:depLike}};
  }else{
    if(!previous?.receipt||!j[0]?.receipt)throw Error('Missing predecessor receipts');inputs=[await cell(previous.receipt.outputs[0]),await cell(previous.receipt.outputs[1]),await cell(j[0].receipt.outputs[1])];const p=await fetch('/api/v2-init-proof',{method:'POST'});if(!p.ok)throw Error('Initial proof unavailable');const proof=await p.json();request={stage,previous:previous.receipt,params:{identity,inventory:inputs[0],marker:inputs[1],buyer:inputs[2],supply:2000n,quantity:7n,price:91n*UNIT,custodyCapacity:350n*UNIT,custodyMarkerCapacity:350n*UNIT,fee:1_000_000n,newRoot:proof.newRoot,witness:proof.witness,genesis:f.genesis,deps:depLike}};
  }
  const refresh=()=>prepareLocalInitializationStage(rpc,f.genesis,request,inputs,deps,prior);
  const ready=await refresh();signed.current=null;setReview({stage,tx:ready.transaction,inputs,owner:owner.hash(),refresh});setMessage(`${stage} prepared: ${ready.hash}. Review locally before signing.`);
 }catch(e){setMessage(e instanceof Error?e.message:'Fixture preparation failed');}}
 async function freshReview(){const active=activeSigner.current;if(!review||!active)throw Error('Prepare review');if((await active.getRecommendedAddressObj()).script.hash().toLowerCase()!==review.owner.toLowerCase()||activeSigner.current!==active)throw Error('Fixture wallet changed');const current=await review.refresh();if(activeSigner.current!==active||(await active.getRecommendedAddressObj()).script.hash().toLowerCase()!==review.owner.toLowerCase())throw Error('Fixture wallet changed');if(current.hash!==review.tx.hash()||current.transaction.witnesses.length!==review.tx.witnesses.length||current.transaction.witnesses.some((w,i)=>w.toLowerCase()!==review.tx.witnesses[i].toLowerCase()))throw Error('Reviewed stage changed');}
 async function sign(){try{if(!review||!signer)throw Error('Prepare review');await freshReview();const candidate=txFrom(cccA.JsonRpcTransformers.transactionFrom(review.tx));const tx=await signer.signTransaction(candidate);verifyInitializationSignature(review.tx,tx,review.inputs,review.stage==='purchase'?2:0,review.owner);await freshReview();signed.current=tx;setMessage(`${review.stage} signature verified; not submitted.`);}catch(e){signed.current=null;setMessage(e instanceof Error?e.message:'Signature refused');}}
 async function submit(){try{if(!navigator.locks)throw Error('Exclusive lock unavailable');await navigator.locks.request('roveko-local-initialization',{ifAvailable:true},async lock=>{if(!lock||!review||!signed.current||!signer)throw Error('Review or lock unavailable');await freshReview();verifyInitializationSignature(review.tx,signed.current,review.inputs,review.stage==='purchase'?2:0,review.owner);const f=await fixture(),j=readJournal(f.genesis);if(j.length!==steps.indexOf(review.stage)||j.some(x=>!x.receipt))throw Error('Another attempt requires reconciliation');const entry:Saved={stage:review.stage,tx:cccA.JsonRpcTransformers.transactionFrom(signed.current),inputs:points(review.tx),indices:review.stage==='purchase'?[0,1,2,3,4]:[0,1]};localStorage.setItem(key+':'+f.genesis,JSON.stringify([...j,entry]));const hash=await rpc('send_transaction',[entry.tx,'passthrough']);signed.current=null;if(hash!==review.tx.hash())throw Error('Unexpected transaction hash');setRevision(n=>n+1);setMessage(`${review.stage} submitted ${hash}; confirm on the private node.`);});}catch(e){setMessage(e instanceof Error?e.message:'Submission outcome unknown');}}
 async function confirm(){try{const f=await fixture(),j=readJournal(f.genesis),entry=j.at(-1);if(!entry||entry.receipt)throw Error('No pending fixture stage');const tx=txFrom(entry.tx);const receipt=await verifyInitializationStage(rpc,f.genesis,entry.stage,tx,entry.inputs,entry.indices);entry.receipt=receipt;localStorage.setItem(key+':'+f.genesis,JSON.stringify(j));setReview(null);setRevision(n=>n+1);setMessage(`${entry.stage} confirmed ${receipt.txHash}; switch fixture wallet if needed.`);}catch(e){setMessage(e instanceof Error?e.message:'Confirmation unavailable');}}
 async function verifyMarket(){try{if(process.env.NEXT_PUBLIC_ROVEKO_REQUIRE_DEPLOYED_CODES!=='1')throw Error('Confirmed local code deployment is required');const f=await fixture(),raw=localStorage.getItem('roveko-local-code-confirmed:'+f.genesis);if(!raw)throw Error('Missing local code deployment');const code=JSON.parse(raw),manifest=await createLocalManifest(rpc,f,readJournal(f.genesis),code.txHash);localStorage.setItem('roveko-local-market:'+f.genesis,JSON.stringify(manifest));setMarketReady(true);setMessage('Local market manifest verified against the private chain.');}catch(e){setMarketReady(false);setMessage(e instanceof Error?e.message:'Market verification failed');}}
 if(process.env.NEXT_PUBLIC_LOCAL_FIXTURE!=='1'||process.env.NODE_ENV==='production')return null;
 return <section><h2>Disposable market initialization</h2><p>Private fixture only; uses two disposable wallets. Public deployment remains disabled.</p><p>Recorded stages: {revision} changes this session.</p><button onClick={prepare} disabled={!signer}>Prepare local initialization stage</button>{review&&<><p>Stage {review.stage} · transaction {review.tx.hash()}</p><button onClick={sign}>Sign local initialization stage</button> <button onClick={submit}>Submit local initialization stage</button></>} <button onClick={confirm}>Confirm local initialization stage</button> <button onClick={verifyMarket}>Verify local market and open</button>{marketReady&&<> <a href="/v2">Open verified local market</a></>}<p role="status">{message}</p></section>;
}

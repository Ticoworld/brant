'use client';
import {useRef,useState} from 'react';
import {useSigner} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {JOURNAL_KEY,parseDeploymentAttempt} from '../../../lib/v2-engine/deployment-journal.ts';
import {WIZARD_KEY,appendWizardSubmission,confirmWizardSubmission,parseWizard} from '../../../lib/v2-engine/wizard-journal.ts';
import {recoverPudgeHistory} from '../../../lib/v2-engine/pudge-history.ts';
import {verifyPudgeInitialProof} from '../../../lib/v2-engine/pudge-proof-client.ts';
import {createPudgeManifest,PUDGE_MARKET_KEY} from '../../../lib/v2-engine/pudge-manifest.ts';
import {preparePudgeInitializationStage} from '../../../lib/v2-engine/initialization-orchestrator.ts';
import {verifyInitializationSignature} from '../../../lib/v2-engine/initialization-signature.ts';
import {discoverFunding,selectFunding} from '../../../lib/v2-engine/multi-funding.ts';
import {useLocale} from '../../i18n-provider';
import type {MessageKey} from '../../i18n';

type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
type Wallet=ReturnType<typeof useSigner>;
type Point={txHash:string;index:string};
type Stage='setup'|'issuance'|'purchase';
const genesis='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606',unit=100_000_000n,fee=1_000_000n;
const secp={outPoint:{txHash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:'0x0'},depType:'depGroup' as const};
const xudt={outPoint:{txHash:'0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f',index:'0x0'},depType:'code' as const};
const codeHashes=['0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000','0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770','0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc','0xd09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2','0xf8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53'];
const hashSecp='0xf66ca3517241864672b7f47d093aec4d6d4d07824068993eacd728eb9078e236',hashXudt='0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95';
const point=(tx:ccc.Transaction,i:number)=>({txHash:tx.hash(),index:'0x'+i.toString(16)});
const points=(tx:ccc.Transaction)=>tx.inputs.map(i=>({txHash:i.previousOutput.txHash,index:ccc.numToHex(i.previousOutput.index)}));
const copy=(tx:ccc.Transaction)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(cccA.JsonRpcTransformers.transactionFrom(tx)));

/** Pudge stage controls. Saved records are hints; every action reconstructs the
 * committed history and rechecks live inputs and dependencies. */
export default function PudgeInitialization({rpc,signer}:{rpc:Rpc;signer:Wallet}){
 const {t}=useLocale();
 const stageLabel=(stage:Stage)=>t(stage==='setup'?'setupStage':stage==='issuance'?'issuanceStage':'purchaseStage');
 const [message,setMessage]=useState<MessageKey|null>(null),[review,setReview]=useState<Awaited<ReturnType<typeof prepare>>|null>(null),[approved,setApproved]=useState(false),[signedReady,setSignedReady]=useState(false);
 const signed=useRef<ccc.Transaction|null>(null),active=useRef(signer);active.current=signer;
 const proof=verifyPudgeInitialProof;
 const readRecords=()=>{const c=localStorage.getItem(JOURNAL_KEY),w=localStorage.getItem(WIZARD_KEY);if(!c||!w)throw Error('Reconcile the confirmed code deployment first');return {attempt:parseDeploymentAttempt(c),journal:parseWizard(w),raw:w};};
 async function cell(p:Point){const row=await rpc('get_live_cell',[{tx_hash:p.txHash,index:p.index},true]) as {status?:string;cell?:{output:{capacity:string;lock:{code_hash:string;hash_type:string;args:string};type?:{code_hash:string;hash_type:string;args:string}|null};data:{content:string}}};if(row?.status!=='live'||!row.cell)throw Error('Required stage input is unavailable');const s=(v:{code_hash:string;hash_type:string;args:string})=>ccc.Script.from({codeHash:v.code_hash,hashType:v.hash_type as 'type',args:v.args});return {outPoint:p,capacity:BigInt(row.cell.output.capacity),lock:s(row.cell.output.lock),...(row.cell.output.type?{type:s(row.cell.output.type)}:{}),data:row.cell.data.content};}
 async function prepare(){
  const current=active.current;if(!current||!await current.isConnected())throw Error('Connect a Pudge wallet first');
  const {attempt,journal,raw}=readRecords();if(!attempt.anchor||!journal.entries.length||journal.entries.some(e=>e.state!=='confirmed'))throw Error('Reconcile every preceding stage first');
  if((await current.client.getHeaderByNumber(0))?.hash!==genesis||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==attempt.owner.toLowerCase()||active.current!==current)throw Error('Wallet account or network changed');
  const history=await recoverPudgeHistory(rpc,attempt,journal,proof);const stage=(['setup','issuance','purchase'] as Stage[])[journal.entries.length-1];if(!stage)throw Error('Initialization is already complete');
  const id=history.identity,anchor=attempt.anchor,code=(i:number)=>({outPoint:{txHash:attempt.txHash,index:'0x'+i.toString(16)},depType:'code' as const});
  const depLike=stage==='setup'?[secp]:stage==='issuance'?[secp,code(4),xudt,code(3)]:[secp,code(1),code(3),code(0),code(2),xudt];
  const expected=stage==='setup'?[hashSecp]:stage==='issuance'?[hashSecp,codeHashes[4],hashXudt,codeHashes[3]]:[hashSecp,codeHashes[1],codeHashes[3],codeHashes[0],codeHashes[2],hashXudt];
  const deps=await Promise.all(depLike.map(async(d,i)=>{const row=await rpc('get_live_cell',[{tx_hash:d.outPoint.txHash,index:d.outPoint.index},true]) as {status?:string;cell?:{data?:{content?:string}}};if(row?.status!=='live'||!row.cell?.data?.content||ccc.hashCkb(row.cell.data.content as ccc.Hex)!==expected[i])throw Error('Stage dependency changed');return {outPoint:d.outPoint,dataHash:expected[i]};}));
  const previousStage:'setup'|'issuance'|undefined=stage==='issuance'?'setup':stage==='purchase'?'issuance':undefined,previous=previousStage?history.stages[previousStage]:undefined;
  const prior=previous?{transaction:previous.tx,requiredInputs:points(previous.tx),liveIndices:[0,1]}:undefined;
  const receipt=previousStage&&previous?{stage:previousStage,txHash:previous.tx.hash(),blockHash:previous.blockHash,outputs:[point(previous.tx,0),point(previous.tx,1)]}:undefined;
  let inputs:Awaited<ReturnType<typeof cell>>[],request:Parameters<typeof preparePudgeInitializationStage>[1];
  if(stage==='setup'){
   const ownerLock=(await current.getRecommendedAddressObj()).script,lock={codeHash:ownerLock.codeHash,hashType:ownerLock.hashType,args:ownerLock.args},cells=await discoverFunding(rpc,rpc,lock);
   const selection=selectFunding(cells,attempt.owner,2200n*unit,61n*unit,()=>fee,[`${anchor.txHash}:${anchor.index}`]);if(!selection.selected.length||selection.deficit)throw Error('Insufficient setup funding');
   inputs=await Promise.all(selection.selected.map(c=>cell(c.outPoint)));request={stage,params:{identity:id,anchor,inputs,ownerCapacity:200n*unit,buyerCapacity:2000n*unit,fee,secpDep:secp}};
  }else if(stage==='issuance'){
   if(!receipt||receipt.stage!=='setup')throw Error('Missing setup confirmation');inputs=[await cell(anchor),await cell(receipt.outputs[0])];request={stage,previous:receipt,params:{identity:id,anchor:inputs[0],ownerCell:inputs[1],supply:2000n,inventoryCapacity:300n*unit,markerCapacity:300n*unit,fee,deps:depLike}};
  }else{
   const setup=history.stages.setup?.tx;if(!receipt||receipt.stage!=='issuance'||!setup)throw Error('Missing initialization predecessors');inputs=[await cell(receipt.outputs[0]),await cell(receipt.outputs[1]),await cell(point(setup,1))];const p=await proof(anchor,attempt.owner);
   request={stage,previous:receipt,params:{identity:id,inventory:inputs[0],marker:inputs[1],buyer:inputs[2],supply:2000n,quantity:7n,price:91n*unit,custodyCapacity:350n*unit,custodyMarkerCapacity:350n*unit,fee,newRoot:p.newRoot,witness:p.witness,genesis,deps:depLike}};
  }
  const prepared=await preparePudgeInitializationStage(rpc,request,inputs,deps,prior),placeholder=copy(prepared.transaction),signerIndex=stage==='purchase'?2:0;
  placeholder.witnesses[signerIndex]=ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex();
  const pool=await rpc('tx_pool_info',[]) as {min_fee_rate:string};const rate=BigInt(pool.min_fee_rate)*2n;if(rate<2000n||rate>200000n||placeholder.estimateFee(rate)>fee)throw Error('Stage fee is insufficient or outside review bounds');
  if(active.current!==current||!await current.isConnected()||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==attempt.owner.toLowerCase()||localStorage.getItem(WIZARD_KEY)!==raw)throw Error('Wallet or saved stage changed');
  return {stage,transaction:prepared.transaction,inputs,owner:attempt.owner,signerIndex,raw,address:(await current.getRecommendedAddressObj()).toString()};
 }
 async function run(){try{signed.current=null;setSignedReady(false);setApproved(false);setReview(null);const value=await prepare();setReview(value);setMessage('transactionNeedsReview');}catch{setMessage('stagePreparationFailed');}}
 async function fresh(){if(!review)throw Error('Prepare stage first');const next=await prepare();if(next.stage!==review.stage||next.raw!==review.raw||next.transaction.hash()!==review.transaction.hash()||next.transaction.witnesses.length!==review.transaction.witnesses.length||next.transaction.witnesses.some((w,i)=>w.toLowerCase()!==review.transaction.witnesses[i].toLowerCase()))throw Error('Stage review changed');}
 async function sign(){try{signed.current=null;setSignedReady(false);if(!review||!active.current||!approved)throw Error('Review stage first');await fresh();const tx=await active.current!.signTransaction(copy(review.transaction));verifyInitializationSignature(review.transaction,tx,review.inputs,review.signerIndex,review.owner);await fresh();signed.current=tx;setSignedReady(true);setMessage('signatureVerifiedNotBroadcast');}catch{setMessage('stageSignatureFailed');}}
 async function submit(){try{if(!navigator.locks)throw Error('Exclusive deployment lock unavailable');await navigator.locks.request('roveko-v2-code-deployment',{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock||!review||!signed.current||!active.current||!approved)throw Error('Signed review or lock unavailable');await fresh();verifyInitializationSignature(review.transaction,signed.current,review.inputs,review.signerIndex,review.owner);const records=readRecords();if(records.raw!==review.raw)throw Error('Saved stage changed');const next=appendWizardSubmission(records.journal,review.stage,review.transaction.hash());localStorage.setItem(WIZARD_KEY,JSON.stringify(next));window.dispatchEvent(new Event('roveko-wizard-updated'));const tx=signed.current;signed.current=null;setSignedReady(false);const hash=await active.current.client.sendTransaction(tx);if(hash.toLowerCase()!==review.transaction.hash().toLowerCase())throw Error('Unexpected submission hash; reconcile before retry');setMessage('stageSubmissionUnconfirmed');});}catch{signed.current=null;setSignedReady(false);setMessage('stageSubmissionUnconfirmed');}}
 async function confirm(){try{if(!navigator.locks)throw Error('Exclusive deployment lock unavailable');await navigator.locks.request('roveko-v2-code-deployment',{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)throw Error('Another deployment action is in progress');const {attempt,journal}=readRecords(),last=journal.entries.at(-1);if(!last||last.stage==='code'||last.state!=='submitted')throw Error('No pending initialization stage');const history=await recoverPudgeHistory(rpc,attempt,journal,proof),block=history.stages[last.stage]?.blockHash;if(!block)throw Error('Stage confirmation unavailable');const next=confirmWizardSubmission(journal,last.stage,last.txHash,block);if(last.stage==='purchase'){const manifest=await createPudgeManifest(rpc,attempt,next,proof);localStorage.setItem(PUDGE_MARKET_KEY,JSON.stringify(manifest));}localStorage.setItem(WIZARD_KEY,JSON.stringify(next));window.dispatchEvent(new Event('roveko-wizard-updated'));setReview(null);setApproved(false);setMessage('transactionConfirmed');if(last.stage==='purchase')window.location.assign('/v2');});}catch{setMessage('initializationReconciliationFailed');}}
 async function openMarket(){try{const {attempt,journal}=readRecords(),manifest=await createPudgeManifest(rpc,attempt,journal,proof,false);localStorage.setItem(PUDGE_MARKET_KEY,JSON.stringify(manifest));window.location.assign('/v2');}catch{setMessage('marketRecoveryFailed');}}
 return <section><h2>{t('initializationHeading')}</h2><p>{t('initializationPrerequisite')}</p><button onClick={run} disabled={!signer}>{t('prepareNextInitialization')}</button> <button onClick={confirm}>{t('reconcileInitialization')}</button> <button onClick={openMarket}>{t('verifyOpenPudgeMarket')}</button>{review&&<><p>{t('owner')} {review.address} · {t('stage')} {stageLabel(review.stage)} · {t('transaction')} {review.transaction.hash()} · {t('networkFee')} {fee.toString()} shannons</p><p>{t('inputs')}: {points(review.transaction).map(p=>`${p.txHash}:${p.index}`).join(', ')}</p><ul aria-label={t('stageOutputs')}>{review.transaction.outputs.map((o,i)=><li key={i}>{t('output')} {i} · {t('capacity')} {o.capacity.toString()} shannons · {t('lock')} {o.lock.hash()} · {t('type')} {o.type?.hash()||t('none')} · {t('data')} {review.transaction.outputsData[i]}</li>)}</ul><details><summary>{t('reviewCompleteTransaction')}</summary><pre>{JSON.stringify(review.transaction,(_,v)=>typeof v==='bigint'?v.toString():v,2)}</pre></details><label><input type="checkbox" checked={approved} onChange={e=>{setApproved(e.target.checked);signed.current=null;setSignedReady(false);}}/> {t('stageReviewApproval')}</label><br/><button onClick={sign} disabled={!approved||!signer}>{t('requestInitializationSignature')}</button> <button onClick={submit} disabled={!signedReady||!approved||!signer}>{t('broadcastInitialization')}</button></> }<p role="status">{t(message||'initializationPrerequisite')}</p></section>;
}

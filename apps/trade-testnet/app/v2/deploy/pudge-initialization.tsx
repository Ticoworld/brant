'use client';
import {useEffect,useRef,useState} from 'react';
import {useSigner} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {JOURNAL_KEY,parseDeploymentAttempt} from '../../../lib/v2-engine/deployment-journal.ts';
import {WIZARD_KEY,appendWizardSubmission,confirmWizardSubmission,parseWizard,type WizardJournal} from '../../../lib/v2-engine/wizard-journal.ts';
import {recoverPudgeHistory} from '../../../lib/v2-engine/pudge-history.ts';
import {verifyPudgeInitialProof} from '../../../lib/v2-engine/pudge-proof-client.ts';
import {createPudgeManifest,PUDGE_MARKET_KEY} from '../../../lib/v2-engine/pudge-manifest.ts';
import {preparePudgeInitializationStage} from '../../../lib/v2-engine/initialization-orchestrator.ts';
import {verifyInitializationSignature} from '../../../lib/v2-engine/initialization-signature.ts';
import {discoverFunding,selectFunding} from '../../../lib/v2-engine/multi-funding.ts';
import {safeSigningError} from '../../../lib/v2-engine/wallet-signing.ts';
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
const cloneTransaction=(tx:ccc.Transaction)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(cccA.JsonRpcTransformers.transactionFrom(tx)));

/** Pudge stage controls. Saved records are hints; every action reconstructs the
 * committed history and rechecks live inputs and dependencies. */
export default function PudgeInitialization({rpc,signer}:{rpc:Rpc;signer:Wallet}){
 const {locale,t}=useLocale();const copy=(en:string,zh:string)=>locale==='zh-CN'?zh:en;
 const stageLabel=(stage:Stage)=>t(stage==='setup'?'setupStage':stage==='issuance'?'issuanceStage':'purchaseStage');
 const [message,setMessage]=useState<MessageKey|null>(null),[review,setReview]=useState<Awaited<ReturnType<typeof prepare>>|null>(null),[approved,setApproved]=useState(false),[signedReady,setSignedReady]=useState(false);
 const [busy,setBusy]=useState<'prepare'|'sign'|'submit'|'reconcile'|'market'|null>(null),[progress,setProgress]=useState(''),[failure,setFailure]=useState<{operation:string;stage:string;message:string;code?:string;next:string}|null>(null),[stageHint,setStageHint]=useState<Stage|null>(null),[wizard,setWizard]=useState<WizardJournal|null>(null);
 const signed=useRef<ccc.Transaction|null>(null),active=useRef(signer),busyRef=useRef(false);active.current=signer;
 const begin=(operation:NonNullable<typeof busy>,initial:string)=>{if(busyRef.current)return false;busyRef.current=true;setBusy(operation);setProgress(initial);setFailure(null);return true;};
 const finish=()=>{busyRef.current=false;setBusy(null);setProgress('');};
 const reportFailure=(operation:string,stage:string,error:unknown)=>{const safe=safeSigningError(error),indexerLag=/funding indexer.*(?:behind|ahead|different block)/i.test(safe.message),signature=operation.toLowerCase().includes('signature');setFailure({operation,stage,message:safe.message,code:safe.code,next:indexerLag?copy('No transaction was created. Wait for the Pudge indexer to catch up, then retry preparation.','尚未创建交易。请等待 Pudge 索引器同步后重试准备。'):signature?copy('The signed response was not accepted for broadcast. Review this reason; no transaction was sent.','签名结果未获准广播。请查看原因；交易尚未发送。'):copy('No transaction was broadcast during this action. Correct the issue above, then retry.','此次操作未广播交易。请先解决上述问题，再重试。')});};
 const proof=verifyPudgeInitialProof;
 useEffect(()=>{const sync=()=>{try{const raw=localStorage.getItem(WIZARD_KEY);const value=raw?parseWizard(raw):null;setWizard(value);const last=value?.entries.at(-1),pending=last&&last.stage!=='code'&&last.state==='submitted'?last.stage:undefined;const stage=pending??(value?.entries[0]?.state==='confirmed'?(['setup','issuance','purchase'] as Stage[])[value.entries.length-1]:undefined);setStageHint(stage??null);}catch{setWizard(null);setStageHint(null);}};sync();window.addEventListener('roveko-wizard-updated',sync);return()=>window.removeEventListener('roveko-wizard-updated',sync);},[]);
 const readRecords=()=>{const c=localStorage.getItem(JOURNAL_KEY),w=localStorage.getItem(WIZARD_KEY);if(!c||!w)throw Error('Reconcile the confirmed code deployment first');return {attempt:parseDeploymentAttempt(c),journal:parseWizard(w),raw:w};};
 async function cell(p:Point){const row=await rpc('get_live_cell',[{tx_hash:p.txHash,index:p.index},true]) as {status?:string;cell?:{output:{capacity:string;lock:{code_hash:string;hash_type:string;args:string};type?:{code_hash:string;hash_type:string;args:string}|null};data:{content:string}}};if(row?.status!=='live'||!row.cell)throw Error('Required stage input is unavailable');const s=(v:{code_hash:string;hash_type:string;args:string})=>ccc.Script.from({codeHash:v.code_hash,hashType:v.hash_type as 'type',args:v.args});return {outPoint:p,capacity:BigInt(row.cell.output.capacity),lock:s(row.cell.output.lock),...(row.cell.output.type?{type:s(row.cell.output.type)}:{}),data:row.cell.data.content};}
 async function prepare(onProgress?:(message:string)=>void){
  onProgress?.(copy('Checking the connected wallet and saved stages…','正在检查已连接钱包和已保存阶段…'));
  const current=active.current;if(!current||!await current.isConnected())throw Error('Connect a Pudge wallet first');
  const {attempt,journal,raw}=readRecords();if(!attempt.anchor||!journal.entries.length||journal.entries.some(e=>e.state!=='confirmed'))throw Error('Reconcile every preceding stage first');
  if((await current.client.getHeaderByNumber(0))?.hash!==genesis||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==attempt.owner.toLowerCase()||active.current!==current)throw Error('Wallet account or network changed');
  onProgress?.(copy('Verifying confirmed Pudge history…','正在验证已确认的 Pudge 历史…'));
  const history=await recoverPudgeHistory(rpc,attempt,journal,proof);const stage=(['setup','issuance','purchase'] as Stage[])[journal.entries.length-1];if(!stage)throw Error('Initialization is already complete');setStageHint(stage);
  const id=history.identity,anchor=attempt.anchor,code=(i:number)=>({outPoint:{txHash:attempt.txHash,index:'0x'+i.toString(16)},depType:'code' as const});
  const depLike=stage==='setup'?[secp]:stage==='issuance'?[secp,code(4),xudt,code(3)]:[secp,code(1),code(3),code(0),code(2),xudt];
  const expected=stage==='setup'?[hashSecp]:stage==='issuance'?[hashSecp,codeHashes[4],hashXudt,codeHashes[3]]:[hashSecp,codeHashes[1],codeHashes[3],codeHashes[0],codeHashes[2],hashXudt];
  onProgress?.(copy('Checking required script dependencies…','正在检查所需脚本依赖…'));
  const deps=await Promise.all(depLike.map(async(d,i)=>{const row=await rpc('get_live_cell',[{tx_hash:d.outPoint.txHash,index:d.outPoint.index},true]) as {status?:string;cell?:{data?:{content?:string}}};if(row?.status!=='live'||!row.cell?.data?.content||ccc.hashCkb(row.cell.data.content as ccc.Hex)!==expected[i])throw Error('Stage dependency changed');return {outPoint:d.outPoint,dataHash:expected[i]};}));
  const previousStage:'setup'|'issuance'|undefined=stage==='issuance'?'setup':stage==='purchase'?'issuance':undefined,previous=previousStage?history.stages[previousStage]:undefined;
  const prior=previous?{transaction:previous.tx,requiredInputs:points(previous.tx),liveIndices:[0,1]}:undefined;
  const receipt=previousStage&&previous?{stage:previousStage,txHash:previous.tx.hash(),blockHash:previous.blockHash,outputs:[point(previous.tx,0),point(previous.tx,1)]}:undefined;
  let inputs:Awaited<ReturnType<typeof cell>>[],request:Parameters<typeof preparePudgeInitializationStage>[1];
  if(stage==='setup'){
   onProgress?.(copy('Checking the funding indexer and selecting live setup Cells…','正在检查资金索引器并选择可用的 setup Cell…'));
   const ownerLock=(await current.getRecommendedAddressObj()).script,lock={codeHash:ownerLock.codeHash,hashType:ownerLock.hashType,args:ownerLock.args},cells=await discoverFunding(rpc,rpc,lock);
   const selection=selectFunding(cells,attempt.owner,2200n*unit,61n*unit,()=>fee,[`${anchor.txHash}:${anchor.index}`]);if(!selection.selected.length||selection.deficit)throw Error('Insufficient setup funding');
   inputs=await Promise.all(selection.selected.map(c=>cell(c.outPoint)));request={stage,params:{identity:id,anchor,inputs,ownerCapacity:200n*unit,buyerCapacity:2000n*unit,fee,secpDep:secp}};
  }else if(stage==='issuance'){
   onProgress?.(copy('Checking the confirmed setup outputs…','正在检查已确认的 setup 输出…'));
   if(!receipt||receipt.stage!=='setup')throw Error('Missing setup confirmation');inputs=[await cell(anchor),await cell(receipt.outputs[0])];request={stage,previous:receipt,params:{identity:id,anchor:inputs[0],ownerCell:inputs[1],supply:2000n,inventoryCapacity:300n*unit,markerCapacity:300n*unit,fee,deps:depLike}};
  }else{
   onProgress?.(copy('Checking issuance outputs and the initial purchase proof…','正在检查发行输出和首次购买证明…'));
   const setup=history.stages.setup?.tx;if(!receipt||receipt.stage!=='issuance'||!setup)throw Error('Missing initialization predecessors');inputs=[await cell(receipt.outputs[0]),await cell(receipt.outputs[1]),await cell(point(setup,1))];const p=await proof(anchor,attempt.owner);
   request={stage,previous:receipt,params:{identity:id,inventory:inputs[0],marker:inputs[1],buyer:inputs[2],supply:2000n,quantity:7n,price:91n*unit,custodyCapacity:350n*unit,custodyMarkerCapacity:350n*unit,fee,newRoot:p.newRoot,witness:p.witness,genesis,deps:depLike}};
  }
  onProgress?.(copy('Building and validating an unsigned stage review…','正在构建并验证未签名的阶段审查…'));
  const prepared=await preparePudgeInitializationStage(rpc,request,inputs,deps,prior),placeholder=cloneTransaction(prepared.transaction),signerIndex=stage==='purchase'?2:0;
  placeholder.witnesses[signerIndex]=ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex();
  const pool=await rpc('tx_pool_info',[]) as {min_fee_rate:string};const rate=BigInt(pool.min_fee_rate)*2n;if(rate<2000n||rate>200000n||placeholder.estimateFee(rate)>fee)throw Error('Stage fee is insufficient or outside review bounds');
  if(active.current!==current||!await current.isConnected()||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==attempt.owner.toLowerCase()||localStorage.getItem(WIZARD_KEY)!==raw)throw Error('Wallet or saved stage changed');
  return {stage,transaction:prepared.transaction,inputs,owner:attempt.owner,signerIndex,raw,address:(await current.getRecommendedAddressObj()).toString()};
 }
 async function run(){
  if(!begin('prepare',copy('Starting the stage check…','正在开始阶段检查…')))return;
  let failedAt=copy('Checking the connected wallet and saved stages','检查已连接的钱包和已保存阶段');
  signed.current=null;setSignedReady(false);setApproved(false);setReview(null);
  try{const value=await prepare(value=>{failedAt=value;setProgress(value);});setReview(value);setMessage('transactionNeedsReview');}
  catch(error){setMessage('stagePreparationFailed');reportFailure(copy('Prepare unsigned review','准备未签名审查'),failedAt,error);}
  finally{finish();}
 }
 async function fresh(){if(!review)throw Error('Prepare stage first');const next=await prepare();if(next.stage!==review.stage||next.raw!==review.raw||next.transaction.hash()!==review.transaction.hash()||next.transaction.witnesses.length!==review.transaction.witnesses.length||next.transaction.witnesses.some((w,i)=>w.toLowerCase()!==review.transaction.witnesses[i].toLowerCase()))throw Error('Stage review changed');}
 async function sign(){
  if(!begin('sign',copy('Rechecking live inputs before signature…','正在请求签名之前重新检查链上输入…')))return;
  let failedAt=copy('Rechecking the stage review','重新检查阶段审查');signed.current=null;setSignedReady(false);
  try{if(!review||!active.current||!approved)throw Error('Review stage first');await fresh();failedAt=copy('Waiting for UTXO Global approval','等待 UTXO Global 钱包批准');setProgress(failedAt);const tx=await active.current.signTransaction(cloneTransaction(review.transaction));failedAt=copy('Verifying the returned wallet signature','验证钱包返回的签名');setProgress(failedAt);verifyInitializationSignature(review.transaction,tx,review.inputs,review.signerIndex,review.owner);failedAt=copy('Rechecking live inputs after signature','签名后重新检查链上输入');setProgress(failedAt);await fresh();signed.current=tx;setSignedReady(true);setMessage('signatureVerifiedNotBroadcast');}
  catch(error){setMessage('stageSignatureFailed');reportFailure(copy('Request wallet signature','请求钱包签名'),failedAt,error);}
  finally{finish();}
 }
 async function submit(){
  if(!begin('submit',copy('Rechecking the signed review…','正在重新检查已签名审查…')))return;
  let failedAt=copy('Checking the exclusive submission lock','检查独占提交锁');
  try{if(!navigator.locks)throw Error('Exclusive deployment lock unavailable');await navigator.locks.request('roveko-v2-code-deployment',{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock||!review||!signed.current||!active.current||!approved)throw Error('Signed review or lock unavailable');failedAt=copy('Revalidating the signed transaction','重新验证已签名交易');setProgress(failedAt);await fresh();verifyInitializationSignature(review.transaction,signed.current,review.inputs,review.signerIndex,review.owner);const records=readRecords();if(records.raw!==review.raw)throw Error('Saved stage changed');const next=appendWizardSubmission(records.journal,review.stage,review.transaction.hash());localStorage.setItem(WIZARD_KEY,JSON.stringify(next));window.dispatchEvent(new Event('roveko-wizard-updated'));const tx=signed.current;signed.current=null;setSignedReady(false);failedAt=copy('Sending the owner-approved transaction to Pudge','正在向 Pudge 提交已由所有者批准的交易');setProgress(failedAt);const hash=await active.current.client.sendTransaction(tx);if(hash.toLowerCase()!==review.transaction.hash().toLowerCase())throw Error('Unexpected submission hash; reconcile before retry');setMessage('stageSubmissionUnconfirmed');});}
  catch(error){signed.current=null;setSignedReady(false);setMessage('stageSubmissionUnconfirmed');const safe=safeSigningError(error);setFailure({operation:copy('Broadcast approved transaction','广播已批准的交易'),stage:failedAt,message:safe.message,code:safe.code,next:copy('Submission may have reached Pudge. Do not retry; reconcile the saved attempt first.','交易可能已到达 Pudge。请勿重试；先核对已保存的提交记录。')});}
  finally{finish();}
 }
 async function confirm(){
  if(!begin('reconcile',copy('Checking Pudge for the submitted stage…','正在查询 Pudge 上的已提交阶段…')))return;
  let failedAt=copy('Checking the saved submission and canonical history','检查已保存的提交和规范链历史');
  try{if(!navigator.locks)throw Error('Exclusive deployment lock unavailable');await navigator.locks.request('roveko-v2-code-deployment',{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)throw Error('Another deployment action is in progress');const {attempt,journal}=readRecords(),last=journal.entries.at(-1);if(!last||last.stage==='code'||last.state!=='submitted')throw Error('No pending initialization stage');failedAt=copy('Verifying canonical confirmation and stage outputs','验证规范确认和阶段输出');setProgress(failedAt);const history=await recoverPudgeHistory(rpc,attempt,journal,proof),block=history.stages[last.stage]?.blockHash;if(!block)throw Error('Stage confirmation unavailable');const next=confirmWizardSubmission(journal,last.stage,last.txHash,block);if(last.stage==='purchase'){const manifest=await createPudgeManifest(rpc,attempt,next,proof);localStorage.setItem(PUDGE_MARKET_KEY,JSON.stringify(manifest));}localStorage.setItem(WIZARD_KEY,JSON.stringify(next));window.dispatchEvent(new Event('roveko-wizard-updated'));setReview(null);setApproved(false);setMessage('transactionConfirmed');if(last.stage==='purchase')window.location.assign('/v2');});}
  catch(error){setMessage('initializationReconciliationFailed');reportFailure(copy('Reconcile submitted stage','核对已提交阶段'),failedAt,error);}
  finally{finish();}
 }
 async function openMarket(){
  if(!begin('market',copy('Verifying the initialized market…','正在验证已初始化的市场…')))return;
  let failedAt=copy('Reconstructing the confirmed market identity','重建已确认的市场身份');
  try{const {attempt,journal}=readRecords(),manifest=await createPudgeManifest(rpc,attempt,journal,proof,false);localStorage.setItem(PUDGE_MARKET_KEY,JSON.stringify(manifest));window.location.assign('/v2');}
  catch(error){setMessage('marketRecoveryFailed');reportFailure(copy('Verify and open market','验证并打开市场'),failedAt,error);}
  finally{finish();}
 }
 const activeStage=review?.stage??stageHint,stageNumber=activeStage?(['setup','issuance','purchase'] as Stage[]).indexOf(activeStage)+1:1;
 const codeStageReady=wizard?.entries[0]?.stage==='code'&&wizard.entries[0].state==='confirmed';
 const latest=wizard?.entries.at(-1),pending=!!latest&&latest.stage!=='code'&&latest.state==='submitted';
 const confirmed=(name:Stage)=>wizard?.entries.find(entry=>entry.stage===name)?.state==='confirmed';
 const stageComplete=activeStage?confirmed(activeStage):false;
 const flowIndex=busy==='prepare'?0:pending?4:!review?0:!approved?1:!signedReady?2:3;
 const flowLabels=[copy('Prepare review','准备审查'),copy('Review inputs and outputs','检查输入和输出'),copy('Request wallet signature','请求钱包签名'),copy('Broadcast if you approve','批准后广播'),copy('Reconcile confirmation','核对确认')];
 const stagePurpose=activeStage==='setup'?copy('Create the owner and buyer market Cells from live owner funding and the reserved anchor.','使用所有者现有资金和预留锚点创建市场所有者与买方 Cell。'):activeStage==='issuance'?copy('Issue the fixed supply after the setup transaction is confirmed.','在 setup 交易确认后发行固定供应量。'):copy('Make the initial curve purchase after issuance is confirmed.','在发行交易确认后完成首次曲线购买。');
 return <section aria-busy={busy!==null}>
  <h2>{t('initializationHeading')}</h2>
  {activeStage&&<div className="my-3 border-y border-[#252527] py-3">
   <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="m-0 text-sm font-semibold">{copy(`Step ${stageNumber} of 3 · ${stageLabel(activeStage)}`,`第 ${stageNumber} 步，共 3 步 · ${stageLabel(activeStage)}`)}</h3><span className="text-xs text-[#a0a0a5]">{stageComplete?copy('Confirmed','已确认'):pending?copy('Waiting for confirmation','等待确认'):copy('Next stage','下一阶段')}</span></div>
   <p className="mb-2 mt-1 text-xs text-[#a0a0a5]">{stagePurpose}</p>
   <ol className="grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0 text-xs sm:grid-cols-5">{flowLabels.map((label,i)=><li key={label} aria-current={i===flowIndex?'step':undefined} className={`flex min-w-0 items-start gap-2 border-t py-2 ${i===flowIndex?'border-[#63d994] text-[#eceeec]':i<flowIndex?'border-[#4b6954] text-[#a7c8b0]':'border-[#303034] text-[#85858a]'}`}><span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center border border-current text-[10px]">{i<flowIndex?'✓':i+1}</span><span>{label}</span></li>)}</ol>
   {!stageComplete&&<p className="mb-0 mt-2 text-xs text-[#a0a0a5]">{copy('Preparation is read-only. Signing opens UTXO Global; broadcasting remains a separate action.','准备过程只读。签名会打开 UTXO Global；广播是单独的操作。')}</p>}
  </div>}
  {busy&&<p role="status" aria-live="polite" aria-busy="true" className="my-3 flex items-center gap-2 text-xs text-[#c9d9ce]"><span aria-hidden="true" className="inline-block size-3 animate-spin rounded-full border border-current border-r-transparent motion-reduce:animate-none"/>{progress}</p>}
  <div className="flex flex-wrap gap-x-4 gap-y-2">
   {codeStageReady&&!pending&&!confirmed('purchase')&&<button id="init-stage-action" className="launch-button launch-primary" onClick={run} disabled={!signer||busy!==null||stageComplete} aria-busy={busy==='prepare'}>{busy==='prepare'?copy('Checking Pudge…','正在检查 Pudge…'):failure?.operation===copy('Prepare unsigned review','准备未签名审查')?copy('Retry preparation','重试准备'):review?copy('Refresh stage review','刷新阶段审查'):t('prepareNextInitialization')}</button>}
   {pending&&<button id="init-reconcile-action" className="launch-button launch-secondary" onClick={confirm} disabled={busy!==null} aria-busy={busy==='reconcile'}>{busy==='reconcile'?copy('Checking confirmation…','正在检查确认…'):t('reconcileInitialization')}</button>}
   {confirmed('purchase')&&<button id="init-open-market-action" className="launch-button launch-primary" onClick={openMarket} disabled={busy!==null} aria-busy={busy==='market'}>{busy==='market'?copy('Verifying market…','正在验证市场…'):t('verifyOpenPudgeMarket')}</button>}
  </div>
  {!codeStageReady&&<p className="mt-2 text-xs text-[#a0a0a5]">{copy('Finish and reconcile the code deployment step above before starting initialization.','请先完成并核对上方的代码部署步骤，再开始初始化。')}</p>}
  {review&&!pending&&<div className="mt-3 border-t border-[#303034] pt-3">
   <h4 className="mb-1 text-xs font-semibold">{copy('Review this unsigned transaction','检查这笔未签名交易')}</h4>
   <p className="my-1 break-all text-xs text-[#a0a0a5]">{t('owner')} {review.address}</p><p className="my-1 break-all text-xs text-[#a0a0a5]">{t('transaction')} {review.transaction.hash()} · {t('networkFee')} {fee.toString()} shannons</p>
   <p className="my-1 break-all text-xs text-[#a0a0a5]">{t('inputs')}: {points(review.transaction).map(p=>`${p.txHash}:${p.index}`).join(', ')}</p>
   <ul aria-label={t('stageOutputs')} className="my-2 list-none space-y-1 p-0 text-xs">{review.transaction.outputs.map((o,i)=><li key={i} className="break-all border-l border-[#343438] pl-2">{t('output')} {i} · {t('capacity')} {o.capacity.toString()} shannons · {t('lock')} {o.lock.hash()} · {t('type')} {o.type?.hash()||t('none')}</li>)}</ul>
   <details className="my-2 text-xs text-[#a0a0a5]"><summary className="w-fit cursor-pointer">{t('reviewCompleteTransaction')}</summary><pre className="max-h-72 overflow-auto">{JSON.stringify(review.transaction,(_,v)=>typeof v==='bigint'?v.toString():v,2)}</pre></details>
   <label className="my-3 flex items-start gap-2 text-xs text-[#c9c9cc]"><input className="mt-0.5 size-4 accent-[#63d994]" type="checkbox" checked={approved} disabled={busy!==null} onChange={e=>{setApproved(e.target.checked);signed.current=null;setSignedReady(false);}}/> {t('stageReviewApproval')}</label>
   <div className="flex flex-wrap gap-3"><button className="launch-button launch-secondary" onClick={sign} disabled={!approved||!signer||busy!==null} aria-busy={busy==='sign'}>{busy==='sign'?copy('Waiting for wallet…','等待钱包…'):t('requestInitializationSignature')}</button>{signedReady&&<button className="launch-button launch-primary" onClick={submit} disabled={!approved||!signer||busy!==null} aria-busy={busy==='submit'}>{busy==='submit'?copy('Submitting approved transaction…','正在提交已批准的交易…'):t('broadcastInitialization')}</button>}</div>
  </div>}
  {failure&&<details open className="mt-3 border border-[#674d32] p-3 text-xs text-[#e7d7c3]"><summary className="w-fit cursor-pointer font-medium">{copy('What needs attention','需要处理的问题')} · {failure.operation}</summary><div className="mt-2 grid gap-1 [overflow-wrap:anywhere]"><p className="m-0">{copy('Stopped at','停止阶段')}: {failure.stage}</p><p className="m-0">{copy('Reason','原因')}: {failure.message}</p>{failure.code&&<p className="m-0">{copy('Wallet error code','钱包错误代码')}: <code>{failure.code}</code></p>}<p className="m-0">{failure.next}</p></div></details>}
  {message&&<p role="status" aria-live="polite" className="mt-2 text-xs text-[#a0a0a5]">{t(message)}</p>}
 </section>;
}

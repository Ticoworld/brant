'use client';
import {useEffect,useState} from 'react';
import {JOURNAL_KEY,parseDeploymentAttempt} from '../../../lib/v2-engine/deployment-journal.ts';
import {reconcileCodeAttempt} from '../../../lib/v2-engine/deployment-verification.ts';
import {WIZARD_KEY,WIZARD_STAGES,appendWizardSubmission,confirmWizardSubmission,parseWizard,type WizardJournal} from '../../../lib/v2-engine/wizard-journal.ts';
import {recoverPudgeHistory} from '../../../lib/v2-engine/pudge-history.ts';
import {verifyPudgeInitialProof} from '../../../lib/v2-engine/pudge-proof-client.ts';
import {useLocale} from '../../i18n-provider';
import {safeSigningError} from '../../../lib/v2-engine/wallet-signing.ts';

type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
/** Owner-facing recovery record. Stored entries are hints, not authorization. */
export default function DeploymentWizard({rpc,genesis,codeHashes}:{rpc:Rpc;genesis:string;codeHashes:string[]}){
 const {locale,t}=useLocale();
 const [journal,setJournal]=useState<WizardJournal|null>(null),[message,setMessage]=useState(''),[backup,setBackup]=useState(''),[busy,setBusy]=useState<'code'|'all'|'restore'|null>(null);
 useEffect(()=>{const load=()=>{try{const raw=localStorage.getItem(WIZARD_KEY);if(raw){const j=parseWizard(raw);setJournal(j);setMessage(t('deploymentProgressLoaded'));}}catch{setMessage(t('savedProgressInvalid'));}};load();window.addEventListener('roveko-wizard-updated',load);return()=>window.removeEventListener('roveko-wizard-updated',load);},[locale]);
 async function reconcileCode(){if(busy)return;setBusy('code');setMessage('Checking canonical Pudge code cells…');try{
   if(!navigator.locks)throw Error('Exclusive deployment lock unavailable');
   await navigator.locks.request('roveko-v2-code-deployment',{mode:'exclusive',ifAvailable:true},async lock=>{
     if(!lock)throw Error('Another deployment operation is in progress');
     const raw=localStorage.getItem(JOURNAL_KEY);if(!raw)throw Error('No saved code-deployment attempt');
     const attempt=parseDeploymentAttempt(raw),expected=new Set(codeHashes.map(x=>x.toLowerCase()));
     if(attempt.genesis.toLowerCase()!==genesis.toLowerCase()||attempt.codeHashes.length!==expected.size||attempt.codeHashes.some(x=>!expected.has(x.toLowerCase())))throw Error('Code attempt does not match this deployment');
     const verified=await reconcileCodeAttempt(rpc,attempt);
     const saved=localStorage.getItem(WIZARD_KEY);let current=saved?parseWizard(saved):{version:1 as const,genesis,owner:attempt.owner,entries:[]};
     if(current.genesis.toLowerCase()!==genesis.toLowerCase()||current.owner.toLowerCase()!==attempt.owner.toLowerCase())throw Error('Saved wizard belongs to a different owner or network');
     if(!current.entries.length) current=appendWizardSubmission(current,'code',attempt.txHash);
     const first=current.entries[0];
     if(first.txHash.toLowerCase()!==attempt.txHash.toLowerCase())throw Error('Saved code stage differs from attempt');
     if(first.state==='submitted')current=confirmWizardSubmission(current,'code',attempt.txHash,verified.blockHash);
     else if(first.blockHash?.toLowerCase()!==verified.blockHash.toLowerCase())throw Error('Recorded code confirmation changed');
     localStorage.setItem(WIZARD_KEY,JSON.stringify(current));setJournal(current);window.dispatchEvent(new Event('roveko-wizard-updated'));setMessage(`${t('codeCellsCanonicalVerified')} ${t('initializationStagesRequireReview')}`);
   });
 }catch(error){setMessage(`${t('initializationReconciliationFailed')} ${safeSigningError(error).message}`);}finally{setBusy(null);}}
 async function reconcileAll(imported?:string){if(busy)return;setBusy(imported?'restore':'all');setMessage('Reconstructing confirmed stage history…');try{
  if(!navigator.locks)throw Error('Exclusive deployment lock unavailable');
  await navigator.locks.request('roveko-v2-code-deployment',{mode:'exclusive',ifAvailable:true},async lock=>{
   if(!lock)throw Error('Another deployment operation is in progress');
   const code=localStorage.getItem(JOURNAL_KEY),existing=localStorage.getItem(WIZARD_KEY);if(!code)throw Error('Restore the code deployment backup first');
   if(imported&&existing)throw Error('Existing wizard requires reconciliation');
   const current=parseWizard(imported||existing||'');
   const proof=verifyPudgeInitialProof;
   const verified=await recoverPudgeHistory(rpc,parseDeploymentAttempt(code),current,proof,{requireSuccessors:current.entries.at(-1)?.stage!=='purchase'});
   const last=current.entries.at(-1);if(!last)throw Error('No stage to reconcile');
   const block=last.stage==='code'?verified.code.blockHash:verified.stages[last.stage]?.blockHash;
   if(!block)throw Error('Stage confirmation unavailable');
   const next=last.state==='submitted'?confirmWizardSubmission(current,last.stage,last.txHash,block):current;
   localStorage.setItem(WIZARD_KEY,JSON.stringify(next));setJournal(next);setBackup('');setMessage(t('recordedStagesReconstructed'));
  });
 }catch(error){setMessage(`${t('initializationReconciliationFailed')} ${safeSigningError(error).message}`);}finally{setBusy(null);}}
 const stageLabels=[t('codeCellsStage'),t('initializationSetupStage'),t('fixedSupplyIssuanceStage'),t('firstPurchaseCustodyStage')];
 return <section aria-busy={busy!==null}><h2>{t('deploymentStages')}</h2><p>{t('savedProgressRecoveryHint')}</p><ol>{WIZARD_STAGES.map((stage,i)=><li key={stage}>{stageLabels[i]}: {journal?.entries[i]?`${t('recordedState')} ${journal.entries[i].state==='submitted'?t('deploymentStatusSubmitted'):t('confirmed')} · ${journal.entries[i].txHash}`:t('notRecorded')}</li>)}</ol><div className="flex flex-wrap gap-x-4 gap-y-2"><button id="code-stage-action" className="launch-button launch-secondary" onClick={reconcileCode} disabled={busy!==null} aria-busy={busy==='code'}>{busy==='code'?'Checking Pudge…':t('reconcileCodeStage')}</button>{journal&&<> <button className="launch-button launch-secondary" onClick={()=>reconcileAll()} disabled={busy!==null} aria-busy={busy==='all'}>{busy==='all'?'Checking Pudge…':t('reconcileRecordedStages')}</button></>}</div><p role="status" aria-live="polite" aria-busy={busy!==null} className="[overflow-wrap:anywhere]">{message||t('noVerifiedDeploymentRecorded')}</p>{journal?<details><summary>{t('publicWizardBackup')}</summary><label><textarea readOnly rows={5} value={JSON.stringify(journal)}/></label></details>:<details><summary>{t('restoreWizardBackup')}</summary><label><textarea rows={5} value={backup} onChange={e=>setBackup(e.target.value)} disabled={busy!==null}/></label><button className="launch-button launch-secondary" disabled={!backup||busy!==null} onClick={()=>reconcileAll(backup)} aria-busy={busy==='restore'}>{busy==='restore'?'Verifying backup…':t('verifyRestoreStages')}</button></details>}</section>;
}

'use client';
import {useEffect,useState} from 'react';
import {JOURNAL_KEY,parseDeploymentAttempt} from '../../../lib/v2-engine/deployment-journal.ts';
import {reconcileCodeAttempt} from '../../../lib/v2-engine/deployment-verification.ts';
import {WIZARD_KEY,WIZARD_STAGES,appendWizardSubmission,confirmWizardSubmission,parseWizard,type WizardJournal} from '../../../lib/v2-engine/wizard-journal.ts';
import {recoverPudgeHistory} from '../../../lib/v2-engine/pudge-history.ts';
import {verifyPudgeInitialProof} from '../../../lib/v2-engine/pudge-proof-client.ts';
import {useLocale} from '../../i18n-provider';

type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
/** Owner-facing recovery record. Stored entries are hints, not authorization. */
export default function DeploymentWizard({rpc,genesis,codeHashes}:{rpc:Rpc;genesis:string;codeHashes:string[]}){
 const {locale,t}=useLocale();
 const [journal,setJournal]=useState<WizardJournal|null>(null),[message,setMessage]=useState(''),[backup,setBackup]=useState('');
 useEffect(()=>{const load=()=>{try{const raw=localStorage.getItem(WIZARD_KEY);if(raw){const j=parseWizard(raw);setJournal(j);setMessage(t('deploymentProgressLoaded'));}}catch{setMessage(t('savedProgressInvalid'));}};load();window.addEventListener('roveko-wizard-updated',load);return()=>window.removeEventListener('roveko-wizard-updated',load);},[locale]);
 async function reconcileCode(){try{
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
     localStorage.setItem(WIZARD_KEY,JSON.stringify(current));setJournal(current);setMessage(`${t('codeCellsCanonicalVerified')} ${t('initializationStagesRequireReview')}`);
   });
 }catch{setMessage(t('initializationReconciliationFailed'));}}
 async function reconcileAll(imported?:string){try{
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
 }catch{setMessage(t('initializationReconciliationFailed'));}}
 const stageLabels=[t('codeCellsStage'),t('initializationSetupStage'),t('fixedSupplyIssuanceStage'),t('firstPurchaseCustodyStage')];
 return <section><h2>{t('deploymentStages')}</h2><p>{t('savedProgressRecoveryHint')}</p><ol>{WIZARD_STAGES.map((stage,i)=><li key={stage}>{stageLabels[i]}: {journal?.entries[i]?`${t('recordedState')} ${journal.entries[i].state==='submitted'?t('deploymentStatusSubmitted'):t('confirmed')} · ${journal.entries[i].txHash}`:t('notRecorded')}</li>)}</ol><button onClick={reconcileCode}>{t('reconcileCodeStage')}</button>{journal&&<> <button onClick={()=>reconcileAll()}>{t('reconcileRecordedStages')}</button></>}<p role="status">{message||t('noVerifiedDeploymentRecorded')}</p>{journal?<details><summary>{t('publicWizardBackup')}</summary><label><textarea readOnly rows={5} value={JSON.stringify(journal)}/></label></details>:<details><summary>{t('restoreWizardBackup')}</summary><label><textarea rows={5} value={backup} onChange={e=>setBackup(e.target.value)}/></label><button disabled={!backup} onClick={()=>reconcileAll(backup)}>{t('verifyRestoreStages')}</button></details>}</section>;
}

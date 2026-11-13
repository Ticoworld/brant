'use client';
import {useEffect,useState} from 'react';
import {JOURNAL_KEY,parseDeploymentAttempt} from '../../../lib/v2-engine/deployment-journal.ts';
import {reconcileCodeAttempt} from '../../../lib/v2-engine/deployment-verification.ts';
import {WIZARD_KEY,WIZARD_STAGES,appendWizardSubmission,confirmWizardSubmission,parseWizard,type WizardJournal} from '../../../lib/v2-engine/wizard-journal.ts';

type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
/** Owner-facing recovery record. Stored entries are hints, not authorization. */
export default function DeploymentWizard({rpc,genesis,codeHashes}:{rpc:Rpc;genesis:string;codeHashes:string[]}){
 const [journal,setJournal]=useState<WizardJournal|null>(null),[message,setMessage]=useState('No verified deployment recorded.');
 useEffect(()=>{try{const raw=localStorage.getItem(WIZARD_KEY);if(raw){const j=parseWizard(raw);setJournal(j);setMessage('Saved progress loaded. Reconcile with the chain before relying on it.');}}catch{setMessage('Saved progress is invalid; manual reconciliation is required.');}},[]);
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
     localStorage.setItem(WIZARD_KEY,JSON.stringify(current));setJournal(current);setMessage('Code cells verified live in a canonical block. Initialization stages require separate review.');
   });
 }catch(e){setMessage(e instanceof Error?e.message:'Unable to reconcile code stage');}}
 return <section><h2>Deployment stages</h2><p>Saved progress is a public recovery record. Every stage requires fresh chain and transaction checks; a saved status alone never enables signing.</p><ol>{WIZARD_STAGES.map((stage,i)=><li key={stage}>{['Code cells','Initialization setup','Fixed-supply issuance','First purchase and custody'][i]}: {journal?.entries[i]?`recorded ${journal.entries[i].state} · ${journal.entries[i].txHash}`:'not recorded'}</li>)}</ol><button onClick={reconcileCode}>Reconcile code stage</button><p role="status">{message}</p>{journal&&<label>Public wizard backup JSON<br/><textarea readOnly rows={5} value={JSON.stringify(journal)}/></label>}<p>Setup, issuance and first purchase are unavailable until the reviewed transaction builders and owner-wallet flow are validated.</p></section>;
}

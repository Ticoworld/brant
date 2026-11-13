'use client';
import {useState} from 'react';
import {importDeploymentAttempt,parseDeploymentAttempt,type DeploymentAttempt} from '../../../lib/v2-engine/deployment-journal.ts';

export default function DeploymentBackup({journal,genesis,codeHashes,onRestore}:{journal:DeploymentAttempt|null;genesis:string;codeHashes:string[];onRestore:(attempt:DeploymentAttempt)=>void}) {
  const [text,setText]=useState(''),[status,setStatus]=useState('');
  async function restore(){try{
    if(!navigator.locks)throw Error('Exclusive deployment lock unavailable');
    await navigator.locks.request('roveko-v2-code-deployment',{mode:'exclusive',ifAvailable:true},lock=>{
      if(!lock)throw Error('Another deployment operation is in progress');
      const attempt=importDeploymentAttempt(localStorage,text,genesis,codeHashes);
      onRestore(attempt);setStatus('Backup restored. Reconcile against the chain before relying on it.');setText('');
    });
  }catch(error){setStatus(error instanceof Error?error.message:'Backup could not be restored');}}
  return <section><h2>Deployment attempt backup</h2><p>The backup contains public transaction and script identities. It is not proof of confirmation. Retain it outside this browser before changing devices.</p>{journal?<><label>Public backup JSON<br/><textarea readOnly value={JSON.stringify(parseDeploymentAttempt(JSON.stringify(journal)))} rows={5}/></label></>:<><label>Restore public backup JSON<br/><textarea value={text} onChange={event=>setText(event.target.value)} rows={5}/></label><br/><button onClick={restore} disabled={!text}>Restore attempt</button></>}<p role="status">{status}</p></section>;
}

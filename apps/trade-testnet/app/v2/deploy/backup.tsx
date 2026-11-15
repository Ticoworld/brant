'use client';
import {useState} from 'react';
import {importDeploymentAttempt,parseDeploymentAttempt,type DeploymentAttempt} from '../../../lib/v2-engine/deployment-journal.ts';
import {useLocale} from '../../i18n-provider';

export default function DeploymentBackup({journal,genesis,codeHashes,onRestore}:{journal:DeploymentAttempt|null;genesis:string;codeHashes:string[];onRestore:(attempt:DeploymentAttempt)=>void}) {
  const {t}=useLocale();
  const [text,setText]=useState(''),[status,setStatus]=useState('');
  async function restore(){try{
    if(!navigator.locks)throw Error('Exclusive deployment lock unavailable');
    await navigator.locks.request('roveko-v2-code-deployment',{mode:'exclusive',ifAvailable:true},lock=>{
      if(!lock)throw Error('Another deployment operation is in progress');
      const attempt=importDeploymentAttempt(localStorage,text,genesis,codeHashes);
      onRestore(attempt);setStatus(t('backupRestoredReconcile'));setText('');
    });
  }catch{setStatus(t('backupRestoreFailed'));}}
  return <section><h2>{t('deploymentAttemptBackup')}</h2><p>{t('backupDisclosure')}</p>{journal?<details><summary>{t('publicBackupJson')}</summary><label><textarea readOnly value={JSON.stringify(parseDeploymentAttempt(JSON.stringify(journal)))} rows={5}/></label></details>:<details><summary>{t('restorePublicBackupJson')}</summary><label><textarea value={text} onChange={event=>setText(event.target.value)} rows={5}/></label><button onClick={restore} disabled={!text}>{t('restoreAttempt')}</button></details>}<p role="status">{status}</p></section>;
}

// Public transaction references only. Stored state is a recovery hint and must
// be independently reconciled with chain state before authorizing a new stage.
export const WIZARD_KEY='roveko-v2-wizard-v1';
export const WIZARD_STAGES=['code','setup','issuance','purchase'] as const;
export type WizardStage=typeof WIZARD_STAGES[number];
export type WizardEntry={stage:WizardStage;txHash:string;state:'submitted'|'confirmed';blockHash?:string};
export type WizardJournal={version:1;genesis:string;owner:string;entries:WizardEntry[]};
const hash=/^0x[0-9a-f]{64}$/i;
export function parseWizard(raw:string):WizardJournal {
  if(raw.length>16384)throw Error('Wizard backup is too large');
  const data=JSON.parse(raw) as WizardJournal;
  if(!data||data.version!==1||!hash.test(data.genesis)||!hash.test(data.owner)||!Array.isArray(data.entries)||data.entries.length>4)throw Error('Invalid wizard journal');
  const seen=new Set<string>();
  const entries=data.entries.map((entry,i)=>{
    if(!entry||entry.stage!==WIZARD_STAGES[i]||!hash.test(entry.txHash)||seen.has(entry.txHash.toLowerCase())||!['submitted','confirmed'].includes(entry.state)||(entry.blockHash!==undefined&&!hash.test(entry.blockHash))||(entry.state==='confirmed'&&!entry.blockHash)||(i<data.entries.length-1&&entry.state!=='confirmed'))throw Error('Invalid wizard stage');
    seen.add(entry.txHash.toLowerCase());
    return {stage:entry.stage,txHash:entry.txHash,state:entry.state,...(entry.blockHash?{blockHash:entry.blockHash}:{})};
  });
  return {version:1,genesis:data.genesis,owner:data.owner,entries};
}
/** Call under the origin-wide deployment lock. A missing/pending RPC result
 * cannot erase or replace the current submitted transaction. */
export function appendWizardSubmission(journal:WizardJournal,stage:WizardStage,txHash:string):WizardJournal {
  const current=parseWizard(JSON.stringify(journal));
  if(current.entries.length>=4||WIZARD_STAGES[current.entries.length]!==stage||current.entries.some(entry=>entry.state!=='confirmed'))throw Error('Previous stage requires reconciliation');
  return parseWizard(JSON.stringify({...current,entries:[...current.entries,{stage,txHash,state:'submitted'}]}));
}
/** Only invoke after independent canonical verification and stage validation. */
export function confirmWizardSubmission(journal:WizardJournal,stage:WizardStage,txHash:string,blockHash:string):WizardJournal {
  const current=parseWizard(JSON.stringify(journal)),entry=current.entries.at(-1);
  if(!entry||entry.stage!==stage||entry.state!=='submitted'||entry.txHash.toLowerCase()!==txHash.toLowerCase())throw Error('Submission does not match journal');
  if(entry.blockHash&&entry.blockHash.toLowerCase()!==blockHash.toLowerCase())throw Error('Recorded block changed');
  return parseWizard(JSON.stringify({...current,entries:[...current.entries.slice(0,-1),{...entry,state:'confirmed',blockHash}]}));
}

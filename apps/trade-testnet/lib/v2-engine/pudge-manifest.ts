import {parseDeploymentAttempt,type DeploymentAttempt} from './deployment-journal.ts';
import {parseWizard,type WizardJournal} from './wizard-journal.ts';
import {recoverPudgeHistory} from './pudge-history.ts';
import {ccc} from '@ckb-ccc/core';
type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
type Proof=(anchor:{txHash:string;index:string},owner:string)=>Promise<{owner:string;newRoot:string;witness:string}>;
export const PUDGE_MARKET_KEY='roveko-pudge-market-v1';

/** Reconstruct a public manifest from canonical stage transactions. Saved
 * manifest fields are never accepted as evidence of market identity. */
export async function createPudgeManifest(rpc:Rpc,rawAttempt:DeploymentAttempt,rawWizard:WizardJournal,proof:Proof,requireSuccessors=true){
 const attempt=parseDeploymentAttempt(JSON.stringify(rawAttempt)),journal=parseWizard(JSON.stringify(rawWizard));
 if(journal.entries.length!==4||journal.entries.some(e=>e.state!=='confirmed'))throw Error('Initialization is not fully confirmed');
 const history=await recoverPudgeHistory(rpc,attempt,journal,proof,{requireSuccessors}),purchase=history.stages.purchase?.tx;if(!purchase)throw Error('Missing confirmed purchase');
 const code=(index:number)=>({outPoint:{txHash:attempt.txHash,index:'0x'+index.toString(16)},depType:'code' as const});
 const xudt={outPoint:{txHash:'0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f',index:'0x0'},depType:'code' as const};
 return {format:'roveko-pudge-market-v1' as const,genesis:journal.genesis,attempt,journal,initializationTransactionHash:purchase.hash(),codeDeploymentTransactionHash:attempt.txHash,initial:[0,1,2,3].map(i=>({tx_hash:purchase.hash(),index:'0x'+i.toString(16)})) as [{tx_hash:string;index:string},{tx_hash:string;index:string},{tx_hash:string;index:string},{tx_hash:string;index:string}],funding:{txHash:purchase.hash(),index:'0x4'},scripts:history.identity,deps:{custody_smt:code(0),market_smt:code(1),custody_marker:code(2),marker_candidate:code(3),owner_lineage_candidate:code(4),xudt}};
}

export async function loadPudgeManifest(rpc:Rpc,raw:string,proof:Proof){
 if(raw.length>65536)throw Error('Market manifest is too large');const saved=JSON.parse(raw);
 if(saved?.format!=='roveko-pudge-market-v1'||!saved.attempt||!saved.journal)throw Error('Invalid Pudge market manifest');
 const verified=await createPudgeManifest(rpc,saved.attempt,saved.journal,proof,false);
 if(saved.genesis!==verified.genesis||saved.codeDeploymentTransactionHash!==verified.codeDeploymentTransactionHash||saved.initializationTransactionHash!==verified.initializationTransactionHash)throw Error('Market manifest identity mismatch');
 try{
  for(const name of ['market','marker','owner','token','custody','custodyMarker'] as const)if(ccc.Script.from(saved.scripts[name]).hash()!==verified.scripts[name].hash())throw Error('script');
  if(saved.scripts.markerData!==verified.scripts.markerData||saved.scripts.custodyMarkerData!==verified.scripts.custodyMarkerData)throw Error('data');
  for(const name of ['custody_smt','market_smt','custody_marker','marker_candidate','owner_lineage_candidate','xudt'] as const){const a=ccc.CellDep.from(saved.deps[name]),b=ccc.CellDep.from(verified.deps[name]);if(a.depType!==b.depType||a.outPoint.txHash!==b.outPoint.txHash||a.outPoint.index!==b.outPoint.index)throw Error('dependency');}
  if(!Array.isArray(saved.initial)||saved.initial.length!==4||saved.initial.some((p:{tx_hash:string;index:string},i:number)=>p.tx_hash!==verified.initial[i].tx_hash||BigInt(p.index)!==BigInt(verified.initial[i].index))||saved.funding.txHash!==verified.funding.txHash||BigInt(saved.funding.index)!==BigInt(verified.funding.index))throw Error('outpoint');
 }catch{throw Error('Market manifest identity mismatch');}
 return verified;
}

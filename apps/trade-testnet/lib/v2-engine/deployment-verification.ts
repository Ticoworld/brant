import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
/** Verify a committed code deployment against the retained reviewed transaction.
 * A missing or noncanonical transaction is never reported as deployed. */
export async function verifyCodeDeployment(rpc:Rpc, reviewed:ccc.Transaction, expectedGenesis:string, expectedHashes:string[]) {
  if(!/^0x[0-9a-f]{64}$/i.test(expectedGenesis)||expectedHashes.length===0||reviewed.outputs.length!==expectedHashes.length+1) throw Error('Invalid deployment review');
  if(await rpc('get_block_hash',['0x0'])!==expectedGenesis) throw Error('Wrong genesis');
  const hash=reviewed.hash();
  const result=await rpc('get_transaction',[hash]) as {tx_status?:{status?:string;block_hash?:string};transaction?:unknown};
  if(result?.tx_status?.status!=='committed'||!result.tx_status.block_hash||!result.transaction) throw Error('Deployment is not committed');
  const actual=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(result.transaction as never));
  if(actual.hash()!==hash) throw Error('Committed transaction differs from review');
  const header=await rpc('get_header',[result.tx_status.block_hash]) as {number?:string;hash?:string};
  if(!header?.number||header.hash!==result.tx_status.block_hash||await rpc('get_block_hash',[header.number])!==header.hash) throw Error('Deployment block is not canonical');
  for(let i=0;i<expectedHashes.length;i++){
    const h=expectedHashes[i]; if(!/^0x[0-9a-f]{64}$/i.test(h)||ccc.hashCkb(reviewed.outputsData[i]).toLowerCase()!==h.toLowerCase())throw Error('Reviewed code hash mismatch');
    const live=await rpc('get_live_cell',[{tx_hash:hash,index:'0x'+i.toString(16)},true]) as {status?:string;cell?:{data?:{hash?:string;content?:string}}};
    if(live?.status!=='live'||live.cell?.data?.hash?.toLowerCase()!==h.toLowerCase()||!live.cell.data.content||ccc.hashCkb(live.cell.data.content).toLowerCase()!==h.toLowerCase())throw Error('Code cell is unavailable or differs from review');
  }
  return {hash,blockHash:header.hash,outpoints:expectedHashes.map((_,i)=>({tx_hash:hash,index:'0x'+i.toString(16)}))};
}

/** Reconcile an uncertain attempt using the persisted public identity. */
export async function reconcileCodeAttempt(rpc:Rpc, attempt:import('./deployment-journal.ts').DeploymentAttempt) {
  const result=await rpc('get_transaction',[attempt.txHash]) as {transaction?:unknown;tx_status?:{status?:string}};
  if(result?.tx_status?.status!=='committed'||!result.transaction) throw Error('Attempt is not confirmed; retain the journal and do not retry');
  const tx=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(result.transaction as never));
  if(tx.hash().toLowerCase()!==attempt.txHash.toLowerCase() || tx.outputs.length!==attempt.codeHashes.length+1) throw Error('Attempt transaction does not match journal');
  if(tx.outputs.slice(0,attempt.codeHashes.length).some(o=>o.lock.hash().toLowerCase()!==attempt.owner.toLowerCase())) throw Error('Code cell owner differs from journal');
  const verified = await verifyCodeDeployment(rpc,tx,attempt.genesis,attempt.codeHashes);
  if(attempt.blockHash && attempt.blockHash.toLowerCase()!==verified.blockHash.toLowerCase()) throw Error('Previously recorded confirmation changed; manual reconciliation required');
  return verified;
}

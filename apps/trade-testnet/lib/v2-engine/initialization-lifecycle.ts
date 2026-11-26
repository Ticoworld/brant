import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';

type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
type Stage='setup'|'issuance'|'purchase';
type Point={txHash:string;index:string};
type Confirmed={stage:Stage;txHash:string;blockHash:string;blockNumber?:string;outputs:Point[]};
const h=/^0x[0-9a-f]{64}$/i;
const pointKey=(p:Point)=>`${p.txHash.toLowerCase()}:${BigInt(p.index)}`;
/** Verify a reviewed initialization transaction on a canonical chain. The
 * transaction must already have been built and authorized by the owner.
 * Inputs, proof, dependency and wallet checks remain separate obligations. */
export async function verifyInitializationStage(rpc:Rpc,genesis:string,stage:Stage,reviewed:ccc.Transaction,requiredInputs:Point[],liveIndices:number[], requireLive = true):Promise<Confirmed>{
  if(!h.test(genesis)||!['setup','issuance','purchase'].includes(stage)||!requiredInputs.length||!liveIndices.length||new Set(liveIndices).size!==liveIndices.length||liveIndices.some(i=>!Number.isSafeInteger(i)||i<0||i>=reviewed.outputs.length))throw Error('Invalid stage review');
  const actualInputs=reviewed.inputs.map(x=>pointKey({txHash:x.previousOutput.txHash,index:ccc.numToHex(x.previousOutput.index)}));
  if(new Set(actualInputs).size!==actualInputs.length||requiredInputs.some(p=>!actualInputs.includes(pointKey(p))))throw Error('Stage predecessor mismatch');
  if(await rpc('get_block_hash',['0x0'])!==genesis)throw Error('Wrong genesis');
  const txHash=reviewed.hash();
  const result=await rpc('get_transaction',[txHash]) as {transaction?:unknown;tx_status?:{status?:string;block_hash?:string}};
  if(result?.tx_status?.status!=='committed'||!result.tx_status.block_hash||!result.transaction)throw Error('Stage is not committed; retain attempt and reconcile');
  const committed=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(result.transaction as never));
  if(committed.hash()!==txHash)throw Error('Committed transaction differs from review');
  if(committed.witnesses.length!==reviewed.witnesses.length||reviewed.witnesses.slice(reviewed.inputs.length).some((w,i)=>w.toLowerCase()!==committed.witnesses[reviewed.inputs.length+i]?.toLowerCase()))throw Error('Committed proof witness differs from review');
  const header=await rpc('get_header',[result.tx_status.block_hash]) as {hash?:string;number?:string};
  if(!header?.number||header.hash!==result.tx_status.block_hash||await rpc('get_block_hash',[header.number])!==header.hash)throw Error('Stage block is not canonical');
  const outputs:Point[]=[];
  for(const i of liveIndices){
    const point={txHash,index:'0x'+i.toString(16)};
    if (!requireLive) { outputs.push(point); continue; }
    const row=await rpc('get_live_cell',[{tx_hash:txHash,index:point.index},true]) as {status?:string;cell?:{output:{capacity:string;lock:{code_hash:string;hash_type:string;args:string};type?:{code_hash:string;hash_type:string;args:string}|null};data:{content:string}}};
    if(row?.status!=='live'||!row.cell)throw Error('Expected successor is unavailable');
    const script=(s:{code_hash:string;hash_type:string;args:string})=>ccc.Script.from({codeHash:s.code_hash,hashType:s.hash_type as 'data1',args:s.args});
    const out=reviewed.outputs[i], actual=row.cell.output;
    if(BigInt(actual.capacity)!==out.capacity||script(actual.lock).hash()!==out.lock.hash()||Boolean(actual.type)!==Boolean(out.type)||(actual.type&&out.type&&script(actual.type).hash()!==out.type.hash())||row.cell.data.content.toLowerCase()!==reviewed.outputsData[i].toLowerCase())throw Error('Successor differs from reviewed output');
    outputs.push(point);
  }
  return {stage,txHash,blockHash:header.hash!,blockNumber:header.number,outputs};
}

/** Require the exact predecessor outputs and keep ambiguous attempts blocked. */
export function nextInitializationStage(previous:Confirmed|undefined,stage:Stage,requiredInputs:Point[]){
  if(stage==='setup'){if(previous)throw Error('Setup already attempted');return;}
  if(!previous||previous.stage!==(stage==='issuance'?'setup':'issuance'))throw Error('Previous stage not confirmed');
  const needed=stage==='issuance'?[previous.outputs[0]]:previous.outputs.slice(0,2);
  if(needed.length!==(stage==='issuance'?1:2)||needed.some(p=>!requiredInputs.some(x=>pointKey(x)===pointKey(p))))throw Error('Stage predecessor mismatch');
}

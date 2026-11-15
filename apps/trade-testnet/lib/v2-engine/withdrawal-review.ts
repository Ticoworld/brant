import { ccc } from '@ckb-ccc/core';
import { readFundingCell } from './funding.ts';
import { buildWithdrawal } from './withdrawal.ts';
import type { Cell } from './transaction.ts';
type Rpc = (method:string,params:unknown[])=>Promise<unknown>;
type Config = {genesis:string;funding:{txHash:string;index:string};deps:Record<string,ccc.CellDepLike>};
const codes:Record<string,string>={custody_smt:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',custody_marker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95'};
// Construct only from canonical replay and a wallet-owned plain funding cell.
export async function prepareWithdrawal(rpc:Rpc, config:Config, owner:string, quantity:bigint) {
  const response=await fetch('/api/v2/proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({owner,side:'withdraw',quantity:quantity.toString()})});
  const body=await response.json(); if(!response.ok) throw Error(body.error || 'Recovery proof unavailable');
  const p=body.proof;
  if(body.genesis!==config.genesis || p.side!=='withdraw' || p.quantity!==quantity.toString() || !['0x0','0x2'].includes(p.tip_outpoint.index)) throw Error('Recovery identity mismatch');
  const index=BigInt(p.tip_outpoint.index), points=[{tx_hash:p.tip_outpoint.tx_hash,index:p.tip_outpoint.index},{tx_hash:p.tip_outpoint.tx_hash,index:'0x'+(index+1n).toString(16)}];
  const rows=await Promise.all(points.map(point=>rpc('get_live_cell',[point,true]))) as {status:string;cell:{output:{capacity:string;lock:{code_hash:string;hash_type:string;args:string};type:{code_hash:string;hash_type:string;args:string}|null};data:{content:string}}}[];
  if(rows.some(r=>r.status!=='live'||!r.cell)) throw Error('Custody singleton spent; refresh proof');
  if(rows[0].cell.output.lock.code_hash.toLowerCase()!==codes.custody_smt || rows[0].cell.data.content.slice(34).toLowerCase()!==p.old_root.slice(2).toLowerCase()) throw Error('Custody script or root mismatch');
  const transform=(s:{code_hash:string;hash_type:string;args:string})=>({codeHash:s.code_hash,hashType:s.hash_type,args:s.args});
  const cells=rows.map((r,i)=>({outPoint:{txHash:points[i].tx_hash,index:points[i].index},capacity:BigInt(r.cell.output.capacity),lock:transform(r.cell.output.lock),type:r.cell.output.type?transform(r.cell.output.type):undefined,data:r.cell.data.content}));
  const funding=await readFundingCell(rpc,config.funding,owner);
  const block=await rpc('get_block_by_number',['0x0']) as {header:{hash:string};transactions:{hash:string}[]};
  if(block.header.hash.toLowerCase()!==config.genesis.toLowerCase() || !block.transactions[1]?.hash) throw Error('Wrong network');
  const names=['custody_smt','custody_marker','xudt'];
  for(const name of names){const dep=ccc.CellDep.from(config.deps[name]); const row=await rpc('get_live_cell',[{tx_hash:dep.outPoint.txHash,index:ccc.numToHex(dep.outPoint.index)},true]) as {status:string;cell?:{data:{content:string}}}; if(dep.depType!=='code'||row.status!=='live'||!row.cell||ccc.hashCkb(row.cell.data.content).toLowerCase()!==codes[name]) throw Error(`Unverified ${name} dependency`);}
  const deps:ccc.CellDepLike[]=[{outPoint:{txHash:block.transactions[1].hash,index:'0x0'},depType:'depGroup'},...names.map(n=>config.deps[n])];
  return buildWithdrawal([...cells,funding] as [Cell,Cell,Cell],quantity,p.new_root,p.witness,100000n,deps,config.genesis,owner);
}

import { ccc } from '@ckb-ccc/core';
import { readFundingCell } from './funding.ts';
import { buildWithdrawal } from './withdrawal.ts';
import { discoverFunding } from './multi-funding.ts';
import { discoverCustodyPair } from './lineage.ts';
import type { Cell } from './transaction.ts';
type Rpc = (method:string,params:unknown[])=>Promise<unknown>;
type Config = {genesis:string;funding?:{txHash:string;index:string};deps:Record<string,ccc.CellDepLike>;format?:string;scripts?:Record<string,ccc.ScriptLike>};
const codes:Record<string,string>={custody_smt:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',custody_marker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95'};
// Construct only from canonical replay and a wallet-owned plain funding cell.
export async function prepareWithdrawal(rpc:Rpc, config:Config, owner:string, quantity:bigint) {
  const pudge=config.format==='roveko-pudge-market-v1';
  const response=await fetch(pudge?'/api/v2/pudge-proof':'/api/v2/proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({owner,side:'withdraw',quantity:quantity.toString(),...(pudge?{manifest:config}:{})})});
  const body=await response.json(); if(!response.ok) throw Error(body.error || 'Recovery proof unavailable');
  const p=body.proof;
  if(body.genesis!==config.genesis || p.side!=='withdraw' || p.quantity!==quantity.toString()) throw Error('Recovery identity mismatch');
  if(pudge){
    if(!p.tip_outpoint?.tx_hash||!p.tip_outpoint?.index||!p.old_root||!p.new_root||typeof p.witness!=='string'||!config.scripts)throw Error('Pudge withdrawal proof is incomplete');
    const genesis=await rpc('get_block_hash',['0x0']);if(typeof genesis!=='string'||genesis.toLowerCase()!==config.genesis.toLowerCase())throw Error('Wrong Pudge network');
    const points=await discoverCustodyPair(rpc,p.tip_outpoint);
    const rows=await Promise.all(points.map(point=>rpc('get_live_cell',[point,true]))) as {status:string;cell:{output:{capacity:string;lock:{code_hash:string;hash_type:string;args:string};type:{code_hash:string;hash_type:string;args:string}|null};data:{content:string}}}[];
    if(rows.some(row=>row.status!=='live'||!row.cell))throw Error('Custody state changed; prepare again');
    const custodyHash=ccc.Script.from(config.scripts.custody).hash().toLowerCase();
    const tokenHash=ccc.Script.from(config.scripts.token).hash().toLowerCase();
    const markerHash=ccc.Script.from(config.scripts.custodyMarker).hash().toLowerCase();
    const scriptHash=(value:{code_hash:string;hash_type:string;args:string}|null)=>value?ccc.Script.from({codeHash:value.code_hash,hashType:value.hash_type as ccc.HashType,args:value.args}).hash().toLowerCase():'';
    if(scriptHash(rows[0].cell.output.lock)!==custodyHash||scriptHash(rows[0].cell.output.type)!==tokenHash||scriptHash(rows[1].cell.output.lock)!==custodyHash||scriptHash(rows[1].cell.output.type)!==markerHash)throw Error('Pudge custody identity mismatch');
    if(rows[0].cell.data.content.slice(34).toLowerCase()!==p.old_root.slice(2).toLowerCase())throw Error('Custody root changed; prepare again');
    const transform=(script:{code_hash:string;hash_type:string;args:string})=>({codeHash:script.code_hash,hashType:script.hash_type,args:script.args});
    const cells=rows.map((row,index)=>({outPoint:{txHash:points[index].tx_hash,index:points[index].index},capacity:BigInt(row.cell.output.capacity),lock:transform(row.cell.output.lock),type:row.cell.output.type?transform(row.cell.output.type):undefined,data:row.cell.data.content})) as [Cell,Cell];
    for(const [name,expected] of [['custody_smt',codes.custody_smt],['custody_marker',codes.custody_marker],['xudt',codes.xudt]] as const){
      const dep=ccc.CellDep.from(config.deps[name]);
      const row=await rpc('get_live_cell',[{tx_hash:dep.outPoint.txHash,index:ccc.numToHex(dep.outPoint.index)},true]) as {status:string;cell?:{data:{content:string}}};
      if(dep.depType!=='code'||row.status!=='live'||!row.cell||ccc.hashCkb(row.cell.data.content).toLowerCase()!==expected)throw Error(`Unverified ${name} dependency`);
    }
    const ownerScript=ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:owner.slice(-40)});
    if(ownerScript.hash().toLowerCase()!==owner.toLowerCase())throw Error('Withdrawal requires a supported standard CKB wallet');
    const tokenType=ccc.Script.from(config.scripts.token);
    const tokenOutput=ccc.CellOutput.from({capacity:0,lock:ownerScript,type:tokenType});
    const minimum=BigInt(tokenOutput.occupiedSize+16)*100_000_000n+1_000_000n;
    const candidates=await discoverFunding(rpc,rpc,{codeHash:ownerScript.codeHash,hashType:ownerScript.hashType,args:ownerScript.args});
    const eligible=candidates.filter(cell=>cell.capacity>=minimum).sort((a,b)=>a.capacity===b.capacity?a.outPoint.txHash.localeCompare(b.outPoint.txHash):a.capacity<b.capacity?-1:1);
    let failure:unknown;
    for(const candidate of eligible){
      try{
        const funding=await readFundingCell(rpc,candidate.outPoint,owner);
        const review=buildWithdrawal([...cells,funding],quantity,p.new_root,p.witness,1_000_000n,[config.deps.custody_smt,config.deps.custody_marker,config.deps.xudt],config.genesis,owner);
        return {...review,inputs:[...cells,funding] as [Cell,Cell,Cell]};
      }catch(error){failure=error;}
    }
    if(failure)throw failure;
    throw Error('No live plain CKB cell can fund the external xUDT output');
  }
  if(!config.funding)throw Error('Withdrawal funding cell is unavailable');
  if(!['0x0','0x2'].includes(p.tip_outpoint.index)) throw Error('Recovery identity mismatch');
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

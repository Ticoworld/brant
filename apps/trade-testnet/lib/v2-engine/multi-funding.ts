import { ccc } from '@ckb-ccc/core';
import {readFundingCell} from './funding.ts';
import {PUDGE_GATE2_ANCHOR,PUDGE_GATE2_GENESIS} from './pudge-public-registry.ts';

export type FundingHint={txHash:string;index:string;owner:string;genesis:string};

export async function selectTradeFunding(rpc:Rpc,script:ccc.Script,minimum:bigint,hint?:FundingHint){
  const owner=script.hash();
  const reserved=(point:{txHash:string;index:string})=>point.txHash.toLowerCase()===PUDGE_GATE2_ANCHOR.txHash.toLowerCase()&&BigInt(point.index)===BigInt(PUDGE_GATE2_ANCHOR.index);
  const check=async(point:{txHash:string;index:string})=>{
    try{
      if(reserved(point))return null;
      const cell=await readFundingCell(rpc,point,owner);
      return cell.capacity>=minimum?cell:null;
    }catch{return null;}
  };
  if(hint?.genesis===PUDGE_GATE2_GENESIS&&hint.owner===owner){
    const live=await check(hint);
    if(live)return live;
  }
  const [tip,indexed]=await Promise.all([
    rpc('get_tip_header',[]) as Promise<{number:string}>,
    rpc('get_indexer_tip',[]) as Promise<{block_number:string;block_hash:string}>,
  ]);
  const lag=BigInt(tip.number)-BigInt(indexed.block_number);
  if(lag<0n||lag>6n)throw Error('Funding index is catching up. Retry shortly.');
  const page=await rpc('get_cells',[{
    script:{code_hash:script.codeHash,hash_type:script.hashType,args:script.args},script_type:'lock',script_search_mode:'exact',with_data:true,
    filter:{output_data:'0x',output_data_filter_mode:'exact',script_len_range:['0x0','0x1'],output_capacity_range:[ccc.numToHex(minimum),'0xffffffffffffffff']},
  },'desc','0x64']) as {objects:{out_point:{tx_hash:string;index:string};output:{capacity:string;type?:unknown};output_data:string}[]};
  const candidates=page.objects.filter(row=>!row.output.type&&row.output_data==='0x'&&BigInt(row.output.capacity)>=minimum)
    .sort((a,b)=>BigInt(a.output.capacity)<BigInt(b.output.capacity)?1:BigInt(a.output.capacity)>BigInt(b.output.capacity)?-1:0).slice(0,8);
  const [live,canonical,after]=await Promise.all([
    Promise.all(candidates.map(row=>check({txHash:row.out_point.tx_hash,index:row.out_point.index}))),
    rpc('get_block_hash',[indexed.block_number]),
    rpc('get_indexer_tip',[]) as Promise<typeof indexed>,
  ]);
  if(canonical!==indexed.block_hash||after.block_hash!==indexed.block_hash||after.block_number!==indexed.block_number)throw Error('Funding index changed during selection. Retry shortly.');
  const funding=live.find(cell=>cell!==null);
  if(!funding)throw Error('No eligible live funding Cell found in the funding search');
  return funding;
}

export type FundingCandidate = { outPoint: { txHash: string; index: string }; capacity: bigint; lock: {codeHash:string;hashType:string;args:string}; type?: unknown; data:string };
const SECP = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8';
type Rpc = (method:string, params:unknown[])=>Promise<unknown>;
/** Bounded plain-capacity search; verify only enough candidates to fund the plan. */
export async function discoverLaunchFunding(rpc:Rpc,lock:ccc.Script,minimum:bigint,protectedPoints:string[]=[]){
 const blocked=new Set([`${PUDGE_GATE2_ANCHOR.txHash}:${BigInt(PUDGE_GATE2_ANCHOR.index)}`,...protectedPoints]);
 const indexed=await rpc('get_indexer_tip',[]) as {block_number:string;block_hash:string};
 const tip=await rpc('get_tip_header',[]) as {number:string};
 const lag=BigInt(tip.number)-BigInt(indexed.block_number);
 if(lag<0n||lag>6n)throw Error('Funding index is catching up. Retry shortly.');
 const selected:FundingCandidate[]=[];let total=0n;
 for(const sufficientOnly of [true,false]){
  const page=await rpc('get_cells',[{script:{code_hash:lock.codeHash,hash_type:lock.hashType,args:lock.args},script_type:'lock',script_search_mode:'exact',with_data:true,
   filter:{output_data:'0x',output_data_filter_mode:'exact',script_len_range:['0x0','0x1'],...(sufficientOnly?{output_capacity_range:[ccc.numToHex(minimum),'0xffffffffffffffff']}:{})}},'desc','0x40']) as {objects:{out_point:{tx_hash:string;index:string};output:{capacity:string;type?:unknown};output_data:string}[]};
  const candidates=page.objects.filter(c=>!c.output.type&&c.output_data==='0x').sort((a,b)=>BigInt(a.output.capacity)>BigInt(b.output.capacity)?-1:1);
  for(const row of candidates){
   const key=`${row.out_point.tx_hash}:${BigInt(row.out_point.index)}`;
   if(blocked.has(key))continue;blocked.add(key);
   const cell=await readFundingCell(rpc,{txHash:row.out_point.tx_hash,index:row.out_point.index},lock.hash()).catch(error=>{
    if(error instanceof Error&&['Funding cell is unavailable or not plain','Funding cell does not belong to connected wallet','Gate 2 requires a standard CKB secp owner'].includes(error.message))return undefined;
    throw error;
   });
   if(!cell)continue;
   if(cell.type||cell.data!=='0x')continue;
   selected.push({...cell,lock:{codeHash:lock.codeHash,hashType:lock.hashType,args:lock.args}});total+=cell.capacity;
   if(total>=minimum){
    if(await rpc('get_block_hash',[indexed.block_number])!==indexed.block_hash)throw Error('Funding index changed during selection. Retry shortly.');
    return selected;
   }
  }
 }
 throw Error('Insufficient eligible funding in bounded launch search');
}
/** Discover candidates through a synchronized CKB indexer and revalidate each
 * against the full node. Indexer omissions can understate the available funds. */
export async function discoverFunding(indexer:Rpc, node:Rpc, lock:FundingCandidate['lock']): Promise<FundingCandidate[]> {
  if (lock.codeHash.toLowerCase() !== SECP || lock.hashType !== 'type' || !/^0x[0-9a-f]{40}$/i.test(lock.args)) throw Error('Standard secp wallet required');
  const [start,indexed]=await Promise.all([
    node('get_tip_header',[]) as Promise<{hash?:string;number?:string}>,
    indexer('get_indexer_tip',[]) as Promise<{block_hash?:string;block_number?:string}>,
  ]);
  if(!start?.hash || !start.number) throw Error('Pudge node tip is unavailable; retry funding discovery.');
  let nodeHeight:bigint,indexerHeight:bigint;
  try{nodeHeight=BigInt(start.number);indexerHeight=BigInt(indexed?.block_number||'0');}catch{throw Error('Pudge funding indexer returned an invalid tip; retry funding discovery.');}
  if(indexed?.block_hash?.toLowerCase()!==start.hash.toLowerCase() || indexerHeight!==nodeHeight){
    const relation=indexerHeight<nodeHeight?'behind':indexerHeight>nodeHeight?'ahead of':'at a different block from';
    throw Error(`Pudge funding indexer is ${relation} the full node (indexer height ${indexerHeight}, node height ${nodeHeight}). Wait for synchronization, then retry.`);
  }
  const script={code_hash:lock.codeHash,hash_type:lock.hashType,args:lock.args};
  const result:FundingCandidate[]=[]; let cursor:string|undefined;
  for (let page=0;page<1000;page++) {
    const args:unknown[]=[{script,script_type:'lock',script_search_mode:'exact',with_data:true},'asc','0x64'];
    if(cursor) args.push(cursor);
    const data=await indexer('get_cells',args) as {objects?:Array<{out_point:{tx_hash:string;index:string}}>;last_cursor?:string};
    if(!Array.isArray(data?.objects)) throw Error('Invalid indexer page');
    for (let offset=0;offset<data.objects.length;offset+=4) {
      const verified = await Promise.all(data.objects.slice(offset,offset+4).map(async row => {
      const live=await node('get_live_cell',[row.out_point,true]) as {status?:string;cell?:{output:{capacity:string;lock:{code_hash:string;hash_type:string;args:string};type?:unknown};data:{content:string}}};
      if(live?.status!=='live' || !live.cell) return null;
      const o=live.cell.output, l=o.lock;
      if(l.code_hash.toLowerCase()!==lock.codeHash.toLowerCase() || l.hash_type!==lock.hashType || l.args.toLowerCase()!==lock.args.toLowerCase()) throw Error('Indexer returned unrelated lock');
        return {outPoint:{txHash:row.out_point.tx_hash,index:row.out_point.index},capacity:BigInt(o.capacity),lock,type:o.type,data:live.cell.data.content};
      }));
      for (const cell of verified) if (cell) result.push(cell);
    }
    if(data.objects.length<100) {
      const canonical=await node('get_block_hash',[start.number]);
      if(typeof canonical!=='string' || canonical.toLowerCase()!==start.hash.toLowerCase()) throw Error('Chain reorganized during funding discovery');
      return result;
    }
    if(!data.last_cursor || data.last_cursor===cursor) throw Error('Indexer cursor did not advance');
    cursor=data.last_cursor;
  }
  throw Error('Funding discovery exceeded page limit');
}
/** Select only plain cells locked by the connected standard-secp owner. The
 * caller must re-fetch every selected outpoint before requesting a signature.
 * Fee estimator must compute the final serialized transaction fee for each
 * proposed input count, including the change output and signature placeholder. */
export function selectFunding(cells: FundingCandidate[], ownerHash:string, outputCapacity:bigint, changeMinimum:bigint, feeForInputs:(count:number)=>bigint, protectedOutpoints:string[] = []) {
  if (!/^0x[0-9a-f]{64}$/i.test(ownerHash) || outputCapacity < 0n || changeMinimum <= 0n) throw Error('Invalid funding request');
  const protectedSet = new Set(protectedOutpoints.map(x=>{
    const m=/^(0x[0-9a-f]{64}):(0x[0-9a-f]+|[0-9]+)$/i.exec(x);
    if(!m) throw Error('Invalid protected outpoint');
    return `${m[1].toLowerCase()}:${BigInt(m[2])}`;
  }));
  const seen = new Set<string>();
  const eligible = cells.filter(c => {
    if (!/^0x[0-9a-f]{64}$/i.test(c.outPoint.txHash) || !/^0x[0-9a-f]+$/i.test(c.outPoint.index)) throw Error('Invalid outpoint');
    const point = `${c.outPoint.txHash.toLowerCase()}:${BigInt(c.outPoint.index)}`;
    if (seen.has(point)) throw Error('Duplicate outpoint');
    seen.add(point);
    if (protectedSet.has(point) || c.capacity <= 0n || c.type || c.data !== '0x' || c.lock.codeHash.toLowerCase() !== SECP || c.lock.hashType !== 'type' || !/^0x[0-9a-f]{40}$/i.test(c.lock.args)) return false;
    return ccc.Script.from(c.lock).hash().toLowerCase() === ownerHash.toLowerCase();
  }).sort((a,b)=>a.capacity === b.capacity ? a.outPoint.txHash.localeCompare(b.outPoint.txHash) || Number(BigInt(a.outPoint.index)-BigInt(b.outPoint.index)) : a.capacity > b.capacity ? -1 : 1);
  let total = 0n;
  for (let i=0;i<eligible.length;i++) {
    total += eligible[i].capacity;
    const fee = feeForInputs(i+1);
    if (fee < 0n) throw Error('Invalid fee');
    const change = total-outputCapacity-fee;
    if (change >= changeMinimum) return { selected:eligible.slice(0,i+1), total, fee, change, deficit:0n };
  }
  const fee = feeForInputs(eligible.length);
  if (fee < 0n) throw Error('Invalid fee');
  const required = outputCapacity+fee+changeMinimum;
  return {selected:[],total,fee,change:0n,deficit:required>total ? required-total : 0n};
}

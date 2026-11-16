import { ccc } from '@ckb-ccc/core';
import { cccA } from '@ckb-ccc/core/advanced';
type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
export type Point={tx_hash:string;index:string};
type Script={code_hash:string;hash_type:string;args:string};
type Output={lock:Script;type:Script|null};
type Tx={hash:string;inputs:{previous_output:Point}[];outputs:Output[]};
const key=(p:Point)=>`${p.tx_hash.toLowerCase()}:${BigInt(p.index)}`;
const same=(a:Script|null,b:Script|null)=>a===null ? b===null : !!b&&a.code_hash.toLowerCase()===b.code_hash.toLowerCase()&&a.hash_type===b.hash_type&&a.args.toLowerCase()===b.args.toLowerCase();
const script=(s:Script)=>ccc.Script.from({codeHash:s.code_hash,hashType:s.hash_type as ccc.HashType,args:s.args});
const blockBatchSize=16n;
async function fetchBlock(rpc:Rpc,height:bigint) {
  let failure:unknown;
  for(let attempt=1;attempt<=3;attempt++) {
    try { return await rpc('get_block_by_number',['0x'+height.toString(16)]) as {header?:{number?:string;hash?:string;parent_hash?:string};transactions?:Tx[]}; }
    catch(error) { failure=error; if(attempt<3) await new Promise(resolve=>setTimeout(resolve,attempt*250)); }
  }
  throw Error(`Block ${height} unavailable after 3 attempts: ${failure instanceof Error?failure.message:String(failure)}`);
}
async function live(rpc:Rpc,p:Point) {const r=await rpc('get_live_cell',[p,true]) as {status?:string;cell?:{output:Output;data:{content:string}}};if(r.status!=='live'||!r.cell) throw Error('Singleton no longer live');return r.cell;}
/** An indexer proposes live cells only. Every predecessor is authenticated by
 * the full node and the resulting chain must reach the original pair. */
async function indexedPair(rpc:Rpc,initial:[Point,Point],a:Output,b:Output,tip:{number:string;hash:string}):Promise<[Point,Point]|null>{
 let page:{objects?:{out_point:Point;output:Output}[]};
 try{page=await rpc('get_cells',[{script:a.lock,script_type:'lock',script_search_mode:'exact'},'asc','0x64']) as typeof page;}catch{return null;}
 if(!Array.isArray(page?.objects)||page.objects.length>=100)return null;
 const objects=page.objects;
 const find=(ref:Output)=>objects.filter(x=>x.output&&same(x.output.lock,ref.lock)&&same(x.output.type,ref.type));
 const aa=find(a),bb=find(b);if(aa.length!==1||bb.length!==1)return null;
 let pair:[Point,Point]=[aa[0].out_point,bb[0].out_point];
 const candidate=pair;const cache=new Map<string,{tx:Tx; height:bigint; index:number}>();
 async function canonical(hash:string){
  const cached=cache.get(hash.toLowerCase());if(cached)return cached;
  const row=await rpc('get_transaction',[hash]) as {transaction?:Tx;tx_status?:{status?:string;block_hash?:string;block_number?:string;tx_index?:string}};
  if(row.tx_status?.status!=='committed'||!row.tx_status.block_hash||!row.tx_status.block_number||!row.tx_status.tx_index||!row.transaction)throw Error('Indexed lineage transaction unavailable');
  const tx=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(row.transaction as never));if(tx.hash().toLowerCase()!==hash.toLowerCase())throw Error('Indexed lineage transaction hash mismatch');
  const height=BigInt(row.tx_status.block_number),index=Number(BigInt(row.tx_status.tx_index));if(height>BigInt(tip.number)||!Number.isSafeInteger(index))throw Error('Indexed lineage position invalid');
  const block=await fetchBlock(rpc,height),blockTx=block.transactions?.[index];if(block.header?.hash?.toLowerCase()!==row.tx_status.block_hash.toLowerCase()||blockTx?.hash?.toLowerCase()!==hash.toLowerCase())throw Error('Indexed lineage transaction not in canonical block');
  if(ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(blockTx as never)).hash().toLowerCase()!==hash.toLowerCase())throw Error('Indexed block transaction hash mismatch');
  const canonicalHash=await rpc('get_block_hash',[row.tx_status.block_number]);if(typeof canonicalHash!=='string'||canonicalHash.toLowerCase()!==row.tx_status.block_hash.toLowerCase())throw Error('Indexed lineage block changed');
  const value={tx:row.transaction,height,index};cache.set(hash.toLowerCase(),value);return value;
 }
 let later:{height:bigint;index:number}|undefined;
 for(let depth=0;depth<10000;depth++){
  if(pair[0].tx_hash.toLowerCase()!==pair[1].tx_hash.toLowerCase())throw Error('Indexed market pair split');
  const row=await canonical(pair[0].tx_hash);if(later&&(row.height>later.height||(row.height===later.height&&row.index>=later.index)))throw Error('Indexed lineage order invalid');
  const outA=row.tx.outputs[Number(BigInt(pair[0].index))],outB=row.tx.outputs[Number(BigInt(pair[1].index))];if(!outA||!outB||!same(outA.lock,a.lock)||!same(outA.type,a.type)||!same(outB.lock,b.lock)||!same(outB.type,b.type))throw Error('Indexed market identity mismatch');
  if(key(pair[0])===key(initial[0])&&key(pair[1])===key(initial[1])){
   const cells=await Promise.all(candidate.map(p=>live(rpc,p)));if(!same(cells[0].output.lock,a.lock)||!same(cells[0].output.type,a.type)||!same(cells[1].output.lock,b.lock)||!same(cells[1].output.type,b.type))throw Error('Indexed live market identity mismatch');
   const stable=await rpc('get_block_hash',[tip.number]);if(typeof stable!=='string'||stable.toLowerCase()!==tip.hash.toLowerCase())throw Error('Chain reorganized; rescan');return candidate;
  }
  const inputs=await Promise.all(row.tx.inputs.map(async input=>{const prev=await canonical(input.previous_output.tx_hash);return {point:input.previous_output,output:prev.tx.outputs[Number(BigInt(input.previous_output.index))]};}));
  const pa=inputs.filter(x=>x.output&&same(x.output.lock,a.lock)&&same(x.output.type,a.type)),pb=inputs.filter(x=>x.output&&same(x.output.lock,b.lock)&&same(x.output.type,b.type));
  if(pa.length!==1||pb.length!==1)throw Error('Indexed market predecessor missing or ambiguous');later=row;pair=[pa[0].point,pb[0].point];
 }
 throw Error('Indexed lineage exceeds traversal limit');
}
/** Scan canonical blocks from initialization to locate the separately evolving
 * market pair. The full-node tip is checked again to detect reorganizations. */
export async function discoverMarketPair(rpc:Rpc, initial:[Point,Point]) {
  if(initial[0].tx_hash.toLowerCase()!==initial[1].tx_hash.toLowerCase()) throw Error('Invalid initial market pair');
  const init=await rpc('get_transaction',[initial[0].tx_hash]) as {tx_status?:{status?:string;block_hash?:string};transaction?:Tx};
  if(init.tx_status?.status!=='committed'||!init.tx_status.block_hash||!init.transaction) throw Error('Market initialization unavailable');
  const a=init.transaction.outputs[Number(BigInt(initial[0].index))],b=init.transaction.outputs[Number(BigInt(initial[1].index))];
  if(!a?.type||!b?.type||!same(a.lock,b.lock)||same(a.type,b.type)) throw Error('Invalid market initialization');
  const start=await rpc('get_header',[init.tx_status.block_hash]) as {number:string}, tip=await rpc('get_tip_header',[]) as {number:string;hash:string};
  const lo=BigInt(start.number),hi=BigInt(tip.number);if(hi<lo||hi-lo>100000n) throw Error('Market history exceeds scan limit');
  const initialCanonical=await rpc('get_block_hash',[start.number]);
  if(typeof initialCanonical!=='string'||initialCanonical.toLowerCase()!==init.tx_status.block_hash.toLowerCase()) throw Error('Initialization block is not canonical');
  const initialLive=await Promise.all(initial.map(p=>rpc('get_live_cell',[p,true]))) as {status?:string;cell?:{output:Output}}[];
  if(initialLive.every(c=>c.status==='live'&&c.cell)) {
    if(!same(initialLive[0].cell!.output.lock,a.lock)||!same(initialLive[0].cell!.output.type,a.type)||!same(initialLive[1].cell!.output.lock,b.lock)||!same(initialLive[1].cell!.output.type,b.type)) throw Error('Market singleton identity changed');
    const stable=await rpc('get_block_hash',[tip.number]);if(typeof stable!=='string'||stable.toLowerCase()!==tip.hash.toLowerCase()) throw Error('Chain reorganized; rescan');
    return initial;
  }
  const indexed=await indexedPair(rpc,initial,a,b,tip);if(indexed)return indexed;
  let pair:[Point,Point]=initial;
  let previousHash:string|undefined,foundInitialization=false;
  for(let first=lo;first<=hi;first+=blockBatchSize) {
    const last=first+blockBatchSize-1n>hi?hi:first+blockBatchSize-1n;
    const blocks=await Promise.all(Array.from({length:Number(last-first+1n)},(_,i)=>{
      const height=first+BigInt(i);
      return fetchBlock(rpc,height);
    }));
    for(let i=0;i<blocks.length;i++) {
      const height=first+BigInt(i),block=blocks[i];
      if(!block?.header?.number||BigInt(block.header.number)!==height||!Array.isArray(block.transactions)) throw Error('Canonical block unavailable');
      const blockHash=block.header.hash,parentHash=block.header.parent_hash;
      if(!blockHash||!/^0x[0-9a-f]{64}$/i.test(blockHash)||!parentHash||!/^0x[0-9a-f]{64}$/i.test(parentHash)) throw Error('Invalid block identity');
      if(height===lo&&blockHash.toLowerCase()!==init.tx_status.block_hash.toLowerCase()) throw Error('Initialization block changed');
      if(previousHash&&parentHash.toLowerCase()!==previousHash.toLowerCase()) throw Error('Discontinuous block history');
      previousHash=blockHash;
      for(const tx of block.transactions) {
        if(height===lo&&tx.hash.toLowerCase()===initial[0].tx_hash.toLowerCase()) foundInitialization=true;
        const used=pair.map(p=>tx.inputs.some(input=>key(input.previous_output)===key(p)));
        if(!used.some(Boolean)) continue;
        if(!used.every(Boolean)) throw Error('Market singleton lineage split');
        const matches=(out:Output,ref:Output)=>same(out.lock,ref.lock)&&same(out.type,ref.type);
        const ai=tx.outputs.map((o,index)=>matches(o,a)?index:-1).filter(index=>index>=0),bi=tx.outputs.map((o,index)=>matches(o,b)?index:-1).filter(index=>index>=0);
        if(ai.length!==1||bi.length!==1||!/^0x[0-9a-f]{64}$/i.test(tx.hash)) throw Error('Invalid market successor');
        pair=[{tx_hash:tx.hash,index:'0x'+ai[0].toString(16)},{tx_hash:tx.hash,index:'0x'+bi[0].toString(16)}];
      }
    }
  }
  if(!foundInitialization||previousHash?.toLowerCase()!==tip.hash.toLowerCase()) throw Error('Incomplete canonical history');
  const unchanged=await rpc('get_block_hash',[tip.number]);if(typeof unchanged!=='string'||unchanged.toLowerCase()!==tip.hash.toLowerCase()) throw Error('Chain reorganized; rescan');
  const cells=await Promise.all(pair.map(p=>live(rpc,p)));if(!same(cells[0].output.lock,a.lock)||!same(cells[0].output.type,a.type)||!same(cells[1].output.lock,b.lock)||!same(cells[1].output.type,b.type)) throw Error('Market singleton identity changed');
  return pair;
}
/** The custody marker may have moved independently of the market pair. */
export async function discoverCustodyPair(rpc:Rpc,point:Point) {
  const asset=await live(rpc,point), lock=asset.output.lock;
  if(!/^0x[0-9a-f]{256}$/i.test(lock.args)||!asset.output.type) throw Error('Invalid custody lock');
  const markerHash='0x'+lock.args.slice(-64).toLowerCase();
  const result=await rpc('get_transaction',[point.tx_hash]) as {tx_status?:{status?:string};transaction?:Tx};
  if(result.tx_status?.status!=='committed'||!result.transaction) throw Error('Custody transaction unavailable');
  const indexes=result.transaction.outputs.map((o,i)=>same(o.lock,lock)&&o.type&&script(o.type).hash().toLowerCase()===markerHash?i:-1).filter(i=>i>=0);
  if(indexes.length!==1) throw Error('Custody marker missing or ambiguous');
  const marker={tx_hash:point.tx_hash,index:'0x'+indexes[0].toString(16)};
  await live(rpc,marker);
  return [point,marker] as [Point,Point];
}

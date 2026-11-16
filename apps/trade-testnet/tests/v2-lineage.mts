import assert from 'node:assert/strict';
import { discoverMarketPair, discoverCustodyPair } from '../lib/v2-engine/lineage.ts';
import { ccc } from '@ckb-ccc/core';
import { cccA } from '@ckb-ccc/core/advanced';
const hash=(c:string)=>'0x'+c.repeat(64), p=(c:string,i:number)=>({tx_hash:hash(c),index:'0x'+i.toString(16)});
const s=(c:string,args='0x')=>({code_hash:hash(c),hash_type:'data1',args});
const lock=s('1'), asset=s('2'), marker=s('3');
const mh=ccc.Script.from({codeHash:marker.code_hash,hashType:'data1',args:'0x'}).hash();
const custody=s('4','0x'+'00'.repeat(96)+mh.slice(2));
const outputs=[{lock,type:asset},{lock,type:marker}], tx=(h:string,ins:ReturnType<typeof p>[],outs:typeof outputs)=>({hash:hash(h),inputs:ins.map(previous_output=>({previous_output})),outputs:outs});
const init=tx('a',[],outputs), move=tx('b',[p('a',0),p('a',1)],outputs), cTx=tx('c',[],[{lock:custody,type:asset},{lock:custody,type:marker}]);
const blocks=[{header:{number:'0x1',hash:hash('d'),parent_hash:hash('c')},transactions:[init]},{header:{number:'0x2',hash:hash('e'),parent_hash:hash('d')},transactions:[move,cTx]}];
const rpc=async(method:string,args:unknown[])=>{
 if(method==='get_transaction') return {tx_status:{status:'committed',block_hash:hash('d')},transaction:(args[0]===hash('a')?init:cTx)};
 if(method==='get_header') return {number:'0x1'};
 if(method==='get_tip_header') return {number:'0x2',hash:hash('e')};
 if(method==='get_block_hash') return args[0]==='0x1'?hash('d'):hash('e');
 if(method==='get_block_by_number') return blocks[Number(BigInt(args[0] as string))-1];
 if(method==='get_live_cell'){const point=args[0] as ReturnType<typeof p>;if(point.tx_hash===hash('a'))return {status:'dead'};const source=point.tx_hash===hash('b')?move:cTx;return {status:'live',cell:{output:source.outputs[Number(BigInt(point.index))],data:{content:'0x'}}};}
 throw Error(method);
};
assert.deepEqual(await discoverMarketPair(rpc,[p('a',0),p('a',1)]),[p('b',0),p('b',1)]);
assert.deepEqual(await discoverCustodyPair(rpc,p('c',0)),[p('c',0),p('c',1)]);
await assert.rejects(()=>discoverMarketPair(async(m,a)=>m==='get_block_hash'&&a[0]==='0x2'?hash('f'):rpc(m,a),[p('a',0),p('a',1)]),/reorganized/);
let scanned=false;
assert.deepEqual(await discoverMarketPair(async(m,a)=>{if(m==='get_block_by_number')scanned=true;if(m==='get_live_cell'&&(a[0] as ReturnType<typeof p>).tx_hash===hash('a'))return {status:'live',cell:{output:outputs[Number(BigInt((a[0] as ReturnType<typeof p>).index))]}};return rpc(m,a);},[p('a',0),p('a',1)]),[p('a',0),p('a',1)]);
assert.equal(scanned,false);
let attempts=0;
assert.deepEqual(await discoverMarketPair(async(m,a)=>{if(m==='get_block_by_number'&&a[0]==='0x1'&&++attempts<3)throw Error('temporary RPC failure');return rpc(m,a);},[p('a',0),p('a',1)]),[p('b',0),p('b',1)]);
assert.equal(attempts,3);
await assert.rejects(()=>discoverMarketPair(async(m,a)=>{if(m==='get_block_by_number'&&a[0]==='0x1')throw Error('offline');return rpc(m,a);},[p('a',0),p('a',1)]),/Block 1 unavailable after 3 attempts: offline/);
await assert.rejects(()=>discoverMarketPair(async(m,a)=>m==='get_block_by_number'&&a[0]==='0x1'?blocks[1]:rpc(m,a),[p('a',0),p('a',1)]),/Canonical block unavailable/);
await assert.rejects(()=>discoverMarketPair(async(m,a)=>m==='get_block_by_number'&&a[0]==='0x2'?{...blocks[1],header:{...blocks[1].header,parent_hash:hash('f')}}:rpc(m,a),[p('a',0),p('a',1)]),/Discontinuous/);
await assert.rejects(()=>discoverMarketPair(async(m,a)=>m==='get_block_by_number'&&a[0]==='0x1'?{...blocks[0],transactions:[]}:rpc(m,a),[p('a',0),p('a',1)]),/Incomplete canonical history/);
console.log('Separate market and custody lineage checks passed');

// Exercise the indexed path with real transaction hashes; missing indexed data
// is never enough to establish a successor.
const cscript=(x:typeof lock)=>({codeHash:x.code_hash,hashType:'data1' as const,args:x.args});
const mk=(ins:{txHash:string;index:string}[])=>ccc.Transaction.from({inputs:ins.map(previousOutput=>({previousOutput,since:'0x0'})),outputs:outputs.map(o=>({capacity:10000000000n,lock:cscript(o.lock),type:cscript(o.type!)})),outputsData:['0x','0x']});
const realInit=mk([]),realMove=mk([{txHash:realInit.hash(),index:'0x0'},{txHash:realInit.hash(),index:'0x1'}]);
const raw=(t:ccc.Transaction)=>({...cccA.JsonRpcTransformers.transactionFrom(t),hash:t.hash()});
const initialHash=realInit.hash(),moveHash=realMove.hash(),p0={tx_hash:initialHash,index:'0x0'},p1={tx_hash:initialHash,index:'0x1'};
let forged=false,blockCalls=0;
const indexedRpc=async(method:string,args:unknown[])=>{
 if(method==='get_transaction'){const h=args[0] as string,t=h===initialHash?realInit:realMove,old=h===initialHash;return {transaction:raw(t),tx_status:{status:'committed',block_hash:old?hash('d'):hash('e'),block_number:old?'0x1':'0x2',tx_index:'0x0'}};}
 if(method==='get_header')return {number:'0x1'};
 if(method==='get_tip_header')return {number:'0x2',hash:hash('e')};
 if(method==='get_block_hash')return args[0]==='0x1'?hash('d'):hash('e');
 if(method==='get_block_by_number'){blockCalls++;return args[0]==='0x1'?{header:{number:'0x1',hash:hash('d')},transactions:[raw(realInit)]}:{header:{number:'0x2',hash:hash('e')},transactions:[forged?raw(realInit):raw(realMove)]};}
 if(method==='get_cells')return {objects:outputs.map((output,i)=>({output,out_point:{tx_hash:moveHash,index:'0x'+i}}))};
 if(method==='get_live_cell'){const point=args[0] as typeof p0;if(point.tx_hash===initialHash)return {status:'dead'};return {status:'live',cell:{output:outputs[Number(BigInt(point.index))],data:{content:'0x'}}};}
 throw Error(method);
};
assert.deepEqual(await discoverMarketPair(indexedRpc,[p0,p1]),[{tx_hash:moveHash,index:'0x0'},{tx_hash:moveHash,index:'0x1'}]);assert.ok(blockCalls<=3);
forged=true;await assert.rejects(()=>discoverMarketPair(indexedRpc,[p0,p1]),/not in canonical block/);
forged=false;
await assert.rejects(()=>discoverMarketPair(async(m,a)=>{const value=await indexedRpc(m,a);if(m==='get_transaction'&&a[0]===moveHash){const r=value as {transaction:ReturnType<typeof raw>};return {...r,transaction:{...r.transaction,outputs_data:['0x01','0x']}};}return value;},[p0,p1]),/transaction hash mismatch/);
await assert.rejects(()=>discoverMarketPair(async(m,a)=>{if(m==='get_block_hash'&&a[0]==='0x2')return hash('f');return indexedRpc(m,a);},[p0,p1]),/block changed|reorganized/);
console.log('Indexed market lineage checks passed');

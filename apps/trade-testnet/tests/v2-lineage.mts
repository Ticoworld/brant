import assert from 'node:assert/strict';
import { discoverMarketPair, discoverCustodyPair } from '../lib/v2-engine/lineage.ts';
import { ccc } from '@ckb-ccc/core';
const hash=(c:string)=>'0x'+c.repeat(64), p=(c:string,i:number)=>({tx_hash:hash(c),index:'0x'+i.toString(16)});
const s=(c:string,args='0x')=>({code_hash:hash(c),hash_type:'data1',args});
const lock=s('1'), asset=s('2'), marker=s('3');
const mh=ccc.Script.from({codeHash:marker.code_hash,hashType:'data1',args:'0x'}).hash();
const custody=s('4','0x'+'00'.repeat(96)+mh.slice(2));
const outputs=[{lock,type:asset},{lock,type:marker}], tx=(h:string,ins:ReturnType<typeof p>[],outs:typeof outputs)=>({hash:hash(h),inputs:ins.map(previous_output=>({previous_output})),outputs:outs});
const init=tx('a',[],outputs), move=tx('b',[p('a',0),p('a',1)],outputs), cTx=tx('c',[],[{lock:custody,type:asset},{lock:custody,type:marker}]);
const blocks=[{header:{number:'0x1'},transactions:[init]},{header:{number:'0x2'},transactions:[move,cTx]}];
const rpc=async(method:string,args:unknown[])=>{
 if(method==='get_transaction') return {tx_status:{status:'committed',block_hash:hash('d')},transaction:(args[0]===hash('a')?init:cTx)};
 if(method==='get_header') return {number:'0x1'};
 if(method==='get_tip_header') return {number:'0x2',hash:hash('e')};
 if(method==='get_block_hash') return hash('e');
 if(method==='get_block_by_number') return blocks[Number(BigInt(args[0] as string))-1];
 if(method==='get_live_cell'){const point=args[0] as ReturnType<typeof p>;const source=point.tx_hash===hash('b')?move:cTx;return {status:'live',cell:{output:source.outputs[Number(BigInt(point.index))],data:{content:'0x'}}};}
 throw Error(method);
};
assert.deepEqual(await discoverMarketPair(rpc,[p('a',0),p('a',1)]),[p('b',0),p('b',1)]);
assert.deepEqual(await discoverCustodyPair(rpc,p('c',0)),[p('c',0),p('c',1)]);
await assert.rejects(()=>discoverMarketPair(async(m,a)=>m==='get_block_hash'?hash('f'):rpc(m,a),[p('a',0),p('a',1)]),/reorganized/);
console.log('Separate market and custody lineage checks passed');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recoverR7 } from '../lib/r7-recovery.ts';
const dir='../../labs/wo15-merkle-intent/r7/evidence/r7-1793925991792/';
const events=JSON.parse(readFileSync(dir+'events.json','utf8'));
const result=JSON.parse(readFileSync(dir+'result.json','utf8'));
const last=events.at(-1),id=last.tx.outputs[0].type.args,code=last.tx.outputs[0].type.codeHash;
const byHash=new Map(events.map((e:any)=>[e.hash,e.committed]));
let live=true;
const rpc=async(method:string,args:unknown[])=>{
 if(method==='get_transaction')return byHash.get(args[0]);
 if(method==='get_live_cell')return live?{status:'live',cell:{data:{content:last.tx.outputsData[0]}}}:{status:'dead'};
 throw Error('Unexpected RPC');
};
const state=await recoverR7(rpc,last.hash,code,id,result.genesis);
assert.equal(state.tree.root,result.root);assert.equal(state.tree.records[0].revision,4n);
live=false;await assert.rejects(()=>recoverR7(rpc,last.hash,code,id,result.genesis),/Stale vault/);
console.log('R7 historical replay and stale live-cell rejection passed');

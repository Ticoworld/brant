const fs=require('fs'),z=require('zlib'),assert=require('assert/strict'),path=require('path'),M=require('./merkle-lib.cjs'),{C}=M;
const dir=path.resolve(process.argv[2]);const events=JSON.parse(fs.readFileSync(dir+'/events.json'));const raw=z.gunzipSync(fs.readFileSync(dir+'/raw.jsonl.gz')).toString().trim().split('\n').map(JSON.parse);let tree,prev;let leafUpdates=0;
function decoded(d){const b=C.b(d),rd=o=>b.readBigUInt64LE(o);assert.equal(b.length,160);return {phase:rd(80),P:rd(96),B:rd(104),count:rd(112),target:Number(rd(120)),root:C.hx(b.subarray(128)),k:rd(72)};}
for(const e of events){assert.equal(e.committed.tx_status.status,'committed');assert(raw.some(r=>r.method==='get_transaction'&&r.params[0]===e.hash&&r.response.result?.tx_status.status==='committed'));if(e.label.startsWith('deploy_'))continue;
 const hasMarket=e.tx.outputs[0].type&&e.tx.outputs[0].lock.codeHash===e.tx.outputs[0].type.codeHash;
 if(!tree){const s=decoded(e.tx.outputsData[0]);tree=new M.Tree(s.target,e.tx.outputs[0].type.args);assert.equal(tree.root,s.root);prev=e;continue;}
 assert.equal(e.tx.inputs[0].previousOutput.txHash,prev.hash);const w=Buffer.concat(e.tx.witnesses.slice(e.tx.inputs.length).map(C.b));const n=Number(w.readBigUInt64LE(8)),stride=104+32*tree.depth;assert.equal(w.length,16+n*stride);
 for(let j=0;j<n;j++){const item=w.subarray(16+j*stride),i=Number(item.readBigUInt64LE(0)),old=M.decodeLeaf(item.subarray(8,56)),next=M.decodeLeaf(item.subarray(56,104));assert.deepEqual(old,tree.records[i]);const proof=Array.from({length:tree.depth},(_,d)=>C.hx(item.subarray(104+32*d,136+32*d)));assert.equal(M.proofRoot(tree.id,i,old,proof),tree.root);tree.set(i,next);leafUpdates++;}
 if(hasMarket){const s=decoded(e.tx.outputsData[0]);assert.equal(tree.root,s.root);const t=M.metadata({tree,phase:s.phase});assert.equal(s.P,t.P);assert.equal(s.B,t.B);assert.equal(s.count,BigInt(t.count));assert.equal(BigInt(e.tx.outputs[0].capacity),s.k+(s.phase?s.B:s.P));assert.deepEqual(e.tx.outputs[0].type,e.tx.outputs[0].lock);}
 else {assert.equal(tree.records.reduce((s,r)=>s+r.b,0n),0n);assert.equal(n,0);}
 prev=e;
}
const report={classification:'OFFLINE_NATIVE_MERKLE_EVIDENCE_VERIFICATION',committed_transactions:events.length,leaf_updates:leafUpdates,target:tree.n,final_backing:tree.records.reduce((s,r)=>s+r.b,0n).toString(),rejections:JSON.parse(fs.readFileSync(dir+'/cases.json')).length};fs.writeFileSync(dir+'/verification.json',JSON.stringify(report,null,2)+'\n');console.log(report);

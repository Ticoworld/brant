// Summarize recorded committed transactions; never submits transactions.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const root=path.resolve(__dirname,'evidence');const results=[];
for(const dir of fs.readdirSync(root)){
 const p=path.join(root,dir);if(!fs.existsSync(p+'/complete.json'))continue;
 const events=JSON.parse(fs.existsSync(p+'/events.json')?fs.readFileSync(p+'/events.json'):zlib.gunzipSync(fs.readFileSync(p+'/events.json.gz')));
 const byHash=new Map(events.map(e=>[e.hash,e.tx]));
 for(const e of events.filter(e=>/offline_sale|batch_\d/.test(e.label))){
 const sum=e.tx.inputs.reduce((v,i)=>{const t=byHash.get(i.previousOutput.txHash);if(!t)throw Error('missing input history');return v+BigInt(t.outputs[Number(i.previousOutput.index)].capacity);},0n);
 const fee=sum-e.tx.outputs.reduce((v,o)=>v+BigInt(o.capacity),0n);
 results.push({evidence:dir,label:e.label,hash:e.hash,bytes:e.bytes,cycles:Number(BigInt(e.cycles.cycles)),feeShannons:fee.toString(),committed:e.committed.tx_status.status});
 }
}
console.log(JSON.stringify(results,null,2));

const fs=require('fs'),zlib=require('zlib'),assert=require('assert/strict'),path=require('path');
const dir=path.resolve(process.argv[2]);const read=p=>JSON.parse(fs.readFileSync(dir+'/'+p));const events=read('events.json'),life=read('lifecycle.json');const raw=zlib.gunzipSync(fs.readFileSync(dir+'/raw.jsonl.gz')).toString().trim().split('\n').map(JSON.parse);
const rd=(h,o)=>Buffer.from(h.slice(2),'hex').readBigUInt64LE(o);
for(const e of events){assert.equal(e.committed.tx_status.status,'committed');assert(raw.some(r=>r.method==='get_transaction'&&r.params[0]===e.hash&&r.response.result?.tx_status?.status==='committed'));}
const cells=new Map();
const genesis=raw.find(r=>r.method==='get_block_by_number'&&r.params[0]==='0x0'&&r.response.result)?.response.result;assert(genesis);
for(const t of genesis.transactions)t.outputs.forEach((o,i)=>cells.set(t.hash+':'+i,BigInt(o.capacity)));
for(const [index,e]of events.entries()){let input=0n;for(const i of e.tx.inputs){const k=i.previousOutput.txHash+':'+Number(BigInt(i.previousOutput.index));assert(cells.has(k));input+=cells.get(k);cells.delete(k);}const output=e.tx.outputs.reduce((s,o)=>s+BigInt(o.capacity),0n);assert.equal(input-output,index===0?1000000n:10000n,e.label);e.tx.outputs.forEach((o,i)=>cells.set(e.hash+':'+i,BigInt(o.capacity)));}
let previous;
for(const e of events.slice(1)){
 if(previous)assert.equal(e.tx.inputs[0].previousOutput.txHash,previous.hash);
 if(e.label.startsWith('lawful_final')){assert.equal(e.tx.outputs.length,1);assert.equal(rd(previous.tx.outputsData[0],80),1n);assert.equal([0,1,2].reduce((s,i)=>s+rd(previous.tx.outputsData[0],96+i*48+40),0n),0n);}
 else {const d=e.tx.outputsData[0];assert.equal(Buffer.from(d.slice(2),'hex').length,240);const phase=rd(d,80);const liabilities=[0,1,2].reduce((s,i)=>s+rd(d,96+i*48+(phase?40:32)),0n);assert.equal(BigInt(e.tx.outputs[0].capacity),rd(d,72)+liabilities);assert.deepEqual(e.tx.outputs[0].lock,e.tx.outputs[0].type);}
 previous=e;
}
const active=events.find(e=>e.label==='release_only_unprotected_creator_proceeds');const contributions=[12500000n,125000000n,12500000000n];assert.equal(contributions.reduce((s,p)=>s+p,0n),BigInt(life.creator_gross_shannons)+BigInt(life.protected_initial_shannons));
const sale=events.find(e=>e.label.startsWith('atomic_paid'));assert.equal(rd(sale.tx.outputsData[0],96+40),5000000n);assert.equal(sale.tx.outputsData[0].slice(2+96*2,2+(96+32)*2),sale.tx.outputsData[0].slice(2+(96+48)*2,2+(96+48+32)*2));
console.log(JSON.stringify({classification:'RECORDED_NATIVE_EVIDENCE_VERIFIED',transactions:events.length,rejections:read('cases.json').length,creator_gross_ckb:Number(BigInt(life.creator_gross_shannons))/1e8,protected_ckb:Number(BigInt(life.protected_initial_shannons))/1e8,cushion_ckb:Number(BigInt(life.cushion_shannons))/1e8},null,2));

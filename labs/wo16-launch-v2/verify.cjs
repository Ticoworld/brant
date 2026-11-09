const assert=require('node:assert/strict'),fs=require('node:fs');
const nativeRoot=process.env.TRADE_NATIVE_ROOT||require('node:path').resolve(__dirname,'../rebuild/native');
const C=require(nativeRoot+'/src/lib.cjs');
const dir=process.argv[2];assert(dir,'usage: node verify.cjs EVIDENCE_DIR');
const rows=fs.readFileSync(dir+'/events.jsonl','utf8').trim().split('\n').map(JSON.parse), by=Object.fromEntries(rows.map(x=>[x.label,x]));
for(const r of rows){assert.equal(r.committed.tx_status.status,'committed');assert.equal(C.U.rawTransactionToHash(r.tx),r.hash);}
const a=by.issue_inventory,b=by.first_purchase,c=by.second_purchase,d=by.curve_sale;for(const x of [a,b,c,d])assert(x);
const setup=by.create_one_shot_owner,withdrawal=by.external_xudt_transfer,returned=by.external_xudt_return;for(const x of [setup,withdrawal,returned])assert(x);
function consumes(child,input,parent,index){const p=child.tx.inputs[input].previousOutput;assert.equal(p.txHash,parent.hash);assert.equal(BigInt(p.index),BigInt(index));}
consumes(a,1,setup,0);consumes(b,0,a,0);consumes(c,0,b,0);consumes(c,1,b,2);consumes(withdrawal,0,c,1);consumes(returned,0,withdrawal,0);consumes(d,0,c,0);consumes(d,1,returned,0);consumes(d,2,c,2);
const amount=(t,i)=>{const z=C.b(t.outputsData[i]);assert.equal(z.length,16);return BigInt('0x'+Buffer.from(z).reverse().toString('hex'));};
const cap=(t,i)=>BigInt(t.outputs[i].capacity);
assert.equal(amount(a.tx,0),1000n);assert.equal(amount(b.tx,0),998n);assert.equal(amount(b.tx,1),2n);assert.equal(amount(c.tx,0),997n);assert.equal(amount(c.tx,1),1n);assert.equal(amount(d.tx,0),998n);assert.equal(amount(d.tx,1),0n);
assert.equal(cap(b.tx,0)-cap(a.tx,0),2100000000n);assert.equal(cap(c.tx,0)-cap(b.tx,0),1200000000n);assert.equal(cap(c.tx,0)-cap(d.tx,0),1200000000n);
for(const x of [b,c,d])assert.equal(C.U.scriptToHash(x.tx.outputs[0].lock),C.U.scriptToHash(a.tx.outputs[0].lock));
assert.equal(C.U.scriptToHash(b.tx.outputs[1].lock),C.U.scriptToHash(c.tx.outputs[1].lock));
assert.equal(C.U.scriptToHash(a.tx.outputs[0].type),C.U.scriptToHash(b.tx.outputs[1].type));
assert.equal(amount(withdrawal.tx,0),1n);assert.equal(amount(returned.tx,0),1n);
const tokenHash=C.U.scriptToHash(a.tx.outputs[0].type);for(const [t,i] of [[b.tx,1],[c.tx,1],[withdrawal.tx,0],[returned.tx,0],[d.tx,1]])assert.equal(C.U.scriptToHash(t.outputs[i].type),tokenHash);
assert.notEqual(C.U.scriptToHash(withdrawal.tx.outputs[0].lock),C.U.scriptToHash(c.tx.outputs[1].lock));assert.equal(C.U.scriptToHash(returned.tx.outputs[0].lock),C.U.scriptToHash(c.tx.outputs[1].lock));
assert.equal(cap(withdrawal.tx,0),cap(c.tx,1)-1000000n);assert.equal(cap(returned.tx,0),cap(withdrawal.tx,0)-1000000n);
assert.equal(cap(d.tx,1)+cap(d.tx,2),cap(returned.tx,0)+cap(c.tx,2)+1200000000n-1000000n);
const checks=fs.readFileSync(dir+'/rejections.jsonl','utf8').trim().split('\n').map(JSON.parse);for(const name of ['overissue','buyer_max_spend','reserve_underpayment','unauthorized_remint','stale_price','sale_minimum','excessive_fee','wrong_recipient'])assert(checks.some(x=>x.label===name));
console.log('Verified recorded node commitments, transaction hashes, ownership, supply, curve prices, reserves, and eight rejection records. Consensus relies on the disposable node.');

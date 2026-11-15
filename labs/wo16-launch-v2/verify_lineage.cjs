const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const C=require((process.env.TRADE_NATIVE_ROOT||path.resolve(__dirname,'../rebuild/native'))+'/src/lib.cjs');
const dir=process.argv[2];assert(dir,'evidence directory required');
const rows=fs.readFileSync(dir+'/events.jsonl','utf8').trim().split('\n').map(JSON.parse), by=Object.fromEntries(rows.map(r=>[r.label,r]));
for(const r of rows){assert.equal(r.committed.tx_status.status,'committed');assert.equal(C.U.rawTransactionToHash(r.tx),r.hash)}
const [issue,first,second,sale]=['issue_marker_inventory','first_purchase','second_purchase','curve_sale'].map(k=>{assert(by[k]);return by[k]});
function link(child,i,parent,j){let p=child.tx.inputs[i].previousOutput;assert.equal(p.txHash,parent.hash);assert.equal(BigInt(p.index),BigInt(j))}
for(const [a,b] of [[first,issue],[second,first],[sale,second]]){link(a,0,b,0);link(a,1,b,1)}
link(sale,2,second,2);link(sale,3,second,3);
const amount=(r,i)=>{let x=C.b(r.tx.outputsData[i]);assert.equal(x.length,16);return BigInt('0x'+Buffer.from(x).reverse().toString('hex'))},cap=(r,i)=>BigInt(r.tx.outputs[i].capacity),hash=s=>C.U.scriptToHash(s);
assert.deepEqual([amount(issue,0),amount(first,0),amount(first,2),amount(second,0),amount(second,2),amount(sale,0),amount(sale,2)],[1000n,998n,2n,997n,1n,998n,0n]);
assert.equal(cap(first,0)-cap(issue,0),2100000000n);assert.equal(cap(second,0)-cap(first,0),1200000000n);assert.equal(cap(second,0)-cap(sale,0),1200000000n);
assert.equal(cap(sale,2)+cap(sale,3),cap(second,2)+cap(second,3)+1200000000n-1000000n);
for(const r of [first,second,sale]){assert.equal(hash(r.tx.outputs[0].type),hash(issue.tx.outputs[0].type));assert.equal(hash(r.tx.outputs[0].lock),hash(issue.tx.outputs[0].lock));assert.equal(hash(r.tx.outputs[1].type),hash(issue.tx.outputs[1].type));assert.equal(r.tx.outputsData[1],issue.tx.outputsData[1]);assert.equal(cap(r,1),cap(issue,1))}
const md=C.b(issue.tx.outputsData[1]);assert.equal(C.hx(md.subarray(0,32)),hash(issue.tx.outputs[0].lock));assert.equal(C.hx(md.subarray(32)),hash(issue.tx.outputs[0].type));
const errors=fs.readFileSync(dir+'/rejections.jsonl','utf8').trim().split('\n').map(JSON.parse);for(const k of ['incorrect_initial_marker','wrong_initial_inventory_position','unauthorized_remint','marker_substitution','wrong_asset_purchase','duplicate_marker','changed_marker_state','reserve_underpayment','stale_price','wrong_recipient','sale_minimum'])assert(errors.some(x=>x.label===k),k);
console.log('Verified transaction hashes, committed statuses, singleton successor chain, token supply, reserve changes, seller payment and eleven rejection records; node consensus is assumed.');

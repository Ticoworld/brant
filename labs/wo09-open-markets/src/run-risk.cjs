const {C,Engine,cell,assert}=require('./engine.cjs');
const e=new Engine('fixed-term-risk'),U=C.UNIT,F=1000000n,R=61n*U;
const cat=(...x)=>Buffer.concat(x.map(x=>typeof x==='string'?C.b(x):x));
const u=n=>C.le(BigInt(n),8), lh=r=>C.U.scriptToHash(C.locks[r]);
function id(w,index=0){return C.hash(cat(u(0),C.b(w.outPoint.txHash),C.le(BigInt(w.outPoint.index),4),u(index)));}
const data=(event,maturity,price)=>C.hx(cat(event,u(maturity),u(price),lh(2)));
async function makeEvent(maturity,label){const w=e.wallets[2],event=C.hash(Buffer.from(label)),type={...e.codes.maturity_event.script,args:id(w)},outs=[cell(206n*U,C.locks[2],type,data(event,maturity,0)),cell(w.capacity-206n*U-F,C.locks[2])];const r=await e.send(label+'_event',e.sign(e.tx([w],outs,[e.dep('maturity_event')]),[w],[2]));e.wallets[2]=r[1];return {c:r[0],event,type,maturity};}
function publish(ev,price){const w=e.wallets[2],ins=[{...ev.c,since:C.hex(ev.maturity)},w],outs=[{...ev.c,data:data(ev.event,ev.maturity,price)},cell(w.capacity-F,C.locks[2])];return {ins,tx:e.sign(e.tx(ins,outs,[e.dep('maturity_event')]),ins,[2])};}
async function pool(ev,label){const s=1000n*U,j=s,terms=C.hx(cat(lh(0),lh(1),C.U.scriptToHash(ev.type),ev.event,u(ev.maturity),u(ev.maturity+10n),u(1000n*U),u(s),u(j),u(F),u(R)));const lock={...e.codes.risk_pool.script,args:C.hash(C.b(terms))},a=e.wallets[0],b=e.wallets[1],cost=s+R+F/2n;const r=await e.send(label+'_fund',e.sign(e.tx([a,b],[cell(s+j+2n*R+F,lock),cell(a.capacity-cost-F,C.locks[0]),cell(b.capacity-cost,C.locks[1])]),[a,b],[0,1]));e.wallets[0]=r[1];e.wallets[1]=r[2];return {c:r[0],terms};}
function settle(p,ev,s,j,at=ev.maturity){return e.tx([{...p.c,since:C.hex(at)}],[cell(s+R,C.locks[0]),cell(j+R,C.locks[1])],[e.dep('risk_pool'),{outPoint:ev.c.outPoint,depType:'code'}],[p.terms]);}
(async()=>{try{await e.start();for(const n of ['maturity_event','risk_pool'])await e.deploy(n,e.build+'/'+n);
const fixtures=C.fs.readFileSync(e.root+'/fixtures/risk-payoffs.json','utf8');for(const [i,f] of JSON.parse(fixtures).entries()){
const tip=BigInt((await e.rpc('get_tip_header')).number),ev=await makeEvent(tip+12n,'scenario_'+i),p=await pool(ev,'scenario_'+i),pub=publish(ev,BigInt(f.price));
if(i===0){await e.reject('publisher_before_maturity',pub.tx,/Immature|immature/,'send_transaction');const noSince=structuredClone(pub.tx);noSince.inputs[0].since='0x0';await e.reject('publisher_missing_since',e.sign(noSince,pub.ins,[2]),/error code 18/);}
while(BigInt((await e.rpc('get_tip_header')).number)<ev.maturity)await e.mine();
const out=await e.send('scenario_'+i+'_publish',pub.tx);ev.c=out[0];e.wallets[2]=out[1];const tx=settle(p,ev,BigInt(f.senior_principal),BigInt(f.junior_principal));
if(i===0){const bad=structuredClone(tx);bad.outputs[0].capacity=C.hex(BigInt(bad.outputs[0].capacity)-1n);bad.outputs[1].capacity=C.hex(BigInt(bad.outputs[1].capacity)+1n);await e.reject('incorrect_payoff',bad,/error code 21/);const wrong=structuredClone(tx);wrong.outputs[0].lock=C.locks[2];await e.reject('incorrect_recipient',wrong,/error code 21/);const missing=structuredClone(tx);missing.cellDeps=missing.cellDeps.slice(0,-1);await e.reject('missing_event',missing,/error code 18/);const altered=structuredClone(tx);altered.witnesses[0]=C.hx(cat(C.b(p.terms).subarray(0,183),Buffer.from([1])));await e.reject('altered_terms',altered,/error code 12/);const second=publish(ev,BigInt(f.price)+1n);await e.reject('immutable_published_event',second.tx,/error code 16/);}
const result=await e.send('scenario_'+i+'_settle',tx);assert.equal(result[0].capacity,BigInt(f.senior_principal)+R);assert.equal(result[1].capacity,BigInt(f.junior_principal)+R);
}
const tip=BigInt((await e.rpc('get_tip_header')).number),ev=await makeEvent(tip+8n,'outage'),p=await pool(ev,'outage'),refund=settle(p,ev,1000n*U,1000n*U,ev.maturity+10n);await e.reject('outage_refund_before_grace',refund,/Immature|immature/,'send_transaction');while(BigInt((await e.rpc('get_tip_header')).number)<ev.maturity+10n)await e.mine();await e.send('outage_native_contribution_refund',refund);
// Both deterministic commitment schedules; no mempool fairness assertion.
for(const publishFirst of [true,false]){
const tip=BigInt((await e.rpc('get_tip_header')).number),ev=await makeEvent(tip+6n,'race_'+publishFirst),p=await pool(ev,'race_'+publishFirst),oldRefund=settle(p,ev,1000n*U,1000n*U,ev.maturity+10n);
while(BigInt((await e.rpc('get_tip_header')).number)<ev.maturity+10n)await e.mine();
if(publishFirst){const pub=publish(ev,80000000n),r=await e.send('late_publication_before_refund',pub.tx);ev.c=r[0];e.wallets[2]=r[1];await e.reject('spent_event_invalidates_old_refund',oldRefund,/Dead|dead|Unknown|unknown/,'send_transaction');await e.send('late_publication_payoff',settle(p,ev,1250n*U,750n*U));}
else {await e.send('refund_before_late_publication',oldRefund);const pub=publish(ev,80000000n),r=await e.send('publication_after_pool_refund',pub.tx);ev.c=r[0];e.wallets[2]=r[1];await e.reject('refunded_pool_cannot_settle_again',settle(p,ev,1250n*U,750n*U),/Dead|dead|Unknown|unknown/,'send_transaction');}
}
e.close();}catch(err){e.close(err);console.error(err);process.exitCode=1;}})();

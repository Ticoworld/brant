const C=require(process.env.TRADE_NATIVE_ROOT+'/src/lib.cjs'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),os=require('node:os'),path=require('node:path');
const {ccc}=require(process.env.TRADE_NATIVE_ROOT+'/node_modules/@ckb-ccc/core');
const signGroup=require(process.env.TRADE_NATIVE_ROOT+'/node_modules/@nervosnetwork/ckb-sdk-core/lib/signWitnessGroup.js').default;
const {fs,UNIT,fee,hex,hx,b,le,hash,locks,keys,U}=C;
keys.push('0x'+'4'.padStart(64,'0'));locks.push({codeHash:locks[0].codeHash,hashType:'type',args:'0x'+U.blake160(U.privateKeyToPublicKey(keys[3]),'hex')});
keys.push('0x'+'5'.padStart(64,'0'));locks.push({codeHash:locks[0].codeHash,hashType:'type',args:'0x'+U.blake160(U.privateKeyToPublicKey(keys[4]),'hex')});
keys.push('0x'+'6'.padStart(64,'0'));locks.push({codeHash:locks[0].codeHash,hashType:'type',args:'0x'+U.blake160(U.privateKeyToPublicKey(keys[5]),'hex')});
keys.push('0x'+'7'.padStart(64,'0'));locks.push({codeHash:locks[0].codeHash,hashType:'type',args:'0x'+U.blake160(U.privateKeyToPublicKey(keys[6]),'hex')});
keys.push('0x'+'8'.padStart(64,'0'));locks.push({codeHash:locks[0].codeHash,hashType:'type',args:'0x'+U.blake160(U.privateKeyToPublicKey(keys[7]),'hex')});
const out=path.join(__dirname,'evidence','native-'+Date.now());fs.mkdirSync(out,{recursive:true});const build=process.env.TRADE_BUILD_DIR||path.join(__dirname,'build');let child,secp;
const chain=fs.mkdtempSync(path.join(os.tmpdir(),'wo16-lineage-'))+'/chain';
async function rpc(method,params=[]){const res=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await res.json();fs.appendFileSync(out+'/rpc.jsonl',JSON.stringify({method,params,response:j})+'\n');if(j.error)throw Error(JSON.stringify(j.error));return j.result;}
const cell=(capacity,lock,type,data='0x')=>({capacity:BigInt(capacity),lock,type,data});
function tx(ins,outs,deps=[]){return {version:'0x0',cellDeps:[secp,...deps],headerDeps:[],inputs:ins.map(x=>({previousOutput:x.outPoint,since:'0x0'})),outputs:outs.map(x=>({capacity:hex(x.capacity),lock:x.lock,...(x.type?{type:x.type}:{})})),outputsData:outs.map(x=>x.data),witnesses:ins.map(()=> '0x')}}
function sign(t,ins,role){t=structuredClone(t);const ids=ins.map((c,i)=>U.scriptToHash(c.lock)===U.scriptToHash(locks[role])?i:-1).filter(i=>i>=0);assert(ids.length);const i=ids[0],h=U.rawTransactionToHash(t),group=[{lock:'',inputType:'',outputType:''},...ids.slice(1).map(j=>t.witnesses[j]),...t.witnesses.slice(ins.length)];t.witnesses[i]=signGroup(keys[role],h,group)[0];return t}
async function send(label,t){const cycles=await rpc('estimate_cycles',[C.snake(t)]);const h=await rpc('send_transaction',[C.snake(t),'passthrough']);let r;for(let i=0;i<30;i++){r=await rpc('get_transaction',[h]);if(r.tx_status.status==='committed')break;await rpc('generate_block')}assert.equal(r.tx_status.status,'committed');fs.appendFileSync(out+'/events.jsonl',JSON.stringify({label,hash:h,cycles,tx:t,committed:r})+'\n');console.log(label,h);return t.outputs.map((x,i)=>({...x,capacity:BigInt(x.capacity),data:t.outputsData[i],outPoint:{txHash:h,index:hex(i)}}))}
async function reject(label,t,code){let e;try{await rpc('estimate_cycles',[C.snake(t)])}catch(x){e=x}assert(e,'unexpected acceptance: '+label);assert.match(e.message,new RegExp('error code '+code+'\\b'));fs.appendFileSync(out+'/rejections.jsonl',JSON.stringify({label,error:e.message})+'\n');console.log('rejected',label)}
async function rejectCase(label,t,source,code,expectedHash){let err;try{await rpc('estimate_cycles',[C.snake(t)])}catch(e){err=e}assert(err,'unexpected acceptance '+label);const msg=JSON.parse(err.message).message;const cases=Array.isArray(code)?code:[[source,code,expectedHash]];assert(cases.some(([src,c,h])=>msg.includes('source: '+src+', cause: ValidationFailure: see error code '+c+' ')&&msg.includes(h.slice(2))),msg);fs.appendFileSync(out+'/rejections.jsonl',JSON.stringify({label,error:err.message,tx:t})+'\n');console.log('rejected',label,code);}
const empty=()=>({owner:'0x'+'00'.repeat(32),balance:0n,revision:0n});
const encode=r=>Buffer.concat([b(r.owner),le(r.balance),le(r.revision)]),copy=records=>records.map(r=>({...r}));
function tree(records){let layer=records.map((r,i)=>hash(Buffer.concat([Buffer.from([1]),le(i),encode(r)])));for(let width=8;width>1;width/=2){const n=[];for(let i=0;i<width;i+=2)n.push(hash(Buffer.concat([Buffer.from([2]),b(layer[i]),b(layer[i+1])])));layer=n;}return layer[0];}
const data=records=>hx(Buffer.concat([le(records.reduce((n,r)=>n+r.balance,0n),16),b(tree(records))]));
function witness(op,seller,buyer,qty,price,order,old,newer,pub=Buffer.alloc(33),sig=Buffer.alloc(65)){return hx(Buffer.concat([le(op),le(seller),le(buyer),le(qty),le(price),b(order),...old.map(encode),...newer.map(encode),pub,sig]));}
const ZERO='0x'+'00'.repeat(32);
async function main(){execFileSync(process.execPath,[C.ROOT+'/src/setup.cjs',chain]);let spec=fs.readFileSync(chain+'/specs/dev.toml','utf8'),extra='';const names=['marker_candidate','market','owner_lineage_candidate','custody','custody_marker'];for(const name of names){fs.copyFileSync(path.join(build,name),chain+'/'+name);extra+=`[[genesis.system_cells]]\nfile = { file = "../${name}" }\ncreate_type_id = false\ncapacity = 100_000_0000_0000\n\n`;}spec=spec.replace('[genesis.system_cells_lock]',extra+'[genesis.system_cells_lock]');fs.writeFileSync(chain+'/specs/dev.toml',spec);
child=spawn(C.ROOT+'/tools/ckb',['run','-C',chain,'--ba-advanced'],{stdio:['ignore',fs.openSync(out+'/node.log','w'),'ignore']});for(let i=0;i<100;i++){try{await rpc('get_tip_header');break}catch{await new Promise(r=>setTimeout(r,100))}}const gen=await rpc('get_block_by_number',['0x0']);secp={outPoint:{txHash:gen.transactions[1].hash,index:'0x0'},depType:'depGroup'};let wallets=[],deps={},hashes={};for(const name of names)hashes[name]=hash(fs.readFileSync(path.join(build,name)));hashes.xudt=hash(fs.readFileSync(C.ROOT+'/vendor/ickb/build/release/xudt'));for(const t of gen.transactions)for(let i=0;i<t.outputs.length;i++){const dh=hash(b(t.outputs_data[i]));for(const [name,h] of Object.entries(hashes))if(dh===h)deps[name]={outPoint:{txHash:t.hash,index:hex(i)},depType:'code'};for(let j=0;j<3;j++)if(t.outputs[i].lock.args===locks[j].args)wallets[j]={...C.camel(t.outputs[i]),capacity:BigInt(t.outputs[i].capacity),data:t.outputs_data[i],outPoint:{txHash:t.hash,index:hex(i)}}}assert.equal(Object.keys(deps).length,6);for(let i=0;i<12;i++)await rpc('generate_block');
const anchor=wallets[0],ab=Buffer.concat([b(anchor.outPoint.txHash),le(BigInt(anchor.outPoint.index),4)]),markerId=hash(Buffer.concat([le(0),ab,le(1)])),marker={codeHash:hashes.marker_candidate,hashType:'data1',args:markerId},market={codeHash:hashes.market,hashType:'data1',args:hx(Buffer.concat([b(hash(ab)),le(10n*UNIT),le(UNIT),le(1000n),b(U.scriptToHash(marker))]))},owner={codeHash:hashes.owner_lineage_candidate,hashType:'data1',args:hx(Buffer.concat([ab,b(hashes.xudt),b(U.scriptToHash(market)),le(1000n,16)]))},token={codeHash:hashes.xudt,hashType:'data1',args:U.scriptToHash(owner)},md=hx(Buffer.concat([b(U.scriptToHash(market)),b(U.scriptToHash(token))])),identities=locks.map(U.scriptToHash);
const setup=await send('fund',sign(tx([wallets[2]],[cell(200n*UNIT,owner),cell(2000n*UNIT,locks[1]),cell(2000n*UNIT,locks[2]),cell(1000n*UNIT,locks[3]),cell(200n*UNIT,owner),cell(wallets[2].capacity-5400n*UNIT-fee,locks[2])]),[wallets[2]],2));
const issueTx=tx([anchor,setup[0]],[cell(300n*UNIT,market,token,hx(le(1000n,16))),cell(300n*UNIT,market,marker,md),cell(anchor.capacity+setup[0].capacity-600n*UNIT-fee,locks[0])],[deps.owner_lineage_candidate,deps.xudt,deps.marker_candidate]);const duplicateMarker=structuredClone(issueTx);duplicateMarker.outputs[2].capacity=hex(BigInt(duplicateMarker.outputs[2].capacity)-300n*UNIT);duplicateMarker.outputs.push({capacity:hex(300n*UNIT),lock:market,type:marker});duplicateMarker.outputsData.push(md);await rejectCase('duplicate_market_singleton',sign(duplicateMarker,[anchor,setup[0]],0),'Outputs[1].Type',3,hashes.marker_candidate);const overissue=structuredClone(issueTx);overissue.outputsData[0]=hx(le(1001n,16));await rejectCase('initial_overissuance',sign(overissue,[anchor,setup[0]],0),'Inputs[1].Lock',7,hashes.owner_lineage_candidate);const issued=await send('issue',sign(issueTx,[anchor,setup[0]],0));
const invIn=issued[0].outPoint,uniqueId=U.scriptToHash(market),custodyMarker={codeHash:hashes.custody_marker,hashType:'data1',args:uniqueId},custody={codeHash:hashes.custody,hashType:'data1',args:hx(Buffer.concat([b(U.scriptToHash(market)),b(U.scriptToHash(token)),b(gen.header.hash),b(U.scriptToHash(custodyMarker))]))},markerData=hx(Buffer.concat([b(U.scriptToHash(custody)),b(U.scriptToHash(token))]));
let records=Array.from({length:8},empty);records[0]={owner:identities[1],balance:3n,revision:0n};records[1]={owner:identities[0],balance:2n,revision:0n};records[2]={owner:identities[3],balance:2n,revision:0n};const initial=copy(records),q=7n,cost=91n*UNIT,buyIns=[issued[0],issued[1],setup[1]],buy=tx(buyIns,[cell(issued[0].capacity+cost,market,token,hx(Buffer.concat([le(993n,16),b(U.scriptToHash(custodyMarker))]))),cell(issued[1].capacity,market,marker,md),cell(350n*UNIT,custody,token,data(records)),cell(350n*UNIT,custody,custodyMarker,markerData),cell(setup[1].capacity-cost-700n*UNIT-fee,locks[1])],[deps.market,deps.marker_candidate,deps.custody_marker,deps.xudt]);buy.headerDeps=[gen.header.hash];buy.witnesses.push(hx(Buffer.concat([le(q),le(cost),...records.map(encode)])));const bought=await send('purchase_to_custody',sign(buy,buyIns,1));
let vc=bought[2],mc=bought[3],actorFunds=[issued[2],bought[4],setup[2],setup[3]];
const fake=await send('fund_fake_untyped_marker',sign(tx([setup[5]],[cell(350n*UNIT,custody),cell(500n*UNIT,locks[4]),cell(500n*UNIT,locks[5]),cell(500n*UNIT,locks[6]),cell(500n*UNIT,locks[7]),cell(setup[5].capacity-2350n*UNIT-fee,locks[2])]),[setup[5]],2));
const genesis=gen.header.hash,marketHash=U.scriptToHash(market),assetHash=U.scriptToHash(token),custodyHash=U.scriptToHash(custody);
async function order(role,index,amount,price,orderId){const rev=records[index].revision,seller=records[index].owner;assert.equal(seller,identities[role]);const msg=`TRADE V2 TOKEN SALE v1\nGenesis: ${genesis}\nMarket: ${marketHash}\nAsset: ${assetHash}\nCustody: ${custodyHash}\nSeller index: ${index}\nSeller: ${seller}\nRevision: ${rev}\nQuantity: ${amount}\nMinimum shannons: ${price}\nPayout: ${seller}\nOrder id: ${orderId}\nBuyer: any\nExpiry: none`;const signer=new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(),keys[role]),sig=b(await signer.signMessageRaw(msg)),pub=b(ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(msg),hx(sig)));return {role,index,amount,price,orderId,msg,sig,pub,revision:rev};}
const aliceOrder=await order(1,0,1n,100n*UNIT,'0x'+'a1'.repeat(32)),carolOrder=await order(0,1,1n,100n*UNIT,'0x'+'b2'.repeat(32));
fs.appendFileSync(out+'/timeline.jsonl',JSON.stringify({label:'orders_signed_before_unrelated',custody:vc.outPoint,root:tree(records),orders:[aliceOrder,carolOrder]},(_,v)=>typeof v==='bigint'?v.toString():Buffer.isBuffer(v)?hx(v):v)+'\n');
// Continuation uses the same authenticated custody and marker after Alice signed.
const dupRecords=Array.from({length:8},empty);dupRecords[0]={owner:identities[2],balance:1n,revision:0n};const dupIns=[bought[0],bought[1],actorFunds[2]],dup=tx(dupIns,[cell(bought[0].capacity+17n*UNIT,market,token,hx(Buffer.concat([le(992n,16),b(U.scriptToHash(custodyMarker))]))),cell(bought[1].capacity,market,marker,md),cell(350n*UNIT,custody,token,data(dupRecords)),cell(350n*UNIT,custody,custodyMarker,markerData),cell(actorFunds[2].capacity-717n*UNIT-fee,locks[2])],[deps.market,deps.marker_candidate,deps.custody_marker,deps.xudt]);dup.headerDeps=[genesis];dup.witnesses.push(hx(Buffer.concat([le(1),le(17n*UNIT),...dupRecords.map(encode)])));await rejectCase('duplicate_custody_lineage',sign(dup,dupIns,2),'Inputs[0].Lock',8,hashes.market);
const purchaseOld=copy(records),purchaseNew=copy(records);purchaseNew[4]={owner:identities[4],balance:1n,revision:1n};
const nextPrice=17n*UNIT,continuationIns=[bought[0],bought[1],vc,mc,fake[1]],continuation=tx(continuationIns,[cell(bought[0].capacity+nextPrice,market,token,hx(Buffer.concat([le(992n,16),b(U.scriptToHash(custodyMarker))]))),cell(bought[1].capacity,market,marker,md),cell(vc.capacity,custody,token,data(purchaseNew)),cell(mc.capacity,custody,custodyMarker,markerData),cell(fake[1].capacity-nextPrice-fee,locks[4])],[deps.market,deps.marker_candidate,deps.custody,deps.custody_marker,deps.xudt]);continuation.witnesses.push(witness(5,0,4,1,0,ZERO,purchaseOld,purchaseNew));
const crossMarket=structuredClone(continuation),nearMarketArgs=b(crossMarket.outputs[0].lock.args);nearMarketArgs[0]^=1;crossMarket.outputs[0].lock={...market,args:hx(nearMarketArgs)};await rejectCase('cross_market_inventory_substitution',sign(crossMarket,continuationIns,4),null,[['Inputs[0].Lock',21,hashes.market],['Inputs[2].Lock',20,hashes.custody]],null);
let invalid=structuredClone(continuation);invalid.outputs[0].capacity=hex(bought[0].capacity+nextPrice-UNIT);invalid.outputs[4].capacity=hex(fake[1].capacity-nextPrice+UNIT-fee);await rejectCase('incorrect_curve_price',sign(invalid,continuationIns,4),'Inputs[0].Lock',28,hashes.market);
invalid=structuredClone(continuation);const over=copy(purchaseNew);over[4].balance++;invalid.outputsData[2]=data(over);invalid.witnesses[5]=witness(5,0,4,1,0,ZERO,purchaseOld,over);await rejectCase('purchase_overcredit',sign(invalid,continuationIns,4),null,[['Inputs[0].Lock',27,hashes.market],['Inputs[2].Lock',23,hashes.custody]],null);
invalid=structuredClone(continuation);invalid.outputs[2].type={...token,args:'0x'+'44'.repeat(32)};await rejectCase('purchase_wrong_asset',sign(invalid,continuationIns,4),null,[['Inputs[0].Lock',22,hashes.market],['Inputs[2].Lock',20,hashes.custody]],null);
invalid=structuredClone(continuation);const altered=copy(purchaseNew);altered[0].revision++;invalid.outputsData[2]=data(altered);invalid.witnesses[5]=witness(5,0,4,1,0,ZERO,purchaseOld,altered);await rejectCase('purchase_unauthorized_revision',sign(invalid,continuationIns,4),'Inputs[2].Lock',25,hashes.custody);
invalid=structuredClone(continuation);const stale=copy(purchaseOld);stale[0].revision++;invalid.witnesses[5]=witness(5,0,4,1,0,ZERO,stale,purchaseNew);await rejectCase('purchase_stale_root',sign(invalid,continuationIns,4),'Inputs[2].Lock',23,hashes.custody);
invalid=structuredClone(continuation);invalid.outputsData[3]='0x'+'00'.repeat(64);await rejectCase('purchase_invalid_marker',sign(invalid,continuationIns,4),null,[['Inputs[0].Lock',23,hashes.market],['Inputs[2].Lock',21,hashes.custody],['Inputs[3].Type',10,hashes.custody_marker]],null);
const continued=await send('continuation_purchase',sign(continuation,continuationIns,4));records=purchaseNew;vc=continued[2];mc=continued[3];fake[1]=continued[4];
// Three individually signed buyers use one curve and custody successor. Input order sets marginal prices.
const batchOld=copy(records),batchNew=copy(records);batchNew[2].balance++;batchNew[2].revision++;batchNew[5]={owner:identities[5],balance:1n,revision:1n};batchNew[6]={owner:identities[6],balance:1n,revision:1n};
const batchIns=[continued[0],continued[1],vc,mc,actorFunds[3],fake[2],fake[3]],batch=tx(batchIns,[cell(continued[0].capacity+57n*UNIT,market,token,hx(Buffer.concat([le(989n,16),b(U.scriptToHash(custodyMarker))]))),cell(continued[1].capacity,market,marker,md),cell(vc.capacity,custody,token,data(batchNew)),cell(mc.capacity,custody,custodyMarker,markerData),cell(actorFunds[3].capacity-18n*UNIT-fee,locks[3]),cell(fake[2].capacity-19n*UNIT,locks[5]),cell(fake[3].capacity-20n*UNIT,locks[6])],[deps.market,deps.marker_candidate,deps.custody,deps.custody_marker,deps.xudt]);
batch.witnesses.push(witness(7,0,0,3,0,ZERO,batchOld,batchNew));batch.witnesses.push(hx(Buffer.concat([le(2),le(1),le(18n*UNIT),le(fee),le(5),le(1),le(19n*UNIT),le(0),le(6),le(1),le(20n*UNIT),le(0)])));let batchSigned=sign(sign(sign(batch,batchIns,3),batchIns,5),batchIns,6);
// Insert immediately after batchSigned is assembled and before either batch is submitted.
// Script groups execute in parallel; accept only the listed, semantically relevant failures.
const resignBatch=t=>sign(sign(sign(t,batchIns,3),batchIns,5),batchIns,6);
const batchReject=async(label,t,cases)=>rejectCase(label,resignBatch(t),null,cases,null);
let attack=structuredClone(batch),abuf=b(attack.witnesses[8]);
le(17n*UNIT).copy(abuf,16);attack.witnesses[8]=hx(abuf);
await batchReject('batch_exceeds_max',attack,[['Inputs[0].Lock',43,hashes.market]]);
attack=structuredClone(batch);abuf=b(attack.witnesses[8]);le(2).copy(abuf,32);attack.witnesses[8]=hx(abuf);
await batchReject('batch_duplicate_slot',attack,[['Inputs[0].Lock',42,hashes.market],['Inputs[2].Lock',29,hashes.custody]]);
attack=structuredClone(batch);attack.outputs[5].lock=locks[6];
await batchReject('batch_redirect_change',attack,[['Inputs[0].Lock',42,hashes.market],['Inputs[2].Lock',29,hashes.custody]]);
attack=structuredClone(batch);abuf=b(attack.witnesses[8]);le(2).copy(abuf,40);attack.witnesses[8]=hx(abuf);
await batchReject('batch_quantity_mismatch',attack,[['Inputs[0].Lock',42,hashes.market],['Inputs[0].Lock',43,hashes.market],['Inputs[0].Lock',44,hashes.market],['Inputs[2].Lock',30,hashes.custody],['Inputs[2].Lock',32,hashes.custody]]);
attack=structuredClone(batch);const stolen=copy(batchNew);stolen[0].balance--;stolen[1].balance++;attack.outputsData[2]=data(stolen);attack.witnesses[7]=witness(7,0,0,3,0,ZERO,batchOld,stolen);
await batchReject('batch_unauthorized_transfer',attack,[['Inputs[2].Lock',31,hashes.custody]]);
attack=structuredClone(batch);const duplicateOwner=copy(batchNew);duplicateOwner[5].owner=identities[3];attack.outputsData[2]=data(duplicateOwner);attack.witnesses[7]=witness(7,0,0,3,0,ZERO,batchOld,duplicateOwner);
await batchReject('batch_duplicate_owner_record',attack,[['Inputs[2].Lock',28,hashes.custody]]);

const conflictIns=[continued[0],continued[1],vc,mc,fake[2],fake[3],actorFunds[3]],conflict=tx(conflictIns,[...batch.outputs.slice(0,4).map((o,i)=>cell(BigInt(o.capacity),o.lock,o.type,batch.outputsData[i])),cell(fake[2].capacity-18n*UNIT-fee,locks[5]),cell(fake[3].capacity-19n*UNIT,locks[6]),cell(actorFunds[3].capacity-20n*UNIT,locks[3])],[deps.market,deps.marker_candidate,deps.custody,deps.custody_marker,deps.xudt]);conflict.witnesses.push(witness(7,0,0,3,0,ZERO,batchOld,batchNew));conflict.witnesses.push(hx(Buffer.concat([le(5),le(1),le(18n*UNIT),le(fee),le(6),le(1),le(19n*UNIT),le(0),le(2),le(1),le(20n*UNIT),le(0)])));const conflictSigned=sign(sign(sign(conflict,conflictIns,5),conflictIns,6),conflictIns,3);assert.notEqual(U.rawTransactionToHash(batchSigned),U.rawTransactionToHash(conflictSigned));await rpc('estimate_cycles',[C.snake(conflictSigned)]);
const batchOut=await send('batch_purchase',batchSigned);let staleBatchError;try{await rpc('send_transaction',[C.snake(conflictSigned),'passthrough'])}catch(e){staleBatchError=e}assert(staleBatchError,'conflicting batch unexpectedly accepted');fs.appendFileSync(out+'/batch-conflict.json',JSON.stringify({tx:conflictSigned,error:staleBatchError.message}));records=batchNew;vc=batchOut[2];mc=batchOut[3];actorFunds[3]=batchOut[4];fake[2]=batchOut[5];fake[3]=batchOut[6];
const prev=(newer)=>[cell(vc.capacity,custody,token,data(newer)),cell(mc.capacity,custody,custodyMarker,markerData)];
function withdrawal(role,index,amount,tokenCap=200n*UNIT){const old=copy(records),newer=copy(records);newer[index].balance-=amount;newer[index].revision++;const ins=[vc,mc,actorFunds[role]],t=tx(ins,[...prev(newer),cell(tokenCap,locks[role],token,hx(le(amount,16))),cell(actorFunds[role].capacity-tokenCap-fee,locks[role])],[deps.custody,deps.custody_marker,deps.xudt]);t.witnesses.push(witness(4,index,0,amount,0,ZERO,old,newer));return {t,ins,old,newer,role};}
async function perform(label,o){const v=await send(label,sign(o.t,o.ins,o.role));records=o.newer;vc=v[0];mc=v[1];actorFunds[o.role]=v.at(-1);return v;}
let dw=withdrawal(3,2,1n);const dave=await perform('unrelated_dave_withdraw',dw);assert.notEqual(tree(initial),tree(records));
{
 const qty=BigInt('0x'+Buffer.from(b(dave[2].data).subarray(0,16)).reverse().toString('hex'));
 const ins=[dave[2],setup[4]],attack=tx(ins,[cell(dave[2].capacity,locks[3],token,hx(le(qty+1n,16))),cell(setup[4].capacity-fee,locks[3])],[deps.xudt,deps.owner_lineage_candidate]);
 await rejectCase('owner_mode_forged_matching_lock_mint',sign(attack,ins,3),'Inputs[1].Lock',4,hashes.owner_lineage_candidate);
}
// Probe xUDT's enhanced owner-mode path using the real issuance owner script
// carried in WitnessArgs.input_type. The conserved transfer is the positive
// control; the otherwise identical +1 token output must fail in the xUDT VM.
{
 const ownerBytes=b(U.serializeScript(owner));
 const tail=Buffer.concat([ownerBytes,le(4,4)]);
 const offset=20+ownerBytes.length;
 const xudtWitness=Buffer.concat([le(20+tail.length,4),le(20,4),le(offset,4),le(offset,4),le(offset,4),tail]);
 const amount=BigInt('0x'+Buffer.from(b(dave[2].data).subarray(0,16)).reverse().toString('hex'));
 const ins=[dave[2],actorFunds[3]],base=tx(ins,[cell(dave[2].capacity,locks[3],token,hx(le(amount,16))),cell(actorFunds[3].capacity-fee,locks[3])],[deps.xudt,deps.owner_lineage_candidate]);
 const signOwnerWitness=enlarge=>{const t=structuredClone(base);t.outputsData[0]=hx(le(amount+BigInt(enlarge),16));const group=[{lock:'',inputType:hx(xudtWitness),outputType:''},t.witnesses[1],...t.witnesses.slice(ins.length)];t.witnesses[0]=signGroup(keys[3],U.rawTransactionToHash(t),group)[0];return t;};
 await rpc('estimate_cycles',[C.snake(signOwnerWitness(0))]);
 const attack=signOwnerWitness(1);let err;try{await rpc('estimate_cycles',[C.snake(attack)])}catch(e){err=e}assert(err,'enhanced owner witness permitted xUDT inflation');
 const msg=JSON.parse(err.message).message;assert(msg.includes('Inputs[0].Type')&&msg.includes(hashes.xudt.slice(2)),msg);
 fs.appendFileSync(out+'/rejections.jsonl',JSON.stringify({label:'enhanced_owner_witness_inflation',error:err.message,tx:attack})+'\n');
 console.log('rejected enhanced_owner_witness_inflation');
}
function sale(intent,recordSource=records){const old=copy(recordSource),newer=copy(old),buyerIndex=3;newer[intent.index].balance-=intent.amount;newer[intent.index].revision++;if(newer[buyerIndex].owner===ZERO)newer[buyerIndex].owner=identities[2];newer[buyerIndex].balance+=intent.amount;newer[buyerIndex].revision++;const ins=[vc,mc,actorFunds[2]],t=tx(ins,[...prev(newer),cell(intent.price,locks[intent.role]),cell(actorFunds[2].capacity-intent.price-fee,locks[2])],[deps.custody,deps.custody_marker,deps.xudt]);t.headerDeps=[genesis];t.witnesses.push(witness(2,intent.index,buyerIndex,intent.amount,intent.price,intent.orderId,old,newer,intent.pub,intent.sig));return {t,ins,old,newer,role:2};}
let st=sale(aliceOrder,initial);await rejectCase('stale_seller_proof',sign(st.t,st.ins,2),'Inputs[0].Lock',6,hashes.custody);
let as=sale(aliceOrder);let bad=structuredClone(as.t);bad.outputs[2].capacity=hex(aliceOrder.price-UNIT);bad.outputs[3].capacity=hex(BigInt(bad.outputs[3].capacity)+UNIT);await rejectCase('underpaid_seller',sign(bad,as.ins,2),'Inputs[0].Lock',17,hashes.custody);
bad=structuredClone(as.t);let sw=b(bad.witnesses[3]);sw[874]^=1;bad.witnesses[3]=hx(sw);await rejectCase('invalid_signature',sign(bad,as.ins,2),'Inputs[0].Lock',19,hashes.custody);
const altSigner=new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(),keys[0]),wrongSig=b(await altSigner.signMessageRaw(aliceOrder.msg)),wrongPub=b(ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(aliceOrder.msg),hx(wrongSig)));bad=structuredClone(as.t);sw=b(bad.witnesses[3]);wrongPub.copy(sw,840);wrongSig.copy(sw,873);bad.witnesses[3]=hx(sw);await rejectCase('wrong_seller_signer',sign(bad,as.ins,2),'Inputs[0].Lock',19,hashes.custody);
const rightSigner=new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(),keys[1]),wrongChain=b(await rightSigner.signMessageRaw(aliceOrder.msg.replace(genesis,'0x'+'42'.repeat(32))));bad=structuredClone(as.t);sw=b(bad.witnesses[3]);wrongChain.copy(sw,873);bad.witnesses[3]=hx(sw);await rejectCase('wrong_chain_signature',sign(bad,as.ins,2),'Inputs[0].Lock',19,hashes.custody);
bad=structuredClone(as.t);let wrongType=b(bad.outputs[0].type.args);wrongType[0]^=1;bad.outputs[0].type={...bad.outputs[0].type,args:hx(wrongType)};await rejectCase('wrong_custody_asset',sign(bad,as.ins,2),'Inputs[0].Lock',2,hashes.custody);

bad=structuredClone(as.t);bad.outputs[2].lock=locks[3];await rejectCase('seller_payment_redirect',sign(bad,as.ins,2),'Inputs[0].Lock',17,hashes.custody);
const changedQty=sale({...aliceOrder,amount:2n});await rejectCase('altered_signed_quantity',sign(changedQty.t,changedQty.ins,2),'Inputs[0].Lock',19,hashes.custody);
bad=structuredClone(as.t);let ww=b(bad.witnesses[3]);ww[40]^=1;bad.witnesses[3]=hx(ww);await rejectCase('altered_order_id',sign(bad,as.ins,2),'Inputs[0].Lock',19,hashes.custody);
bad=structuredClone(as.t);bad.inputs[1].previousOutput=fake[0].outPoint;bad.outputs[3].capacity=hex(BigInt(bad.outputs[3].capacity)+fake[0].capacity-mc.capacity);await rejectCase('wrong_singleton_marker',sign(bad,[vc,fake[0],actorFunds[2]],2),'Inputs[0].Lock',2,hashes.custody);

await perform('alice_open_sale_after_unrelated',as);let used=sale(aliceOrder);await rejectCase('fulfilled_order_replay',sign(used.t,used.ins,2),'Inputs[0].Lock',19,hashes.custody);
const canceledOrder=await order(1,0,1n,99n*UNIT,'0x'+'c3'.repeat(32));let old=copy(records),newer=copy(old);newer[0].revision++;let ri=[vc,mc,actorFunds[1]],rt=tx(ri,[...prev(newer),cell(actorFunds[1].capacity-fee,locks[1])],[deps.custody,deps.custody_marker,deps.xudt]);rt.witnesses.push(witness(3,0,0,0,0,ZERO,old,newer));await perform('alice_revoke', {t:rt,ins:ri,newer,role:1});let revoked=sale(canceledOrder);await rejectCase('revoked_order',sign(revoked.t,revoked.ins,2),'Inputs[0].Lock',19,hashes.custody);
const cs=sale(carolOrder);bad=structuredClone(cs.t);let duplicate=copy(cs.newer);duplicate[3].balance--;duplicate[4]={owner:identities[2],balance:1n,revision:1n};bad.outputsData[0]=data(duplicate);bad.witnesses[3]=witness(2,carolOrder.index,3,carolOrder.amount,carolOrder.price,carolOrder.orderId,cs.old,duplicate,carolOrder.pub,carolOrder.sig);await rejectCase('duplicate_buyer_position',sign(bad,cs.ins,2),'Inputs[0].Lock',6,hashes.custody);await perform('carol_open_sale_after_unrelated',cs);
let bw=withdrawal(2,3,2n);const benOut=await perform('ben_withdraw',bw);
const tombstoneOrder=await order(1,0,1n,100n*UNIT,'0x'+'d4'.repeat(32)),tombOld=copy(records),tombNew=copy(records);assert.equal(tombOld[3].balance,0n);assert.equal(tombOld[3].owner,identities[2]);tombNew[0].balance--;tombNew[0].revision++;tombNew[3].owner=identities[7];tombNew[3].balance=1n;tombNew[3].revision++;const tombIns=[vc,mc,fake[4]],tomb=tx(tombIns,[...prev(tombNew),cell(tombstoneOrder.price,locks[1]),cell(fake[4].capacity-tombstoneOrder.price-fee,locks[7])],[deps.custody,deps.custody_marker,deps.xudt]);tomb.headerDeps=[genesis];tomb.witnesses.push(witness(2,0,3,1,tombstoneOrder.price,tombstoneOrder.orderId,tombOld,tombNew,tombstoneOrder.pub,tombstoneOrder.sig));await rejectCase('replace_ben_tombstone',sign(tomb,tombIns,7),'Inputs[0].Lock',18,hashes.custody);
let aw=withdrawal(1,0,2n,350n*UNIT);const aliceOut=await perform('alice_withdraw',aw);
const depOld=copy(records),depNew=copy(records);assert.equal(depOld[0].balance,0n);depNew[0].balance=1n;depNew[0].revision++;const depIns=[vc,mc,aliceOut[2]],depTx=tx(depIns,[...prev(depNew),cell(142n*UNIT,locks[1],token,hx(le(1n,16))),cell(aliceOut[2].capacity-142n*UNIT-fee,locks[1])],[deps.custody,deps.custody_marker,deps.xudt]);depTx.witnesses.push(witness(1,0,0,1,0,ZERO,depOld,depNew));const deposit=await perform('alice_deposit_after_zero', {t:depTx,ins:depIns,newer:depNew,role:1});const revived=sale(aliceOrder);await rejectCase('old_order_after_balance_returns',sign(revived.t,revived.ins,2),'Inputs[0].Lock',19,hashes.custody);const aliceReturn=await perform('alice_rewithdraw',withdrawal(1,0,1n,142n*UNIT));

actorFunds[4]=fake[1];actorFunds[5]=fake[2];actorFunds[6]=fake[3];
let curve=batchOut[0],curveMarker=batchOut[1];
// Call before send() with an unsigned, otherwise valid sell transaction t and its inputs.
async function rejectSellMutations(t,ins,role){
 let x=structuredClone(t);
 // Increase gross payout one shannon while preserving total CKB.
 x.outputs[0].capacity=hex(BigInt(x.outputs[0].capacity)-1n);x.outputs[4].capacity=hex(BigInt(x.outputs[4].capacity)+1n);
 await rejectCase('sell_excess_payout',sign(x,ins,role),'Inputs[0].Lock',28,hashes.market);
 x=structuredClone(t);x.outputs[0].capacity=hex(BigInt(x.outputs[0].capacity)+1n);x.outputs[4].capacity=hex(BigInt(x.outputs[4].capacity)-1n);
 await rejectCase('sell_underpaid',sign(x,ins,role),'Inputs[0].Lock',28,hashes.market);
 x=structuredClone(t);let w=b(x.witnesses[5]);le(0).copy(w,24);x.witnesses[5]=hx(w);
 await rejectCase('sell_zero_quantity',sign(x,ins,role),null,[['Inputs[0].Lock',31,hashes.market],['Inputs[2].Lock',23,hashes.custody]],null);
 x=structuredClone(t);w=b(x.witnesses[5]);le(999999999999n).copy(w,32);x.witnesses[5]=hx(w);
 await rejectCase('sell_minimum_exceeds_price',sign(x,ins,role),'Inputs[0].Lock',31,hashes.market);
 x=structuredClone(t);x.outputs[4].lock=locks[(role+1)%locks.length];
 await rejectCase('sell_redirect',sign(x,ins,role),null,[['Inputs[0].Lock',25,hashes.market],['Inputs[2].Lock',24,hashes.custody]],null);
}
// Replay of an offline order after seller revision changes should use the unchanged signature
// with the CURRENT state witness; an old witness alone only proves stale-root rejection.
// Assert the signature check fails against the revised leaf (custody error 19).

async function sellToCurve(inventory, marketMarker, role, index, qty, minProceeds, label) {
  const old=copy(records), newer=copy(records);
  const before=BigInt('0x'+Buffer.from(b(inventory.data).subarray(0,16)).reverse().toString('hex'));
  const outstanding=1000n-before;
  assert(qty>0n && qty<=outstanding && old[index].balance>=qty);
  const gross=qty*10n*UNIT+UNIT*(qty*(outstanding-qty)+qty*(qty-1n)/2n);
  assert(gross>=minProceeds);
  newer[index].balance-=qty; newer[index].revision++;
  const ins=[inventory,marketMarker,vc,mc,actorFunds[role]];
  const invData=hx(Buffer.concat([le(before+qty,16),b(U.scriptToHash(custodyMarker))]));
  const t=tx(ins,[cell(inventory.capacity-gross,market,token,invData),cell(marketMarker.capacity,market,marker,md),cell(vc.capacity,custody,token,data(newer)),cell(mc.capacity,custody,custodyMarker,markerData),cell(actorFunds[role].capacity+gross-fee,locks[role])],[deps.market,deps.marker_candidate,deps.custody,deps.custody_marker,deps.xudt]);
  t.witnesses.push(witness(6,0,index,qty,minProceeds,ZERO,old,newer));
  if(role===4)await rejectSellMutations(t,ins,role);
  const out=await send(label||('curve_sell_'+role+'_'+index),sign(t,ins,role));
  records=newer; vc=out[2]; mc=out[3]; actorFunds[role]=out[4];
  return {inventory:out[0],marketMarker:out[1],gross,old,newer};
}

for(const [role,index] of [[4,4],[0,1],[3,2],[5,5],[6,6]]) {const qty=records[index].balance; if(qty){const v=await sellToCurve(curve,curveMarker,role,index,qty,0n);curve=v.inventory;curveMarker=v.marketMarker;}}
// Insert after constructing an unsigned, valid 4-input/4-output external sell `t` and `ins`, before signing/sending.
// `role`, `gross`, `qty`, `token`, `locks`, `hashes`, `UNIT`, `sign`, `rejectCase`, `hex`, `le`, `b`, `hx` follow run.cjs conventions.
// Every mutation is re-signed by the actual holder, so rejection tests the covenant rather than an invalid signature.
async function rejectExternalAttacks(t,ins,role,gross,qty) {
 let x=structuredClone(t);
 // Preserve total capacities and fee while increasing curve withdrawal by one shannon.
 x.outputs[0].capacity=hex(BigInt(x.outputs[0].capacity)-1n);
 x.outputs[3].capacity=hex(BigInt(x.outputs[3].capacity)+1n);
 await rejectCase('external_excess_payout',sign(x,ins,role),'Inputs[0].Lock',47,hashes.market);
 x=structuredClone(t); x.outputs[0].capacity=hex(BigInt(x.outputs[0].capacity)+1n); x.outputs[3].capacity=hex(BigInt(x.outputs[3].capacity)-1n);
 await rejectCase('external_underpaid_seller',sign(x,ins,role),'Inputs[0].Lock',47,hashes.market);
 x=structuredClone(t); x.outputs[3].lock=locks[(role+1)%locks.length];
 await rejectCase('external_payout_redirect',sign(x,ins,role),'Inputs[0].Lock',42,hashes.market);
 x=structuredClone(t); x.outputs[2].lock=locks[(role+1)%locks.length];
 await rejectCase('external_token_change_redirect',sign(x,ins,role),'Inputs[0].Lock',42,hashes.market);
 x=structuredClone(t); x.witnesses[4]=hx(Buffer.concat([le(qty),le(gross+1n)]));
 await rejectCase('external_minimum_not_met',sign(x,ins,role),'Inputs[0].Lock',46,hashes.market);
 x=structuredClone(t);x.outputs[2].type={...token,args:'0x'+'44'.repeat(32)};
 await rejectCase('external_wrong_xudt_type',sign(x,ins,role),'Inputs[0].Lock',41,hashes.market);
 // Exercise the current market's quantity/supply ceiling with otherwise
 // well-formed 48-byte inventory data and the genuine token Type Script.
 x=structuredClone(t);x.outputsData[0]=hx(Buffer.concat([le(1001n,16),b(U.scriptToHash(custodyMarker))]));
 await rejectCase('external_inventory_above_supply',sign(x,ins,role),null,[['Inputs[0].Lock',43,hashes.market],['Inputs[0].Type',-52,hashes.xudt]],null);
 // Claim a redemption quantity larger than the signed seller's genuine input
 // balance while keeping the data shape and all capacities valid.
 x=structuredClone(t);const beforeInv=BigInt('0x'+Buffer.from(b(t.outputsData[0]).subarray(0,16)).reverse().toString('hex'));x.outputsData[0]=hx(Buffer.concat([le(beforeInv+qty+1n,16),b(U.scriptToHash(custodyMarker))]));x.outputsData[2]=hx(le(0n,16));
 await rejectCase('external_quantity_exceeds_holder',sign(x,ins,role),null,[['Inputs[0].Lock',44,hashes.market],['Inputs[0].Type',-52,hashes.xudt]],null);
 // A zero-quantity xUDT output is still an unexpected extra asset cell. Keep
 // total CKB and token amounts unchanged and leave every original output valid.
 x=structuredClone(t);x.outputs[3].capacity=hex(BigInt(x.outputs[3].capacity)-142n*UNIT);x.outputs.push({capacity:hex(142n*UNIT),lock:locks[role],type:token});x.outputsData.push(hx(le(0n,16)));
 await rejectCase('external_extra_xudt_output',sign(x,ins,role),'Inputs[0].Lock',4,hashes.market);
 // An additional genuine xUDT input/output pair preserves global token and
 // capacity sums but violates the four-cell external-redeem transaction shape.
 const withBen=[...ins,benOut[2]];x=structuredClone(t);x.inputs.push({previousOutput:benOut[2].outPoint,since:'0x0'});x.witnesses.splice(4,0,'0x');x.outputs.push({capacity:hex(benOut[2].capacity),lock:locks[2],type:token});x.outputsData.push(benOut[2].data);
 await rejectCase('external_extra_xudt_input',sign(sign(x,withBen,2),withBen,role),'Inputs[0].Lock',23,hashes.market);
 // Keep ordinary xUDT sums balanced while making the seller return one extra
 // unit. Market accounting must reject the mismatched inventory/holder delta.
 x=structuredClone(t);const old=BigInt('0x'+Buffer.from(b(t.outputsData[2])).reverse().toString('hex'));x.outputsData[2]=hx(le(old+1n,16));
 let externalReturnError;try{await rpc('estimate_cycles',[C.snake(sign(x,ins,role))])}catch(e){externalReturnError=e}
 assert(externalReturnError,'external incorrect-token return unexpectedly accepted');const em=JSON.parse(externalReturnError.message).message;assert(em.includes(hashes.market.slice(2))||em.includes(hashes.xudt.slice(2)),em);assert(/error code (44|-52)\b/.test(em),em);fs.appendFileSync(out+'/rejections.jsonl',JSON.stringify({label:'external_incorrect_token_return',error:externalReturnError.message,tx:sign(x,ins,role)})+'\n');console.log('rejected external_incorrect_token_return',em.match(/error code (-?\d+)/)?.[1]);
 x=structuredClone(t); x.outputsData[2]=hx(le(BigInt('0x'+Buffer.from(b(t.outputsData[2])).reverse().toString('hex'))+1n,16));
 // Inflation leaves inventory and all capacities intact. The xUDT type may reject concurrently; accept only attributable market lock or xUDT type failure after checking actual node result.
 // Do not assert a specific script until testing, because VM groups may race and the xUDT error code must be observed.
 // await rejectCase('external_inflation',sign(x,ins,role),...);
 x=structuredClone(t); x.outputs[2].type={...token,args:'0x'+'44'.repeat(32)};
 // Wrong output type can fail either market identity (Inputs[0].Lock, 41) or the wrong output type's script resolution; observe before attributing.
 // await rejectCase('external_wrong_asset',sign(x,ins,role),...);
}

async function externalSell(tokenCell,role,qty,label){const before=BigInt('0x'+Buffer.from(b(curve.data).subarray(0,16)).reverse().toString('hex')),n=1000n-before;const gross=qty*10n*UNIT+UNIT*(qty*(n-qty)+qty*(qty-1n)/2n),old=BigInt('0x'+Buffer.from(b(tokenCell.data).subarray(0,16)).reverse().toString('hex'));assert(old>=qty);const ins=[curve,curveMarker,tokenCell,actorFunds[role]],t=tx(ins,[cell(curve.capacity-gross,market,token,hx(Buffer.concat([le(before+qty,16),b(U.scriptToHash(custodyMarker))]))),cell(curveMarker.capacity,market,marker,md),cell(tokenCell.capacity,locks[role],token,hx(le(old-qty,16))),cell(actorFunds[role].capacity+gross-fee,locks[role])],[deps.market,deps.marker_candidate,deps.xudt]);t.witnesses.push(hx(Buffer.concat([le(qty),le(gross)])));if(label==='external_sell_dave')await rejectExternalAttacks(t,ins,role,gross,qty);const signed=sign(t,ins,role),v=await send(label,signed);if(label==='external_sell_dave'){let replaySend=null,replaySendError=null;try{replaySend=await rpc('send_transaction',[C.snake(signed),'passthrough'])}catch(e){replaySendError=e.message}let replayEstimateError=null;try{await rpc('estimate_cycles',[C.snake(signed)])}catch(e){replayEstimateError=e.message}assert(replayEstimateError,'committed external redemption replay remained estimable');const original=await rpc('get_transaction',[v[0].outPoint.txHash]);assert.equal(original.tx_status.status,'committed');C.write(out+'/external-sell-replay.json',{hash:v[0].outPoint.txHash,replaySend,replaySendError,replayEstimateError,originalStatus:original.tx_status,tx:signed});}curve=v[0];curveMarker=v[1];actorFunds[role]=v[3];}
await externalSell(dave[2],3,1n,'external_sell_dave');await externalSell(benOut[2],2,2n,'external_sell_ben');await externalSell(deposit[2],1,1n,'external_sell_alice_remainder');await externalSell(aliceReturn[2],1,1n,'external_sell_alice_last');
assert.equal(curve.data,hx(Buffer.concat([le(1000,16),b(U.scriptToHash(custodyMarker))])));assert.equal(curve.capacity,issued[0].capacity);assert(records.every(r=>r.balance===0n));
{
 const ins=[actorFunds[2],setup[4]],secondInit=tx(ins,[cell(300n*UNIT,market,token,hx(le(1000n,16))),cell(300n*UNIT,market,marker,md),cell(actorFunds[2].capacity+setup[4].capacity-600n*UNIT-fee,locks[2])],[deps.owner_lineage_candidate,deps.xudt,deps.marker_candidate]);
 await rejectCase('second_initialization_after_full_sell_down',sign(secondInit,ins,2),'Inputs[1].Lock',4,hashes.owner_lineage_candidate);
}
async function rebuy(label){const old=copy(records),next=copy(records);next[0].balance++;next[0].revision++;const ins=[curve,curveMarker,vc,mc,actorFunds[1]],t=tx(ins,[cell(curve.capacity+10n*UNIT,market,token,hx(Buffer.concat([le(999,16),b(U.scriptToHash(custodyMarker))]))),cell(curveMarker.capacity,market,marker,md),cell(vc.capacity,custody,token,data(next)),cell(mc.capacity,custody,custodyMarker,markerData),cell(actorFunds[1].capacity-10n*UNIT-fee,locks[1])],[deps.market,deps.marker_candidate,deps.custody,deps.custody_marker,deps.xudt]);t.witnesses.push(witness(5,0,0,1,10n*UNIT,ZERO,old,next));const v=await send(label,sign(t,ins,1));curve=v[0];curveMarker=v[1];vc=v[2];mc=v[3];actorFunds[1]=v[4];records=next;}
await rebuy('roundtrip_buy_1');const preSellOrder=await order(1,0,1n,100n*UNIT,'0x'+'e5'.repeat(32));let round=await sellToCurve(curve,curveMarker,1,0,1n,10n*UNIT,'curve_sell_roundtrip_1');curve=round.inventory;curveMarker=round.marketMarker;assert.equal(curve.capacity,issued[0].capacity);
await rebuy('roundtrip_buy_2');const staleRound=sale(preSellOrder);await rejectCase('order_replay_after_curve_sale',sign(staleRound.t,staleRound.ins,2),'Inputs[0].Lock',19,hashes.custody);round=await sellToCurve(curve,curveMarker,1,0,1n,10n*UNIT,'curve_sell_roundtrip_2');curve=round.inventory;curveMarker=round.marketMarker;assert.equal(curve.capacity,issued[0].capacity);assert.equal(curve.data,hx(Buffer.concat([le(1000,16),b(U.scriptToHash(custodyMarker))])));
C.write(out+'/summary.json',{hashes,market,marker,owner,token,custody,custodyMarker,genesis,identities,initial,records,orders:[{...aliceOrder,pub:hx(aliceOrder.pub),sig:hx(aliceOrder.sig)},{...carolOrder,pub:hx(carolOrder.pub),sig:hx(carolOrder.sig)},{...canceledOrder,pub:hx(canceledOrder.pub),sig:hx(canceledOrder.sig)}],supply:1000,inventory:1000,finalCurve:curve.outPoint,finalCustody:vc.outPoint,benOut:benOut[2].outPoint,aliceOut:aliceReturn[2].outPoint,aliceRemainder:deposit[2].outPoint,daveOut:dave[2].outPoint});console.log('Evidence',out);}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{if(child)child.kill()});

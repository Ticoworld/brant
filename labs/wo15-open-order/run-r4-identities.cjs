const C = require('../rebuild/native/src/lib.cjs');
const assert = require('node:assert/strict');
const {spawn,execFileSync} = require('node:child_process');
const os = require('node:os');
const signGroup = require(C.path.join(C.path.dirname(require.resolve('../rebuild/native/node_modules/@nervosnetwork/ckb-sdk-core')),'signWitnessGroup.js')).default;
const {fs,UNIT,fee,hex,hx,b,le,hash,locks,keys,U} = C;
const out=C.path.join(__dirname,'evidence','r4-identities-'+Date.now()); fs.mkdirSync(out,{recursive:true});
const chain=fs.mkdtempSync(C.path.join(os.tmpdir(),'wo15-'))+'/chain'; let child;
const binary=C.path.join(__dirname,'r3','build','sell_order');
const rpc=async(method,params=[])=>{const r=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();fs.appendFileSync(out+'/rpc.jsonl',JSON.stringify({method,params,response:j})+'\n');if(j.error)throw Error(JSON.stringify(j.error));return j.result};
const cell=(capacity,lock,type,data='0x')=>({capacity:BigInt(capacity),lock,type,data});
let secp,xdep,odep;
const orderHashForRejections=hash(fs.readFileSync(binary)).slice(2);
function tx(ins,outs,deps=[]){return {version:'0x0',cellDeps:[secp,...deps],headerDeps:[],inputs:ins.map(x=>({previousOutput:x.outPoint,since:'0x0'})),outputs:outs.map(x=>({capacity:hex(x.capacity),lock:x.lock,...(x.type?{type:x.type}:{})})),outputsData:outs.map(x=>x.data),witnesses:ins.map(()=> '0x')}}
function sign(t,ins,role){t=structuredClone(t);const ids=ins.map((c,i)=>U.scriptToHash(c.lock)===U.scriptToHash(locks[role])?i:-1).filter(i=>i>=0);assert(ids.length);const i=ids[0],h=U.rawTransactionToHash(t),group=[{lock:'',inputType:'',outputType:''},...ids.slice(1).map(j=>t.witnesses[j]),...t.witnesses.slice(ins.length)];t.witnesses[i]=signGroup(keys[role],h,group)[0];return t}
async function send(label,t){const cycles=await rpc('estimate_cycles',[C.snake(t)]);const h=await rpc('send_transaction',[C.snake(t),'passthrough']);let r;for(let i=0;i<30;i++){r=await rpc('get_transaction',[h]);if(r.tx_status.status==='committed')break;await rpc('generate_block')}assert.equal(r.tx_status.status,'committed');fs.appendFileSync(out+'/events.jsonl',JSON.stringify({label,hash:h,cycles,tx:t})+'\n');console.log(label,h);return t.outputs.map((x,i)=>({...x,capacity:BigInt(x.capacity),data:t.outputsData[i],outPoint:{txHash:h,index:hex(i)}}))}
async function main(){
 execFileSync(process.execPath,[C.ROOT+'/src/setup.cjs',chain]);
 const original=fs.readFileSync(binary), variant=Buffer.concat([original,Buffer.from([0])]);
 fs.writeFileSync(chain+'/order-a',original);fs.writeFileSync(chain+'/order-b',variant);
 const hashes=[hash(original),hash(variant)];assert.notEqual(...hashes);
 let spec=fs.readFileSync(chain+'/specs/dev.toml','utf8');
 spec=spec.replace('[genesis.system_cells_lock]', ['order-a','order-b'].map(f=>'[[genesis.system_cells]]\nfile = { file = "../'+f+'" }\ncreate_type_id = false\ncapacity = 100_000_0000_0000\n\n').join('')+'[genesis.system_cells_lock]');fs.writeFileSync(chain+'/specs/dev.toml',spec);
 child=spawn(C.ROOT+'/tools/ckb',['run','-C',chain,'--ba-advanced'],{stdio:['ignore',fs.openSync(out+'/node.log','w'),'ignore']});
 for(let i=0;i<100;i++){try{await rpc('get_tip_header');break}catch{await new Promise(r=>setTimeout(r,100))}}
 const gen=await rpc('get_block_by_number',['0x0']);secp={outPoint:{txHash:gen.transactions[1].hash,index:'0x0'},depType:'depGroup'};
 const xhash=hash(fs.readFileSync(C.ROOT+'/vendor/ickb/build/release/xudt'));let deps=[],wallets=[];
 for(const t of gen.transactions)for(let i=0;i<t.outputs.length;i++){let dh=hash(b(t.outputs_data[i]));let dep={outPoint:{txHash:t.hash,index:hex(i)},depType:'code'};if(hashes.includes(dh))deps[hashes.indexOf(dh)]=dep;if(dh===xhash)xdep=dep;for(let j=0;j<3;j++)if(t.outputs[i].lock.args===locks[j].args)wallets[j]={...C.camel(t.outputs[i]),capacity:BigInt(t.outputs[i].capacity),data:t.outputs_data[i],outPoint:{txHash:t.hash,index:hex(i)}}}
 assert(deps.length===2&&xdep&&wallets.length===3);for(let i=0;i<12;i++)await rpc('generate_block');
 let orders=[],types=[];
 for(const [k,role] of [0,2].entries()){
  let w=wallets[role],token={codeHash:xhash,hashType:'data1',args:U.scriptToHash(locks[role])};types.push(token);
  let minted=await send('issue_'+k,sign(tx([w],[cell(210n*UNIT,locks[role],token,hx(le(1000n,16))),cell(w.capacity-210n*UNIT-fee,locks[role])],[xdep]),[w],role));
  let args=hx(Buffer.concat([b(U.scriptToHash(locks[role])),b(U.scriptToHash(token)),le(1000n,16),le(BigInt(100+100*k)*UNIT)]));let lock={codeHash:hashes[k],hashType:'data1',args};let ins=[minted[0],minted[1]];
  if(k===0){let tooSmall=sign(tx(ins,[cell(209n*UNIT,lock,token,hx(le(1000n,16))),cell(minted[1].capacity+UNIT-fee,locks[role])],[xdep]),ins,role);let smallErr;try{await rpc('send_transaction',[C.snake(tooSmall),'passthrough'])}catch(e){smallErr=e}assert(smallErr&&/Capacity|capacity/.test(smallErr.message),smallErr?.message);fs.appendFileSync(out+'/rejections.jsonl',JSON.stringify({label:'order_below_occupied_capacity',error:smallErr.message,tx:tooSmall})+'\n');}
  let funded=await send('fund_'+k,sign(tx(ins,[cell(210n*UNIT,lock,token,hx(le(1000n,16))),cell(minted[1].capacity-fee,locks[role])],[xdep]),ins,role));orders.push(funded[0]);wallets[role]=funded[1];
 }
 // Trust boundary: the private node's committed chain supplies the funding
 // transaction and its input cells; relay descriptions are never consulted.
 let listings=[];
 for(const [k,order] of orders.entries()){
  const role=[0,2][k], observed=await rpc('get_transaction',[order.outPoint.txHash]);assert.equal(observed.tx_status.status,'committed');const funding=observed.transaction;
  let authorized=false;for(const input of funding.inputs){const parent=await rpc('get_transaction',[input.previous_output.tx_hash]);assert.equal(parent.tx_status.status,'committed');let previous=parent.transaction.outputs[Number(BigInt(input.previous_output.index))];if(U.scriptToHash(C.camel(previous.lock))===U.scriptToHash(locks[role]))authorized=true;}
  assert(authorized,'funding has no maker-authorized input');const live=await rpc('get_live_cell',[C.snake(order.outPoint),true]);assert.equal(live.status,'live');const actual=C.camel(live.cell.output);assert.deepEqual(actual.lock,order.lock);assert.deepEqual(actual.type,types[k]);assert.equal(live.cell.data.content,hx(le(1000n,16)));assert.equal(BigInt(actual.capacity),210n*UNIT);
  listings.push({genesisHash:gen.header.hash,orderOutpoint:order.outPoint,contractCodeHash:hashes[k],hashType:'data1',assetTypeHash:U.scriptToHash(types[k]),inventory:'1000',priceShannons:(BigInt(100+100*k)*UNIT).toString(),makerLockHash:U.scriptToHash(locks[role]),fundingTransaction:order.outPoint.txHash,status:'live',cancellationStatus:'unknown',fundingMakerInputVerified:true});
 }
 fs.writeFileSync(out+'/listings.json',JSON.stringify(listings,null,2));
 const ins=[wallets[1],orders[0],orders[1]], buyer=wallets[1];
 let outs=[cell(61n*UNIT,locks[1]),cell(61n*UNIT,locks[1]),cell(310n*UNIT,locks[0]),cell(142n*UNIT,locks[1],types[0],hx(le(1000n,16))),cell(410n*UNIT,locks[2]),cell(142n*UNIT,locks[1],types[1],hx(le(1000n,16))),cell(buyer.capacity-706n*UNIT-fee,locks[1])];
 let settlement=tx(ins,outs,[...deps,xdep]);for(const i of [1,2])settlement.witnesses[i]=U.serializeWitnessArgs({lock:U.scriptToHash(locks[1]),inputType:'',outputType:''});settlement=sign(settlement,ins,1);
 let bad=structuredClone(settlement);bad.outputs[4].capacity=hex(409n*UNIT);bad.outputs[6].capacity=hex(BigInt(bad.outputs[6].capacity)+UNIT);bad=sign(bad,ins,1);let err;try{await rpc('estimate_cycles',[C.snake(bad)])}catch(e){err=e}assert(err&&/Inputs\[2\]\.Lock.*error code 26\b/.test(err.message),err?.message);fs.appendFileSync(out+'/rejections.jsonl',JSON.stringify({label:'second_maker_underpaid',error:err.message,tx:bad})+'\n');
 let cancelFirstIns=[orders[0],wallets[0]];let cancelAfterFill=sign(tx(cancelFirstIns,[cell(210n*UNIT,locks[0],types[0],hx(le(1000n,16))),cell(wallets[0].capacity-fee,locks[0])],[deps[0],xdep]),cancelFirstIns,0);
 let swapped=structuredClone(settlement);[swapped.outputs[4],swapped.outputs[6]]=[swapped.outputs[6],swapped.outputs[4]];swapped=sign(swapped,ins,1);let badOrder;try{await rpc('estimate_cycles',[C.snake(swapped)])}catch(e){badOrder=e}assert(badOrder&&/Inputs\[2\]\.Lock.*error code 26\b/.test(badOrder.message),badOrder?.message);fs.appendFileSync(out+'/rejections.jsonl',JSON.stringify({label:'misplaced_second_payout',error:badOrder.message,tx:swapped})+'\n');
 const result=await send('two_identity_settlement',settlement);for(const [i,expected] of [[2,310n],[3,142n],[4,410n],[5,142n]]){let live=await rpc('get_live_cell',[C.snake(result[i].outPoint),true]);assert.equal(live.status,'live');assert.equal(BigInt(live.cell.output.capacity),expected*UNIT);assert.equal(live.cell.data.content,settlement.outputsData[i]);assert.deepEqual(C.camel(live.cell.output.lock),settlement.outputs[i].lock);if(settlement.outputs[i].type)assert.deepEqual(C.camel(live.cell.output.type),settlement.outputs[i].type);}
 for(const order of orders){let live=await rpc('get_live_cell',[C.snake(order.outPoint),true]);assert.equal(live.status,'unknown')}

 let staleErr;try{await rpc('estimate_cycles',[C.snake(cancelAfterFill)])}catch(e){staleErr=e}assert(staleErr&&/Unknown\(OutPoint/.test(staleErr.message),staleErr?.message);fs.appendFileSync(out+'/rejections.jsonl',JSON.stringify({label:'stale_cancel_after_fill',error:staleErr.message,tx:cancelAfterFill})+'\n');
 // A new maker-authorized order provides the opposite confirmed ordering.
 const mk=wallets[0], orderLock=orders[0].lock;
 let freshFund=await send('fund_cancel_first',sign(tx([mk],[cell(210n*UNIT,orderLock,types[0],hx(le(1000n,16))),cell(mk.capacity-210n*UNIT-fee,locks[0])],[xdep]),[mk],0));
 let ci=[freshFund[0],freshFund[1]], cancel=sign(tx(ci,[cell(210n*UNIT,locks[0],types[0],hx(le(1000n,16))),cell(freshFund[1].capacity-fee,locks[0])],[deps[0],xdep]),ci,0);
 let fi=[freshFund[0],result[6]],fill=tx(fi,[cell(310n*UNIT,locks[0]),cell(142n*UNIT,locks[1],types[0],hx(le(1000n,16))),cell(result[6].capacity-242n*UNIT-fee,locks[1])],[deps[0],xdep]);fill.witnesses[0]=U.serializeWitnessArgs({lock:U.scriptToHash(locks[1]),inputType:'',outputType:''});fill=sign(fill,fi,1);
 let recovered=await send('cancel_before_fill',cancel);let recoveredLive=await rpc('get_live_cell',[C.snake(recovered[0].outPoint),true]);assert.equal(recoveredLive.status,'live');assert.equal(BigInt(recoveredLive.cell.output.capacity),210n*UNIT);assert.deepEqual(C.camel(recoveredLive.cell.output.lock),locks[0]);assert.deepEqual(C.camel(recoveredLive.cell.output.type),types[0]);assert.equal(recoveredLive.cell.data.content,hx(le(1000n,16)));
 let staleFill;try{await rpc('estimate_cycles',[C.snake(fill)])}catch(e){staleFill=e}assert(staleFill&&/Unknown\(OutPoint/.test(staleFill.message),staleFill?.message);fs.appendFileSync(out+'/rejections.jsonl',JSON.stringify({label:'stale_fill_after_cancel',error:staleFill.message,tx:fill})+'\n');
 // An accidentally funded cell with missing type and different data remains
 // recoverable by a separate authorized maker input.
 let malformed=await send('fund_malformed_inventory',sign(tx([recovered[1]],[cell(210n*UNIT,orderLock,null,'0x1234'),cell(recovered[1].capacity-210n*UNIT-fee,locks[0])]),[recovered[1]],0));let mi=[malformed[0],malformed[1]];let rescue=await send('recover_malformed_inventory',sign(tx(mi,[cell(210n*UNIT,locks[0],null,'0x1234'),cell(malformed[1].capacity-fee,locks[0])],[deps[0]]),mi,0));let rescueLive=await rpc('get_live_cell',[C.snake(rescue[0].outPoint),true]);assert.equal(rescueLive.status,'live');assert.equal(rescueLive.cell.data.content,'0x1234');assert.deepEqual(C.camel(rescueLive.cell.output.lock),locks[0]);
 fs.writeFileSync(out+'/summary.json',JSON.stringify({hashes,orderOutpoints:orders.map(x=>x.outPoint),settlementOutputs:result.map(x=>x.outPoint),fee:fee.toString()},null,2));console.log('Evidence:',out);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{if(child)child.kill()});

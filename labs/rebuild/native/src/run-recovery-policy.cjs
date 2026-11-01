const C=require('./lib.cjs'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('child_process'),os=require('os');
const signGroup=require(C.path.join(C.path.dirname(require.resolve('@nervosnetwork/ckb-sdk-core')),'signWitnessGroup.js')).default;
const {fs,ROOT,UNIT,fee,hex,b,hx,le,hash,keys,locks,U,orderData}=C;
const out=process.env.EVIDENCE_DIR||ROOT+'/evidence/run-'+Date.now();if(fs.existsSync(out))throw Error('Evidence directory must be fresh');fs.mkdirSync(out,{recursive:true});
const dir=fs.mkdtempSync(os.tmpdir()+'/trade-rebuild-')+'/chain';let child,gen,deps={},codes={},wallets=[],events=[],cases=[];
function save(){C.write(out+'/events.json',events);C.write(out+'/cases.json',cases);}
async function rpc(method,params=[]){const response=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await response.json();fs.appendFileSync(out+'/raw.jsonl',JSON.stringify({method,params,response:j})+'\n');if(j.error){const e=Error(j.error.message);e.rpc=j.error;throw e;}return j.result;}
async function mine(n=1){for(let i=0;i<n;i++)await rpc('generate_block');}
const cell=(capacity,lock,type,data='0x')=>({capacity:BigInt(capacity),lock,type,data});
function tx(ins,outs,extra=[],headers=[]){return {version:'0x0',cellDeps:[deps.secp,...extra].filter((x,i,a)=>a.findIndex(y=>JSON.stringify(x)===JSON.stringify(y))===i),headerDeps:headers,inputs:ins.map(x=>({previousOutput:x.outPoint,since:x.since||'0x0'})),outputs:outs.map(x=>({capacity:hex(x.capacity),lock:x.lock,...(x.type?{type:x.type}:{})})),outputsData:outs.map(x=>x.data),witnesses:ins.map(()=> '0x')};}
function sign(t,ins,roles,options={}){t=structuredClone(t);const h=U.rawTransactionToHash(t);for(const role of roles){const lock=options.lock||locks[role],idx=ins.map((c,i)=>U.scriptToHash(c.lock)===U.scriptToHash(lock)?i:-1).filter(i=>i>=0);assert(idx.length);const first=idx[0],w=typeof t.witnesses[first]==='object'?t.witnesses[first]:{lock:'',inputType:'',outputType:''};const group=[w,...idx.slice(1).map(i=>t.witnesses[i]),...t.witnesses.slice(ins.length)];let signed=signGroup(options.key||keys[role],h,group,options.multisig)[0];if(options.multisig){signed.lock=options.configHex+signed.lock.slice(2);signed=U.serializeWitnessArgs(signed);}t.witnesses[first]=signed;}t.witnesses=t.witnesses.map(w=>typeof w==='string'?w:U.serializeWitnessArgs(w));return t;}
async function send(label,t){const cycles=await rpc('estimate_cycles',[C.snake(t)]);const h=await rpc('send_transaction',[C.snake(t),'passthrough']);let r;for(let i=0;i<20;i++){r=await rpc('get_transaction',[h]);if(r.tx_status.status==='committed')break;await mine();}assert.equal(r.tx_status.status,'committed');const e={label,hash:h,cycles,bytes:(U.serializeTransaction(t).length-2)/2,tx:t,committed:r};events.push(e);save();console.log(label,h);return t.outputs.map((x,i)=>({...x,capacity:BigInt(x.capacity),data:t.outputsData[i],outPoint:{txHash:h,index:hex(i)},blockHash:r.tx_status.block_hash}));}
async function reject(label,t,pattern,method='estimate_cycles'){let error;try{await rpc(method,method==='send_transaction'?[C.snake(t),'passthrough']:[C.snake(t)]);}catch(e){error=e;}assert(error,'unexpected acceptance '+label);assert.match(error.message,pattern,label);cases.push({label,method,error:error.message,rpc:error.rpc});save();}
const dep=n=>({outPoint:codes[n].outPoint,depType:'code'});
async function mintOrder(label,role,type,amount=0n,reverse=false,lock=locks[role]){let w=wallets[role];const order=cell((amount?600n:1200n)*UNIT,codes.a2.script,type,orderData(amount,null,[1n,UNIT],reverse)),master=cell((lock.args.length>42?108n:100n)*UNIT,lock,codes.a2.script);const change=cell(w.capacity-order.capacity-master.capacity-fee,locks[role]);const t=tx([w],[order,master,change],[dep('a2'),dep('xudt')]);const r=await send(label,sign(t,[w],[role]));wallets[role]=r[2];return {order:r[0],master:r[1]};}
async function melt(label,pair,role,options={}){const ins=[pair.master,pair.order],output=cell(ins.reduce((a,c)=>a+c.capacity,0n)-fee,locks[role],pair.order.type,hx(le(BigInt('0x'+Buffer.from(b(pair.order.data).subarray(0,16)).reverse().toString('hex')),16)));let t=tx(ins,[output],[dep('a2'),dep('xudt'),...(options.deps||[])]);if(options.since)t.inputs[0].since=hex(options.since);t=sign(t,ins,[role],options);return {t,ins};}
async function main(){execFileSync(process.execPath,[__dirname+'/setup.cjs',dir]);const bin=process.env.CKB_BIN||ROOT+'/tools/ckb';const log=fs.openSync(out+'/node.log','w');child=spawn(bin,['run','-C',dir,'--ba-advanced'],{stdio:['ignore',log,log]});for(let i=0;i<100;i++){try{await rpc('get_tip_header');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 gen=await rpc('get_block_by_number',['0x0']);deps.secp={outPoint:{txHash:gen.transactions[1].hash,index:'0x0'},depType:'depGroup'};
 for(const name of ['limit_order','xudt','ickb_logic','owned_owner']){const data=fs.readFileSync(ROOT+'/vendor/ickb/build/release/'+name),h=hash(data);for(const t of gen.transactions)for(let i=0;i<t.outputs_data.length;i++)if(hash(b(t.outputs_data[i]))===h)codes[name==='limit_order'?'a2':name]={hash:h,outPoint:{txHash:t.hash,index:hex(i)},script:{codeHash:h,hashType:'data1',args:'0x'}};}
 for(let role=0;role<3;role++)for(const t of gen.transactions)for(let i=0;i<t.outputs.length;i++)if(t.outputs[i].lock.args===locks[role].args)wallets[role]={...C.camel(t.outputs[i]),capacity:BigInt(t.outputs[i].capacity),data:t.outputs_data[i],outPoint:{txHash:t.hash,index:hex(i)}};
 C.write(out+'/environment.json',{genesis:gen.header,versions:await rpc('local_node_info'),codes,locks});fs.copyFileSync(dir+'/specs/dev.toml',out+'/dev.toml');fs.copyFileSync(dir+'/ckb.toml',out+'/ckb.toml');
 await mine(12);
 const token={...codes.xudt.script,args:U.scriptToHash(locks[2])};
 // Issuer mode is available only with a real signature from fixture issuer.
 let w=wallets[2],t=tx([w],[cell(200n*UNIT,locks[1],token,hx(le(2000n,16))),cell(w.capacity-200n*UNIT-fee,locks[2])],[dep('xudt')]);
 await reject('wrong_issuer_signature',sign(t,[w],[2],{key:keys[0]}),/ValidationFailure/);
 let r=await send('authorized_xudt_issuance',sign(t,[w],[2]));wallets[2]=r[1];let tokens=r[0];
 const pair=await mintOrder('maker_funds_ckb_bid',0,token);let ins=[pair.order,tokens];let successor=cell(pair.order.capacity-400n*UNIT,codes.a2.script,token,orderData(400n,pair.master.outPoint));let remain=cell(200n*UNIT,locks[1],token,hx(le(1600n,16)));let payout=cell(400n*UNIT-fee,locks[1]);t=tx(ins,[successor,remain,payout],[dep('a2'),dep('xudt')]);t=sign(t,ins,[1]);
 let bad=structuredClone(t);bad.outputsData[0]=orderData(399n,pair.master.outPoint);bad.outputsData[1]=hx(le(1601n,16));bad=sign(bad,ins,[1]);await reject('underpaid_order',bad,/ValidationFailure/);
 bad=structuredClone(t);bad.outputsData[1]=hx(le(1601n,16));bad=sign(bad,ins,[1]);await reject('token_inflation',bad,/ValidationFailure/);
 bad=structuredClone(t);bad.outputsData[0]=orderData(400n,{...pair.master.outPoint,index:'0x0'});bad=sign(bad,ins,[1]);await reject('rewritten_master_lineage',bad,/ValidationFailure/);
 let diverted=structuredClone(t);diverted.outputs[2].lock=locks[2];await reject('signed_customer_payout_cannot_be_diverted',diverted,/ValidationFailure/);
 r=await send('partial_fill_direct_ckb_payout',t);pair.order=r[0];tokens=r[1];assert.equal(r[2].lock.args,locks[1].args);
 ins=[pair.order,tokens];const used=pair.order.capacity-289n*UNIT;successor=cell(289n*UNIT,codes.a2.script,token,orderData(400n+used/UNIT,pair.master.outPoint));remain=cell(200n*UNIT,locks[1],token,hx(le(1600n-used/UNIT,16)));payout=cell(used-fee,locks[1]);t=sign(tx(ins,[successor,remain,payout],[dep('a2'),dep('xudt')]),ins,[1]);r=await send('complete_fill_direct_ckb_payout',t);pair.order=r[0];tokens=r[1];
 let recovery=await melt('recover',pair,0);await reject('unauthorized_owner_recovery',sign(recovery.t,recovery.ins,[0],{key:keys[1]}),/ValidationFailure/);C.write(out+'/recovery-package.json',{tx:{...recovery.t,witnesses:recovery.t.witnesses.map(()=> '0x')},inputs:recovery.ins,role:0});const independent=JSON.parse(execFileSync(process.execPath,[__dirname+'/recover.cjs',out+'/recovery-package.json'],{encoding:'utf8'}));const mintRecord=events.find(e=>e.hash===pair.master.outPoint.txHash);const policy={schema:1,domain:'trade-disposable-private-devnet',genesis:gen.header.hash,a2:codes.a2.script,owner:locks[0],recipient:locks[0],fixtureRole:0,master:pair.master.outPoint,mintTxHash:mintRecord.hash,retainedMint:mintRecord.tx,mintOrderIndex:0,currentOrder:pair.order.outPoint,assetTypeHash:U.scriptToHash(pair.order.type),fee:fee.toString(),expectedCKB:(pair.master.capacity+pair.order.capacity-fee).toString(),expectedTokens:'911',cellDeps:recovery.t.cellDeps};C.write(out+'/authenticated-recovery-policy.json',policy);const authorized=JSON.parse(execFileSync(process.execPath,[__dirname+'/authenticated-recovery.cjs',out+'/authenticated-recovery-policy.json',out+'/authenticated-recovery-rpc.jsonl'],{encoding:'utf8'}));assert.equal(U.rawTransactionToHash(authorized.tx),U.rawTransactionToHash(independent));C.write(out+'/authenticated-recovery-audit.json',authorized.audit);C.write(out+'/authenticated-recovery-validation.json',await require('./recovery-validation.cjs').validate(out));await send('authenticated_independent_owner_recovery',authorized.tx);
 C.write(out+'/checkpoint-A.json',{status:'REPRODUCED',transactions:events.length,cases:cases.length});
 const askMaster=cell(100n*UNIT,locks[1],codes.a2.script),askCell=cell(289n*UNIT,codes.a2.script,token,orderData(500n,null,[1n,UNIT],true));
 w=wallets[1];ins=[w,tokens];t=tx(ins,[askCell,askMaster,cell(200n*UNIT,locks[1],token,hx(le(589n,16))),cell(w.capacity+tokens.capacity-589n*UNIT-fee,locks[1])],[dep('a2'),dep('xudt')]);
 r=await send('holder_funds_authentic_ask',sign(t,ins,[1]));wallets[1]=r[3];tokens=r[2];const ask={order:r[0],master:r[1]};
 const bid=await mintOrder('second_maker_bid',0,token);ins=[bid.order,ask.order];
 t=tx(ins,[cell(bid.order.capacity-500n*UNIT,codes.a2.script,token,orderData(500n,bid.master.outPoint)),cell(ask.order.capacity+500n*UNIT,codes.a2.script,token,orderData(0n,ask.master.outPoint,[1n,UNIT],true)),cell(wallets[2].capacity-fee,locks[2])],[dep('a2'),dep('xudt')]);
 ins.push(wallets[2]);t.inputs.push({previousOutput:wallets[2].outPoint,since:'0x0'});t.witnesses.push('0x');
 r=await send('atomic_two_owner_net_settlement',sign(t,ins,[2]));bid.order=r[0];ask.order=r[1];wallets[2]=r[2];
 await send('bid_owner_recovers_net_assets',(await melt('bid',bid,0)).t);await send('ask_owner_recovers_net_assets',(await melt('ask',ask,1)).t);
 // Native bounded batching uses the published upstream binary; no compact rival is invented.
 const batchMetrics=[];
 for(const n of [2,8,32]){
   const pairs=[];for(let i=0;i<n;i++)pairs.push(await mintOrder('batch_'+n+'_fund_'+i,0,token));
   w=wallets[2];let ti=tx([w],[cell(200n*UNIT,locks[1],token,hx(le(BigInt(n)*911n,16))),cell(w.capacity-200n*UNIT-fee,locks[2])],[dep('xudt')]);let rr=await send('batch_'+n+'_issuer_inventory',sign(ti,[w],[2]));wallets[2]=rr[1];
   const bi=[...pairs.map(p=>p.order),rr[0]],bo=pairs.map(p=>cell(289n*UNIT,codes.a2.script,token,orderData(911n,p.master.outPoint)));
   bo.push(cell(BigInt(n)*911n*UNIT+rr[0].capacity-fee,locks[1],token,hx(le(0,16))));
   const bt=sign(tx(bi,bo,[dep('a2'),dep('xudt')]),bi,[1]);
   if(n===2){let broken=structuredClone(bt);broken.outputsData[1]=orderData(910n,pairs[1].master.outPoint);broken.outputsData[2]=hx(le(1n,16));broken=sign(broken,bi,[1]);await reject('one_bad_leg_rejects_atomic_batch',broken,/ValidationFailure/);}
   await send('bounded_batch_'+n,bt);batchMetrics.push({n,cycles:events.at(-1).cycles,bytes:events.at(-1).bytes});
 }
 // Equivalent two-order serial full fills measure the architectural batching benefit.
 const serialPairs=[];for(let i=0;i<2;i++)serialPairs.push(await mintOrder('serial_fund_'+i,0,token));
 w=wallets[2];t=tx([w],[cell(200n*UNIT,locks[1],token,hx(le(1822n,16))),cell(w.capacity-200n*UNIT-fee,locks[2])],[dep('xudt')]);r=await send('serial_inventory',sign(t,[w],[2]));wallets[2]=r[1];let serialToken=r[0],serialCycles=0n,serialBytes=0;
 for(let i=0;i<2;i++){const si=[serialPairs[i].order,serialToken],so=[cell(289n*UNIT,codes.a2.script,token,orderData(911n,serialPairs[i].master.outPoint)),cell(200n*UNIT,locks[1],token,hx(le(BigInt(1-i)*911n,16))),cell(911n*UNIT-fee,locks[1])];r=await send('serial_full_fill_'+i,sign(tx(si,so,[dep('a2'),dep('xudt')]),si,[1]));serialToken=r[1];serialCycles+=BigInt(events.at(-1).cycles.cycles);serialBytes+=events.at(-1).bytes;}
 const shared=batchMetrics[0];assert(serialCycles>BigInt(shared.cycles.cycles));assert(serialBytes>shared.bytes);C.write(out+'/baseline-comparison.json',{workload:'Two 911-token full fills of identical funded A2 bids; funding excluded from both settlement totals',serial:{cycles:serialCycles,bytes:serialBytes,fee:2n*fee},shared:{cycles:BigInt(shared.cycles.cycles),bytes:shared.bytes,fee},limits:'Serial preserves one empty token cell and two direct CKB payouts; shared coalesces empty-token capacity and payout. Both keep masters and full successors. Fixed fixture fee policy; no custom competitor or maximum heap claim.'});
 C.write(out+'/batch-metrics.json',{binary:codes.a2.hash,scope:'Published upstream full-fill batch bounds, not maximum capacity or a custom-candidate comparison',metrics:batchMetrics});
 // Standard 1-of-1 multisig with embedded absolute block since commits owner, not customers.
 const deadline=BigInt((await rpc('get_tip_header')).number)+30n;
 const configHex='0x00000101'+locks[0].args.slice(2),multi={r:0,m:1,n:1,blake160s:[locks[0].args]};
 const committedLock={codeHash:U.systemScripts.SECP256K1_MULTISIG.codeHash,hashType:'type',args:'0x'+U.blake160(b(configHex),'hex')+le(deadline).toString('hex')};
 const multisigDep={outPoint:{txHash:gen.transactions[1].hash,index:'0x1'},depType:'depGroup'};
 const committed=await mintOrder('bounded_commitment_funding',0,token,0n,false,committedLock);
 const options={lock:committedLock,multisig:multi,configHex,deps:[multisigDep]};
 let exit=(await melt('early',committed,0,{...options,since:deadline})).t;
 await reject('owner_since_before_maturity',exit,/Immature|since|Since/, 'send_transaction');
 const noSince=(await melt('no_since',committed,0,options)).t;await reject('owner_omits_since',noSince,/ValidationFailure|since|Since/);
 const inventory=wallets[2];t=tx([inventory],[cell(200n*UNIT,locks[1],token,hx(le(200n,16))),cell(inventory.capacity-200n*UNIT-fee,locks[2])],[dep('xudt')]);r=await send('commitment_customer_inventory',sign(t,[inventory],[2]));wallets[2]=r[1];let ctoken=r[0];
 async function commitmentFill(label){const ci=[committed.order,ctoken],amt=BigInt('0x'+Buffer.from(b(committed.order.data).subarray(0,16)).reverse().toString('hex'))+100n;const co=[cell(committed.order.capacity-100n*UNIT,codes.a2.script,token,orderData(amt,committed.master.outPoint)),cell(ctoken.capacity,locks[1],token,hx(le(200n-amt,16))),cell(100n*UNIT-fee,locks[1])];const cr=await send(label,sign(tx(ci,co,[dep('a2'),dep('xudt')]),ci,[1]));committed.order=cr[0];ctoken=cr[1];}
 await commitmentFill('customer_fill_before_owner_maturity');
 let tip=BigInt((await rpc('get_tip_header')).number);await mine(Number(deadline-tip+2n));await commitmentFill('customer_late_fill_after_owner_maturity');
 exit=(await melt('mature',committed,0,{...options,since:deadline})).t;
 const wrong=(await melt('wrong_sig',committed,0,{...options,since:deadline,key:keys[1]})).t;await reject('committed_owner_wrong_signature',wrong,/ValidationFailure/);
 await send('committed_owner_mature_recovery',exit);
 C.write(out+'/commitment.json',{deadline,lateFill:events.find(e=>e.label==='customer_late_fill_after_owner_maturity').committed.tx_status,ordinaryMaster:100n*UNIT,committedMaster:108n*UNIT,occupiedDeltaCKB:8,note:'Extra 8 bytes in lock args; fixture allocates 8 additional CKB to committed master.'});
 C.write(out+'/checkpoint-B.json',{status:'REPRODUCED_BOUNDED',transactions:events.length,cases:cases.length});
 // Published DAO/iCKB lifecycle. Deposit lock is genuine logic, not an always-success stand-in.
 const dao={codeHash:U.systemScripts.NERVOS_DAO.codeHash,hashType:'type',args:'0x'};
 let daoDep;for(const gt of gen.transactions)for(let i=0;i<gt.outputs.length;i++)if(gt.outputs[i].type&&U.scriptToHash(C.camel(gt.outputs[i].type))===dao.codeHash)daoDep={outPoint:{txHash:gt.hash,index:hex(i)},depType:'code'};assert(daoDep);
 const logic=codes.ickb_logic.script,owned=codes.owned_owner.script,ickb={...codes.xudt.script,args:U.scriptToHash(logic)+'00000080'};
 const depositCapacity=100082n*UNIT,depositAmount=100000n*UNIT;
 w=wallets[1];ins=[w];const depositOutputs=[cell(depositCapacity,logic,dao,hx(le(0))),cell(110n*UNIT,locks[1],logic,hx(Buffer.concat([le(1,4),le(depositAmount)]))),cell(w.capacity-depositCapacity-110n*UNIT-fee,locks[1])];
 t=sign(tx(ins,depositOutputs,[daoDep,dep('ickb_logic')]),ins,[1]);
 let invalidDeposit=structuredClone(t);invalidDeposit.outputsData[1]=hx(Buffer.concat([le(2,4),le(depositAmount)]));invalidDeposit=sign(invalidDeposit,ins,[1]);await reject('dao_receipt_quantity_mismatch',invalidDeposit,/ValidationFailure/);
 r=await send('dao_authentic_deposit_and_receipt',t);const deposit=r[0],receipt=r[1];wallets[1]=r[2];const depositHeader=await rpc('get_header',[deposit.blockHash]);
 const ar=h=>b(h.dao).readBigUInt64LE(8);const issued=depositAmount*10000000000000000n/ar(depositHeader);assert(issued<=100000n*UNIT);
 w=wallets[1];ins=[receipt,w];t=tx(ins,[cell(200n*UNIT,locks[1],ickb,hx(le(issued,16))),cell(w.capacity+receipt.capacity-200n*UNIT-fee,locks[1])],[dep('ickb_logic'),dep('xudt')],[deposit.blockHash]);
 let forged=structuredClone(t);forged.outputsData[0]=hx(le(issued+1n,16));forged=sign(forged,ins,[1]);await reject('authentic_ickb_overissuance',forged,/ValidationFailure/);
 r=await send('receipt_converts_to_authentic_ickb',sign(t,ins,[1]));let authentic=r[0];wallets[1]=r[1];
 const price=99000n*UNIT;function gcd(a,b){while(b){[a,b]=[b,a%b];}return a;};const g=gcd(issued,price),ratio=[issued/g,price/g];
 w=wallets[0];ins=[w];t=tx(ins,[cell(price+289n*UNIT,codes.a2.script,ickb,orderData(0n,null,ratio)),cell(100n*UNIT,locks[0],codes.a2.script),cell(w.capacity-price-389n*UNIT-fee,locks[0])],[dep('a2'),dep('xudt')]);r=await send('dao_maker_funds_native_bid',sign(t,ins,[0]));wallets[0]=r[2];const daoPair={order:r[0],master:r[1]};
 ins=[daoPair.order,authentic];t=tx(ins,[cell(289n*UNIT,codes.a2.script,ickb,orderData(issued,daoPair.master.outPoint,ratio)),cell(price+authentic.capacity-fee,locks[1])],[dep('a2'),dep('xudt')]);
 let under=structuredClone(t);under.outputsData[0]=orderData(issued-1n,daoPair.master.outPoint,ratio);under.outputs.push({capacity:hex(200n*UNIT),lock:locks[1],type:ickb});under.outputsData.push(hx(le(1,16)));under.outputs[1].capacity=hex(BigInt(under.outputs[1].capacity)-200n*UNIT);under=sign(under,ins,[1]);await reject('dao_order_wrong_token_payout',under,/ValidationFailure/);
 r=await send('holder_trades_ickb_for_spendable_ckb',sign(t,ins,[1]));daoPair.order=r[0];assert.equal(r[1].capacity,price+authentic.capacity-fee);
 const dm=await melt('dao_recovery',daoPair,0);C.write(out+'/dao-recovery-package.json',{tx:{...dm.t,witnesses:dm.t.witnesses.map(()=> '0x')},inputs:dm.ins,role:0});t=JSON.parse(execFileSync(process.execPath,[__dirname+'/recover.cjs',out+'/dao-recovery-package.json'],{encoding:'utf8'}));const daoMintRecord=events.find(e=>e.hash===daoPair.master.outPoint.txHash),daoPolicy={schema:1,domain:'trade-disposable-private-devnet',genesis:gen.header.hash,a2:codes.a2.script,owner:locks[0],recipient:locks[0],fixtureRole:0,master:daoPair.master.outPoint,mintTxHash:daoMintRecord.hash,retainedMint:daoMintRecord.tx,mintOrderIndex:0,currentOrder:daoPair.order.outPoint,assetTypeHash:U.scriptToHash(ickb),fee:fee.toString(),expectedCKB:(daoPair.master.capacity+daoPair.order.capacity-fee).toString(),expectedTokens:issued.toString(),cellDeps:dm.t.cellDeps};C.write(out+'/dao-authenticated-policy.json',daoPolicy);const daoAuthorized=JSON.parse(execFileSync(process.execPath,[__dirname+'/authenticated-recovery.cjs',out+'/dao-authenticated-policy.json',out+'/dao-authenticated-rpc.jsonl'],{encoding:'utf8'}));assert.equal(U.rawTransactionToHash(t),U.rawTransactionToHash(daoAuthorized.tx));C.write(out+'/dao-authenticated-audit.json',daoAuthorized.audit);r=await send('maker_authenticated_successor_recovery',daoAuthorized.tx);authentic=r[0];
 await mine(12);w=wallets[0];ins=[deposit,authentic,w];const requestOutputs=[cell(deposit.capacity,owned,dao,hx(le(BigInt(depositHeader.number)))),cell(100n*UNIT,locks[0],owned,hx(le(-1n,4))),cell(w.capacity+authentic.capacity-100n*UNIT-fee,locks[0])];
 t=tx(ins,requestOutputs,[daoDep,dep('ickb_logic'),dep('owned_owner'),dep('xudt')],[deposit.blockHash]);
 let noBurn=structuredClone(t);noBurn.outputs.push({capacity:hex(200n*UNIT),lock:locks[0],type:ickb});noBurn.outputsData.push(hx(le(issued,16)));noBurn.outputs[2].capacity=hex(BigInt(noBurn.outputs[2].capacity)-200n*UNIT);await reject('dao_withdrawal_without_token_burn',sign(noBurn,ins,[0]),/ValidationFailure/);
 const request=await send('genuine_dao_withdrawal_request_burns_ickb',sign(t,ins,[0]));wallets[0]=request[2];const requestHeader=await rpc('get_header',[request[0].blockHash]);
 const since=U.getWithdrawEpoch(depositHeader.epoch,requestHeader.epoch);
 const maximum=BigInt(await rpc('calculate_dao_maximum_withdraw',[C.snake(deposit.outPoint),requestHeader.hash]));
 const independentlyComputed=82n*UNIT+depositAmount*ar(requestHeader)/ar(depositHeader);assert.equal(maximum,independentlyComputed);
 ins=[request[0],request[1]];t=tx(ins,[cell(maximum+request[1].capacity-fee,locks[0])],[daoDep,dep('owned_owner')],[deposit.blockHash,requestHeader.hash]);t.inputs[0].since=since;t.witnesses[0]={lock:'',inputType:hx(le(0)),outputType:''};
 let completion=sign(t,ins,[0]);await reject('dao_early_completion_consensus',completion,/Immature|since|Since/,'send_transaction');
 let unauthorized=sign(t,ins,[0],{key:keys[1]});await reject('dao_unauthorized_completion',unauthorized,/ValidationFailure/);
 let over=structuredClone(t);over.outputs[0].capacity=hex(maximum+request[1].capacity+1n);over=sign(over,ins,[0]);await reject('dao_excessive_withdrawal',over,/Overflow|Capacity|capacity|ValidationFailure/,'send_transaction');
 const decode=e=>{const n=BigInt(e);return {number:n&0xffffffn,index:(n>>24n)&0xffffn,length:(n>>40n)&0xffffn};};
 const mature=decode(BigInt(since)&0x00ffffffffffffffn);let mined=0;
 while(true){const epoch=decode((await rpc('get_tip_header')).epoch);if(epoch.number>mature.number||(epoch.number===mature.number&&epoch.index*mature.length>=mature.index*epoch.length))break;await mine(10);mined+=10;if(mined>10000)throw Error('Maturity mining bound exceeded');}
 r=await send('actual_mature_dao_withdrawal_completion',completion);
 await reject('dao_double_completion',completion,/Dead|dead|Unknown|unknown|Duplicate|duplicate/,'send_transaction');
 C.write(out+'/dao-lifecycle.json',{depositHeader,requestHeader,matureSince:since,minimumEpoch:mature,completionHeader:await rpc('get_header',[r[0].blockHash]),minedBlocks:mined,depositCapacity,issued,payout:price,maximum,independentlyComputed,finalSpendable:r[0].capacity,interest:maximum-depositCapacity,note:'Interest freezes at request header; short integration epochs are not public-network elapsed time. Maker token and underlying DAO collateral must not be added as independent assets.'});
 const redeemed=r[0];await send('redeemed_ckb_is_actually_spendable',sign(tx([redeemed],[cell(redeemed.capacity-fee,locks[0])]),[redeemed],[0]));
 C.write(out+'/checkpoint-D.json',{status:'REPRODUCED',transactions:events.length,cases:cases.length});


}
main().then(()=>{C.write(out+'/complete.json',{transactions:events.length,cases:cases.length});console.log('COMPLETE',events.length,cases.length);}).catch(e=>{C.write(out+'/failure.json',{error:e.stack});console.error(e);process.exitCode=1;}).finally(()=>{save();if(child)child.kill('SIGTERM');const raw=out+'/raw.jsonl';if(fs.existsSync(raw)){fs.writeFileSync(raw+'.gz',require('zlib').gzipSync(fs.readFileSync(raw)));fs.unlinkSync(raw);}});
module.exports={};

// Only constructs candidate transactions. Every authoritative field is checked
// by CKB scripts; no live state/certificate cells are injected into genesis.
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const R=path.resolve(__dirname,'..'),E1=path.resolve(R,'../../wo04-e1'),U=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils');
const H=b=>'0x'+U.blake2b(32,null,null,U.PERSONAL).update(b).digest('hex'),hex=n=>'0x'+BigInt(n).toString(16),B=s=>Buffer.from(s.slice(2),'hex'),le=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
const sha=b=>require('crypto').createHash('sha256').update(b).digest();
const snake=x=>x==='depGroup'?'dep_group':Array.isArray(x)?x.map(snake):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),snake(v)])):x;
const pause=ms=>new Promise(r=>setTimeout(r,ms)),read=n=>fs.readFileSync(R+'/fixtures/devnet/'+n);
const recovered=process.env.E2D_RESUME_FROM?JSON.parse(fs.readFileSync(process.env.E2D_RESUME_FROM)):null;
if(recovered&&!process.env.E2D_RESUME_DIR)throw Error('explicit persisted CKB directory required');
const dir=recovered?process.env.E2D_RESUME_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'e2d-chain-')),ckb=E1+'/tools/ckb/ckb';
const configuration=JSON.parse(read('configuration.json'));
const runName=process.env.E2D_RUN_NAME||'zero-origin';if(!/^[A-Za-z0-9_-]+$/.test(runName))throw Error('invalid run label');
if(fs.existsSync(R+'/evidence/chain-'+runName+'.json'))throw Error('Evidence label already exists; use a new E2B_RUN_NAME');
let node,wallet;const result={scope:'E2C historical root authorization and actual principal withholding; no positive trade claim',runName,transactions:[],rejections:[],lineages:[],evm:[],trades:[],proofs:[],settlements:[],evmRejections:[]};
if(recovered){Object.assign(result,recovered,{runName,resumedFrom:process.env.E2D_RESUME_FROM});delete result.failure;}result.ckbDir=dir;result.scope='E2D zero user-Ethereum transactions; authenticated non-inclusion refund';
const save=()=>fs.writeFileSync(R+'/evidence/chain-'+runName+'.json',JSON.stringify(result,null,2)+'\n');
const rpc=async(method,params=[])=>{const r=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;};
const bins={};for(const n of ['state','certificate','root','settlement'])bins[n]=fs.readFileSync(R+'/build/devnet/'+n);bins.reservation=fs.readFileSync(R+'/build/devnet/reservation');bins.always=fs.readFileSync(E1+'/config/always_success');
const script=(n,args='0x')=>({codeHash:H(bins[n]),hashType:'data2',args}),lock=script('always'),deps={};
const fee=1000000n,cap=100000000000n;
const output=(capacity,type=null)=>({capacity:hex(capacity),lock:type&&type.codeHash===H(bins.state)&&B(type.args).length===32?script('state'):lock,type});
const tx=(inputs,outputs,data,witness,cellDeps)=>({version:'0x0',cellDeps:cellDeps.filter((d,i,a)=>a.findIndex(x=>JSON.stringify(x)===JSON.stringify(d))===i),headerDeps:[],inputs,outputs,outputsData:data.map(b=>'0x'+b.toString('hex')),witnesses:['0x'+witness.toString('hex')]});
const reject=async(name,t,send=false)=>{try{await rpc(send?'send_transaction':'estimate_cycles',send?[snake(t),'passthrough']:[snake(t)]);throw Error('INVALID_ACCEPTED '+name);}catch(e){if(e.message.includes('INVALID_ACCEPTED'))throw e;const parsed=JSON.parse(e.message);if(![-301,-302].includes(parsed.code))throw e;result.rejections.push({name,error:e.message,method:send?'send_transaction':'estimate_cycles',tx:snake(t),afterTransactions:result.transactions.length});save();}};
const commit=async(name,t)=>{const started=Date.now();const estimate=await rpc('estimate_cycles',[snake(t)]);if(BigInt(estimate.cycles)>70000000n)throw Error('policy exceeded '+name+' '+estimate.cycles);let hash,maturityWaits=0;for(;;){try{hash=await rpc('send_transaction',[snake(t),'passthrough']);break;}catch(e){if(!e.message.includes('Immature(Inputs[0])')||maturityWaits++>=60)throw e;await rpc('generate_block');await pause(1000);}}let status;for(let i=0;i<30;i++){await rpc('generate_block');await pause(100);status=(await rpc('get_transaction',[hash])).tx_status;if(status.status==='committed')break;}if(status.status!=='committed')throw Error('not committed '+name+' '+JSON.stringify(status));const row={name,hash,cycles:Number(BigInt(estimate.cycles)),bytes:(U.serializeTransaction(t).length-2)/2,status,tx:snake(t),maturityWaits,hostElapsedMs:Date.now()-started,feeShannons:fee.toString()};result.transactions.push(row);save();console.log(name,row.cycles,row.bytes);return hash;};
const live=async p=>{const c=await rpc('get_live_cell',[snake(p),true]);if(c.status!=='live')throw Error('not live');return c.cell;};
async function bootstrap(label){
 const first={since:'0x0',previousOutput:wallet.point};const serialized=B(U.serializeInput(first));if(serialized.length!==44)throw Error('CellInput length');
 const id=H(Buffer.concat([serialized,le(0)])),type=script('state',id),identity=U.scriptToHash(type);
 const t=tx([first],[output(cap,type),output(wallet.capacity-cap-fee)],[read('state-0.bin'),Buffer.alloc(0)],read('bootstrap.bin'),[deps.state,deps.always]);
 const wrong=structuredClone(t);wrong.outputs[0].type=script('state','0x'+'11'.repeat(32));await reject(label+'-incorrect-Type-ID',wrong);
 const indexWrong=structuredClone(t);indexWrong.outputs[0].type=script('state',H(Buffer.concat([serialized,le(1)])));await reject(label+'-incorrect-Type-ID-output-index',indexWrong);
 const h=await commit(label+'-bootstrap',t);wallet={point:{txHash:h,index:'0x1'},capacity:wallet.capacity-cap-fee};
 const lc={label,type,identity,point:{txHash:h,index:'0x0'},data:read('state-0.bin'),certs:new Map(),roots:[],history:[{txHash:h,index:'0x0'}]};
 const cloned=structuredClone(t);cloned.inputs[0].previousOutput=wallet.point;cloned.outputs[1].capacity=hex(wallet.capacity-cap-fee);await reject(label+'-same-identity-second-constructor',cloned);
 result.lineages.push({label,identity,typeId:id,serializedFirstCellInput:'0x'+serialized.toString('hex'),outputIndex:0});save();return lc;
}
async function certify(lc,period,tests=true){
 const s=lc.data,version=s.readBigUInt64LE(72),p=s.readBigUInt64LE(192),root=s.subarray(period===p?200:232,period===p?232:264);
 const args=Buffer.concat([B(lc.identity),B(lc.type.codeHash),le(version),le(period),root]);
 const witness=read('committee-'+period+'.bin'),keys=witness.subarray(0,24576),leaves=[];for(let i=0;i<512;i++)leaves.push(sha(Buffer.concat([keys.subarray(i*48,i*48+48),Buffer.alloc(16)])));
 let layer=leaves;while(layer.length>1){const next=[];for(let i=0;i<layer.length;i+=2)next.push(sha(Buffer.concat([layer[i],layer[i+1]])));layer=next;}
 const data=Buffer.concat([Buffer.from('E2BCERT1'),B(lc.identity),B(lc.type.codeHash),le(version),le(period),root,layer[0],witness.subarray(24576)]);
 if(data.length!==296)throw Error('cert size');const type=script('certificate','0x'+args.toString('hex'));
 const t=tx([{since:'0x0',previousOutput:wallet.point}],[output(cap,type),output(wallet.capacity-cap-fee)],[data,Buffer.alloc(0)],witness,[{outPoint:lc.point,depType:'code'},deps.certificate,deps.always]);
 if(tests){const bad=structuredClone(t),w=B(bad.witnesses[0]);w[0]^=1;bad.witnesses[0]='0x'+w.toString('hex');await reject(lc.label+'-forged-committee-'+period,bad);const wrong=structuredClone(t),a=B(wrong.outputs[0].type.args);a.fill(0,0,32);wrong.outputs[0].type.args='0x'+a.toString('hex');await reject(lc.label+'-unrelated-registry-certificate-'+period,wrong);}
 if(tests){const stale=structuredClone(t),a=B(stale.outputs[0].type.args);a.writeBigUInt64LE(version===0n?1n:version-1n,64);stale.outputs[0].type.args='0x'+a.toString('hex');await reject(lc.label+'-stale-transition-certification-'+period,stale);}
 const h=await commit(lc.label+'-certify-'+period,t);wallet={point:{txHash:h,index:'0x1'},capacity:wallet.capacity-cap-fee};lc.certs.set(String(period),{point:{txHash:h,index:'0x0'},type,data});return t;
}
function updateTx(lc,i,forceCert){
 const witness=read('update-'+i+'.bin'),after=read('state-'+(i+1)+'.bin'),ss=witness.readBigUInt64LE(0),period=ss/8192n,cert=forceCert||lc.certs.get(String(period));
 const rootAdvance=after.readBigUInt64LE(80)>lc.data.readBigUInt64LE(80),outputs=[output(cap,lc.type)],data=[after];let rootType=null;
 if(rootAdvance){const args=Buffer.concat([B(lc.identity),B(lc.type.codeHash),after.subarray(72,80),after.subarray(88,120)]);rootType=script('root','0x'+args.toString('hex'));outputs.push(output(cap,rootType));data.push(Buffer.concat([sha(Buffer.concat([after.subarray(8,40),B(lc.identity)])),after.subarray(120,192)]));}
 outputs.push(output(wallet.capacity-(rootAdvance?cap:0n)-fee));data.push(Buffer.alloc(0));
 const since=hex(0x4000000000000000n+BigInt(configuration.genesis.genesis_time)+ss*3n);
 const t=tx([{since,previousOutput:lc.point},{since:'0x0',previousOutput:wallet.point}],outputs,data,witness,[cert?{outPoint:cert.point,depType:'code'}:deps.always,deps.state,deps.root,deps.always]);
 return {t,after,rootAdvance,rootType,remaining:wallet.capacity-(rootAdvance?cap:0n)-fee};
}
async function advance(lc,i,tests=true){
 const {t,after,rootAdvance,rootType,remaining}=updateTx(lc,i);
 if(tests){
  const frozen=structuredClone(t);frozen.outputs[0].lock=script('always','0x'+'ff'.repeat(32));await reject('valid-proof-cannot-replace-state-lock-'+i,frozen);
  const bad=structuredClone(t),w=B(bad.witnesses[0]);w[1176]^=1;bad.witnesses[0]='0x'+w.toString('hex');await reject('failed-update-'+i,bad);
  const period=structuredClone(t),wb=B(period.witnesses[0]),wrongSlot=wb.readBigUInt64LE(0)+24576n;wb.writeBigUInt64LE(wrongSlot,0);period.inputs[0].since=hex(0x4000000000000000n+1606824023n+12n*wrongSlot);period.witnesses[0]='0x'+wb.toString('hex');await reject('wrong-signing-period-'+i,period);
  const time=structuredClone(t);time.inputs[0].since='0x0';await reject('unbound-signature-time-'+i,time);
  if(i===0){const deleted=tx(t.inputs,[output(cap+wallet.capacity-fee)],[Buffer.alloc(0)],read('update-0.bin'),t.cellDeps);await reject('state-deletion-despite-Type-ID-burn-permission',deleted);}
  if(i===3){const fork=structuredClone(t),fw=B(fork.witnesses[0]),slot=8626177n;fw.writeBigUInt64LE(slot,0);fork.witnesses[0]='0x'+fw.toString('hex');fork.inputs[0].since=hex(0x4000000000000000n+1606824023n+12n*slot);await reject('unsupported-Deneb-fork-rejected-not-reinterpreted',fork);}
  const rollback=structuredClone(t),rd=Buffer.from(lc.data),rs=lc.data.readBigUInt64LE(80)-1n;rd.writeBigUInt64LE(lc.data.readBigUInt64LE(72)+1n,72);rd.writeBigUInt64LE(rs,80);rd.writeBigUInt64LE(rs/8192n,192);rd.writeBigUInt64LE(B(t.witnesses[0]).readBigUInt64LE(0),264);rollback.outputsData[0]='0x'+rd.toString('hex');await reject('finalized-slot-rollback-'+i,rollback);
  if(rootAdvance){const withheld=structuredClone(t);withheld.outputs.splice(1,1);withheld.outputsData.splice(1,1);withheld.outputs[1].capacity=hex(BigInt(withheld.outputs[1].capacity)+cap);await reject('valid-proof-cannot-withhold-authorized-root-'+i,withheld);}
  if(i<6){const np=structuredClone(t),nw=B(np.witnesses[0]),missing=nw[1560],start=1561+434*missing;nw[start+33]^=1;np.witnesses[0]='0x'+nw.toString('hex');await reject('invalid-next-committee-proof-'+i,np);}
  if(i>0){const replay=structuredClone(t);replay.witnesses[0]='0x'+read('update-'+(i-1)+'.bin').toString('hex');await reject('replayed-old-update-'+i,replay);}
  if(i===0){const fake=structuredClone(t);fake.outputs.push(output(cap,lc.type));fake.outputsData.push('0x'+after.toString('hex'));fake.outputs[1].capacity=hex(BigInt(fake.outputs[1].capacity)-cap);await reject('competing-state-lineage',fake);}
  if(i===0){const early=structuredClone(t),a=Buffer.concat([B(lc.identity),B(lc.type.codeHash),after.subarray(72,80),after.subarray(88,120)]),rtype=script('root','0x'+a.toString('hex')),datum=Buffer.concat([sha(Buffer.concat([after.subarray(8,40),B(lc.identity)])),after.subarray(120,192)]);early.outputs.splice(1,0,output(cap,rtype));early.outputsData.splice(1,0,'0x'+datum.toString('hex'));early.outputs[2].capacity=hex(BigInt(early.outputs[2].capacity)-cap);await reject('committee-learning-cannot-publish-nonadvanced-outcome',early);}
 }
 const before=lc.point;const h=await commit(lc.label+'-update-'+i,t);wallet={point:{txHash:h,index:hex(t.outputs.length-1)},capacity:remaining};lc.point={txHash:h,index:'0x0'};lc.data=after;lc.history.push(lc.point);
 const observed=await live(lc.point);if(observed.data.content!=='0x'+after.toString('hex'))throw Error('state differs');
 result.transactions.at(-1).stateAfter={version:Number(after.readBigUInt64LE(72)),finalizedSlot:Number(after.readBigUInt64LE(80)),period:Number(after.readBigUInt64LE(192)),currentCommittee:'0x'+after.subarray(200,232).toString('hex'),nextCommittee:'0x'+after.subarray(232,264).toString('hex')};save();
 if(rootAdvance){lc.root={point:{txHash:h,index:'0x1'},type:rootType,data:B(t.outputsData[1])};lc.roots.push(lc.root);}
 if(tests)await reject('spent-state-transaction-replay-'+i,t,true);
 if(tests){const retimed=updateTx(lc,i).t,rw=B(retimed.witnesses[0]),rs=rw.readBigUInt64LE(0)+1n;rw.writeBigUInt64LE(rs,0);retimed.witnesses[0]='0x'+rw.toString('hex');retimed.inputs[0].since=hex(0x4000000000000000n+1606824023n+12n*rs);await reject('retimed-signature-slot-replay-'+i,retimed);}
 return t;
}



const ethers=require('../../../wo04-e1/node_modules/ethers'),CKB=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-core').default;
const inspectIP=name=>JSON.parse(cp.execFileSync('docker',['inspect',name]))[0].NetworkSettings.Networks['e2c-private'].IPAddress;
const elIP=inspectIP('e2c-el');if(!elIP.startsWith('172.18.'))throw Error('unexpected private network');
const provider=new ethers.JsonRpcProvider('http://'+elIP+':8545',1337,{staticNetwork:true,cacheTimeout:-1});provider.pollingInterval=300;
// Well-known disposable generator fixture, NEVER on public chains.
const mnemonic='sleep moment list remain like wall lake industry canvas wonder ecology elite duck salad naive syrup frame brass utility club odor country obey pudding';
const walletAt=i=>ethers.HDNodeWallet.fromPhrase(mnemonic,undefined,"m/44'/60'/0'/0/"+i).connect(provider);
const admin=walletAt(2),maker=walletAt(1),competitor=walletAt(3),userAddress=walletAt(7).address;
// Public isolated CKB fixture keys: real secp256k1 funding and receiving locks.
const userKey='0x'+'0'.repeat(63)+'4',makerKey='0x'+'0'.repeat(63)+'5';
const normal=k=>({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:'0x'+U.blake160(U.privateKeyToPublicKey(k),'hex')});
const userLock=normal(userKey),makerLock=normal(makerKey);let userWallet,secpDep;
const ORDER_DOMAIN=ethers.sha256(ethers.toUtf8Bytes('CKB-E2D-P0-ORDER-V1'));
const fields=['ethGenesis','registry','ckbGenesis','fundingId','ckbMaker','ckbRefund','asset','amount','recipient','maker','deadline','ckbAmount'];
const fieldTypes=['bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','address','uint256','address','address','uint64','uint64'];
const encode=(o,contract)=>B(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32','uint256','address',...fieldTypes],[ORDER_DOMAIN,1337,contract,...fields.map(k=>o[k])]));
const ordered=o=>fields.map(k=>o[k]);
const wire=proof=>{const nodes=ns=>Buffer.concat([Buffer.from([ns.length&255,ns.length>>8]),...ns.flatMap(s=>{const b=B(s);return [Buffer.from([b.length&255,b.length>>8]),b];})]);return Buffer.concat([nodes(proof.accountProof),nodes(proof.storageProof[0].proof)]);};
async function evm(name,p){const sentAt=Date.now(),t=await p,r=await t.wait();if(r.status!==1)throw Error('EVM reverted '+name);result.evm.push({name,hash:t.hash,receipt:r.toJSON(),fee:r.fee.toString(),sentAt,observedAt:Date.now()});save();console.log('EVM',name,r.blockNumber);return r;}
async function evmReject(name,fn){try{await fn();throw Error('INVALID_EVM_ACCEPTED '+name);}catch(e){if(e.message.includes('INVALID_EVM_ACCEPTED'))throw e;if(!['CALL_EXCEPTION','UNPREDICTABLE_GAS_LIMIT'].includes(e.code))throw e;result.evmRejections.push({name,error:e.shortMessage||e.message,data:e.data});save();}}
async function deploy(name,args){const a=JSON.parse(fs.readFileSync(R+'/build/evm.json')).contracts[name],c=await new ethers.ContractFactory(a.abi,a.evm.bytecode.object,admin).deploy(...args);await evm('deploy-'+name,c.deploymentTransaction());return c;}
function fixtureOrder(lc,token,genesis,i){return {ethGenesis:configuration.genesis.genesis_validators_root,registry:lc.identity,ckbGenesis:genesis,fundingId:'0x'+sha(Buffer.from('contract unit order '+i)).toString('hex'),ckbMaker:U.scriptToHash(makerLock),ckbRefund:U.scriptToHash(userLock),asset:token.target,amount:'1000000',recipient:userAddress,maker:maker.address,deadline:4294967295,ckbAmount:cap.toString()};}
async function fund(lc,outcomes,token,genesis,label,seconds){
 const first={since:'0x0',previousOutput:userWallet.point},typ=script('reservation',H(Buffer.concat([B(U.serializeInput(first)),le(0)]))),identity=U.scriptToHash(typ);
 const latest=await provider.send('eth_getBlockByNumber',['latest',false]),o={...fixtureOrder(lc,token,genesis,label),fundingId:identity,deadline:Number(BigInt(latest.timestamp))+seconds,amount:'100000000'};
 const serialized=encode(o,outcomes.target);if(serialized.length!==480)throw Error('order ABI');const id='0x'+sha(serialized).toString('hex');if(id!==await outcomes.orderId(ordered(o)))throw Error('order hash');
 const codeHash=ethers.keccak256(await provider.getCode(outcomes.target)),args=Buffer.concat([serialized,B(codeHash),le(1),le(BigInt(latest.number)),le(fee)]);
 const t=tx([first],[{capacity:hex(cap+fee),lock:script('settlement','0x'+args.toString('hex')),type:typ},{capacity:hex(userWallet.capacity-cap-fee-fee),lock:userLock,type:null}],[Buffer.alloc(0),Buffer.alloc(0)],Buffer.alloc(0),[secpDep,deps.reservation]);
 t.witnesses=[{lock:'',inputType:'',outputType:''}];const signed=new CKB().signTransaction(userKey)(t),h=await commit('USER-CKB-FUND-'+label,signed);
 userWallet={point:{txHash:h,index:'0x1'},capacity:userWallet.capacity-cap-fee-fee};
 const record={label,id,order:o,args:'0x'+args.toString('hex'),type:typ,point:{txHash:h,index:'0x0'},fundedAt:Date.now(),userEthereumTransactions:0};result.trades.push(record);save();return record;
}
async function obtainUpdate(index,minTime){
 if(fs.existsSync(R+'/fixtures/devnet/update-'+index+'.bin'))return;
 for(let n=0;n<180;n++){
  const p=cp.spawnSync(R+'/../.venv/bin/python',[R+'/devnet/prepare.py','update',String(minTime),String(index)],{encoding:'utf8'});
  if(p.status===0){console.log(p.stdout);return;}
  if(!/wait for|not finalized yet/.test(p.stderr))throw Error(p.stderr);
  if(n%10===0)console.log('Finality pending',index,n,p.stderr.trim().split('\n').at(-1));await pause(3000);
 }throw Error('bounded finality timeout');
}
function timeProof(index){return read('update-'+index+'.bin').subarray(120,840);}
async function candidate(t,root,index,mode,proofOverride){
 const block=hex(root.data.readBigUInt64LE(64)),actual=await provider.send('eth_getBlockByNumber',[block,false]);
 if(actual.stateRoot!=='0x'+root.data.subarray(32,64).toString('hex')||actual.hash!=='0x'+root.data.subarray(72).toString('hex'))throw Error('execution history');
 const outcomes='0x'+B(t.args).subarray(76,96).toString('hex'),slot=ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32','uint256'],[t.id,0]));
 const proof=proofOverride||await provider.send('eth_getProof',[outcomes,[slot],block]);
 const w=Buffer.concat([Buffer.from([mode]),timeProof(index),wire(proof)]);
 const c=tx([{since:'0x0',previousOutput:t.point}],[{capacity:hex(cap),lock:mode?makerLock:userLock,type:null}],[Buffer.alloc(0)],w,[{outPoint:root.point,depType:'code'},deps.settlement,deps.reservation]);
 if(!proofOverride){result.proofs.push({id:t.id,mode,index,root:root.point,block:actual,slot,proof,timestampProof:'0x'+timeProof(index).toString('hex')});save();}
 return c;
}
async function finish(t,root,index,mode){
 const c=await candidate(t,root,index,mode),w=B(c.witnesses[0]);
 for(const [name,offset] of [['false-time',1+112+288],['wrong-header-root',1+112+64],['wrong-timestamp-branch',1+592],['wrong-finalized-header',1+48],['forged-MPT',w.length-5]]){const bad=structuredClone(c),b=B(bad.witnesses[0]);b[offset]^=1;bad.witnesses[0]='0x'+b.toString('hex');await reject(name+'-'+t.label,bad);}
 await reject('proof-withholding-'+t.label,{...c,witnesses:['0x'+w.subarray(0,721).toString('hex')]});
 for(const n of [0,1,720,721,w.length-1])await reject('truncated-'+t.label+'-'+n,{...c,witnesses:['0x'+w.subarray(0,n).toString('hex')]});
 const wrong=structuredClone(c);wrong.outputs[0].lock=mode?userLock:makerLock;await reject('wrong-CKB-recipient-'+t.label,wrong);
 const flip=Buffer.from(w);flip[0]=mode?0:1;await reject('competing-payout-mode-'+t.label,{...c,witnesses:['0x'+flip.toString('hex')]});
 const cert=structuredClone(c);cert.cellDeps[0]={outPoint:lcGlobal.certs.get('0').point,depType:'code'};await reject('certificate-not-root-'+t.label,cert);
 const h=await commit(mode?'MAKER-REIMBURSEMENT':'USER-INDEPENDENT-EMPTY-SLOT-REFUND',c),received=await live({txHash:h,index:'0x0'});
 if(BigInt(received.output.capacity)!==cap)throw Error('principal');result.settlements.push({label:t.label,mode,hash:h,root:root.point,index,received,latencyMs:Date.now()-t.fundedAt,observedAt:Date.now(),userEthereumTransactions:0});save();await reject('double-principal-'+t.label,c,true);
}
let lcGlobal;
async function contractTests(lc,token,outcomes,genesis){
 const o=fixtureOrder(lc,token,genesis,0),id=await outcomes.orderId(ordered(o));
 for(const [name,patch] of [['amount-zero',{amount:0}],['recipient-zero',{recipient:ethers.ZeroAddress}],['wrong-source-chain',{ethGenesis:'0x'+'11'.repeat(32)}],['wrong-CKB-chain',{ckbGenesis:'0x'+'22'.repeat(32)}],['wrong-registry',{registry:'0x'+'33'.repeat(32)}],['funding-zero',{fundingId:ethers.ZeroHash}],['invalid-deadline',{deadline:0}],['maker-reimbursement-zero',{ckbMaker:ethers.ZeroHash}]])await evmReject(name,()=>outcomes.connect(maker).fill.staticCall(ordered({...o,...patch})));
 await evmReject('competing-maker',()=>outcomes.connect(competitor).fill.staticCall(ordered(o)));
 // Real reverted transactions and storage rollback for false/reverting/fee/malformed tokens.
 for(const mode of [1,2,3,6]){
  await evm('token-test-mode-'+mode,token.configure(mode,ethers.ZeroAddress,'0x'));
  const before=await token.balanceOf(userAddress);
  try{const t=await outcomes.connect(maker).fill(ordered(o),{gasLimit:600000});await t.wait();throw Error('INVALID_TOKEN_ACCEPTED');}catch(e){if(e.message==='INVALID_TOKEN_ACCEPTED')throw e;if(e.code!=='CALL_EXCEPTION')throw e;const r=e.receipt;result.evm.push({name:'REVERTED-token-mode-'+mode,hash:r.hash,receipt:r.toJSON(),fee:r.fee.toString(),observedAt:Date.now(),expectedRevert:true});save();}
  if(await outcomes.filled(id)!==ethers.ZeroHash||await token.balanceOf(userAddress)!==before)throw Error('token rollback');
 }
 await evm('no-return-token-mode',token.configure(5,ethers.ZeroAddress,'0x'));await evm('no-return-valid-fill',outcomes.connect(maker).fill(ordered(o)));await evmReject('replayed-order',()=>outcomes.connect(maker).fill.staticCall(ordered(o)));
 // Actual reentrant inner order has maker=token contract, so the mutex is needed.
 const inner={...fixtureOrder(lc,token,genesis,1),maker:token.target},outer=fixtureOrder(lc,token,genesis,2);
 await evm('configure-reentrancy',token.configure(4,outcomes.target,outcomes.interface.encodeFunctionData('fill',[ordered(inner)])));
 await evm('outer-fill-reentrancy-guard',outcomes.connect(maker).fill(ordered(outer)));
 if(!await token.attempted()||await token.reentered()||await outcomes.filled(await outcomes.orderId(ordered(inner)))!==ethers.ZeroHash)throw Error('reentrancy');
 const reason=await token.reentryResult();if(!reason.includes(Buffer.from('reentrant').toString('hex')))throw Error('not mutex rejection');result.reentrancy={attempted:true,succeeded:false,reason};save();
 await evm('restore-standard-USDC',token.configure(0,ethers.ZeroAddress,'0x'));
}
(async()=>{
 if(recovered)throw Error('Use native offline replay for archived evidence; fresh live run needs a fresh label/configuration');
 cp.execFileSync(ckb,['init','-C',dir,'--chain','dev','--rpc-port','19224','--p2p-port','19225']);let spec=fs.readFileSync(dir+'/specs/dev.toml','utf8');
 const unique=Object.entries(bins).filter(([n,b],i,a)=>a.findIndex(([k,v])=>H(v)===H(b))===i);
 for(const [n,b]of unique){fs.writeFileSync(dir+'/'+n,b);spec=spec.replace('[genesis.system_cells_lock]',`[[genesis.system_cells]]\nfile = { file = "../${n}" }\ncreate_type_id = false\ncapacity = 100_000_000_000_000\n\n[genesis.system_cells_lock]`);}
 for(const l of [lock,userLock])spec=spec.replace('[params]',`[[genesis.issued_cells]]\ncapacity = 100_000_000_000_000\nlock.code_hash = "${l.codeHash}"\nlock.hash_type = "${l.hashType}"\nlock.args = "${l.args}"\n\n[params]`);
 fs.writeFileSync(dir+'/specs/dev.toml',spec);fs.writeFileSync(R+'/fixtures/devnet/ckb-dev.toml',spec);
 let conf=fs.readFileSync(dir+'/ckb.toml','utf8').replace('"Debug", "Terminal"','"Debug", "Terminal", "IntegrationTest"').replaceAll('/ip4/0.0.0.0/','/ip4/127.0.0.1/');conf+=`\n[block_assembler]\ncode_hash = "${H(bins.always)}"\nargs = "0x"\nhash_type = "data"\nmessage = "0x"\n`;fs.writeFileSync(dir+'/ckb.toml',conf);
 result.nodeMaxTxVerifyCycles=Number(conf.match(/max_tx_verify_cycles\s*=\s*([\d_]+)/)[1].replaceAll('_',''));if(result.nodeMaxTxVerifyCycles!==70000000)throw Error('policy changed');
 const log=fs.openSync(dir+'/runtime.log','w');node=cp.spawn(ckb,['run','-C',dir,'--ba-advanced'],{stdio:['ignore',log,log]});let g;
 for(let i=0;i<100;i++){try{g=await rpc('get_block_by_number',['0x0']);if(g)break;}catch{}await pause(200);}if(!g)throw Error('startup');
 secpDep={outPoint:{txHash:g.transactions[1].hash,index:'0x0'},depType:'depGroup'};
 for(const t of g.transactions)for(let i=0;i<t.outputs.length;i++){const point={txHash:t.hash,index:hex(i)};for(const n of Object.keys(bins))if(H(B(t.outputs_data[i]))===H(bins[n]))deps[n]={outPoint:point,depType:'code'};if(t.outputs[i].lock.code_hash===lock.codeHash&&t.outputs_data[i]==='0x')wallet={point,capacity:BigInt(t.outputs[i].capacity)};if(t.outputs[i].lock.args===userLock.args&&t.outputs_data[i]==='0x')userWallet={point,capacity:BigInt(t.outputs[i].capacity)};}
 for(let i=0;i<12;i++)await rpc('generate_block');const lc=await bootstrap('private-PoS');lcGlobal=lc;await certify(lc,0n);
 const nonceBefore=await provider.getTransactionCount(userAddress);result.user={address:userAddress,ethereumNonceBefore:nonceBefore,ckbLock:userLock};save();
 const token=await deploy('ControlledUSDC',[maker.address]),outcomes=await deploy('OutcomesV2',[configuration.genesis.genesis_validators_root,lc.identity,g.header.hash]);
 await evm('maker-amortizable-approval',token.connect(maker).approve(outcomes.target,1000000000000n));
 await contractTests(lc,token,outcomes,g.header.hash);
 const filled=await fund(lc,outcomes,token,g.header.hash,'filled',180),refund=await fund(lc,outcomes,token,g.header.hash,'unfilled',120);
 const before=await token.balanceOf(userAddress),sentAt=Date.now();const delivered=await evm('MAKER-REAL-USDC-DELIVERY',outcomes.connect(maker).fill(ordered(filled.order)));
 const after=await token.balanceOf(userAddress);if(after-before!==BigInt(filled.order.amount))throw Error('USDC delivery');
 result.delivery={before:before.toString(),after:after.toString(),amount:(after-before).toString(),latencyFromFundingMs:Date.now()-filled.fundedAt,makerSubmitToDeliveryMs:Date.now()-sentAt,receipt:delivered.hash};save();
 await evmReject('competing-filled-order',()=>outcomes.connect(maker).fill.staticCall(ordered(filled.order)));
 // A normal user signature cannot cancel the funded order outside the proof gate.
 const cancel=tx([{since:'0x0',previousOutput:refund.point}],[{capacity:hex(cap),lock:userLock,type:null}],[Buffer.alloc(0)],Buffer.from([0]),[deps.settlement,deps.reservation]);await reject('cancelled-funding-attempt',cancel);
 const deliveryBlock=await provider.send('eth_getBlockByNumber',[hex(delivered.blockNumber),false]);
 await obtainUpdate(0,Number(BigInt(deliveryBlock.timestamp)));await advance(lc,0,false);
 const stale=await candidate(refund,lc.root,0,0);const initialTime=Number(BigInt(result.proofs.at(-1).block.timestamp));
 if(initialTime<=refund.order.deadline)await reject('stale-before-deadline-root-cannot-refund',stale);else throw Error('need bounded earlier finalized checkpoint for deadline-negative test');
 await finish(filled,lc.root,0,1);
 // No EVM open or expiry call for this unfilled order. An independent reader retrieves proofs.
 await obtainUpdate(1,refund.order.deadline+1);await advance(lc,1,false);await finish(refund,lc.root,1,0);
 await evmReject('late-fill-after-authenticated-refund',()=>outcomes.connect(maker).fill.staticCall(ordered(refund.order)));
 const nonceAfter=await provider.getTransactionCount(userAddress);if(nonceAfter!==nonceBefore||result.evm.some(r=>r.receipt.from.toLowerCase()===userAddress.toLowerCase()))throw Error('user Ethereum transaction');
 result.user.ethereumNonceAfter=nonceAfter;result.user.ethereumTransactions=0;result.unfilledOrderEthereumTransactions=0;result.finalState={identity:lc.identity,outPoint:lc.point,data:'0x'+lc.data.toString('hex'),root:lc.root};save();
})().catch(e=>{result.failure=e.stack;save();console.error(e);process.exitCode=1;}).finally(()=>{if(node)node.kill('SIGTERM');});

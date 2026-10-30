// Only constructs candidate transactions. Every authoritative field is checked
// by CKB scripts; no live state/certificate cells are injected into genesis.
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const R=path.resolve(__dirname,'..'),E1=path.resolve(R,'../../wo04-e1'),U=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils');
const H=b=>'0x'+U.blake2b(32,null,null,U.PERSONAL).update(b).digest('hex'),hex=n=>'0x'+BigInt(n).toString(16),B=s=>Buffer.from(s.slice(2),'hex'),le=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
const sha=b=>require('crypto').createHash('sha256').update(b).digest();
const snake=x=>x==='depGroup'?'dep_group':Array.isArray(x)?x.map(snake):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),snake(v)])):x;
const pause=ms=>new Promise(r=>setTimeout(r,ms)),read=n=>fs.readFileSync(R+'/fixtures/devnet/'+n);
const recovered=process.env.P1_RESUME_FROM?JSON.parse(fs.readFileSync(process.env.P1_RESUME_FROM)):null;
if(recovered&&!process.env.P1_RESUME_DIR)throw Error('explicit persisted CKB directory required');
const dir=recovered?process.env.P1_RESUME_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'p1-chain-')),ckb=E1+'/tools/ckb/ckb';
const configuration=JSON.parse(read('configuration.json'));
const runName=process.env.P1_RUN_NAME||'compact-live';if(!/^[A-Za-z0-9_-]+$/.test(runName))throw Error('invalid run label');
if(fs.existsSync(R+'/evidence/chain-'+runName+'.json'))throw Error('Evidence label already exists; use a new E2B_RUN_NAME');
let node,wallet;const result={scope:'E2C historical root authorization and actual principal withholding; no positive trade claim',runName,transactions:[],rejections:[],lineages:[],evm:[],trades:[],proofs:[],settlements:[],evmRejections:[]};
if(recovered){Object.assign(result,recovered,{runName,resumedFrom:process.env.P1_RESUME_FROM});delete result.failure;}result.ckbDir=dir;result.scope='P1 compact OutPoint-bound 100-CKB trades';
const save=()=>fs.writeFileSync(R+'/evidence/chain-'+runName+'.json',JSON.stringify(result,null,2)+'\n');
const rpc=async(method,params=[])=>{const r=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;};
const bins={};for(const n of ['state','certificate','root','settlement','settlement20'])bins[n]=fs.readFileSync(R+'/build/devnet/'+n);bins.always=fs.readFileSync(E1+'/config/always_success');
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
const principal=10000000000n;
const ORDER_DOMAIN=ethers.sha256(ethers.toUtf8Bytes('CKB-E2D-P1-ORDER-V1'));
const fields=['ethGenesis','registry','ckbGenesis','fundingId','ckbMaker','ckbRefund','asset','amount','recipient','maker','deadline','ckbAmount'];
const fieldTypes=['bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','address','uint256','address','address','uint64','uint64'];
const encode=(o,contract)=>B(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32','uint256','address',...fieldTypes],[ORDER_DOMAIN,1337,contract,...fields.map(k=>o[k])]));
const ordered=o=>fields.map(k=>o[k]);
const wire=proof=>{const nodes=ns=>Buffer.concat([Buffer.from([ns.length&255,ns.length>>8]),...ns.flatMap(s=>{const b=B(s);return [Buffer.from([b.length&255,b.length>>8]),b];})]);return Buffer.concat([nodes(proof.accountProof),nodes(proof.storageProof[0].proof)]);};
async function evm(name,p){const sentAt=Date.now(),t=await p,r=await t.wait();if(r.status!==1)throw Error('EVM reverted '+name);result.evm.push({name,hash:t.hash,receipt:r.toJSON(),fee:r.fee.toString(),sentAt,observedAt:Date.now()});save();console.log('EVM',name,r.blockNumber);return r;}
async function evmReject(name,fn){try{await fn();throw Error('INVALID_EVM_ACCEPTED '+name);}catch(e){if(e.message.includes('INVALID_EVM_ACCEPTED'))throw e;if(!['CALL_EXCEPTION','UNPREDICTABLE_GAS_LIMIT'].includes(e.code))throw e;result.evmRejections.push({name,error:e.shortMessage||e.message,data:e.data});save();}}
async function deploy(name,args){const a=JSON.parse(fs.readFileSync(R+'/build/evm.json')).contracts[name],c=await new ethers.ContractFactory(a.abi,a.evm.bytecode.object,admin).deploy(...args);await evm('deploy-'+name,c.deploymentTransaction());return c;}
function fixtureOrder(lc,token,genesis,i){return {ethGenesis:configuration.genesis.genesis_validators_root,registry:lc.identity,ckbGenesis:genesis,fundingId:'0x'+sha(Buffer.from('contract unit order '+i)).toString('hex'),ckbMaker:U.scriptToHash(makerLock),ckbRefund:U.scriptToHash(userLock),asset:token.target,amount:'1000000',recipient:userAddress,maker:maker.address,deadline:4294967295,ckbAmount:principal.toString()};}

function pointBytes(point){return B(U.serializeInput({since:'0x0',previousOutput:point})).subarray(8);}
function fullId(base,point){return ethers.sha256(ethers.concat(['0x'+base.subarray(0,480).toString('hex'),point.txHash,ethers.zeroPadValue(ethers.toBeHex(BigInt(point.index)),32)]));}
async function makeBase(lc,outcomes,token,genesis,amount){
 const latest=await provider.send('eth_getBlockByNumber',['latest',false]);const order={...fixtureOrder(lc,token,genesis,amount),fundingId:ethers.ZeroHash,deadline:Number(BigInt(latest.timestamp))+120,amount:String(amount)};
 const serialized=encode(order,outcomes.target),codeHash=ethers.keccak256(await provider.getCode(outcomes.target));
 return {order,terms:Buffer.concat([serialized,B(codeHash),le(1),le(BigInt(latest.number)),le(fee)])};
}
async function fundBatch(base,labels,outcomes){
 const commitment=sha(base.terms),amount=principal+fee,outputs=labels.map(()=>({capacity:hex(amount),lock:script('settlement','0x'+commitment.toString('hex')),type:null}));outputs.push({capacity:hex(userWallet.capacity-BigInt(labels.length)*amount-fee),lock:userLock,type:null});
 const t=tx([{since:'0x0',previousOutput:userWallet.point}],outputs,outputs.map(()=>Buffer.alloc(0)),Buffer.alloc(0),[secpDep]);t.witnesses=[{lock:'',inputType:'',outputType:''}];const signed=new CKB().signTransaction(userKey)(t),expectedHash=U.rawTransactionToHash(signed);
 // Persist the full recoverable preimage BEFORE broadcasting an opaque commitment.
 const recovery={order:base.order,terms:'0x'+base.terms.toString('hex'),commitment:'0x'+commitment.toString('hex'),signedFunding:signed,expectedHash,outputs:labels.map((label,index)=>({label,point:{txHash:expectedHash,index:hex(index)},id:fullId(base.terms,{txHash:expectedHash,index:hex(index)})}))};
 const recoveryPath=R+'/fixtures/recovery-'+labels.join('-')+'.json';if(fs.existsSync(recoveryPath))throw Error('recovery package already exists');const fd=fs.openSync(recoveryPath,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(recovery,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 const h=await commit('USER-FUND-'+labels.join('-'),signed);if(h!==expectedHash)throw Error('funding hash differs');
 userWallet={point:{txHash:h,index:hex(labels.length)},capacity:userWallet.capacity-BigInt(labels.length)*amount-fee};
 const records=[];
 for(let i=0;i<labels.length;i++){
  const point={txHash:h,index:hex(i)},id=fullId(base.terms,point);if(id!==await outcomes.orderId(ordered(base.order),h,i))throw Error('OutPoint encoding');
  const r={label:labels[i],id,order:base.order,terms:'0x'+base.terms.toString('hex'),commitment:'0x'+commitment.toString('hex'),point,fundedAt:Date.now(),principal:principal.toString(),feeReserve:fee.toString(),type:null,data:'0x'};result.trades.push(r);records.push(r);
 }
 save();return records;
}
async function capacityTests(){
 for(const [program,bytes,minimum]of [['settlement',32,7300000000n],['settlement20',20,6100000000n]]){
  const args='0x'+'55'.repeat(bytes),build=value=>{const t=tx([{since:'0x0',previousOutput:userWallet.point}],[{capacity:hex(value),lock:script(program,args),type:null},{capacity:hex(userWallet.capacity-value-fee),lock:userLock,type:null}],[Buffer.alloc(0),Buffer.alloc(0)],Buffer.alloc(0),[secpDep]);t.witnesses=[{lock:'',inputType:'',outputType:''}];return new CKB().signTransaction(userKey)(t);};
  await reject('node-capacity-below-'+bytes+'-byte-minimum',build(minimum-1n),true);const last=result.rejections.at(-1);if(!/InsufficientCellCapacity|OccupiedCapacity/.test(last.error))throw Error('not capacity rejection '+last.error);
  const h=await commit('node-capacity-exact-'+bytes+'-byte-minimum',build(minimum));userWallet={point:{txHash:h,index:'0x1'},capacity:userWallet.capacity-minimum-fee};
  result.capacityTests??=[];result.capacityTests.push({bytes,minimumShannons:minimum.toString(),acceptedOutPoint:{txHash:h,index:'0x0'},oneShannonBelowRejected:true,scope:bytes===32?'32-byte standard target':'20-byte weaker capacity-only experiment; not a successful swap'});save();
 }
}
async function obtainUpdate(index,minTime){
 if(fs.existsSync(R+'/fixtures/devnet/update-'+index+'.bin'))return;
 for(let n=0;n<180;n++){
  const p=cp.spawnSync(R+'/../.venv/bin/python',[R+'/devnet/prepare.py','update',String(minTime),String(index)],{encoding:'utf8'});
  if(p.status===0){console.log(p.stdout);return;}
  if(!/wait for|not finalized yet|actual participation outside bounded range/.test(p.stderr))throw Error(p.stderr);
  if(n%10===0)console.log('Finality pending',index,n,p.stderr.trim().split('\n').at(-1));await pause(3000);
 }throw Error('bounded finality timeout');
}
function timeProof(index){return read('update-'+index+'.bin').subarray(120,840);}
async function candidate(t,root,index,mode){
 const block=hex(root.data.readBigUInt64LE(64)),actual=await provider.send('eth_getBlockByNumber',[block,false]);if(actual.stateRoot!=='0x'+root.data.subarray(32,64).toString('hex')||actual.hash!=='0x'+root.data.subarray(72).toString('hex'))throw Error('execution history');
 const base=B(t.terms),address='0x'+base.subarray(76,96).toString('hex'),slot=ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32','uint256'],[t.id,0]));
 const proof=await provider.send('eth_getProof',[address,[slot],block]);
 const w=Buffer.concat([Buffer.from([mode]),base,pointBytes(t.point),timeProof(index),wire(proof)]);
 result.proofs.push({id:t.id,label:t.label,mode,index,root:root.point,block:actual,slot,proof,timestampProof:'0x'+timeProof(index).toString('hex')});save();
 return tx([{since:'0x0',previousOutput:t.point}],[{capacity:hex(principal),lock:mode?makerLock:userLock,type:null}],[Buffer.alloc(0)],w,[{outPoint:root.point,depType:'code'},deps.settlement]);
}
async function finish(t,c,mode){
 const w=B(c.witnesses[0]);
 for(const [name,offset]of [['principal',1+472],['fee',1+528],['maker',1+396],['maker-lock',1+224],['refund-lock',1+256],['recipient',1+364],['deadline',1+440],['asset',1+300]]){
  const b=Buffer.from(w);b[offset]^=1;await reject('mutated-'+name+'-'+t.label,{...c,witnesses:['0x'+b.toString('hex')]});if(!result.rejections.at(-1).error.includes('error code 27 '))throw Error('terms not committed');
 }
 const wrong=structuredClone(c);wrong.outputs[0].lock=mode?userLock:makerLock;await reject('wrong-output-recipient-'+t.label,wrong);
 const low=structuredClone(c);low.outputs[0].capacity=hex(principal-1n);await reject('altered-output-principal-'+t.label,low);
 const pt=Buffer.from(w);pt[537]^=1;await reject('mismatched-OutPoint-'+t.label,{...c,witnesses:['0x'+pt.toString('hex')]});if(!result.rejections.at(-1).error.includes('error code 16 '))throw Error('OutPoint not checked');
 for(const n of [0,1,537,573,1293,w.length-1])await reject('truncated-'+t.label+'-'+n,{...c,witnesses:['0x'+w.subarray(0,n).toString('hex')]});
 const replacement=structuredClone(c);replacement.outputs[0].lock=script('settlement',t.commitment);await reject('funded-intent-replacement-'+t.label,replacement);
 const h=await commit(mode?'MAKER-100-CKB-'+t.label:'USER-100-CKB-REFUND-'+t.label,c),received=await live({txHash:h,index:'0x0'});if(BigInt(received.output.capacity)!==principal)throw Error('not original100');
 result.settlements.push({label:t.label,hash:h,mode,point:t.point,id:t.id,received,latencyMs:Date.now()-t.fundedAt,observedAt:Date.now()});save();await reject('duplicate-settlement-'+t.label,c,true);
}
async function identityAttacks(a,b,d,ca,cd){
 if(a.point.txHash!==b.point.txHash||a.point.index===b.point.index||a.commitment!==b.commitment||a.terms!==b.terms||a.id===b.id)throw Error('twin test not decisive');
 const reuse=structuredClone(ca);reuse.inputs[0].previousOutput=b.point;await reject('reuse-full-witness-on-identical-twin',reuse);if(!result.rejections.at(-1).error.includes('error code 16 '))throw Error('point reuse');
 const rebind=structuredClone(reuse),w=B(rebind.witnesses[0]);pointBytes(b.point).copy(w,537);rebind.witnesses[0]='0x'+w.toString('hex');await reject('rebound-OutPoint-with-A-fill-proof-cannot-pay-B',rebind);
 const same=structuredClone(ca);same.inputs.push({since:'0x0',previousOutput:b.point});same.witnesses.push(ca.witnesses[0]);await reject('two-same-lock-inputs-one-proof-one-payout',same);if(!result.rejections.at(-1).error.includes('error code 14 '))throw Error('global same-group rule');
 const different=structuredClone(ca);different.inputs.push({since:'0x0',previousOutput:d.point});different.witnesses.push(cd.witnesses[0]);await reject('two-different-lock-groups-two-valid-fills-one-payout',different);if(!result.rejections.at(-1).error.includes('error code 14 '))throw Error('global cross-group rule');
 result.identity={sameTransactionDifferentOutputIndices:true,identicalBaseAndLockCommitment:true,distinctEthereumIds:true,globalSingleInputRuleVerified:true,oneFillCannotClaimTwin:true};save();
}
(async()=>{
 if(!recovered){
 cp.execFileSync(ckb,['init','-C',dir,'--chain','dev','--rpc-port','19224','--p2p-port','19225']);let spec=fs.readFileSync(dir+'/specs/dev.toml','utf8');
 const unique=Object.entries(bins).filter(([n,b],i,a)=>a.findIndex(([k,v])=>H(v)===H(b))===i);
 for(const [n,b]of unique){fs.writeFileSync(dir+'/'+n,b);spec=spec.replace('[genesis.system_cells_lock]',`[[genesis.system_cells]]\nfile = { file = "../${n}" }\ncreate_type_id = false\ncapacity = 100_000_000_000_000\n\n[genesis.system_cells_lock]`);}
 for(const l of [lock,userLock])spec=spec.replace('[params]',`[[genesis.issued_cells]]\ncapacity = 100_000_000_000_000\nlock.code_hash = "${l.codeHash}"\nlock.hash_type = "${l.hashType}"\nlock.args = "${l.args}"\n\n[params]`);
 fs.writeFileSync(dir+'/specs/dev.toml',spec);fs.writeFileSync(R+'/fixtures/devnet/ckb-dev.toml',spec);
 let conf=fs.readFileSync(dir+'/ckb.toml','utf8').replace('"Debug", "Terminal"','"Debug", "Terminal", "IntegrationTest"').replaceAll('/ip4/0.0.0.0/','/ip4/127.0.0.1/');conf+=`\n[block_assembler]\ncode_hash = "${H(bins.always)}"\nargs = "0x"\nhash_type = "data"\nmessage = "0x"\n`;fs.writeFileSync(dir+'/ckb.toml',conf);
 result.nodeMaxTxVerifyCycles=Number(conf.match(/max_tx_verify_cycles\s*=\s*([\d_]+)/)[1].replaceAll('_',''));if(result.nodeMaxTxVerifyCycles!==70000000)throw Error('policy changed');
 }
 const log=fs.openSync(dir+'/runtime.log','w');node=cp.spawn(ckb,['run','-C',dir,'--ba-advanced'],{stdio:['ignore',log,log]});let g;
 for(let i=0;i<100;i++){try{g=await rpc('get_block_by_number',['0x0']);if(g)break;}catch{}await pause(200);}if(!g)throw Error('startup');
 secpDep={outPoint:{txHash:g.transactions[1].hash,index:'0x0'},depType:'depGroup'};
 for(const t of g.transactions)for(let i=0;i<t.outputs.length;i++){const point={txHash:t.hash,index:hex(i)};for(const n of Object.keys(bins))if(H(B(t.outputs_data[i]))===H(bins[n]))deps[n]={outPoint:point,depType:'code'};if(t.outputs[i].lock.code_hash===lock.codeHash&&t.outputs_data[i]==='0x')wallet={point,capacity:BigInt(t.outputs[i].capacity)};if(t.outputs[i].lock.args===userLock.args&&t.outputs_data[i]==='0x')userWallet={point,capacity:BigInt(t.outputs[i].capacity)};}
 for(let i=0;i<12;i++)await rpc('generate_block');let lc,a,b,c,d,lastReceipt;
 if(recovered){
  const bs=recovered.transactions.find(r=>r.name==='private-PoS-bootstrap'),ct=recovered.transactions.find(r=>r.name==='private-PoS-certify-0'),t=bs.tx.outputs[0].type,typ={codeHash:t.code_hash,hashType:t.hash_type,args:t.args};
  lc={label:'private-PoS',type:typ,identity:U.scriptToHash(typ),point:{txHash:bs.hash,index:'0x0'},data:read('state-0.bin'),certs:new Map([['0',{point:{txHash:ct.hash,index:'0x0'}}]]),roots:[],history:[]};
  const manager=[...recovered.transactions].reverse().find(r=>r.tx.outputs.at(-1).lock.args==='0x'&&r.tx.outputs.at(-1).lock.code_hash===lock.codeHash);wallet={point:{txHash:manager.hash,index:hex(manager.tx.outputs.length-1)},capacity:BigInt(manager.tx.outputs.at(-1).capacity)};
  for(const u of recovered.transactions.filter(r=>r.name.startsWith('private-PoS-update-'))){lc.point={txHash:u.hash,index:'0x0'};lc.data=read('state-'+(lc.roots.length+1)+'.bin');const t=u.tx.outputs[1].type;lc.root={point:{txHash:u.hash,index:'0x1'},type:{codeHash:t.code_hash,hashType:t.hash_type,args:t.args},data:B(u.tx.outputs_data[1])};lc.roots.push(lc.root);}
  [a,b,d,c]=['filled-A','identical-B','filled-D','unfilled-C'].map(label=>recovered.trades.find(t=>t.label===label));
  for(const t of [a,b,d,c]){if(!result.settlements.some(x=>x.label===t.label))await live(t.point);if('0x'+sha(B(t.terms)).toString('hex')!==t.commitment)throw Error('recovery preimage');}
  await live(lc.point);lastReceipt=recovered.evm.findLast(e=>e.name.startsWith('MAKER-DELIVERY-')).receipt;
  result.recovery={newEthereumTransactions:false,newFunding:false,originalOutPoints:[a,b,d,c].map(t=>t.point),termsSource:'Full recovery packages persisted before broadcast; commitments rechecked against saved preimages and live original inputs'};save();
 }else{
 lc=await bootstrap('private-PoS');await certify(lc,0n);
 const nonceBefore=await provider.getTransactionCount(userAddress);result.user={address:userAddress,ethereumNonceBefore:nonceBefore,ckbLock:userLock};save();
 await capacityTests();
 const token=await deploy('ControlledUSDC',[maker.address]),outcomes=await deploy('OutcomesV3',[configuration.genesis.genesis_validators_root,lc.identity,g.header.hash]);await evm('maker-amortizable-approval',token.connect(maker).approve(outcomes.target,1000000000000n));
 const base=await makeBase(lc,outcomes,token,g.header.hash,100000000);[a,b]=await fundBatch(base,['filled-A','identical-B'],outcomes);
 [d]=await fundBatch(await makeBase(lc,outcomes,token,g.header.hash,50000000),['filled-D'],outcomes);[c]=await fundBatch(await makeBase(lc,outcomes,token,g.header.hash,25000000),['unfilled-C'],outcomes);
 result.deliveries=[];
 for(const t of [a,d]){const before=await token.balanceOf(userAddress),start=Date.now();lastReceipt=await evm('MAKER-DELIVERY-'+t.label,outcomes.connect(maker).fill(ordered(t.order),t.point.txHash,Number(BigInt(t.point.index))));const after=await token.balanceOf(userAddress);if(after-before!==BigInt(t.order.amount))throw Error('delivery');result.deliveries.push({label:t.label,amount:(after-before).toString(),fundingToDeliveryMs:Date.now()-t.fundedAt,submitToDeliveryMs:Date.now()-start});save();}
 await evmReject('replayed-OutPoint-fill',()=>outcomes.connect(maker).fill.staticCall(ordered(a.order),a.point.txHash,Number(BigInt(a.point.index))));
 await evmReject('zero-OutPoint',()=>outcomes.connect(maker).fill.staticCall(ordered(a.order),ethers.ZeroHash,0));
 }
 const deliveryBlock=await provider.send('eth_getBlockByNumber',[hex(lastReceipt.blockNumber),false]);if(!lc.roots.length){await obtainUpdate(0,Number(BigInt(deliveryBlock.timestamp)));await advance(lc,0,false);}
 const ca=await candidate(a,lc.roots[0],0,1),cd=await candidate(d,lc.roots[0],0,1);if(!result.identity)await identityAttacks(a,b,d,ca,cd);
 const premature=await candidate(c,lc.root,0,0);if(Number(BigInt(result.proofs.at(-1).block.timestamp))<=c.order.deadline)await reject('unfilled-before-authenticated-expiry',premature);else{result.initialRootAlreadyPastDeadline=true;save();}
 if(!result.settlements.some(t=>t.label===a.label))await finish(a,ca,1);if(!result.settlements.some(t=>t.label===d.label))await finish(d,cd,1);
 if(lc.roots.length===1){await obtainUpdate(1,Math.max(b.order.deadline,c.order.deadline)+1);await advance(lc,1,false);}
 for(const t of [b,c])if(!result.settlements.some(x=>x.label===t.label))await finish(t,await candidate(t,lc.root,1,0),0);
 const nonceAfter=await provider.getTransactionCount(userAddress);if(nonceAfter!==result.user.ethereumNonceBefore)throw Error('customer Ethereum transaction');result.user.ethereumNonceAfter=nonceAfter;result.user.ethereumTransactions=0;result.finalState={identity:lc.identity,outPoint:lc.point,data:'0x'+lc.data.toString('hex'),root:lc.root};save();
})().catch(e=>{result.failure=e.stack;save();console.error(e);process.exitCode=1;}).finally(()=>{if(node)node.kill('SIGTERM');});

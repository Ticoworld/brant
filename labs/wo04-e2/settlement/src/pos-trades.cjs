// Only constructs candidate transactions. Every authoritative field is checked
// by CKB scripts; no live state/certificate cells are injected into genesis.
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const R=path.resolve(__dirname,'..'),E1=path.resolve(R,'../../wo04-e1'),U=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils');
const H=b=>'0x'+U.blake2b(32,null,null,U.PERSONAL).update(b).digest('hex'),hex=n=>'0x'+BigInt(n).toString(16),B=s=>Buffer.from(s.slice(2),'hex'),le=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
const sha=b=>require('crypto').createHash('sha256').update(b).digest();
const snake=x=>Array.isArray(x)?x.map(snake):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),snake(v)])):x;
const pause=ms=>new Promise(r=>setTimeout(r,ms)),read=n=>fs.readFileSync(R+'/fixtures/devnet/'+n);
const recovered=process.env.E2C_RESUME_FROM?JSON.parse(fs.readFileSync(process.env.E2C_RESUME_FROM)):null;
if(recovered&&!process.env.E2C_RESUME_DIR)throw Error('explicit persisted CKB directory required');
const dir=recovered?process.env.E2C_RESUME_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'e2c-chain-')),ckb=E1+'/tools/ckb/ckb';
const configuration=JSON.parse(read('configuration.json'));
const runName=process.env.E2C_RUN_NAME||'pos-trades';if(!/^[A-Za-z0-9_-]+$/.test(runName))throw Error('invalid run label');
if(fs.existsSync(R+'/evidence/chain-'+runName+'.json'))throw Error('Evidence label already exists; use a new E2B_RUN_NAME');
let node,wallet;const result={scope:'E2C historical root authorization and actual principal withholding; no positive trade claim',runName,transactions:[],rejections:[],lineages:[],evm:[],trades:[],proofs:[],settlements:[]};
if(recovered){Object.assign(result,recovered,{runName,resumedFrom:process.env.E2C_RESUME_FROM});delete result.failure;}result.scope='Real private-PoS finalized principal settlement; no public transactions';
const save=()=>fs.writeFileSync(R+'/evidence/chain-'+runName+'.json',JSON.stringify(result,null,2)+'\n');
const rpc=async(method,params=[])=>{const r=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;};
const bins={};for(const n of ['state','certificate','root','settlement','history_probe'])bins[n]=fs.readFileSync(R+'/build/devnet/'+n);bins.reservation=fs.readFileSync(R+'/build/devnet/reservation');bins.always=fs.readFileSync(E1+'/config/always_success');
const script=(n,args='0x')=>({codeHash:H(bins[n]),hashType:'data2',args}),lock=script('always'),deps={};
const fee=1000000n,cap=100000000000n;
const output=(capacity,type=null)=>({capacity:hex(capacity),lock:type&&type.codeHash===H(bins.state)&&B(type.args).length===32?script('state'):lock,type});
const tx=(inputs,outputs,data,witness,cellDeps)=>({version:'0x0',cellDeps:cellDeps.filter((d,i,a)=>a.findIndex(x=>JSON.stringify(x)===JSON.stringify(d))===i),headerDeps:[],inputs,outputs,outputsData:data.map(b=>'0x'+b.toString('hex')),witnesses:['0x'+witness.toString('hex')]});
const reject=async(name,t,send=false)=>{try{await rpc(send?'send_transaction':'estimate_cycles',send?[snake(t),'passthrough']:[snake(t)]);throw Error('INVALID_ACCEPTED '+name);}catch(e){if(e.message.includes('INVALID_ACCEPTED'))throw e;result.rejections.push({name,error:e.message,method:send?'send_transaction':'estimate_cycles',tx:snake(t),afterTransactions:result.transactions.length});save();}};
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


const ethers=require('../../../wo04-e1/node_modules/ethers');
const inspectIP=name=>JSON.parse(cp.execFileSync('docker',['inspect',name]))[0].NetworkSettings.Networks['e2c-private'].IPAddress;
const elIP=inspectIP('e2c-el');if(!elIP.startsWith('172.18.'))throw Error('unexpected private network');
const provider=new ethers.JsonRpcProvider('http://'+elIP+':8545');provider.pollingInterval=300;
// Public, disposable fixture mnemonic from the pinned generator. NEVER funded publicly.
const mnemonic='sleep moment list remain like wall lake industry canvas wonder ecology elite duck salad naive syrup frame brass utility club odor country obey pudding';
const recipient=ethers.HDNodeWallet.fromPhrase(mnemonic,undefined,"m/44'/60'/0'/0/0").connect(provider),maker=ethers.HDNodeWallet.fromPhrase(mnemonic,undefined,"m/44'/60'/0'/0/1").connect(provider);
const makerLock=script('always','0x'+'22'.repeat(32)),refundLock=script('always','0x'+'33'.repeat(32));
const wire=proof=>{const nodes=ns=>Buffer.concat([Buffer.from([ns.length&255,ns.length>>8]),...ns.flatMap(s=>{const b=B(s);return [Buffer.from([b.length&255,b.length>>8]),b];})]);return Buffer.concat([nodes(proof.accountProof),nodes(proof.storageProof[0].proof)]);};
async function evm(name,p){const t=await p,r=await t.wait();if(r.status!==1)throw Error('EVM revert '+name);result.evm.push({name,hash:t.hash,receipt:r.toJSON(),fee:r.fee.toString(),observedAt:Date.now()});save();console.log('EVM',name,r.blockNumber);return r;}
async function deploy(name,args){const a=JSON.parse(fs.readFileSync(R+'/build/evm.json')).contracts[name],c=await new ethers.ContractFactory(a.abi,a.evm.bytecode.object,recipient).deploy(...args);await evm('deploy-'+name,c.deploymentTransaction());return c;}
async function openFund(lc,outcomes,token,status,genesis){
 const first={since:'0x0',previousOutput:wallet.point},nonce=H(Buffer.concat([B(U.serializeInput(first)),le(0)]));
 const type=script('reservation',nonce),identity=U.scriptToHash(type),id='0x'+sha(Buffer.from('E2C real PoS '+status+' '+identity)).toString('hex');
 const latest=await provider.send('eth_getBlockByNumber',['latest',false]),deadline=Number(BigInt(latest.timestamp))+75,amount=100000000n;
 const domain=sha(Buffer.concat([B(configuration.genesis.genesis_validators_root),B(lc.identity)])),domainHex='0x'+domain.toString('hex');
 await evm('open-'+status,outcomes.open(id,token.target,recipient.address,maker.address,amount,deadline,genesis,cap,U.scriptToHash(makerLock),U.scriptToHash(refundLock),identity));
 const trade=await outcomes.trades(id),terms=ethers.sha256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32','bytes32','uint256','address','address','address','address','uint256','uint256','bytes32','uint256','bytes32','bytes32','bytes32'],[domainHex,id,1337,outcomes.target,token.target,recipient.address,maker.address,amount,deadline,genesis,cap,U.scriptToHash(makerLock),U.scriptToHash(refundLock),identity]));
 if(terms!==trade.terms)throw Error('terms mismatch');
 const a=Buffer.alloc(412);B(outcomes.target).copy(a,64);B(ethers.keccak256(await provider.getCode(outcomes.target))).copy(a,84);domain.copy(a,116);B(id).copy(a,148);B(terms).copy(a,180);B(U.scriptToHash(makerLock)).copy(a,212);B(U.scriptToHash(refundLock)).copy(a,244);le(cap).copy(a,276);le(fee).copy(a,284);B(identity).copy(a,292);B(lc.identity).copy(a,324);B(configuration.genesis.genesis_validators_root).copy(a,356);le(1).copy(a,388);le(BigInt(latest.number)).copy(a,396);
 const lock=script('settlement','0x'+a.toString('hex'));
 const t=tx([first],[{capacity:hex(cap+fee),lock,type},output(wallet.capacity-cap-fee-fee)],[Buffer.alloc(0),Buffer.alloc(0)],Buffer.alloc(0),[deps.always,deps.reservation]);
 const h=await commit('fund-principal-'+status,t);wallet={point:{txHash:h,index:'0x1'},capacity:wallet.capacity-cap-fee-fee};
 const rec={id,terms,status,deadline,amount:amount.toString(),reservation:identity,point:{txHash:h,index:'0x0'},lock,type,args:'0x'+a.toString('hex'),fundedAt:Date.now()};result.trades.push(rec);save();return rec;
}
async function obtainUpdate(index,terminalTimestamp){
 console.log('Waiting for actual finalized execution history',index,terminalTimestamp);
 if(fs.existsSync(R+'/fixtures/devnet/update-'+index+'.bin')){console.log('Reusing exact previously captured real consensus update',index);return;}
 for(let n=0;n<180;n++){
  const p=cp.spawnSync(R+'/../.venv/bin/python',[R+'/devnet/prepare.py','update',String(terminalTimestamp),String(index)],{encoding:'utf8'});
  if(p.status===0){console.log(p.stdout);return;}
  if(!/wait for|not finalized yet/.test(p.stderr))throw Error(p.stderr);
  if(n%10===0)console.log('Finality pending',n,p.stderr.trim().split('\n').at(-1));
  await pause(3000);
 }
 throw Error('bounded real finality timeout');
}
async function settle(t,root,outcomes){
 const datum=root.data,block=hex(datum.readBigUInt64LE(64)),actual=await provider.send('eth_getBlockByNumber',[block,false]);
 if(actual.stateRoot!=='0x'+datum.subarray(32,64).toString('hex')||actual.hash!=='0x'+datum.subarray(72).toString('hex'))throw Error('different execution history');
 const slot=ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32','uint256'],[t.id,2]));
 const proof=await provider.send('eth_getProof',[outcomes.target,[slot],block]);
 const expected=sha(Buffer.concat([datum.subarray(0,32),B(t.id),B(t.terms),Buffer.from([t.status])]));
 if(BigInt(proof.storageProof[0].value)!==BigInt('0x'+expected.toString('hex')))throw Error('terminal leaf mismatch');
 result.proofs.push({id:t.id,root:root.point,block:actual,slot,proof});save();
 const w=Buffer.concat([Buffer.from([0,t.status]),wire(proof)]),candidate=tx([{since:'0x0',previousOutput:t.point}],[{capacity:hex(cap),lock:t.status===2?makerLock:refundLock,type:null}],[Buffer.alloc(0)],w,[{outPoint:root.point,depType:'code'},deps.settlement,deps.reservation]);
 await reject('proof-withholding-'+t.status,{...candidate,witnesses:['0x0002']});
 const bad=structuredClone(candidate),bw=B(bad.witnesses[0]);bw[10]^=1;bad.witnesses[0]='0x'+bw.toString('hex');await reject('mismatched-proof-'+t.status,bad);
 const payout=structuredClone(candidate);payout.outputs[0].lock=t.status===2?refundLock:makerLock;await reject('wrong-principal-recipient-'+t.status,payout);
 const status=structuredClone(candidate),sw=B(status.witnesses[0]);sw[1]=t.status===2?3:2;status.witnesses[0]='0x'+sw.toString('hex');await reject('wrong-terminal-status-'+t.status,status);
 if(t.status===2){
  // Independent funded rejection controls: each immutable lock has precisely
  // one changed commitment. These are isolated disposable CKB, never payouts.
  for(const [name,offset,kind] of [['forged-contract-code-hash',84,'flip'],['wrong-terms',180,'flip'],['invalid-trade-storage-slot',148,'flip'],['wrong-source-genesis',356,'flip'],['unauthorized-lineage',324,'flip'],['future-minimum-state-version',388,'version'],['expired-block-window',404,'range']]){
   const a=B(t.args);if(kind==='flip')a[offset]^=1;else le(kind==='version'?99:1).copy(a,offset);
   const first={since:'0x0',previousOutput:wallet.point},nonce=H(Buffer.concat([B(U.serializeInput(first)),le(0)])),typ=script('reservation',nonce);B(U.scriptToHash(typ)).copy(a,292);
   const f=tx([first],[{capacity:hex(cap+fee),lock:script('settlement','0x'+a.toString('hex')),type:typ},output(wallet.capacity-cap-fee-fee)],[Buffer.alloc(0),Buffer.alloc(0)],Buffer.alloc(0),[deps.always,deps.reservation]);
   const fh=await commit('fund-negative-control-'+name,f);wallet={point:{txHash:fh,index:'0x1'},capacity:wallet.capacity-cap-fee-fee};
   const bad=structuredClone(candidate);bad.inputs[0].previousOutput={txHash:fh,index:'0x0'};await reject(name,bad);
  }
 }
 await live(t.point);
 const h=await commit(t.status===2?'REAL-POS-FILL-PRINCIPAL-PAYOUT':'REAL-POS-UNFILLED-PRINCIPAL-REFUND',candidate);
 const received=await live({txHash:h,index:'0x0'}),spent=await rpc('get_live_cell',[snake(t.point),false]);if(spent.status==='live'||BigInt(received.output.capacity)!==cap)throw Error('principal not actually transferred');
 result.settlements.push({received,consumedInputStatus:spent.status,id:t.id,status:t.status,hash:h,root:root.point,rootVersion:Number(B(root.type.args).readBigUInt64LE(64)),recoveredAfterLaterRootPublication:true,latencyMs:Date.now()-t.fundedAt,principalShannons:cap.toString(),feeShannons:fee.toString()});save();
 await reject('double-settlement-'+t.status,candidate,true);
}
(async()=>{
 if(!recovered){cp.execFileSync(ckb,['init','-C',dir,'--chain','dev','--rpc-port','19224','--p2p-port','19225']);let spec=fs.readFileSync(dir+'/specs/dev.toml','utf8');
 const unique=Object.entries(bins).filter(([n,b],i,a)=>a.findIndex(([k,v])=>H(v)===H(b))===i);
 for(const [n,b]of unique){fs.writeFileSync(dir+'/'+n,b);spec=spec.replace('[genesis.system_cells_lock]',`[[genesis.system_cells]]\nfile = { file = "../${n}" }\ncreate_type_id = false\ncapacity = 100_000_000_000_000\n\n[genesis.system_cells_lock]`);}
 spec=spec.replace('[params]',`[[genesis.issued_cells]]\ncapacity = 100_000_000_000_000\nlock.code_hash = "${lock.codeHash}"\nlock.hash_type = "data2"\nlock.args = "0x"\n\n[params]`);fs.writeFileSync(dir+'/specs/dev.toml',spec);
 let conf=fs.readFileSync(dir+'/ckb.toml','utf8').replace('"Debug", "Terminal"','"Debug", "Terminal", "IntegrationTest"').replaceAll('/ip4/0.0.0.0/','/ip4/127.0.0.1/');conf+=`\n[block_assembler]\ncode_hash = "${H(bins.always)}"\nargs = "0x"\nhash_type = "data"\nmessage = "0x"\n`;fs.writeFileSync(dir+'/ckb.toml',conf);
 result.nodeMaxTxVerifyCycles=Number(conf.match(/max_tx_verify_cycles\s*=\s*([\d_]+)/)[1].replaceAll('_',''));if(result.nodeMaxTxVerifyCycles!==70000000)throw Error('policy changed');
 }
 const log=fs.openSync(dir+'/runtime.log','w');node=cp.spawn(ckb,['run','-C',dir,'--ba-advanced'],{stdio:['ignore',log,log]});let g;
 for(let i=0;i<100;i++){try{g=await rpc('get_block_by_number',['0x0']);if(g)break;}catch{}await pause(200);}if(!g)throw Error('startup');
 for(const t of g.transactions)for(let i=0;i<t.outputs.length;i++){const point={txHash:t.hash,index:hex(i)};for(const n of Object.keys(bins))if(H(B(t.outputs_data[i]))===H(bins[n]))deps[n]={outPoint:point,depType:'code'};if(t.outputs[i].lock.code_hash===lock.codeHash&&t.outputs_data[i]==='0x')wallet={point,capacity:BigInt(t.outputs[i].capacity)};}
 for(let i=0;i<12;i++)await rpc('generate_block');

 let lc,filled,refund,outcomes;
 if(recovered){
  const bs=recovered.transactions.find(r=>r.name==='private-PoS-bootstrap'),last=recovered.transactions.at(-1),ct=recovered.transactions.find(r=>r.name==='private-PoS-certify-0'),typ={codeHash:bs.tx.outputs[0].type.code_hash,hashType:bs.tx.outputs[0].type.hash_type,args:bs.tx.outputs[0].type.args};
  lc={label:'private-PoS',type:typ,identity:U.scriptToHash(typ),point:{txHash:bs.hash,index:'0x0'},data:read('state-0.bin'),certs:new Map([['0',{point:{txHash:ct.hash,index:'0x0'}}]]),roots:[],history:[]};
  const funding=[...recovered.transactions].reverse().find(r=>r.tx.outputs.at(-1).lock.args==='0x'&&r.tx.outputs.at(-1).lock.code_hash===lock.codeHash);wallet={point:{txHash:funding.hash,index:hex(funding.tx.outputs.length-1)},capacity:BigInt(funding.tx.outputs.at(-1).capacity)};
  const updates=recovered.transactions.filter(r=>r.name.startsWith('private-PoS-update-'));
  for(const u of updates){lc.point={txHash:u.hash,index:'0x0'};lc.data=read('state-'+(lc.roots.length+1)+'.bin');const typ=u.tx.outputs[1].type;lc.root={point:{txHash:u.hash,index:'0x1'},type:{codeHash:typ.code_hash,hashType:typ.hash_type,args:typ.args},data:B(u.tx.outputs_data[1])};lc.roots.push(lc.root);}
  filled=recovered.trades.find(t=>t.status===2);refund=recovered.trades.find(t=>t.status===3);
  for(const t of [filled,refund]){
   if(result.settlements.some(x=>x.id===t.id))continue;
   const prior=recovered.transactions.find(r=>r.name.startsWith('REAL-POS-')&&r.tx.inputs[0].previous_output.tx_hash===t.point.txHash);
   if(prior){const received=await live({txHash:prior.hash,index:'0x0'}),spent=await rpc('get_live_cell',[snake(t.point),false]),confirmed=await rpc('get_transaction',[prior.hash]);if(confirmed.tx_status.status!=='committed'||spent.status==='live'||BigInt(received.output.capacity)!==cap)throw Error('unconfirmed prior payout');
    const header=await rpc('get_header',[confirmed.tx_status.block_hash]);result.settlements.push({id:t.id,status:t.status,hash:prior.hash,root:lc.roots[0].point,rootVersion:1,recoveredAfterLaterRootPublication:true,latencyMs:Number(BigInt(header.timestamp))-t.fundedAt,latencyBasis:'CKB committed header timestamp minus original funding host timestamp',principalShannons:cap.toString(),feeShannons:fee.toString(),received,consumedInputStatus:spent.status,recoveredAlreadyCommittedPrincipal:true});save();
   }else await live(t.point);
  }await live(lc.point);await live(wallet.point);
  const abi=JSON.parse(fs.readFileSync(R+'/build/evm.json')).contracts.Outcomes.abi;outcomes=new ethers.Contract(recovered.evm.find(e=>e.name==='deploy-Outcomes').receipt.contractAddress,abi,recipient);
  result.recovery={resumedPersistedFundedCells:[filled.point,refund.point],newEVMTradesCreated:false,newBootstrapCreated:false,source:'persisted native CKB state plus original actual EVM receipts'};save();
 }else{
 lc=await bootstrap('private-PoS');await certify(lc,0n);
 const domain='0x'+sha(Buffer.concat([B(configuration.genesis.genesis_validators_root),B(lc.identity)])).toString('hex');
 const token=await deploy('TestToken',[recipient.address,maker.address]);outcomes=await deploy('Outcomes',[domain]);
 await evm('maker-allowance',token.connect(maker).approve(outcomes.target,1000000000n));
 filled=await openFund(lc,outcomes,token,2,g.header.hash);refund=await openFund(lc,outcomes,token,3,g.header.hash);
 const before=await token.balanceOf(recipient.address);
 await evm('genuine-controlled-token-fill',outcomes.connect(maker).fill(filled.id,token.target,recipient.address,filled.amount));
 const after=await token.balanceOf(recipient.address);if(after-before!==BigInt(filled.amount))throw Error('delivery mismatch');result.tokenDelivery={token:token.target,recipient:recipient.address,before:before.toString(),after:after.toString(),increase:(after-before).toString(),decimals:6};save();
 for(let n=0;n<100;n++){const b=await provider.send('eth_getBlockByNumber',['latest',false]);if(Number(BigInt(b.timestamp))>=refund.deadline)break;await pause(1000);}
 await evm('genuine-unfilled-expiry',outcomes.expire(refund.id));
 const terminal=await provider.send('eth_getBlockByNumber',['latest',false]);result.terminalTimestamp=Number(BigInt(terminal.timestamp));save();
 }
 if(lc.roots.length===0){await obtainUpdate(0,result.terminalTimestamp);await advance(lc,0,false);}
 const authenticatedTradeRoot=lc.roots[0];
 // Later real finality advances while principal remains funded. Old root must work.
 if(lc.roots.length===1){await obtainUpdate(1,result.terminalTimestamp+1);await advance(lc,1,false);}
 for(const t of [filled,refund])if(!result.settlements.some(x=>x.id===t.id))await settle(t,authenticatedTradeRoot,outcomes);
 result.finalState={identity:lc.identity,outPoint:lc.point,data:'0x'+lc.data.toString('hex'),root:lc.root};save();
})().catch(e=>{result.failure=e.stack;save();console.error(e);process.exitCode=1;}).finally(()=>{if(node)node.kill('SIGTERM');});

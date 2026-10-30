// Only constructs candidate transactions. Every authoritative field is checked
// by CKB scripts; no live state/certificate cells are injected into genesis.
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const R=path.resolve(__dirname,'..'),E1=path.resolve(R,'../../wo04-e1'),U=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils');
const H=b=>'0x'+U.blake2b(32,null,null,U.PERSONAL).update(b).digest('hex'),hex=n=>'0x'+BigInt(n).toString(16),B=s=>Buffer.from(s.slice(2),'hex'),le=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;};
const sha=b=>require('crypto').createHash('sha256').update(b).digest();
const snake=x=>Array.isArray(x)?x.map(snake):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),snake(v)])):x;
const pause=ms=>new Promise(r=>setTimeout(r,ms)),read=n=>fs.readFileSync(R+'/fixtures/'+n);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'e2b-chain-')),ckb=E1+'/tools/ckb/ckb';
let node,wallet;const result={scope:'Seven actual state transitions; historical Capella checkpoint; isolated chain only',transactions:[],rejections:[],lineages:[]};
const save=()=>fs.writeFileSync(R+'/evidence/chain-bundle.json',JSON.stringify(result,null,2)+'\n');
const rpc=async(method,params=[])=>{const r=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;};
const bins={};for(const n of ['state','certificate','root','root_probe'])bins[n]=fs.readFileSync(R+'/build/'+n);bins.always=fs.readFileSync(E1+'/config/always_success');
const script=(n,args='0x')=>({codeHash:H(bins[n]),hashType:'data2',args}),lock=script('always'),deps={};
const fee=1000000n,cap=100000000000n;
const output=(capacity,type=null)=>({capacity:hex(capacity),lock,type});
const tx=(inputs,outputs,data,witness,cellDeps)=>({version:'0x0',cellDeps:cellDeps.filter((d,i,a)=>a.findIndex(x=>JSON.stringify(x)===JSON.stringify(d))===i),headerDeps:[],inputs,outputs,outputsData:data.map(b=>'0x'+b.toString('hex')),witnesses:['0x'+witness.toString('hex')]});
const reject=async(name,t,send=false)=>{try{await rpc(send?'send_transaction':'estimate_cycles',send?[snake(t),'passthrough']:[snake(t)]);throw Error('INVALID_ACCEPTED '+name);}catch(e){if(e.message.includes('INVALID_ACCEPTED'))throw e;result.rejections.push({name,error:e.message,method:send?'send_transaction':'estimate_cycles'});save();}};
const commit=async(name,t)=>{const estimate=await rpc('estimate_cycles',[snake(t)]);if(BigInt(estimate.cycles)>70000000n)throw Error('policy exceeded '+name+' '+estimate.cycles);const hash=await rpc('send_transaction',[snake(t),'passthrough']);let status;for(let i=0;i<30;i++){await rpc('generate_block');await pause(100);status=(await rpc('get_transaction',[hash])).tx_status;if(status.status==='committed')break;}if(status.status!=='committed')throw Error('not committed '+name+' '+JSON.stringify(status));const row={name,hash,cycles:Number(BigInt(estimate.cycles)),bytes:(U.serializeTransaction(t).length-2)/2,status,tx:snake(t)};result.transactions.push(row);save();console.log(name,row.cycles,row.bytes);return hash;};
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
 const since=hex(0x4000000000000000n+1606824023n+ss*12n);
 const t=tx([{since,previousOutput:lc.point},{since:'0x0',previousOutput:wallet.point}],outputs,data,witness,[cert?{outPoint:cert.point,depType:'code'}:deps.always,deps.state,deps.root,deps.always]);
 return {t,after,rootAdvance,rootType,remaining:wallet.capacity-(rootAdvance?cap:0n)-fee};
}
async function advance(lc,i,tests=true){
 const {t,after,rootAdvance,rootType,remaining}=updateTx(lc,i);
 if(tests){
  const bad=structuredClone(t),w=B(bad.witnesses[0]);w[1176]^=1;bad.witnesses[0]='0x'+w.toString('hex');await reject('failed-update-'+i,bad);
  const period=structuredClone(t),wb=B(period.witnesses[0]),wrongSlot=wb.readBigUInt64LE(0)+24576n;wb.writeBigUInt64LE(wrongSlot,0);period.inputs[0].since=hex(0x4000000000000000n+1606824023n+12n*wrongSlot);period.witnesses[0]='0x'+wb.toString('hex');await reject('wrong-signing-period-'+i,period);
  const time=structuredClone(t);time.inputs[0].since='0x0';await reject('unbound-signature-time-'+i,time);
  if(i===0){const deleted=tx(t.inputs,[output(cap+wallet.capacity-fee)],[Buffer.alloc(0)],read('update-0.bin'),t.cellDeps);await reject('state-deletion-despite-Type-ID-burn-permission',deleted);}
  if(i===3){const fork=structuredClone(t),fw=B(fork.witnesses[0]),slot=8626177n;fw.writeBigUInt64LE(slot,0);fork.witnesses[0]='0x'+fw.toString('hex');fork.inputs[0].since=hex(0x4000000000000000n+1606824023n+12n*slot);await reject('unsupported-Deneb-fork-rejected-not-reinterpreted',fork);}
  const rollback=structuredClone(t),rd=B(rollback.outputsData[0]);rd.writeBigUInt64LE(lc.data.readBigUInt64LE(80)-1n,80);rollback.outputsData[0]='0x'+rd.toString('hex');await reject('finalized-slot-rollback-'+i,rollback);
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
async function probes(lc,foreign){
 const consumeRoot=tx([{since:'0x0',previousOutput:lc.root.point}],[output(cap-fee)],[Buffer.alloc(0)],Buffer.alloc(0),[deps.root,deps.always]);await reject('immutable-authorized-root-cannot-be-mutated',consumeRoot);
 const lastCert=lc.certs.get('868'),consumeCert=tx([{since:'0x0',previousOutput:lastCert.point}],[output(cap-fee)],[Buffer.alloc(0)],Buffer.alloc(0),[deps.certificate,deps.always]);await reject('immutable-committee-certificate-cannot-be-mutated',consumeCert);
 // A real caller-controlled registry that does NOT execute this light client.
 const fakeType=script('always','0x'+'99'.repeat(32)),fakeIdentity=U.scriptToHash(fakeType),fakeData=Buffer.from(read('state-0.bin'));fakeData.fill(0x11,200,232);
 const ftx=tx([{since:'0x0',previousOutput:wallet.point}],[output(cap,fakeType),output(wallet.capacity-cap-fee)],[fakeData,Buffer.alloc(0)],Buffer.alloc(0),[deps.always]);const fh=await commit('untrusted-registry-negative-control',ftx);wallet={point:{txHash:fh,index:'0x1'},capacity:wallet.capacity-cap-fee};const fp={txHash:fh,index:'0x0'};
 for(const pretend of [false,true]){
  const code=pretend?lc.type.codeHash:fakeType.codeHash,args=Buffer.concat([B(fakeIdentity),B(code),le(0),le(862),fakeData.subarray(200,232)]);
  const c=tx([{since:'0x0',previousOutput:wallet.point}],[output(cap,script('certificate','0x'+args.toString('hex'))),output(wallet.capacity-cap-fee)],[Buffer.alloc(296),Buffer.alloc(0)],read('committee-862.bin'),[{outPoint:fp,depType:'code'},deps.certificate,deps.always]);await reject('caller-selected-registry-cannot-certify-'+pretend,c);
  const next=Buffer.from(fakeData);next.writeBigUInt64LE(1n,72);next.writeBigUInt64LE(next.readBigUInt64LE(80)+1n,80);
  const ra=Buffer.concat([B(fakeIdentity),B(code),le(1),next.subarray(88,120)]),rd=Buffer.concat([sha(Buffer.concat([next.subarray(8,40),B(fakeIdentity)])),next.subarray(120,192)]);
  const r=tx([{since:'0x0',previousOutput:fp},{since:'0x0',previousOutput:wallet.point}],[output(cap,fakeType),output(cap,script('root','0x'+ra.toString('hex'))),output(wallet.capacity-cap-fee)],[next,rd,Buffer.alloc(0)],Buffer.alloc(0),[deps.root,deps.always]);await reject('caller-selected-registry-cannot-publish-'+pretend,r);
 }
 const args=Buffer.concat([B(lc.identity),B(lc.type.codeHash),lc.data.subarray(72,80)]),probe=script('root_probe','0x'+args.toString('hex'));
 const fund=tx([{since:'0x0',previousOutput:wallet.point}],[{capacity:hex(cap),lock:probe,type:null},output(wallet.capacity-cap-fee)],[Buffer.alloc(0),Buffer.alloc(0)],Buffer.alloc(0),[deps.always]);
 const funded=await commit('authorization-probe-funding',fund);wallet={point:{txHash:funded,index:'0x1'},capacity:wallet.capacity-cap-fee};
 const candidate=(root,state=lc.point,w=Buffer.from([0]))=>tx([{since:'0x0',previousOutput:{txHash:funded,index:'0x0'}}],[output(cap-fee)],[Buffer.alloc(0)],w,[{outPoint:root.point,depType:'code'},{outPoint:state,depType:'code'},deps.root_probe]);
 await reject('genuine-unrelated-registry-root',candidate(foreign.root));
 await reject('stale-authorized-root-version',candidate(lc.roots[0]));
 await reject('stale-spent-trust-state',candidate(lc.root,lc.history[0]));
 const source=JSON.parse(fs.readFileSync(E1+'/evidence/source-proofs.json')),env=JSON.parse(fs.readFileSync(E1+'/config/environment.json'));
 const proof=source.batchProof.proof,wire=nodes=>Buffer.concat([Buffer.from([nodes.length&255,nodes.length>>8]),...nodes.flatMap(s=>{const b=B(s);return [Buffer.from([b.length&255,b.length>>8]),b];})]);
 const ethers=require('../../../wo04-e1/node_modules/ethers'),slot=ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32','uint256'],[source.batch,1]));
 const wrongHistory=Buffer.concat([Buffer.from([1]),B(env.outcome),B(env.outcomeCodeHash),B(slot),wire(proof.accountProof),wire(proof.storageProof[0].proof)]);
 await reject('E1-Ganache-proof-under-authenticated-Ethereum-root',candidate(lc.root,lc.point,wrongHistory));
 const illegal=tx([{since:'0x0',previousOutput:wallet.point}],[output(cap,lc.root.type),output(wallet.capacity-cap-fee)],[lc.root.data,Buffer.alloc(0)],Buffer.alloc(0),[deps.root,deps.always]);await reject('root-publication-without-verified-transition',illegal);
 const h=await commit('authorized-current-root-probe-no-principal-settlement',candidate(lc.root));
 result.authorizedRoot={transaction:h,identity:lc.identity,type:lc.root.type,data:'0x'+lc.root.data.toString('hex'),source:'live root output from version 7 state transition',principalSettlementDemonstrated:false};
 const actual=await live(lc.root.point);if(actual.data.content!=='0x'+lc.root.data.toString('hex'))throw Error('published root differs');save();
}
(async()=>{
 cp.execFileSync(ckb,['init','-C',dir,'--chain','dev','--rpc-port','19224','--p2p-port','19225']);let spec=fs.readFileSync(dir+'/specs/dev.toml','utf8');
 const unique=Object.entries(bins).filter(([n,b],i,a)=>a.findIndex(([k,v])=>H(v)===H(b))===i);
 for(const [n,b]of unique){fs.writeFileSync(dir+'/'+n,b);spec=spec.replace('[genesis.system_cells_lock]',`[[genesis.system_cells]]\nfile = { file = "../${n}" }\ncreate_type_id = false\ncapacity = 100_000_000_000_000\n\n[genesis.system_cells_lock]`);}
 spec=spec.replace('[params]',`[[genesis.issued_cells]]\ncapacity = 100_000_000_000_000\nlock.code_hash = "${lock.codeHash}"\nlock.hash_type = "data2"\nlock.args = "0x"\n\n[params]`);fs.writeFileSync(dir+'/specs/dev.toml',spec);
 let conf=fs.readFileSync(dir+'/ckb.toml','utf8').replace('"Debug", "Terminal"','"Debug", "Terminal", "IntegrationTest"').replaceAll('/ip4/0.0.0.0/','/ip4/127.0.0.1/');conf+=`\n[block_assembler]\ncode_hash = "${H(bins.always)}"\nargs = "0x"\nhash_type = "data"\nmessage = "0x"\n`;fs.writeFileSync(dir+'/ckb.toml',conf);
 result.nodeMaxTxVerifyCycles=Number(conf.match(/max_tx_verify_cycles\s*=\s*([\d_]+)/)[1].replaceAll('_',''));if(result.nodeMaxTxVerifyCycles!==70000000)throw Error('policy changed');
 const log=fs.openSync(dir+'/runtime.log','w');node=cp.spawn(ckb,['run','-C',dir,'--ba-advanced'],{stdio:['ignore',log,log]});let g;
 for(let i=0;i<100;i++){try{g=await rpc('get_block_by_number',['0x0']);if(g)break;}catch{}await pause(200);}if(!g)throw Error('startup');
 for(const t of g.transactions)for(let i=0;i<t.outputs.length;i++){const point={txHash:t.hash,index:hex(i)};for(const n of Object.keys(bins))if(H(B(t.outputs_data[i]))===H(bins[n]))deps[n]={outPoint:point,depType:'code'};if(t.outputs[i].lock.code_hash===lock.codeHash&&t.outputs_data[i]==='0x')wallet={point,capacity:BigInt(t.outputs[i].capacity)};}
 for(let i=0;i<12;i++)await rpc('generate_block');
 const lc=await bootstrap('primary');await certify(lc,862n);
 for(let i=0;i<7;i++){
  if(i===1){const wrong=updateTx(lc,i,lc.certs.get('862'));await reject('incorrect-committee-certificate',wrong.t);}
  await advance(lc,i);
  if(i===0){const missing=updateTx(lc,1);await reject('abandoned-certification-no-signing-certificate',missing.t);}
  if(i<6)await certify(lc,lc.data.readBigUInt64LE(192)+1n);
 }
 const foreign=await bootstrap('independent');await certify(foreign,862n,false);await advance(foreign,0,false);await certify(foreign,863n,false);await advance(foreign,1,false);await probes(lc,foreign);
 result.finalState={identity:lc.identity,outPoint:lc.point,data:'0x'+lc.data.toString('hex'),root:lc.root};save();
})().catch(e=>{result.failure=e.stack;save();console.error(e);process.exitCode=1;}).finally(()=>{if(node)node.kill('SIGTERM');});

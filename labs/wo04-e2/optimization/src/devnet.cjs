// Own isolated chain, generated disposable cells, loopback only. No E1 rerun.
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const U=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils');
const R=path.resolve(__dirname,'..'),E1=path.resolve(R,'../../wo04-e1');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'e2-finality-'));
const ckb=E1+'/tools/ckb/ckb',port=19224,n=process.argv[2];if(!['512','511','510'].includes(n))throw Error('fixture required');
const hash=b=>'0x'+U.blake2b(32,null,null,U.PERSONAL).update(b).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const snake=x=>Array.isArray(x)?x.map(snake):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),snake(v)])):x;
const rpc=async(method,params=[])=>{const r=await fetch('http://127.0.0.1:'+port,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;};
let processCKB;
(async()=>{
 cp.execFileSync(ckb,['init','-C',dir,'--chain','dev','--rpc-port',String(port),'--p2p-port','19225']);
 const binary=fs.readFileSync(R+'/build/'+n+'/affine-multi'),always=fs.readFileSync(E1+'/config/always_success');
 const codeHash=hash(binary),lock={codeHash,hashType:'data2',args:'0x'};
 let spec=fs.readFileSync(dir+'/specs/dev.toml','utf8');
 for(const [name,b]of [['e2_finality',binary],['e2_always',always]]){fs.writeFileSync(dir+'/'+name,b);spec=spec.replace('[genesis.system_cells_lock]',`[[genesis.system_cells]]\nfile = { file = "../${name}" }\ncreate_type_id = false\ncapacity = 100_000_000_000_000\n\n[genesis.system_cells_lock]`);}
 spec=spec.replace('[params]',`[[genesis.issued_cells]]\ncapacity = 100_000_000_000_000\nlock.code_hash = "${codeHash}"\nlock.hash_type = "data2"\nlock.args = "0x"\n\n[params]`);fs.writeFileSync(dir+'/specs/dev.toml',spec);
 let conf=fs.readFileSync(dir+'/ckb.toml','utf8').replace('"Debug", "Terminal"','"Debug", "Terminal", "IntegrationTest"').replaceAll('/ip4/0.0.0.0/','/ip4/127.0.0.1/');
 conf+=`\n[block_assembler]\ncode_hash = "${hash(always)}"\nargs = "0x"\nhash_type = "data"\nmessage = "0x"\n`;fs.writeFileSync(dir+'/ckb.toml',conf);
 const log=fs.openSync(dir+'/runtime.log','w');processCKB=cp.spawn(ckb,['run','-C',dir,'--ba-advanced'],{stdio:['ignore',log,log]});
 let genesis;
 for(let i=0;i<80;i++){try{genesis=await rpc('get_block_by_number',['0x0']);if(genesis)break;}catch{}await pause(250);}
 if(!genesis)throw Error('CKB startup failed; see '+dir+'/runtime.log');
 let dep,funding,capacity;
 for(const t of genesis.transactions)for(let i=0;i<t.outputs.length;i++){
  if(hash(Buffer.from(t.outputs_data[i].slice(2),'hex'))===codeHash)dep={txHash:t.hash,index:'0x'+i.toString(16)};
  if(t.outputs[i].lock.code_hash===codeHash){funding={txHash:t.hash,index:'0x'+i.toString(16)};capacity=BigInt(t.outputs[i].capacity);}
 }
 if(!dep||!funding)throw Error('Genesis E2 cells missing');
 const tx={version:'0x0',cellDeps:[{outPoint:dep,depType:'code'}],headerDeps:[],inputs:[{since:'0x0',previousOutput:funding}],outputs:[{capacity:'0x'+(capacity-1000000n).toString(16),lock,type:null}],outputsData:[JSON.parse(fs.readFileSync(R+'/fixtures/'+n+'-output.json')).data],witnesses:['0x'+fs.readFileSync(R+'/fixtures/'+n+'.bin').toString('hex')]};
 const negative={};for(const label of ['key','index','proof','duplicate','noncanonical_g1','infinity_signature','output']){const p=R+'/build/'+n+'/bad-multi-'+label+'.json';if(!fs.existsSync(p))continue;const b=JSON.parse(fs.readFileSync(p));const bad=structuredClone(tx);bad.witnesses=b.tx.witnesses;bad.outputsData=b.tx.outputs_data;try{await rpc('estimate_cycles',[snake(bad)]);throw Error('INVALID_ACCEPTED '+label);}catch(e){if(e.message.includes('INVALID_ACCEPTED'))throw e;negative[label]=e.message;}}
 const estimate=await rpc('estimate_cycles',[snake(tx)]);
 const accepted=await rpc('send_transaction',[snake(tx),'passthrough']);
 for(let i=0;i<5;i++)await rpc('generate_block');
 const observed=await rpc('get_transaction',[accepted]);
 const result={participants:Number(n),negative,scope:'Local isolated E2 harness admission; not complete on-chain consensus trust state or E1 payout',chainDirectory:dir,estimate,accepted,observedStatus:observed.tx_status,transactionBytes:(U.serializeTransaction(tx).length-2)/2,feeShannons:'1000000',outputValidator:'passthrough (script verification retained)',nodeMaxTxVerifyCycles:70000000};
 fs.writeFileSync(R+'/evidence/devnet-'+n+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 if(observed.tx_status.status!=='committed')throw Error('Not committed');
})().catch(e=>{fs.writeFileSync(R+'/evidence/devnet-'+n+'-error.txt',e.stack+'\n');console.error(e);process.exitCode=1;}).finally(()=>{if(processCKB)processCKB.kill('SIGTERM');});

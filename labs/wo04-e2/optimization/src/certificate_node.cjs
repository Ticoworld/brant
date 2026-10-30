// Authentic bootstrap certificate + repeated read-only reuse. No finalized output.
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const O=path.resolve(__dirname,'..'),E1=path.resolve(O,'../../wo04-e1'),U=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'e2-committee-')),ckb=E1+'/tools/ckb/ckb';
const H=b=>'0x'+U.blake2b(32,null,null,U.PERSONAL).update(b).digest('hex'),hex=x=>'0x'+BigInt(x).toString(16),pause=ms=>new Promise(r=>setTimeout(r,ms));
const snake=x=>Array.isArray(x)?x.map(snake):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),snake(v)])):x;
const rpc=async(method,params=[])=>{const r=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;};
let node;const results={scope:'Immutable bootstrap committee authentication and read-only reuse only; no root publication or rotation',transactions:[],rejections:{}};
(async()=>{
 cp.execFileSync(ckb,['init','-C',dir,'--chain','dev','--rpc-port','19224','--p2p-port','19225']);
 const bins={committee:fs.readFileSync(O+'/build/committee'),reuse:fs.readFileSync(O+'/build/reuse'),always:fs.readFileSync(E1+'/config/always_success')};
 const script=n=>({codeHash:H(bins[n]),hashType:'data2',args:'0x'}),lock=script('always'),type=script('committee');
 let spec=fs.readFileSync(dir+'/specs/dev.toml','utf8');
 for(const [n,b]of Object.entries(bins)){fs.writeFileSync(dir+'/'+n,b);spec=spec.replace('[genesis.system_cells_lock]',`[[genesis.system_cells]]\nfile = { file = "../${n}" }\ncreate_type_id = false\ncapacity = 100_000_000_000_000\n\n[genesis.system_cells_lock]`);}
 spec=spec.replace('[params]',`[[genesis.issued_cells]]\ncapacity = 100_000_000_000_000\nlock.code_hash = "${lock.codeHash}"\nlock.hash_type = "data2"\nlock.args = "0x"\n\n[params]`);fs.writeFileSync(dir+'/specs/dev.toml',spec);
 let conf=fs.readFileSync(dir+'/ckb.toml','utf8').replace('"Debug", "Terminal"','"Debug", "Terminal", "IntegrationTest"').replaceAll('/ip4/0.0.0.0/','/ip4/127.0.0.1/');
 conf+=`\n[block_assembler]\ncode_hash = "${H(bins.always)}"\nargs = "0x"\nhash_type = "data"\nmessage = "0x"\n`;fs.writeFileSync(dir+'/ckb.toml',conf);
 const log=fs.openSync(dir+'/runtime.log','w');node=cp.spawn(ckb,['run','-C',dir,'--ba-advanced'],{stdio:['ignore',log,log]});
 let g;for(let i=0;i<100;i++){try{g=await rpc('get_block_by_number',['0x0']);if(g)break;}catch{}await pause(200);}if(!g)throw Error('node startup');
 const deps={};let funding;
 for(const t of g.transactions)for(let i=0;i<t.outputs.length;i++){const point={txHash:t.hash,index:hex(i)};for(const n of Object.keys(bins))if(H(Buffer.from(t.outputs_data[i].slice(2),'hex'))===H(bins[n]))deps[n]={outPoint:point,depType:'code'};if(t.outputs[i].lock.code_hash===lock.codeHash&&t.outputs_data[i]==='0x')funding=point;}
 const tx=(input,outputs,data,witness,cellDeps)=>({version:'0x0',cellDeps,headerDeps:[],inputs:[{since:'0x0',previousOutput:input}],outputs,outputsData:data,witnesses:[witness]});
 const reject=async(name,t)=>{try{await rpc('estimate_cycles',[snake(t)]);throw Error('INVALID_ACCEPTED');}catch(e){if(e.message.includes('INVALID_ACCEPTED'))throw e;results.rejections[name]=e.message;}};
 const commit=async(name,t)=>{const cycles=await rpc('estimate_cycles',[snake(t)]);if(BigInt(cycles.cycles)>70000000n)throw Error('policy exceeded');const h=await rpc('send_transaction',[snake(t),'passthrough']);for(let i=0;i<5;i++)await rpc('generate_block');const status=(await rpc('get_transaction',[h])).tx_status;if(status.status!=='committed')throw Error('not committed');results.transactions.push({name,hash:h,cycles:Number(BigInt(cycles.cycles)),bytes:(U.serializeTransaction(t).length-2)/2,status});return h;};
 const datum='0x'+fs.readFileSync(O+'/fixtures/certificate-output.bin').toString('hex'),witness='0x'+fs.readFileSync(O+'/fixtures/certificate.bin').toString('hex');
 const A=tx(funding,[{capacity:hex(100000000000n),lock,type},{capacity:hex(99899999000000n),lock:script('reuse'),type:null}],[datum,'0x'],witness,[deps.committee,deps.always]);
 const bad=structuredClone(A);bad.witnesses[0]='0x'+Buffer.alloc(448).toString('hex');await reject('forged_bootstrap',bad);
 const altered=structuredClone(A);altered.outputsData[0]='0x'+Buffer.alloc(264).toString('hex');await reject('substituted_certificate',altered);
 const ah=await commit('authenticated_constructor',A),cert={txHash:ah,index:'0x0'};
 const B=tx({txHash:ah,index:'0x1'},[{capacity:hex(99899998000000n),lock:script('reuse'),type:null}],['0x'],'0x',[{outPoint:cert,depType:'code'},deps.reuse]);
 const no=structuredClone(B);no.cellDeps[0]=deps.always;await reject('wrong_certificate_identity',no);
 const bh=await commit('reuse_one',B);
 const C=structuredClone(B);C.inputs[0].previousOutput={txHash:bh,index:'0x0'};C.outputs[0].capacity=hex(99899997000000n);await commit('reuse_two',C);
 const spend=tx(cert,[{capacity:hex(99999000000n),lock,type:null}],['0x'],witness,[deps.committee,deps.always]);await reject('spend_or_mutate_immutable_certificate',spend);
 results.certificateLive=(await rpc('get_live_cell',[snake(cert),true])).status;results.maxTxVerifyCycles=70000000;results.finalizedExecutionRootsPublished=0;
 fs.writeFileSync(O+'/evidence/certificate-node.json',JSON.stringify(results,null,2)+'\n');console.log(results);
})().catch(e=>{fs.writeFileSync(O+'/evidence/certificate-node-error.txt',e.stack+'\n');console.error(e);process.exitCode=1;}).finally(()=>{if(node)node.kill('SIGTERM');});

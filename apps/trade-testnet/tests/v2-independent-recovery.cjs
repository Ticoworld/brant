'use strict';
// Disposable private-node acceptance only. No private keys are written to disk.
const fs=require('node:fs'); const path=require('node:path'); const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const nativeRoot=process.env.TRADE_NATIVE_ROOT, bootstrapPath=process.env.V2_LOCAL_BOOTSTRAP;
if(!nativeRoot||!bootstrapPath)throw Error('Set TRADE_NATIVE_ROOT and V2_LOCAL_BOOTSTRAP');
const native=require(path.join(nativeRoot,'src/lib.cjs'));
const bootstrap=JSON.parse(fs.readFileSync(bootstrapPath,'utf8'));
const out=path.join(__dirname,'../evidence',`v2-independent-recovery-${Date.now()}`);fs.mkdirSync(out,{recursive:true});
const snake=s=>({code_hash:s.codeHash,hash_type:s.hashType,args:s.args});
const custody=path.join(out,'custody.json'),token=path.join(out,'token.json'),bundle=path.join(out,'history.json'),report=path.join(out,'withdrawal.json');
fs.writeFileSync(custody,JSON.stringify(snake(bootstrap.scripts.custody))); fs.writeFileSync(token,JSON.stringify(snake(bootstrap.scripts.token)));
const owner=native.U.scriptToHash(native.locks[1]);
const cli=path.join(root,'labs/trade-v2-token/gate2/recovery/recover.cjs');
function run(args,env=process.env){const p=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env,maxBuffer:16*1024*1024});if(p.status!==0)throw Error(`recovery failed: ${p.stderr}`);return p.stdout;}
run(['collect-blocks','--node','http://127.0.0.1:19224','--init',bootstrap.initializationTransactionHash,'--owner',owner,'--custody-lock',custody,'--xudt-type',token,'--out',bundle]);
const output=run(['withdraw','--node','http://127.0.0.1:19224','--bundle',bundle,'--out',report,'--sdk-root',nativeRoot,'--mine'],{...process.env,TRADE_RECOVERY_PRIVATE_KEY:native.keys[1]});
run(['verify-withdrawal','--node','http://127.0.0.1:19224','--report',report,'--sdk-root',nativeRoot]);
console.log(output.trim()); console.log(`Independent recovery evidence: ${out}`);

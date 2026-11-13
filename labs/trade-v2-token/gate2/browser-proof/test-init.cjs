const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const dir=process.env.ROVEKO_INIT_EVIDENCE || path.join(__dirname,'../evidence/native-1794484243927');
const fixture=JSON.parse(fs.readFileSync(path.join(dir,'browser-bootstrap.json')));
const event=fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').trim().split('\n').map(JSON.parse).find(x=>x.label==='initial_curve_purchase');
const witness=event.tx.witnesses[3];
const req={domain:fixture.scripts.custody.args,owner:'0x'+witness.slice(26,90),new_root:'0x'+event.tx.outputsData[2].slice(34),witness,quantity:'7',price:'9100000000'};
function run(input){return spawnSync('cargo',['run','--quiet','--locked','--offline','--manifest-path',path.join(__dirname,'Cargo.toml'),'--','verify-init','-'],{input:JSON.stringify(input),encoding:'utf8'});}
const ok=run(req);assert.equal(ok.status,0,ok.stderr);assert.equal(JSON.parse(ok.stdout).verified,true);
const proofIndex=2+108*2, altered=req.witness.slice(0,proofIndex)+(req.witness.slice(proofIndex,proofIndex+2)==='00'?'ff':'00')+req.witness.slice(proofIndex+2);
for(const bad of [{...req,new_root:'0x'+'11'.repeat(32)},{...req,quantity:'8'},{...req,owner:'0x'+'22'.repeat(32)},{...req,witness:altered},{...req,witness:req.witness.slice(0,-2)+'ff'}]) assert.notEqual(run(bad).status,0);
console.log('Initial proof verification and mutation checks passed');

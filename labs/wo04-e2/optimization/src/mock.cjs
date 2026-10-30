const fs=require('fs'),path=require('path');
const O=path.resolve(__dirname,'..'),U=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils');
const hash=b=>'0x'+U.blake2b(32,null,null,U.PERSONAL).update(b).digest('hex');
const snake=x=>Array.isArray(x)?x.map(snake):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),snake(v)])):x;
function make(n,mode,witness,output){
 const bin=fs.readFileSync(O+`/build/${n}/${mode}`),lock={codeHash:hash(bin),hashType:'data2',args:'0x'},out={capacity:'0x5af3107a4000',lock,type:null};
 const input={since:'0x0',previousOutput:{txHash:'0x'+'11'.repeat(32),index:'0x0'}},dep={outPoint:{txHash:'0x'+'22'.repeat(32),index:'0x0'},depType:'code'};
 const tx={version:'0x0',cellDeps:[dep],headerDeps:[],inputs:[input],outputs:[out],outputsData:['0x'+output.toString('hex')],witnesses:['0x'+witness.toString('hex')]};
 return {dump:{mock_info:{inputs:[{input:snake(input),output:snake(out),data:'0x',header:null}],cell_deps:[{cell_dep:snake(dep),output:snake(out),data:'0x'+bin.toString('hex'),header:null}],header_deps:[]},tx:snake(tx)},metrics:{transactionBytes:(U.serializeTransaction(tx).length-2)/2,witnessBytes:witness.length,binaryBytes:bin.length,minOutputCapacityCKB:145,minCodeCellCapacityCKB:bin.length+41}};
}
const metrics=[];
for(const n of ['512','511','510'])for(const mode of ['compressed','affine','profile-c','profile-a','affine-multi','profile-multi']){
 const w=fs.readFileSync(O+`/fixtures/${n}.bin`),o=fs.readFileSync(O+`/fixtures/${n}-output.bin`),v=make(n,mode,w,o);metrics.push({n,mode,...v.metrics});
 fs.writeFileSync(O+`/build/${n}/${mode}.json`,JSON.stringify(v.dump));
 if(mode!=='affine'&&mode!=='affine-multi')continue;
 const bp=mode==='affine'?'bad-':'bad-multi-';
 const cases={signature:b=>{b[1176]^=1;},outcome:b=>{b[296]^=1;},bitfield:b=>{b[1112]^=1;},affine_commitment:b=>{b[1272]^=1;},noncanonical_g1:b=>{b.fill(255,1272,1320);},infinity_signature:b=>{b.fill(0,1176,1272);b[1176]=0xc0;b.fill(0,1368,1560);b[1368]=0x40;}};
 if(n!=='512'){
  cases.key=b=>{b[1563]^=1;};cases.index=b=>{b[1561]^=1;};cases.proof=b=>{b[1707]^=1;};
 }
 if(n==='510')cases.duplicate=b=>{b.copy(b,1995,1561,1995);};
 for(const [label,f]of Object.entries(cases)){const b=Buffer.from(w);f(b);fs.writeFileSync(O+`/build/${n}/${bp}${label}.json`,JSON.stringify(make(n,mode,b,o).dump));}
 if(n==='512'){const torsion=fs.readFileSync(O+'/fixtures/signature-oncurve-nonsubgroup.bin');fs.writeFileSync(O+`/build/${n}/${bp}oncurve-nonsubgroup.json`,JSON.stringify(make(n,mode,torsion,o).dump));const other=fs.readFileSync(O+'/fixtures/511.bin'),different=Buffer.from(w);other.copy(different,1176,1176,1272);other.copy(different,1368,1368,1560);fs.writeFileSync(O+`/build/${n}/${bp}wrong-valid-signature.json`,JSON.stringify(make(n,mode,different,o).dump));}
 const bad=Buffer.alloc(104);fs.writeFileSync(O+`/build/${n}/${bp}output.json`,JSON.stringify(make(n,mode,w,bad).dump));
}
fs.writeFileSync(O+'/evidence/sizes.json',JSON.stringify(metrics,null,2)+'\n');

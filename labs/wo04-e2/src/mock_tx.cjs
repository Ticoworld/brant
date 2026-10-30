// Isolated debugger transaction. Not broadcast, not a live-cell acceptance claim.
const fs=require('fs'),path=require('path');
const U=require('../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils');
const R=path.resolve(__dirname,'..');
const fast=process.argv.includes('--fast'),prefix=fast?'fast-':'';
const bin=fs.readFileSync(R+'/build/'+(fast?'fast64':'witness64'));
const codeHash='0x'+U.blake2b(32,null,null,U.PERSONAL).update(bin).digest('hex');
const lock={codeHash,hashType:'data2',args:'0x'};
const input={since:'0x0',previousOutput:{txHash:'0x'+'11'.repeat(32),index:'0x0'}};
const cellDep={outPoint:{txHash:'0x'+'22'.repeat(32),index:'0x0'},depType:'code'};
const output={capacity:'0x174876e800',lock,type:null};
const data=JSON.parse(fs.readFileSync(R+'/evidence/e1-root-adapter.json')).data;
const tx={version:'0x0',cellDeps:[cellDep],headerDeps:[],inputs:[input],outputs:[output],outputsData:[data],witnesses:['0x'+fs.readFileSync(R+'/fixtures/vm-update'+(fast?'-fast':'')+'.bin').toString('hex')]};
const snake=x=>Array.isArray(x)?x.map(snake):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),snake(v)])):x;
const dump={mock_info:{inputs:[{input:snake(input),output:snake(output),data:'0x',header:null}],cell_deps:[{cell_dep:snake(cellDep),output:snake(output),data:'0x'+bin.toString('hex'),header:null}],header_deps:[]},tx:snake(tx)};
fs.writeFileSync(R+'/build/mock-'+prefix+'valid.json',JSON.stringify(dump));
const wire=U.serializeTransaction(tx);
fs.writeFileSync(R+'/evidence/'+prefix+'transaction-size.json',JSON.stringify({transactionBytes:(wire.length-2)/2,witnessBytes:(tx.witnesses[0].length-2)/2,codeCellBytes:bin.length,scope:'Mock transaction, code deployed separately; no live admission or capacity accounting'},null,2)+'\n');
const bad=structuredClone(dump);bad.tx.outputs_data[0]='0x'+Buffer.alloc(104).toString('hex');
fs.writeFileSync(R+'/build/mock-'+prefix+'wrong-root.json',JSON.stringify(bad));
for(const [name,offset] of [['signature',fast?1271:25815],['state-root',8+112+112+64],['committee',1032],['bits',fast?1112:25656]]){
 const d=structuredClone(dump),b=Buffer.from(d.tx.witnesses[0].slice(2),'hex');b[offset]^=1;d.tx.witnesses[0]='0x'+b.toString('hex');fs.writeFileSync(R+'/build/mock-'+prefix+name+'.json',JSON.stringify(d));
}

const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../../..'),app=path.join(root,'apps/trade-testnet'),native=path.join(root,'labs/rebuild/native');
const b=require(path.resolve(process.argv[2])),out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
const C=require(path.join(native,'src/lib.cjs'));
const {ccc}=require(path.join(app,'node_modules/@ckb-ccc/core'));
const {cccA}=require('module').createRequire(path.join(app,'package.json'))('@ckb-ccc/core/advanced');
const sign=require(path.join(native,'node_modules/@nervosnetwork/ckb-sdk-core/lib/signWitnessGroup.js')).default;
const node=process.env.WO2_EXIT_RPC || 'http://127.0.0.1:19224',fund=b.initial[4],owner=C.U.scriptToHash(fund.lock);
assert.equal(owner,C.U.scriptToHash(C.locks[1]));
function write(n,v){fs.writeFileSync(path.join(out,n+'.json'),JSON.stringify(v,null,2));return path.join(out,n+'.json')}
function run(args,match){const p=spawnSync(process.execPath,['--experimental-strip-types',path.join(app,'lib/v2-engine/pudge-recover.cjs'),...args],{encoding:'utf8'}); if(match){assert.notEqual(p.status,0);assert.match(p.stderr,match);return;} if(p.status!==0)throw Error(p.stderr);console.log(p.stdout.trim());}
const base=['--node',node],collect=[...base,'--init',b.initializationTransactionHash,'--owner',owner,'--custody-lock',write('custody',{code_hash:b.scripts.custody.codeHash,hash_type:b.scripts.custody.hashType,args:b.scripts.custody.args}),'--xudt-type',write('token',{code_hash:b.scripts.token.codeHash,hash_type:b.scripts.token.hashType,args:b.scripts.token.args})];
const before=path.join(out,'before.json');run(['collect-blocks',...collect,'--out',before]);
const shared=[...base,'--bundle',before,'--owner-lock',write('owner',fund.lock),'--funding-outpoint',fund.outPoint.txHash+':'+fund.outPoint.index,'--sdk-root',native];
const review=path.join(out,'review.json');run(['prepare-withdrawal',...shared,'--out',review]);
const r=require(review), t=r.transaction;assert.equal(r.quantity,'7');assert.equal(r.fee,'1000000');assert.equal(r.external_occupied_capacity,'14200000000');assert.equal(r.change_capacity,'106698000000');assert.deepEqual(t.outputs[2].lock,{code_hash:fund.lock.codeHash,hash_type:fund.lock.hashType,args:fund.lock.args});assert.equal(t.inputs[2].previous_output.tx_hash,fund.outPoint.txHash);assert.equal(t.inputs[2].previous_output.index,fund.outPoint.index);assert.match(t.witnesses[3],/^0x544d5331/);
const toSigned=(tx,role)=>{const p=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(tx));p.witnesses[2]=sign(C.keys[role],p.hash(),[{lock:'',inputType:'',outputType:''},...p.witnesses.slice(3)])[0];return cccA.JsonRpcTransformers.transactionFrom(p)};
const submit=(file,name,match)=>run(['submit-signed-withdrawal',...shared,'--signed',file,'--out',path.join(out,name+'.json'),'--mine'],match);
submit(write('wrong-signer',toSigned(t,2)),'wrong-signer-receipt',/signature does not match/i);
const signed=toSigned(t,1);
for(const [name,change,match] of [
 ['destination',x=>{x.outputs[2].lock=x.outputs[0].lock},/changed reviewed transaction/],
 ['funding',x=>{x.inputs[2].previous_output.index='0x0'},/changed reviewed transaction/],
 ['fee',x=>{x.outputs[3].capacity='0xdeadbeef'},/changed reviewed transaction/],
 ['witness',x=>{x.witnesses[3]='0x'},/changed reviewed witnesses/],
 ['rejected-signing',x=>{x.witnesses[2]='0x'},/signature witness/],
]){const candidate=structuredClone(signed);change(candidate);submit(write(name,candidate),name+'-receipt',match);}
const f=write('signed',signed);
if (process.env.WO2_EXPECT_LOST_RESPONSE) {
  submit(f,'receipt',/fetch failed/);
  assert.equal(require(path.join(out,'receipt.json')).status,'submission-unknown');
} else {
  submit(f,'receipt');
}
const receipt=path.join(out,'receipt.json');run(['verify-withdrawal',...base,'--report',receipt,'--sdk-root',native]);
submit(f,'duplicate',/not live|not the current/i);
const after=path.join(out,'after.json');run(['collect-blocks',...collect,'--out',after]);
const result=require(after+'.result.json');assert.equal(String(result.owner.balance),'0');
const afterArgs=shared.map(a=>a===before?after:a);run(['prepare-withdrawal',...afterArgs,'--out',path.join(out,'repeat.json')],/no positive owner withdrawal/);
console.log(JSON.stringify({hash:require(receipt).transaction_hash,cycles:require(receipt).cycles,owner:result.owner,custody:result.custody_amount,receipt:require(receipt).verification},null,2));

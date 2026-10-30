// Creates defensive native test candidates and obtains real READ-ONLY proofs.
// No Ethereum transaction. These are NOT completed additional swap orders.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const R=path.resolve(__dirname,'..'),U=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils'),CKB=require('../../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-core').default,ethers=require('../../../wo04-e1/node_modules/ethers');
const j=JSON.parse(fs.readFileSync(R+'/evidence/chain-live-02.json')),B=s=>Buffer.from(s.slice(2),'hex'),hex=n=>'0x'+BigInt(n).toString(16),le=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b;},sha=b=>crypto.createHash('sha256').update(b).digest(),H=b=>'0x'+U.blake2b(32,null,null,U.PERSONAL).update(b).digest('hex');
const camel=x=>x==='dep_group'?'depGroup':Array.isArray(x)?x.map(camel):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),camel(v)])):x;
const fund=camel(j.transactions.find(r=>r.name==='USER-CKB-FUND-unfilled').tx),settlement=camel(j.transactions.find(r=>r.name==='USER-INDEPENDENT-EMPTY-SLOT-REFUND').tx),proofRecord=j.proofs.at(-1),baseArgs=B(j.trades.find(t=>t.label==='unfilled').args);
let wallet={txHash:j.transactions.find(r=>r.name==='USER-CKB-FUND-unfilled').hash,index:'0x1'},capacity=BigInt(fund.outputs[1].capacity);
const fee=1000000n,principal=100000000000n,key='0x'+'0'.repeat(63)+'4';
const nodes=ns=>Buffer.concat([Buffer.from([ns.length&255,ns.length>>8]),...ns.flatMap(s=>{const b=B(s);return [Buffer.from([b.length&255,b.length>>8]),b];})]);
const wire=p=>Buffer.concat([nodes(p.accountProof),nodes(p.storageProof[0].proof)]);
const cases=[];
for(const name of ['missing-account','wrong-code-hash','alternate-Ethereum-chain','alternate-genesis','alternate-registry','invalid-deadline','deadline-equality','future-trust-version','wrong-funding-identity']){
 const first={since:'0x0',previousOutput:wallet},type={...fund.outputs[0].type,args:H(Buffer.concat([B(U.serializeInput(first)),le(0)]))},a=Buffer.from(baseArgs);B(U.scriptToHash(type)).copy(a,192);
 let expected;
 if(name==='missing-account'){a.fill(0,64,96);Buffer.from('abcdefabcdefabcdefabcdefabcdefabcdefabcd','hex').copy(a,76);expected=70;}
 if(name==='wrong-code-hash'){a[480]^=1;expected=71;}
 if(name==='alternate-Ethereum-chain'){a[63]^=1;expected=19;}
 if(name==='alternate-genesis'){a[96]^=1;expected=103;}
 if(name==='alternate-registry'){a[128]^=1;expected=101;}
 if(name==='invalid-deadline'){a.fill(0,416,448);expected=13;}
 if(name==='deadline-equality'){a.fill(0,416,448);a.writeBigUInt64BE(BigInt(proofRecord.block.timestamp),440);expected=21;}
 if(name==='future-trust-version'){le(99).copy(a,512);expected=101;}
 if(name==='wrong-funding-identity'){baseArgs.subarray(192,224).copy(a,192);expected=16;}
 const id='0x'+sha(a.subarray(0,480)).toString('hex'),address='0x'+a.subarray(76,96).toString('hex'),slot=ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['bytes32','uint256'],[id,0]));
 const proof=JSON.parse(cp.execFileSync(R+'/../.venv/bin/python',[R+'/src/get_proof.py',address,slot,proofRecord.block.number],{encoding:'utf8'}));
 const f={version:'0x0',cellDeps:fund.cellDeps,headerDeps:[],inputs:[first],outputs:[{...fund.outputs[0],type,lock:{...fund.outputs[0].lock,args:'0x'+a.toString('hex')}},{capacity:hex(capacity-principal-fee-fee),lock:fund.outputs[1].lock,type:null}],outputsData:['0x','0x'],witnesses:[{lock:'',inputType:'',outputType:''}]};
 const signed=new CKB().signTransaction(key)(f),hash=U.rawTransactionToHash(signed),candidate={...settlement,inputs:[{since:'0x0',previousOutput:{txHash:hash,index:'0x0'}}],witnesses:['0x'+Buffer.concat([Buffer.from([0]),B(proofRecord.timestampProof),wire(proof)]).toString('hex')]};
 cases.push({name,funding:signed,hash,candidate,expectedScriptExit:expected,proof,slot,independentReadOnly:true});wallet={txHash:hash,index:'0x1'};capacity-=principal+fee+fee;
}
const destination=R+'/fixtures/defensive-controls.json',encoded=JSON.stringify({source:'captured exact E2 finalized execution block; independent signer-free eth_getProof process',cases},null,2)+'\n';if(fs.existsSync(destination)&&fs.readFileSync(destination,'utf8')!==encoded)throw Error('refuse control overwrite');fs.writeFileSync(destination,encoded);
console.log(cases.map(x=>[x.name,x.expectedScriptExit]));

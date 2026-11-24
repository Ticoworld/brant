// Public fixture key; isolated test only.
import assert from 'node:assert/strict';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {prepareCodeDeployment} from '../lib/v2-engine/deployment.ts';
import {verifyInitializationSignature} from '../lib/v2-engine/initialization-signature.ts';
const privateKey='0x'+'00'.repeat(31)+'01',pub='0x0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const lock={codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:ccc.hashCkbShort(pub)};
const cell=(i:number)=>({outPoint:{txHash:'0x'+i.toString(16).padStart(64,'0'),index:'0x0'},capacity:10000000000n,lock,data:'0x'});
const data='0x'+'12'.repeat(60),dep={outPoint:{txHash:'0x'+'aa'.repeat(32),index:'0x0'},depType:'depGroup'};
const result=prepareCodeDeployment([{name:'code',data,expectedDataHash:ccc.hashCkb(data)}],[cell(1),cell(2)],lock,dep,1000n);assert.equal(result.status,'review');if(result.status!=='review')throw Error('Missing review');
assert.equal(result.selected.length,2);assert.equal(result.transaction.witnesses.length,2);
const h=new ccc.HasherCkb();h.update(result.hash);ccc.Transaction.hashWitnessToHasher(ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex(),h);ccc.Transaction.hashWitnessToHasher('0x',h);
const signature=ccc.signMessageSecp256k1(h.digest(),privateKey),signed=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(cccA.JsonRpcTransformers.transactionFrom(result.transaction)));
signed.witnesses[0]=ccc.WitnessArgs.from({lock:signature}).toHex();assert(verifyInitializationSignature(result.transaction,signed,result.selected,0,ccc.Script.from(lock).hash()));
signed.witnesses[1]='0x12';assert.throws(()=>verifyInitializationSignature(result.transaction,signed,result.selected,0,ccc.Script.from(lock).hash()),/witness/);
console.log('multiple-input deployment signature checks passed');
// Atomic xUDT issuance uses outputType in the creator's first lock witness.
const atomicReview=result.transaction.clone();
atomicReview.witnesses[0]=ccc.WitnessArgs.from({outputType:'0x123456',inputType:'0xabcd'}).toHex();
const atomicHasher=new ccc.HasherCkb();atomicHasher.update(atomicReview.hash());
ccc.Transaction.hashWitnessToHasher(ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65),outputType:'0x123456',inputType:'0xabcd'}).toHex(),atomicHasher);
ccc.Transaction.hashWitnessToHasher(atomicReview.witnesses[1]||'0x',atomicHasher);
const atomicSigned=atomicReview.clone();
atomicSigned.witnesses[0]=ccc.WitnessArgs.from({lock:ccc.signMessageSecp256k1(atomicHasher.digest(),privateKey),outputType:'0x123456',inputType:'0xabcd'}).toHex();
assert(verifyInitializationSignature(atomicReview,atomicSigned,result.selected,0,ccc.Script.from(lock).hash()));
for(const field of ['inputType','outputType'] as const){
 const tampered=atomicSigned.clone(),args=tampered.getWitnessArgs(0)!;args[field]='0xdead';tampered.witnesses[0]=args.toHex();
 assert.throws(()=>verifyInitializationSignature(atomicReview,tampered,result.selected,0,ccc.Script.from(lock).hash()),/witness/);
}
console.log('reviewed issuance witness fields are signed and mutation rejected');

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ccc} from '@ckb-ccc/core';
import {verifyPudgeWitness} from '../lib/pudge-wallet-verify.ts';

// Disposable test key; never used on a public chain.
const key='0x'+'01'.padStart(64,'0');
const sampleDigest='0x'+'42'.repeat(32), sampleSig=ccc.signMessageSecp256k1(sampleDigest,key);
const owner=ccc.hashCkbShort(ccc.recoverMessageSecp256k1(sampleDigest,sampleSig));
const lock={codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type' as const,args:owner};
const code=readFileSync('../../labs/wo15-merkle-intent/r7/build/merkle_intent');
assert.equal(code.length,51072);assert.equal(ccc.hashCkb(code),'0x6870b841e2b873ca563b95313bcac6f20e299d17c395e1f907d0723d4fa16c36');
const blank=ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex();
const tx=ccc.Transaction.from({inputs:[{previousOutput:{txHash:'0x'+'11'.repeat(32),index:0}}],outputs:[{capacity:5113300000000n,lock},{capacity:6100000000n,lock}],outputsData:[ccc.hexFrom(code),'0x'],cellDeps:[{outPoint:{txHash:'0x'+'22'.repeat(32),index:0},depType:'depGroup'}],witnesses:[blank]});
const hash=tx.hash(),h=new ccc.HasherCkb();h.update(hash);ccc.Transaction.hashWitnessToHasher(blank,h);const signature=ccc.signMessageSecp256k1(h.digest(),key);tx.witnesses=[ccc.WitnessArgs.from({lock:signature}).toHex()];
assert.equal(verifyPudgeWitness(tx,hash,owner),true);
const edited=ccc.Transaction.from(JSON.parse(JSON.stringify(tx,(_,v)=>typeof v==='bigint'?v.toString():v)));edited.outputs[1].capacity-=1n;assert.throws(()=>verifyPudgeWitness(edited,hash,owner));
const altered=ccc.Transaction.from(JSON.parse(JSON.stringify(tx,(_,v)=>typeof v==='bigint'?v.toString():v)));altered.outputsData[0]='0x00';assert.throws(()=>verifyPudgeWitness(altered,hash,owner));
assert.throws(()=>verifyPudgeWitness(tx,hash,'0x'+'33'.repeat(20)));
console.log('R7 deployment signature and mutation cases passed');

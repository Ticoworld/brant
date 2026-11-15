import assert from 'node:assert/strict';
import {ccc} from '@ckb-ccc/core';
import {verifyPudgeWitness} from '../lib/pudge-wallet-verify.ts';
const key='0x'+'01'.padStart(64,'0');
const tx=ccc.Transaction.from({inputs:[{previousOutput:{txHash:'0x'+'11'.repeat(32),index:0}}],outputs:[],outputsData:[],cellDeps:[],witnesses:['0x']});
const raw=tx.hash(),blank=ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex(),h=new ccc.HasherCkb();h.update(raw);ccc.Transaction.hashWitnessToHasher(blank,h);const digest=h.digest(),sig=ccc.signMessageSecp256k1(digest,key),pub=ccc.recoverMessageSecp256k1(digest,sig),owner=ccc.hashCkbShort(pub);
tx.witnesses=[ccc.WitnessArgs.from({lock:sig}).toHex()];assert.equal(verifyPudgeWitness(tx,raw,owner),true);assert.throws(()=>verifyPudgeWitness(tx,raw,'0x'+'22'.repeat(20)));assert.throws(()=>verifyPudgeWitness(tx,'0x'+'33'.repeat(32),owner));
console.log('Standard-lock witness verification passed');

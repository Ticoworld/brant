import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ccc } from '@ckb-ccc/core';
import { saleMessage, verifyAuthorization } from '../lib/r7-authorization.ts';

const require=createRequire(import.meta.url);
const canonical=require('../../../labs/wo15-merkle-intent/r7/intent.cjs');
const signer=new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(), '0x'+'01'.padStart(64,'0'));
const publicKey=ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1('identity'),await signer.signMessageRaw('identity'));
const seller=ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:ccc.hashCkbShort(publicKey)}).hash();
const terms={genesis:'0x'+'01'.repeat(32),vault:'0x'+'02'.repeat(32),covenant:'0x'+'03'.repeat(32),position:'0',seller,principal:'125000000',backing:'100000000',revision:'1',price:'8000000000'};
assert.equal(saleMessage(terms),canonical.saleMessage(terms));
const signature=await signer.signMessageRaw(saleMessage(terms));
assert.equal(verifyAuthorization(terms,signature).lock.hash(),seller);
assert.throws(()=>verifyAuthorization({...terms,price:'8000000001'},signature));
assert.throws(()=>verifyAuthorization({...terms,seller:'0x'+'04'.repeat(32)},signature));
assert.throws(()=>verifyAuthorization({...terms,revision:'2'},signature));
console.log('CCC R7 authorization helper passed');

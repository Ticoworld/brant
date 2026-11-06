'use strict';
const assert=require('node:assert/strict');
const {ccc}=require('@ckb-ccc/core');
const {saleMessage}=require('../../../labs/wo15-merkle-intent/r7/intent.cjs');
(async()=>{
 const signer=new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(),'0x'+'1'.padStart(64,'0'));
 const pub=ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1('identity'),await signer.signMessageRaw('identity'));
 const seller=ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:ccc.hashCkbShort(pub)}).hash();
 const terms={genesis:'0x'+'11'.repeat(32),vault:'0x'+'22'.repeat(32),covenant:'0x'+'33'.repeat(32),seller,position:'1',principal:'100',backing:'80',revision:'2',price:'6100000000'};
 const signature=await signer.signMessageRaw(saleMessage(terms));
 const r=await fetch('http://127.0.0.1:3000/api/r7/message-check',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({terms,signature})});
 const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));assert.equal(data.verified,true);assert.equal(data.publicKey,pub);console.log(JSON.stringify(data));
})().catch(e=>{console.error(e);process.exitCode=1});

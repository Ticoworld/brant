'use strict';
const {ccc}=require('../../../apps/trade-testnet/node_modules/@ckb-ccc/core');
const {saleMessage}=require('../r7/intent.cjs');
const {run}=require('./run.cjs');
(async()=>{
 const signer=new ccc.SignerCkbPrivateKey(new ccc.ClientPublicTestnet(),'0x'+'1'.padStart(64,'0'));
 const pub=ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1('x'),await signer.signMessageRaw('x'));
 const seller=ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:ccc.hashCkbShort(pub)}).hash();
 const terms={genesis:'0x'+'11'.repeat(32),vault:'0x'+'22'.repeat(32),covenant:'0x'+'33'.repeat(32),seller,position:'1',principal:'100',backing:'80',revision:'2',price:'6100000000'};
 const signature=await signer.signMessageRaw(saleMessage(terms));
 console.log(JSON.stringify(await run({terms,signature})));
})().catch(e=>{console.error(e);process.exitCode=1});

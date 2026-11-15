'use strict';
// A fresh isolated devnet executes the actual R7 verification routine.
const path=require('path');
const net=require('net');
const {Engine,cell,assert,C}=require('../../wo09-e2-capacity/src/engine.cjs');
const {saleMessage}=require('../r7/intent.cjs');
const {ccc}=require('../../../apps/trade-testnet/node_modules/@ckb-ccc/core');
async function run(input){
 const {terms:t,signature}=input;
 const message=saleMessage(t);
 if(!/^0x[0-9a-fA-F]{130}$/.test(signature))throw Error('Invalid signature length');
 const pub=ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(message),signature);
 const payload=Buffer.concat([C.b(t.genesis),C.b(t.vault),C.b(t.covenant),C.b(t.seller),C.le(BigInt(t.principal)),C.le(BigInt(t.backing)),C.le(BigInt(t.revision)),C.le(BigInt(t.position)),C.le(BigInt(t.price)),C.b(pub),C.b(signature)]);
 assert.equal(payload.length,266);
 await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(Error('Private node port 19224 is already in use')));s.listen(19224,'127.0.0.1',()=>s.close(resolve));});
 const e=new Engine('r7-message-check');
 try{
  await e.start();if((await e.rpc('get_blockchain_info')).chain!=='ckb_dev')throw Error('Not a private CKB devnet');await e.deploy('check',path.resolve(__dirname,'build/check'));
  const wallet=e.wallets[2],lock=e.codes.check.script,cap=100n*C.UNIT;
  const created=await e.send('create_check_cell',e.sign(e.tx([wallet],[cell(cap,lock),cell(wallet.capacity-cap-C.fee,C.locks[2])],[e.dep('check')]),[wallet],[2]));
  const tx=e.tx([created[0]],[cell(cap-10000n,C.locks[2])],[e.dep('check')],['0x',C.hx(payload)]);
  const bad=Buffer.from(payload);bad[160]^=1;
  const altered=structuredClone(tx);altered.witnesses[1]=C.hx(bad);
  await e.reject('modified_price',altered,/Inputs\[0\]\.Lock.*error code 85 on/);
  await e.send('verify_external_message',tx);
  e.close();return {verified:true,scope:'isolated R7 signature and lock identity only; no sale or funded position',publicKey:pub,evidence:e.out};
 }catch(err){e.close(err);throw err;}
}
if(require.main===module){let raw='';process.stdin.setEncoding('utf8');process.stdin.on('data',x=>raw+=x);process.stdin.on('end',()=>run(JSON.parse(raw)).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1}));}
module.exports={run};

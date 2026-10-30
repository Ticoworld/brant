const C=require('./common.cjs');
(async()=>{const [mode,role,file]=process.argv.slice(2),keys=C.read(C.ROOT+'/config/test-keys.json'),v=C.read(file);let out;
 if(mode==='terms')out={signature:await new C.ethers.Wallet(keys[role].key).signMessage(C.ethers.getBytes(v.digest))};
 else if(mode==='ckb')out=new C.CKB('http://127.0.0.1:18214').signTransaction(keys[role].key)(v);
 else if(mode==='evm'){const from=new C.ethers.Wallet(keys[role].key).address;const nonce=Number(BigInt(await C.rpc('evm','eth_getTransactionCount',[from,'pending'])));out={raw:await new C.ethers.Wallet(keys[role].key).signTransaction({to:v.to,data:v.data,value:0,chainId:31337,nonce,gasLimit:BigInt(v.gasLimit||1000000),gasPrice:2000000000n})};}
 else throw Error('mode');console.log(JSON.stringify(out));})().catch(e=>{console.log(JSON.stringify({error:e.message}));process.exitCode=1;});

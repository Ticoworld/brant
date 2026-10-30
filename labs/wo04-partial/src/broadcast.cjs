const C=require('./common.cjs');
(async()=>{const [chain,file,drop]=process.argv.slice(2),v=C.read(file);let out;
 if(chain==='ckb'){const hash=C.U.rawTransactionToHash(v);C.write(file+'.submitted.json',{chain,hash});const result=await C.rpc('ckb','send_transaction',[C.snake(v),'passthrough']);out={hash,result};}
 else {const hash=C.ethers.keccak256(v.raw);C.write(file+'.submitted.json',{chain,hash});await C.rpc('evm','eth_sendRawTransaction',[v.raw]);let receipt;for(let i=0;i<100;i++){receipt=await C.rpc('evm','eth_getTransactionReceipt',[hash]);if(receipt)break;await C.sleep(20);}out={hash,receipt};}
 if(drop==='drop'){console.log(JSON.stringify({unknown:true,note:'response deliberately discarded after node accepted',journal:file+'.submitted.json'}));process.exitCode=75;return;}console.log(JSON.stringify(out));})().catch(e=>{console.log(JSON.stringify({error:e.message,rpc:e.rpc}));process.exitCode=1;});

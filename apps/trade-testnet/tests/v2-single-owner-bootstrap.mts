// Isolated-node fixture preparation only. Never use fixture keys on Pudge.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
const require=createRequire(import.meta.url),root=process.env.TRADE_NATIVE_ROOT,source=process.env.ROVEKO_INIT_BOOTSTRAP,destination=process.env.ROVEKO_SINGLE_OWNER_BOOTSTRAP;
assert(root&&source&&destination,'Set native root, source and new destination');
assert(!fs.existsSync(destination),'Destination must be new');
const C=require(path.join(root,'src/lib.cjs'));
const signGroup=require(path.join(root,'node_modules/@nervosnetwork/ckb-sdk-core/lib/signWitnessGroup.js')).default;
const f=JSON.parse(fs.readFileSync(source,'utf8'));
const rpc=async(method:string,params:unknown[]=[])=>{const response=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const result=await response.json();if(result.error)throw Error(JSON.stringify(result.error));return result.result;};
assert.equal((await rpc('get_blockchain_info')).chain,'ckb_dev');
assert.equal(await rpc('get_block_hash',['0x0']),f.genesis);
assert.notEqual(f.genesis,'0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606');
const block=await rpc('get_block_by_number',['0x0']),owner=f.wallets[2],live=await rpc('get_live_cell',[C.snake(owner.outPoint),true]);
assert.equal(live.status,'live');assert.equal(live.cell.data.content,'0x');assert(!live.cell.output.type);
const unit=100_000_000n,anchor=1000n*unit,setup=5000n*unit,fee=1_000_000n,total=BigInt(live.cell.output.capacity),remainder=total-anchor-setup-fee;
assert(remainder>120000n*unit);
const tx=ccc.Transaction.from({inputs:[{previousOutput:owner.outPoint}],outputs:[{capacity:anchor,lock:owner.lock},{capacity:remainder,lock:owner.lock},{capacity:setup,lock:owner.lock}],outputsData:['0x','0x','0x'],cellDeps:[{outPoint:{txHash:block.transactions[1].hash,index:'0x0'},depType:'depGroup'}],witnesses:['0x']});
const raw=C.camel(cccA.JsonRpcTransformers.transactionFrom(tx));for(const d of raw.cellDeps)if(d.depType==='dep_group')d.depType='depGroup';
raw.witnesses[0]=signGroup(C.keys[2],C.U.rawTransactionToHash(raw),[{lock:'',inputType:'',outputType:''}])[0];
const signed=C.snake(raw);await rpc('estimate_cycles',[signed]);const hash=await rpc('send_transaction',[signed,'passthrough']);
let result:any;for(let i=0;i<30;i++){await rpc('generate_block');result=await rpc('get_transaction',[hash]);if(result?.tx_status?.status==='committed')break;}
assert.equal(result?.tx_status?.status,'committed');assert.equal(await rpc('get_block_hash',[result.tx_status.block_number]),result.tx_status.block_hash);
const wallets=[];for(let i=0;i<3;i++){const outPoint={txHash:hash,index:'0x'+i.toString(16)},cell=await rpc('get_live_cell',[C.snake(outPoint),true]);assert.equal(cell.status,'live');wallets.push({...C.camel(cell.cell.output),capacity:BigInt(cell.cell.output.capacity).toString(),data:cell.cell.data.content,outPoint});}
fs.writeFileSync(destination,JSON.stringify({...f,wallets,preparation:{transactionHash:hash,blockHash:result.tx_status.block_hash}},null,2),{flag:'wx'});
console.log('Single-owner fixture split confirmed; bootstrap written to '+destination);

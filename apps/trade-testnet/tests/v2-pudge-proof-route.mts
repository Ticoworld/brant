// Simulated localhost RPC; no public transaction or fixture key is used.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer} from 'node:http';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {POST as initialProof} from '../lib/v2-engine/retired-api/v2-pudge-init-proof.ts';
import {POST as tradeProof} from '../lib/v2-engine/retired-api/v2-pudge-proof.ts';
import {POST as journey} from '../lib/v2-engine/retired-api/v2-pudge-journey.ts';
import {validatePublicJourney} from '../lib/v2-engine/public-journey-validation.ts';
import {createPudgeManifest} from '../lib/v2-engine/pudge-manifest.ts';
assert(process.env.TRADE_NATIVE_ROOT&&process.env.ROVEKO_SMT_BINARY&&process.env.ROVEKO_PROOF_BINARY&&process.env.ROVEKO_RECOVERY_COLLECTOR,'Set test dependencies');
const source=process.env.ROVEKO_PUDGE_EVIDENCE||path.resolve('evidence/v2-pudge-browser-1794645638090/transactions.json'),bundle=JSON.parse(fs.readFileSync(source,'utf8'));
const genesis=bundle.genesis,block=bundle.wizard.entries[0].blockHash,entries=bundle.transactions as {hash:string;transaction:any}[],lookup=new Map(entries.map((e,i)=>[e.hash,{...e,index:i}]));
const secp='0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',xudt='0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f',secpData='0x020000008f8c79eb6671709633fe6a46de93c0fedc9c1b8a6527a18d3983879542635c9f030000008f8c79eb6671709633fe6a46de93c0fedc9c1b8a6527a18d3983879542635c9f01000000',xdata='0x'+fs.readFileSync(path.join(process.env.TRADE_NATIVE_ROOT,'vendor/ickb/build/release/xudt')).toString('hex');
const spent=new Set<string>();for(const e of entries)for(const i of e.transaction.inputs)spent.add(`${i.previous_output.tx_hash}:${BigInt(i.previous_output.index)}`);
const rpc=async(method:string,params:any[])=>{
 if(method==='get_block_hash')return params[0]==='0x0'?genesis:block;
 if(method==='get_header'||method==='get_tip_header')return {hash:block,number:'0x1'};
 if(method==='get_block_by_number')return {header:{hash:block,number:'0x1',parent_hash:genesis},transactions:entries.map(e=>({...e.transaction,hash:e.hash}))};
 if(method==='get_transaction'){const e=lookup.get(params[0]);return e?{transaction:{...e.transaction,hash:e.hash},tx_status:{status:'committed',block_hash:block,block_number:'0x1',tx_index:'0x'+e.index.toString(16)}}:null;}
 if(method==='get_live_cell'){const p=params[0];if(p.tx_hash===secp)return {status:'live',cell:{data:{content:secpData,hash:ccc.hashCkb(secpData)}}};if(p.tx_hash===xudt)return {status:'live',cell:{data:{content:xdata,hash:ccc.hashCkb(xdata)}}};const e=lookup.get(p.tx_hash),i=Number(BigInt(p.index));if(!e?.transaction.outputs[i]||spent.has(`${p.tx_hash}:${BigInt(p.index)}`))return {status:'dead'};const data=e.transaction.outputs_data[i];return {status:'live',cell:{output:e.transaction.outputs[i],data:{content:data,hash:ccc.hashCkb(data)}}};}
 throw Error('Unexpected RPC '+method);
};
const server=createServer(async(req,res)=>{try{let body='';for await(const c of req)body+=c;const q=JSON.parse(body),result=await rpc(q.method,q.params||[]);res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result}));}catch(e){res.statusCode=500;res.end(String(e));}});
await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
try{
 const addr=server.address();assert(addr&&typeof addr==='object');Object.assign(process.env,{NODE_ENV:'test'});process.env.NEXT_PUBLIC_PUDGE_TEST_HOOK='1';process.env.ROVEKO_PUDGE_TEST_RPC=`http://127.0.0.1:${addr.port}`;
 const code=entries[2],split=entries[1],owner=bundle.wizard.owner,attempt={version:1 as const,genesis,owner,txHash:code.hash,codeHashes:code.transaction.outputs_data.slice(0,5).map((d:string)=>ccc.hashCkb(d)),state:'confirmed' as const,blockHash:block,anchor:{txHash:split.hash,index:'0x0'}};
 const first=async(anchor:{txHash:string;index:string},ownerHash:string)=>{const response=await initialProof(new Request('http://127.0.0.1/api/v2/pudge-init-proof',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({anchor,owner:ownerHash})}));assert.equal(response.status,200);return response.json();};
 const manifest=await createPudgeManifest(rpc,attempt,bundle.wizard,first,false),body={manifest,owner,side:'buy',quantity:'1'};
 const request=()=>new Request('http://127.0.0.1/api/v2/pudge-proof',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify(body)});
 const response=await tradeProof(request());assert.equal(response.status,200,await response.clone().text());const result=await response.json(),last=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(entries.at(-1)!.transaction));
 assert.equal(result.genesis,genesis);assert.equal(result.proof.old_root,'0x'+last.outputsData[2].slice(34));assert.equal(result.proof.owner.balance,'7');assert.equal(result.proof.tip_outpoint.tx_hash,last.hash());
 const jr=await journey(new Request('http://127.0.0.1/api/v2/pudge-journey',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({manifest,owner})}));assert.equal(jr.status,200,await jr.clone().text());const recovered=await jr.json();assert.equal(recovered.balance,'7');assert.equal(recovered.tip.tx_hash,last.hash());assert(recovered.transitions.some((t:{op:number})=>t.op===0));
 const locks=[manifest.scripts.market,manifest.scripts.market,manifest.scripts.custody,manifest.scripts.custody],types=[manifest.scripts.token,manifest.scripts.marker,manifest.scripts.token,manifest.scripts.custodyMarker];const snake=(v:ccc.Script)=>({code_hash:v.codeHash,hash_type:v.hashType,args:v.args});const live={cells:locks.map((lock,i)=>({output:{lock:snake(lock),type:snake(types[i])}})),custodyRoot:recovered.root} as never;validatePublicJourney(live,manifest,recovered.root);assert.throws(()=>validatePublicJourney(live,manifest,'0x'+'11'.repeat(32)),/stale/);const wrongIdentity={cells:locks.map((lock,i)=>({output:{lock:snake(i===0?manifest.scripts.custody:lock),type:snake(types[i])}})),custodyRoot:recovered.root} as never;assert.throws(()=>validatePublicJourney(wrongIdentity,manifest,recovered.root),/identity/);const wrongOwner='0x'+'99'.repeat(32);const wr=await journey(new Request('http://127.0.0.1/api/v2/pudge-journey',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({manifest,owner:wrongOwner})}));if(wr.ok){const foreign=await wr.json();assert.equal(foreign.balance,'0');assert.equal(foreign.transitions.length,0);}else assert.equal(wr.status,503);
 process.env.ROVEKO_PUDGE_TEST_RPC='https://testnet.ckb.dev/';assert.equal((await tradeProof(request())).status,503);
 console.log('Pudge proof route reconstruction passed (localhost simulated RPC; no public submission)');
}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}

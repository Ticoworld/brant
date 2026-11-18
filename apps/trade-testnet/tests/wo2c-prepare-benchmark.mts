// Public Pudge read-only benchmark. Stops at the unsigned wallet review.
import {ccc} from '@ckb-ccc/core';
import {prepareLocalReview} from '../lib/v2-engine/local-review.ts';
import {loadPudgeManifest} from '../lib/v2-engine/pudge-manifest.ts';
import {verifyPudgeInitialProof} from '../lib/v2-engine/pudge-proof-client.ts';

const base='http://127.0.0.1:3000';
const original=globalThis.fetch;
const market=await (await original(base+'/api/markets')).json();
const owner=process.env.ROVEKO_BENCH_OWNER||market.manifest.attempt.owner;
const cells=await (await original('https://testnet.ckb.dev/',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method:'get_transaction',params:[market.manifest.initializationTransactionHash]}),
})).json();
const lock=cells.result.transaction.outputs[4].lock;
const script=ccc.Script.from({codeHash:lock.code_hash,hashType:lock.hash_type,args:lock.args});
let legacy=false,requests=0;
globalThis.fetch=async(input,init)=>{
  requests++;
  const url=new URL(String(input),base);
  const headers=new Headers(init?.headers);
  headers.set('origin',base);
  headers.set('sec-fetch-site','same-origin');
  const response=await original(url,{...init,headers});
  if(legacy&&response.ok&&url.pathname==='/api/v2/pudge-proof'){
    const payload=await response.json();
    delete payload.points;
    return Response.json(payload);
  }
  return response;
};
const rpc=async(method:string,params:unknown[])=>{
  const response=await fetch('/api/v2/pudge-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,params})});
  const body=await response.json();
  if(!response.ok)throw Error(body.error);
  return body.result;
};
for(const path of ['legacy','verified'] as const){
  legacy=path==='legacy';
  requests=0;
  const start=performance.now(),stages:Record<string,number>={};
  try{
    const manifest=legacy?await loadPudgeManifest(rpc,JSON.stringify(market.manifest),verifyPudgeInitialProof):market.manifest;
    stages.clientManifestMs=Math.round(performance.now()-start);
    await prepareLocalReview(rpc,manifest,owner,'buy',2n,script,(name,ms)=>{stages[name]=Math.round(ms);});
    console.log(path,'unsigned review ready',{requests,totalMs:Math.round(performance.now()-start),...stages});
  }catch(error){
    console.log(path,'failed',{requests,totalMs:Math.round(performance.now()-start),...stages,error:String(error)});
    process.exitCode=1;
  }
}

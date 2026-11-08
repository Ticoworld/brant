import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {localRequest} from '../../../../lib/r7-local-request';
import {DatabaseSync} from 'node:sqlite';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(process.env.PUDGE_R7_DEPLOY_REVIEW!=='1'||!localRequest(req))return new Response('Disabled',{status:403});
 try{const {hash}=await req.json();if(typeof hash!=='string'||!/^0x[0-9a-f]{64}$/.test(hash))throw Error('Invalid hash');const db=new DatabaseSync(path.resolve(process.cwd(),'pudge-deployment-attempts.sqlite'));try{if(!db.prepare('SELECT hash FROM attempts WHERE hash=?').get(hash))throw Error('Not a recorded deployment attempt')}finally{db.close()}
 const call=async(method:string,params:unknown[])=>{const r=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store'});const j=await r.json();if(!r.ok||j.error)throw Error('Pudge RPC unavailable');return j.result};
 const [genesis,t]=await Promise.all([call('get_block_by_number',['0x0']),call('get_transaction',[hash])]);if(genesis.header.hash!=='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606')throw Error('Wrong network');
 const status=t?.tx_status?.status||'unknown';if(status!=='committed')return Response.json({status});
 if(!t.transaction||ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(t.transaction)).hash()!==hash)throw Error('Committed transaction hash mismatch');
 const [live,code]=await Promise.all([call('get_live_cell',[{tx_hash:hash,index:'0x0'},true]),readFile(path.resolve(process.cwd(),'../../labs/wo15-merkle-intent/r7/build/merkle_intent'))]);
 const o=live.cell?.output,d=live.cell?.data?.content,expected='0x6870b841e2b873ca563b95313bcac6f20e299d17c395e1f907d0723d4fa16c36';
 if(live.status!=='live'||d!==ccc.hexFrom(code)||ccc.hashCkb(d)!==expected||BigInt(o?.capacity||0)!==5113300000000n||o?.lock?.code_hash!=='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'||o.lock.hash_type!=='type'||o.lock.args!=='0x36ef38ed06300fa0f357f1f360b897c476c5c4f9'||o.type)throw Error('Committed output differs from reviewed R7 code cell');
 const change=t.transaction.outputs?.[1];if(t.transaction.outputs.length!==2||!change||JSON.stringify(change.lock)!==JSON.stringify(o.lock)||change.type||t.transaction.outputs_data?.[1]!=='0x'||BigInt(change.capacity)<6100000000n)throw Error('Committed change output mismatch');
 const manifest={network:'pudge',genesis:genesis.header.hash,codeHash:expected,outPoint:{txHash:hash,index:'0x0'}};const file=path.resolve(process.cwd(),'r7-pudge-verified.json'),content=JSON.stringify(manifest,null,2);try{await writeFile(file,content,{flag:'wx'})}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST'||await readFile(file,'utf8')!==content)throw Error('Existing deployment manifest differs; manual review required')}return Response.json({status:'verified',manifest});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Verification failed'},{status:400});}
}

import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ccc} from '@ckb-ccc/core';
import {localRequest} from '../../../lib/r7-local-request';
import {verifyPudgeWitness} from '../../../lib/pudge-wallet-verify';
import {cccA} from '@ckb-ccc/core/advanced';
import {DatabaseSync} from 'node:sqlite';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const expected='0x6870b841e2b873ca563b95313bcac6f20e299d17c395e1f907d0723d4fa16c36';
const lock={codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type' as const,args:'0x36ef38ed06300fa0f357f1f360b897c476c5c4f9'};
export async function GET(req:Request){
 if(process.env.PUDGE_R7_DEPLOY_REVIEW!=='1'||!localRequest(req))return new Response('Disabled',{status:403});
 try{
 const call=async(method:string,params:unknown[])=>{const r=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store'});const j=await r.json();if(!r.ok||j.error)throw Error(j.error?.message||'Pudge RPC unavailable');return j.result};
 const [genesis,cell,dep,pool,code]=await Promise.all([call('get_block_by_number',['0x0']),call('get_live_cell',[{tx_hash:'0x3fa9dd0155936e0dacc9bf5e57a4785c3d6d66191a7560f1ff5ec6a6b04954f3',index:'0x2'},true]),call('get_live_cell',[{tx_hash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:'0x0'},true]),call('tx_pool_info',[]),readFile(path.resolve(process.cwd(),'../../labs/wo15-merkle-intent/r7/build/merkle_intent'))]);
 if(genesis.header.hash!=='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606'||cell.status!=='live'||dep.status!=='live')throw Error('Wrong network or unavailable input/dependency');
 const o=cell.cell.output;if(o.lock.code_hash!==lock.codeHash||o.lock.hash_type!=='type'||o.lock.args!==lock.args||o.type||cell.cell.data.content!=='0x'||BigInt(o.capacity)!==9999986100000n)throw Error('Funding cell differs from review');
 const data=ccc.hexFrom(code);if(code.length!==51072||ccc.hashCkb(data)!==expected)throw Error('R7 binary mismatch');
 const capacity=5113300000000n,rate=BigInt(pool.min_fee_rate)*2n;if(rate<2000n||rate>200000n)throw Error('Fee rate outside review bounds');
 const make=(fee:bigint)=>ccc.Transaction.from({inputs:[{previousOutput:{txHash:'0x3fa9dd0155936e0dacc9bf5e57a4785c3d6d66191a7560f1ff5ec6a6b04954f3',index:2}}],outputs:[{capacity,lock},{capacity:9999986100000n-capacity-fee,lock}],outputsData:[data,'0x'],cellDeps:[{outPoint:{txHash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:0},depType:'depGroup'}],witnesses:[ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex()]});
 const size=BigInt(make(0n).toBytes().length),fee=(size*rate+999n)/1000n;if(9999986100000n-capacity-fee<6100000000n)throw Error('Insufficient change');const tx=make(fee);
 return Response.json({genesis:genesis.header.hash,codeHash:expected,codeBytes:code.length,feeRate:rate.toString(),fee:fee.toString(),size:size.toString(),input:'9999986100000',capacity:capacity.toString(),change:(9999986100000n-capacity-fee).toString(),hash:tx.hash(),transaction:JSON.parse(JSON.stringify(tx,(_,v)=>typeof v==='bigint'?v.toString():v))});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Review unavailable'},{status:503});}
}
export async function POST(req:Request){
 if(process.env.PUDGE_R7_DEPLOY_REVIEW!=='1'||process.env.PUDGE_R7_BROADCAST_ENABLED!=='1'||!localRequest(req)||!req.headers.get('origin')||req.headers.get('content-type')!=='application/json')return new Response('Disabled',{status:403});
 try{
  const body=await req.text();if(body.length>250000)throw Error('Request too large');const tx=ccc.Transaction.from(JSON.parse(body));
  const check=await GET(req);const fresh=await check.json();if(!check.ok||tx.hash()!==fresh.hash)throw Error('Input, fee or transaction changed; review again');verifyPudgeWitness(tx,fresh.hash);
  const db=new DatabaseSync(path.resolve(process.cwd(),'pudge-deployment-attempts.sqlite'));try{db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS attempts (hash TEXT PRIMARY KEY, attempted INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS funding_guard (funding TEXT PRIMARY KEY, hash TEXT NOT NULL)');db.exec('BEGIN IMMEDIATE');try{const inserted=db.prepare('INSERT OR IGNORE INTO funding_guard VALUES (?,?)').run('0x3fa9dd0155936e0dacc9bf5e57a4785c3d6d66191a7560f1ff5ec6a6b04954f3:2',fresh.hash);if(!inserted.changes)throw Error('Funding input already attempted; reconcile before retry');db.prepare('INSERT INTO attempts VALUES (?,?)').run(fresh.hash,Date.now());db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}finally{db.close()}
  const r=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'send_transaction',params:[cccA.JsonRpcTransformers.transactionFrom(tx),'passthrough']})});
  const j=await r.json();if(!r.ok||j.error||j.result!==fresh.hash)throw Error('Submission outcome requires reconciliation for '+fresh.hash);
  return Response.json({hash:fresh.hash,status:'submitted'});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Submission outcome unknown'},{status:400});}
}

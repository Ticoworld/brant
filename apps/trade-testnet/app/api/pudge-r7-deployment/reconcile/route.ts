import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {localRequest} from '../../../../lib/r7-local-request';
export const runtime='nodejs';export const dynamic='force-dynamic';
const funding='0x3fa9dd0155936e0dacc9bf5e57a4785c3d6d66191a7560f1ff5ec6a6b04954f3:2';
export async function POST(req:Request){
 if(process.env.PUDGE_R7_DEPLOY_REVIEW!=='1'||!localRequest(req)||!req.headers.get('origin')||req.headers.get('content-type')!=='application/json')return new Response('Disabled',{status:403});
 try{const {hash}=await req.json();if(typeof hash!=='string'||!/^0x[0-9a-f]{64}$/.test(hash))throw Error('Invalid transaction hash');
 const call=async(method:string,params:unknown[])=>{const r=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store'});const j=await r.json();if(!r.ok||j.error)throw Error('Pudge RPC unavailable');return j.result};
 const [g,t,cell]=await Promise.all([call('get_block_by_number',['0x0']),call('get_transaction',[hash]),call('get_live_cell',[{tx_hash:funding.slice(0,-2),index:'0x2'},false])]);
 if(g?.header?.hash!=='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606')throw Error('Wrong network');
 const status=t?.tx_status?.status||'unknown';let retryAllowed=false;
 if(status==='rejected'&&cell?.status==='live'){
  const db=new DatabaseSync(path.resolve(process.cwd(),'pudge-deployment-attempts.sqlite'));try{db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');try{const row=db.prepare('SELECT hash FROM funding_guard WHERE funding=?').get(funding) as {hash:string}|undefined;if(row?.hash!==hash)throw Error('Attempt does not match funding guard');db.prepare('DELETE FROM funding_guard WHERE funding=? AND hash=?').run(funding,hash);db.exec('COMMIT');retryAllowed=true}catch(e){db.exec('ROLLBACK');throw e}}finally{db.close()}
 }
 return Response.json({status,fundingStatus:cell?.status||'unknown',retryAllowed});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Reconciliation unavailable'},{status:503});}
}

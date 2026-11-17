import {execFile} from 'node:child_process';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {loadPudgeManifest} from '../../../../lib/v2-engine/pudge-manifest.ts';
import {POST as initialProof} from '../pudge-init-proof/route.ts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const run=promisify(execFile),hash=/^0x[0-9a-f]{64}$/i;
function rpcEndpoint(){
 if(process.env.NODE_ENV!=='production'&&process.env.NEXT_PUBLIC_PUDGE_TEST_HOOK==='1'&&process.env.ROVEKO_PUDGE_TEST_RPC){const url=new URL(process.env.ROVEKO_PUDGE_TEST_RPC);if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password)throw Error('Test RPC must be local');return url.toString();}
 return 'https://testnet.ckb.dev/';
}
/** Read-only, bounded Pudge custody history reconstruction. No signing or
 * transaction submission is performed by this endpoint. */
export async function POST(request:Request){
 let dir:string|undefined;
 try{
  const host=request.headers.get('host')||'',origin=request.headers.get('origin'),url=new URL(`http://${host}`);
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||(origin&&origin!==url.origin))return new Response('Local origin required',{status:403});
  const text=await request.text();if(text.length>65536)return new Response('Request too large',{status:400});
  const body=JSON.parse(text) as {owner?:string;manifest?:unknown};
  if(!hash.test(body.owner||'')||!body.manifest)return new Response('Invalid proof request',{status:400});
  const binary=process.env.ROVEKO_PROOF_BINARY;if(!binary)return new Response('Proof tool unavailable',{status:503});const endpoint=rpcEndpoint();
  const rpc=async(method:string,params:unknown[])=>{const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store',signal:AbortSignal.timeout(15000)});const row=await response.json();if(!response.ok||row.error)throw Error('Pudge RPC failed');return row.result;};
  const proof=async(anchor:{txHash:string;index:string},owner:string)=>{const r=await initialProof(new Request('http://127.0.0.1/api/v2/pudge-init-proof',{method:'POST',headers:{host:'127.0.0.1',origin:'http://127.0.0.1','content-type':'application/json'},body:JSON.stringify({anchor,owner})}));if(!r.ok)throw Error('Initial proof unavailable');return r.json();};
  const manifest=await loadPudgeManifest(rpc,JSON.stringify(body.manifest),proof);
  dir=await mkdtemp(path.join(tmpdir(),'roveko-pudge-proof-'));
  const custody=path.join(dir,'custody.json'),token=path.join(dir,'token.json'),bundle=path.join(dir,'bundle.json');
  const snake=(s:{codeHash:string;hashType:string;args:string})=>({code_hash:s.codeHash,hash_type:s.hashType,args:s.args});
  await Promise.all([writeFile(custody,JSON.stringify(snake(manifest.scripts.custody))),writeFile(token,JSON.stringify(snake(manifest.scripts.token)))]);
  const recovery=process.env.ROVEKO_RECOVERY_COLLECTOR||path.resolve(process.cwd(),'lib/v2-engine/pudge-recover.cjs');
  const common=['--node',endpoint,'--init',manifest.initializationTransactionHash,'--owner',body.owner!,'--custody-lock',custody,'--xudt-type',token,'--out',bundle];
  try { await run(process.execPath,[recovery,'collect',...common,'--indexer',endpoint],{timeout:120000,maxBuffer:4*1024*1024}); }
  catch { await run(process.execPath,[recovery,'collect-blocks',...common,'--max-blocks','100000'],{timeout:120000,maxBuffer:4*1024*1024}); }
  const replay=JSON.parse(await readFile(`${bundle}.result.json`,'utf8')); const collected=JSON.parse(await readFile(bundle,'utf8')); if(replay.owner_lock_hash?.toLowerCase()!==body.owner!.toLowerCase()||replay.init_tx_hash?.toLowerCase()!==manifest.initializationTransactionHash.toLowerCase()||!Array.isArray(replay.transitions)||!Array.isArray(collected.history))throw Error('Recovery identity mismatch'); const rows=replay.transitions.map((t:{tx_hash:string;block_number:string;op:number})=>{const item=collected.history.find((x:{tx_hash:string})=>x.tx_hash.toLowerCase()===t.tx_hash.toLowerCase());if(!item)throw Error('Missing replay transaction');const witness=item.transaction.witnesses[t.op===0?3:5];if(typeof witness!=='string'||!/^0x544d5331[0-9a-f]+$/i.test(witness))throw Error('Invalid transition witness');return {hash:t.tx_hash,block:t.block_number,op:t.op,owner:'0x'+witness.slice(26,90)};}).filter((t:{owner:string})=>t.owner.toLowerCase()===body.owner!.toLowerCase()); return Response.json({balance:replay.owner.balance,root:replay.ownership_root,tip:replay.tip_outpoint,transitions:rows,genesis:manifest.genesis},{headers:{'Cache-Control':'no-store'}});
 }catch{return new Response('Pudge canonical history or proof unavailable',{status:503});}
 finally{if(dir){const target=path.resolve(dir),parent=path.resolve(tmpdir());if(path.dirname(target)===parent&&path.basename(target).startsWith('roveko-pudge-proof-'))await rm(target,{recursive:true,force:true});}}
}

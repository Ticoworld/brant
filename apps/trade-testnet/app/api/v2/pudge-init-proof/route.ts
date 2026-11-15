import {spawnSync} from 'node:child_process';
import {access,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {deriveMarketIdentity} from '../../../../lib/v2-engine/initialization.ts';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const genesis='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
const codes={market:'0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770',marker:'0xd09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2',owner:'0xf8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53',custody:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',custodyMarker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95'};
const hash=/^0x[0-9a-f]{64}$/i;
/** Generate and independently verify the fixed initial empty-tree proof.
 * It is not a claim that an anchor, market or deployment exists on chain. */
export async function POST(request:Request){
 try{
  const host=request.headers.get('host')||'',origin=request.headers.get('origin');
  const url=new URL(`http://${host}`);
  if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||(origin&&origin!==url.origin))return new Response('Local origin required',{status:403});
  const size=Number(request.headers.get('content-length')||'0');if(!Number.isFinite(size)||size>2048)return new Response('Request too large',{status:400});
  const text=await request.text();if(text.length>2048)return new Response('Request too large',{status:400});
  const body=JSON.parse(text) as {anchor?:{txHash?:string;index?:string};owner?:string};
  if(!body||!body.anchor||!hash.test(body.anchor.txHash||'')||!/^0x[0-9a-f]{1,8}$/i.test(body.anchor.index||'')||!hash.test(body.owner||''))return new Response('Invalid proof identity',{status:400});
  const smt=process.env.ROVEKO_SMT_BINARY,verify=process.env.ROVEKO_PROOF_BINARY,collector=process.env.ROVEKO_RECOVERY_COLLECTOR;if(!smt||!verify||!collector)return new Response('Proof tools unavailable',{status:503});
  const canonicalCollector=path.resolve(process.cwd(),'../../labs/trade-v2-token/gate2/recovery/recover.cjs'),collectorVerifier=path.join(path.dirname(collector),'target','release',process.platform==='win32'?'trade-v2-recovery.exe':'trade-v2-recovery');
  const [canonical,configured]=await Promise.all([readFile(canonicalCollector),readFile(collector),access(smt),access(verify),access(collectorVerifier)]);
  if(createHash('sha256').update(canonical).digest('hex')!==createHash('sha256').update(configured).digest('hex'))throw Error('Recovery collector differs from repository');
  const id=deriveMarketIdentity({anchor:{txHash:body.anchor.txHash!,index:body.anchor.index!},genesis,base:1000000000n,step:100000000n,supply:2000n,codes});
  const domain={market_script_hash:id.market.hash(),xudt_type_script_hash:id.token.hash(),genesis_hash:genesis,custody_marker_type_hash:id.custodyMarker.hash()};
  const run=spawnSync(smt,['proof','-','-'],{input:JSON.stringify({domain,op:0,owners:[],updates:[{owner_lock_hash:body.owner,balance:'7',revision:'0',active:true}]}),encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  if(run.status!==0)throw Error('Proof generation failed');
  const proof=JSON.parse(run.stdout),price=9100000000n,limit=Array.from({length:8},(_,i)=>Number((price>>BigInt(i*8))&255n).toString(16).padStart(2,'0')).join(''),witness=proof.contract_witness.hex+limit;
  if(!hash.test(proof.new_root)||typeof witness!=='string'||!/^0x(?:[0-9a-f]{2})+$/i.test(witness))throw Error('Invalid generated proof');
  const check=spawnSync(verify,['verify-init','-'],{input:JSON.stringify({domain:id.custody.args,owner:body.owner,new_root:proof.new_root,witness,quantity:'7',price:price.toString()}),encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  if(check.status!==0||JSON.parse(check.stdout).verified!==true)throw Error('Proof verification failed');
  return Response.json({owner:body.owner,newRoot:proof.new_root,witness,genesis,market:id.market.hash(),custody:id.custody.hash()},{headers:{'Cache-Control':'no-store'}});
 }catch{return new Response('Proof preparation failed',{status:503});}
}

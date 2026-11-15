import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { ccc } from '@ckb-ccc/core';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const run = promisify(execFile), hash = /^0x[0-9a-f]{64}$/;
type Owner = {owner_lock_hash:string;balance:string;revision:string;active:boolean};
export async function POST(request:Request) {
  if (process.env.NODE_ENV === 'production' || process.env.ROVEKO_LOCAL_PROOFS !== '1') return NextResponse.json({error:'Local proof service disabled'}, {status:503});
  const rpc=process.env.ROVEKO_LOCAL_RPC || 'http://127.0.0.1:19224';
  let url:URL; try {url=new URL(rpc);} catch {return NextResponse.json({error:'Invalid local node'}, {status:503});}
  if (url.protocol!=='http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.username || url.password) return NextResponse.json({error:'Local node required'}, {status:503});
  let body:{seller?:string;buyer?:string;quantity?:string;op?:string};
  try {body=await request.json();} catch {return NextResponse.json({error:'Invalid JSON'}, {status:400});}
  if (!body || !hash.test(body.seller || '') || !['fill','cancel'].includes(body.op || '') || (body.op==='fill' && (!hash.test(body.buyer || '') || body.seller===body.buyer || !/^[1-9][0-9]{0,19}$/.test(body.quantity || '') || BigInt(body.quantity!) > (1n<<64n)-1n))) return NextResponse.json({error:'Invalid order proof request'}, {status:400});
  const deploymentPath=process.env.ROVEKO_LOCAL_DEPLOYMENT, verifier=process.env.ROVEKO_PROOF_BINARY, smt=process.env.ROVEKO_SMT_BINARY;
  if (!deploymentPath || !verifier || !smt) return NextResponse.json({error:'Proof service not configured'}, {status:503});
  const dir=await mkdtemp(path.join(tmpdir(),'roveko-order-'));
  try {
    const d=JSON.parse(await readFile(deploymentPath,'utf8'));
    if (!hash.test(d.genesis || '') || !hash.test(d.initializationTransactionHash || '') || !d.scripts?.custody || !d.scripts?.token) throw Error('Invalid deployment');
    const network=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'get_block_hash',params:['0x0']}),signal:AbortSignal.timeout(5000)}).then(r=>r.json());
    if (network.result!==d.genesis) throw Error('Wrong genesis');
    const snake=(s:{codeHash:string;hashType:string;args:string})=>({code_hash:s.codeHash,hash_type:s.hashType,args:s.args});
    const custody=path.join(dir,'custody.json'), token=path.join(dir,'token.json'), bundle=path.join(dir,'bundle.json'), proofInput=path.join(dir,'proof.json');
    await Promise.all([writeFile(custody,JSON.stringify(snake(d.scripts.custody))),writeFile(token,JSON.stringify(snake(d.scripts.token)))]);
    const recovery=path.resolve(process.cwd(),'../../labs/trade-v2-token/gate2/recovery/recover.cjs');
    await run(process.execPath,[recovery,'collect-blocks','--node',rpc,'--init',d.initializationTransactionHash,'--owner',body.seller!,'--custody-lock',custody,'--xudt-type',token,'--max-blocks','100000','--out',bundle],{timeout:120000,maxBuffer:4*1024*1024});
    const state=JSON.parse((await run(verifier,['replay',bundle,'-'],{timeout:120000,maxBuffer:16*1024*1024})).stdout);
    if (!Array.isArray(state.owners)) throw Error('Verifier lacks owner records');
    const owners=state.owners as Owner[], seller=owners.find(x=>x.owner_lock_hash===body.seller);
    if (!seller || !seller.active) throw Error('Seller has no entitlement');
    const revision=(x:Owner)=>{const n=BigInt(x.revision)+1n;if(n>(1n<<64n)-1n) throw Error('Revision overflow');return n.toString();};
    const q=body.op==='fill' ? BigInt(body.quantity!) : 0n, balance=BigInt(seller.balance);
    if (q>balance) throw Error('Insufficient seller balance');
    const nextSeller={...seller,balance:(balance-q).toString(),revision:revision(seller),active:balance-q>0n};
    const updates=[nextSeller];
    if(body.op==='fill') {const buyer=owners.find(x=>x.owner_lock_hash===body.buyer);const next=BigInt(buyer?.balance || '0')+q;if(next>(1n<<64n)-1n) throw Error('Balance overflow');updates.push({owner_lock_hash:body.buyer!,balance:next.toString(),revision:buyer?revision(buyer):'1',active:true});}
    const {genesis_hash,market_script_hash,xudt_type_script_hash,custody_marker_type_hash}=state.domain;
    await writeFile(proofInput,JSON.stringify({domain:{genesis_hash,market_script_hash,xudt_type_script_hash,custody_marker_type_hash},op:body.op==='fill'?8:7,owners,updates}));
    const result=JSON.parse((await run(smt,['proof',proofInput,'-'],{timeout:120000,maxBuffer:8*1024*1024})).stdout);
    if(result.old_root!==state.ownership_root || !result.proof?.csmt_old_root_verified || !result.proof?.csmt_new_root_verified) throw Error('Proof root mismatch');
    return NextResponse.json({proof:result,tip:state.tip_outpoint,seller,genesis:d.genesis,custody:ccc.Script.from(d.scripts.custody).hash()},{headers:{'Cache-Control':'no-store'}});
  } catch(error) {console.error('Order proof unavailable',error);return NextResponse.json({error:'Canonical order proof unavailable'}, {status:503});}
  finally {await rm(dir,{recursive:true,force:true});}
}

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { ccc } from '@ckb-ccc/core';
import { cccA } from '@ckb-ccc/core/advanced';
import { deriveMarketIdentity } from '../initialization.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const run = promisify(execFile);
const hash = /^0x[0-9a-f]{64}$/i;

// This experimental local-only endpoint accepts public identities, never keys.
// Configuration is server-owned: clients cannot choose RPC URLs or paths.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production' || process.env.ROVEKO_LOCAL_PROOFS !== '1') return NextResponse.json({error:'Local proof service is disabled'}, {status:503});
  const rpc = process.env.ROVEKO_LOCAL_RPC || 'http://127.0.0.1:19224';
  let url: URL;
  try { url = new URL(rpc); } catch { return NextResponse.json({error:'Invalid RPC configuration'}, {status:503}); }
  if (url.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.username || url.password) return NextResponse.json({error:'Local RPC required'}, {status:503});
  let body: {owner?: string; side?: string; quantity?: string; initTxHash?:string};
  try { body = await request.json(); } catch { return NextResponse.json({error:'Invalid JSON'}, {status:400}); }
  if (!body || typeof body !== 'object' || !hash.test(body.owner || '') || !['buy','sell','withdraw'].includes(body.side || '') || !/^[1-9][0-9]{0,19}$/.test(body.quantity || '') || BigInt(body.quantity!) > (1n << 64n) - 1n) return NextResponse.json({error:'Invalid owner, side, or quantity'}, {status:400});
  const deploymentPath = process.env.ROVEKO_LOCAL_DEPLOYMENT;
  const proofBinary = process.env.ROVEKO_PROOF_BINARY;
  if ((!deploymentPath && !body.initTxHash) || !proofBinary) return NextResponse.json({error:'Local deployment and proof binary are not configured'}, {status:503});
  const root = path.resolve(process.cwd(), '../..');
  const recovery = path.join(root, 'labs/trade-v2-token/gate2/recovery/recover.cjs');
  const dir = await mkdtemp(path.join(tmpdir(), 'rovekorecovery-'));
  try {
    let deployment;
    if(body.initTxHash){
      if(process.env.NEXT_PUBLIC_LOCAL_FIXTURE!=='1'||!process.env.ROVEKO_INIT_BOOTSTRAP||!hash.test(body.initTxHash))throw Error('Fixture handoff unavailable');
      const f=JSON.parse(await readFile(process.env.ROVEKO_INIT_BOOTSTRAP,'utf8'));
      const id=deriveMarketIdentity({anchor:f.wallets[0].outPoint,genesis:f.genesis,base:1000000000n,step:100000000n,supply:2000n,codes:{market:f.hashes.market_smt,marker:f.hashes.marker_candidate,owner:f.hashes.owner_lineage_candidate,custody:f.hashes.custody_smt,custodyMarker:f.hashes.custody_marker,xudt:f.hashes.xudt}});
      const call=async(method:string,params:unknown[])=>{const r=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(5000)});const j=await r.json();if(!r.ok||j.error)throw Error('Fixture RPC failed');return j.result;};
      if((await call('get_blockchain_info',[]))?.chain!=='ckb_dev'||await call('get_block_hash',['0x0'])!==f.genesis||f.genesis==='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606')throw Error('Wrong fixture chain');
      const committed=await call('get_transaction',[body.initTxHash]);
      if(committed?.tx_status?.status!=='committed'||!committed.tx_status.block_hash||!committed.transaction)throw Error('Initialization not committed');
      const header=await call('get_header',[committed.tx_status.block_hash]);
      if(!header?.number||header.hash!==committed.tx_status.block_hash||await call('get_block_hash',[header.number])!==header.hash)throw Error('Initialization not canonical');
      const tx=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(committed.transaction));
      const le=(n:bigint)=>Array.from({length:16},(_,i)=>Number((n>>BigInt(i*8))&255n).toString(16).padStart(2,'0')).join('');
      if(tx.hash().toLowerCase()!==body.initTxHash.toLowerCase()||tx.inputs.length!==3||tx.outputs.length!==5||!tx.headerDeps.some(h=>h.toLowerCase()===f.genesis.toLowerCase())||tx.outputs[0].lock.hash()!==id.market.hash()||tx.outputs[0].type?.hash()!==id.token.hash()||tx.outputs[1].lock.hash()!==id.market.hash()||tx.outputs[1].type?.hash()!==id.marker.hash()||tx.outputs[2].lock.hash()!==id.custody.hash()||tx.outputs[2].type?.hash()!==id.token.hash()||tx.outputs[3].lock.hash()!==id.custody.hash()||tx.outputs[3].type?.hash()!==id.custodyMarker.hash()||tx.outputsData[0].toLowerCase()!==('0x'+le(1993n)+id.custodyMarker.hash().slice(2)).toLowerCase()||tx.outputsData[1].toLowerCase()!==id.markerData.toLowerCase()||!tx.outputsData[2].toLowerCase().startsWith('0x'+le(7n))||tx.outputsData[2].length!==98||tx.outputsData[3].toLowerCase()!==id.custodyMarkerData.toLowerCase())throw Error('Initialization identity mismatch');
      deployment={genesis:f.genesis,initializationTransactionHash:body.initTxHash,scripts:{custody:id.custody,token:id.token}};
    }else deployment=JSON.parse(await readFile(deploymentPath!, 'utf8'));
    if (!hash.test(deployment.initializationTransactionHash || '') || !hash.test(deployment.genesis || '') || !deployment.scripts?.custody || !deployment.scripts?.token) throw Error('Invalid deployment configuration');
    const response = await fetch(rpc, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'get_block_hash',params:['0x0']}),signal:AbortSignal.timeout(5000)});
    const network = await response.json();
    if (!response.ok || typeof network.result !== 'string' || network.result.toLowerCase() !== deployment.genesis.toLowerCase()) throw Error('Wrong genesis');
    const snake = (s: {codeHash:string;hashType:string;args:string}) => ({code_hash:s.codeHash,hash_type:s.hashType,args:s.args});
    const custody = path.join(dir,'custody.json'), token = path.join(dir,'token.json'), bundle = path.join(dir,'bundle.json');
    await Promise.all([writeFile(custody, JSON.stringify(snake(deployment.scripts.custody))), writeFile(token, JSON.stringify(snake(deployment.scripts.token)))]);
    await run(process.execPath, [recovery,'collect-blocks','--node',rpc,'--init',deployment.initializationTransactionHash,'--owner',body.owner!,'--custody-lock',custody,'--xudt-type',token,'--max-blocks','100000','--out',bundle], {timeout:120000,maxBuffer:4*1024*1024});
    const {stdout} = await run(proofBinary, ['transition',bundle,body.side!,body.quantity!], {timeout:120000,maxBuffer:4*1024*1024});
    const proof = JSON.parse(stdout);
    return NextResponse.json({proof, genesis:deployment.genesis, warning:'Proof only; transaction construction and wallet authorization are required.'}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) {
    console.error('V2 local proof preparation failed', error);
    return NextResponse.json({error:'Canonical history or proof preparation failed'}, {status:503});
  } finally { await rm(dir, {recursive:true,force:true}); }
}

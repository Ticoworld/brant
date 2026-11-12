import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const run = promisify(execFile);
const hash = /^0x[0-9a-f]{64}$/i;

// This experimental local-only endpoint accepts public identities, never keys.
// Configuration is server-owned: clients cannot choose RPC URLs or paths.
export async function POST(request: Request) {
  if (process.env.ROVEKO_LOCAL_PROOFS !== '1') return NextResponse.json({error:'Local proof service is disabled'}, {status:503});
  const rpc = process.env.ROVEKO_LOCAL_RPC || 'http://127.0.0.1:19224';
  let url: URL;
  try { url = new URL(rpc); } catch { return NextResponse.json({error:'Invalid RPC configuration'}, {status:503}); }
  if (url.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.username || url.password) return NextResponse.json({error:'Local RPC required'}, {status:503});
  let body: {owner?: string; side?: string; quantity?: string};
  try { body = await request.json(); } catch { return NextResponse.json({error:'Invalid JSON'}, {status:400}); }
  if (!body || typeof body !== 'object' || !hash.test(body.owner || '') || !['buy','sell'].includes(body.side || '') || !/^[1-9][0-9]{0,19}$/.test(body.quantity || '') || BigInt(body.quantity!) > (1n << 64n) - 1n) return NextResponse.json({error:'Invalid owner, side, or quantity'}, {status:400});
  const deploymentPath = process.env.ROVEKO_LOCAL_DEPLOYMENT;
  const proofBinary = process.env.ROVEKO_PROOF_BINARY;
  if (!deploymentPath || !proofBinary) return NextResponse.json({error:'Local deployment and proof binary are not configured'}, {status:503});
  const root = path.resolve(process.cwd(), '../..');
  const recovery = path.join(root, 'labs/trade-v2-token/gate2/recovery/recover.cjs');
  const dir = await mkdtemp(path.join(tmpdir(), 'rovekorecovery-'));
  try {
    const deployment = JSON.parse(await readFile(deploymentPath, 'utf8'));
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

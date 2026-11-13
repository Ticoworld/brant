import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {verifyInitializationLive} from './initialization-live.ts';
import {ccc} from '@ckb-ccc/core';
import {quote} from './curve.ts';

type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
type Cell={outPoint:{txHash:string;index:string};capacity:bigint;lock:ccc.ScriptLike;type?:ccc.ScriptLike;data:string};
type Dep={outPoint:{txHash:string;index:string};dataHash:string};
type Proof={domain:string;owner:string;new_root:string;witness:string;quantity:string;price:string};
type Identity={market:ccc.ScriptLike;marker:ccc.ScriptLike;token:ccc.ScriptLike;custodyMarker:ccc.ScriptLike;custody:ccc.ScriptLike};
/** Local development validation only. The executable and RPC are server-owned;
 * success does not authorize a signature or attest remote consensus. */
export async function validateLocalInitialization(rpc:Rpc,genesis:string,inputs:Cell[],deps:Dep[],proof:Proof,verifier:string,identity:Identity){
  if(process.env.ROVEKO_LOCAL_PROOFS!=='1'||!verifier)throw Error('Local initialization validation disabled');
  if(inputs.length!==3||!/^0x[0-9a-f]{64}$/i.test(genesis)||!identity)throw Error('Invalid initialization identity');
  const market=ccc.Script.from(identity.market),marker=ccc.Script.from(identity.marker),token=ccc.Script.from(identity.token),custodyMarker=ccc.Script.from(identity.custodyMarker),custody=ccc.Script.from(identity.custody);
  const domain='0x'+market.hash().slice(2)+token.hash().slice(2)+genesis.slice(2)+custodyMarker.hash().slice(2);
  const scripts=[market,marker,token,custodyMarker,custody];
  if(custody.args.toLowerCase()!==domain.toLowerCase()||scripts.some(s=>s.hashType!=='data1'||!deps.some(d=>d.dataHash.toLowerCase()===s.codeHash.toLowerCase())))throw Error('Proof domain or code dependencies mismatch');
  const same=(a:ccc.ScriptLike|undefined,b:ccc.Script)=>!!a&&ccc.Script.from(a).hash().toLowerCase()===b.hash().toLowerCase();
  const buyer=ccc.Script.from(inputs[2].lock);
  if(proof.domain.toLowerCase()!==domain.toLowerCase()||!same(inputs[0].lock,market)||!same(inputs[0].type,token)||!same(inputs[1].lock,market)||!same(inputs[1].type,marker)||inputs[1].data.toLowerCase()!==('0x'+market.hash().slice(2)+token.hash().slice(2)).toLowerCase()||market.args.slice(-64).toLowerCase()!==marker.hash().slice(2).toLowerCase()||custodyMarker.args.toLowerCase()!==market.hash().toLowerCase()||inputs[2].type||inputs[2].data!=='0x'||buyer.codeHash.toLowerCase()!=='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'||buyer.hashType!=='type'||buyer.args.length!==42||buyer.hash().toLowerCase()!==proof.owner.toLowerCase())throw Error('Proof or input identity mismatch');
  const le=(s:string)=>BigInt('0x'+s.match(/../g)!.reverse().join(''));
  const args=market.args.slice(2);
  if(args.length!==176||!/^0x[0-9a-f]{32}$/i.test(inputs[0].data)||!/^\d+$/.test(proof.quantity)||!/^\d+$/.test(proof.price))throw Error('Invalid curve identity');
  const supply=le(args.slice(96,112)),inventory=le(inputs[0].data.slice(2));
  if(inventory!==supply||quote({base:le(args.slice(64,80)),step:le(args.slice(80,96)),supply,inventory},'buy',BigInt(proof.quantity))!==BigInt(proof.price))throw Error('Initial curve amount mismatch');
  await verifyInitializationLive(rpc,genesis,inputs,deps);
  const run=promisify(execFile);
  // Use a temporary file rather than a shell or command-line encoded witness.
  const {mkdtemp,writeFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');
  const path=await import('node:path');
  const dir=await mkdtemp(path.join(tmpdir(),'roveko-init-'));
  try {
    const input=path.join(dir,'proof.json'); await writeFile(input,JSON.stringify(proof));
    const {stdout}=await run(verifier,['verify-init',input],{timeout:30000,maxBuffer:1024*1024});
    const result=JSON.parse(stdout);
    if(result?.verified!==true||typeof result.new_root!=='string'||result.new_root.toLowerCase()!==proof.new_root.toLowerCase())throw Error('Initial proof rejected');
    // Revalidate after the verifier completes to narrow the stale-input window.
    await verifyInitializationLive(rpc,genesis,inputs,deps);
    return {verified:true as const,newRoot:result.new_root as string};
  } finally {await rm(dir,{recursive:true,force:true});}
}

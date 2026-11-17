import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {ccc} from '@ckb-ccc/core';
import {deriveMarketIdentity} from '../initialization.ts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Fixed private-fixture proof; accepts no client-supplied scripts or paths. */
export async function POST(){
 if(process.env.NODE_ENV==='production'||process.env.NEXT_PUBLIC_LOCAL_FIXTURE!=='1'||!process.env.ROVEKO_INIT_BOOTSTRAP||!process.env.ROVEKO_SMT_BINARY||!process.env.ROVEKO_PROOF_BINARY)return new Response('Disabled',{status:404});
 try{
  const f=JSON.parse(await readFile(process.env.ROVEKO_INIT_BOOTSTRAP,'utf8'));
  const r=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'get_block_hash',params:['0x0']}),signal:AbortSignal.timeout(5000)}),j=await r.json();
  if(!r.ok||j.result!==f.genesis||f.genesis==='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606')throw Error('Wrong private genesis');
  const id=deriveMarketIdentity({anchor:f.wallets[0].outPoint,genesis:f.genesis,base:1000000000n,step:100000000n,supply:2000n,codes:{market:f.hashes.market_smt,marker:f.hashes.marker_candidate,owner:f.hashes.owner_lineage_candidate,custody:f.hashes.custody_smt,custodyMarker:f.hashes.custody_marker,xudt:f.hashes.xudt}});
  const owner=ccc.Script.from(f.wallets[2].lock).hash(),domain={market_script_hash:id.market.hash(),xudt_type_script_hash:id.token.hash(),genesis_hash:f.genesis,custody_marker_type_hash:id.custodyMarker.hash()};
  const generated=spawnSync(process.env.ROVEKO_SMT_BINARY,['proof','-','-'],{input:JSON.stringify({domain,op:0,owners:[],updates:[{owner_lock_hash:owner,balance:'7',revision:'0',active:true}]}),encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  if(generated.status!==0)throw Error('Proof generation failed');const proof=JSON.parse(generated.stdout),price=9100000000n,witness=proof.contract_witness.hex+Array.from({length:8},(_,i)=>Number((price>>BigInt(i*8))&255n).toString(16).padStart(2,'0')).join('');
  const checked=spawnSync(process.env.ROVEKO_PROOF_BINARY,['verify-init','-'],{input:JSON.stringify({domain:id.custody.args,owner,new_root:proof.new_root,witness,quantity:'7',price:'9100000000'}),encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  if(checked.status!==0||JSON.parse(checked.stdout).verified!==true)throw Error('Independent proof verification failed');
  return Response.json({owner,newRoot:proof.new_root,witness},{headers:{'Cache-Control':'no-store'}});
 }catch{return new Response('Fixture proof unavailable',{status:503});}
}

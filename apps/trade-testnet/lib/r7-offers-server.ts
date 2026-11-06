import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { ccc } from '@ckb-ccc/core';
import { httpRpc } from './market';
import { recoverR7 } from './r7-recovery';
import { saleMessage, verifyAuthorization, type SaleTerms } from './r7-authorization';

function config() {
  if (process.env.R7_LOCAL_ENABLED !== '1') throw Error('Private R7 service disabled');
  const url = new URL(process.env.R7_LOCAL_RPC || 'http://127.0.0.1:19224');
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) throw Error('Only loopback RPC is permitted');
  const genesis=process.env.R7_LOCAL_GENESIS, code=process.env.R7_LOCAL_CODE_HASH;
  if (!genesis || !code || !/^0x[0-9a-f]{64}$/.test(genesis) || !/^0x[0-9a-f]{64}$/.test(code)) throw Error('Private chain identity not configured');
  return {rpc:httpRpc(url.toString()),genesis:genesis as ccc.Hex,code:code as ccc.Hex};
}
function db() {
  const d=new DatabaseSync(process.env.R7_LISTING_DB || './r7-listings.sqlite');
  d.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS offers (id TEXT PRIMARY KEY, vault TEXT NOT NULL, terms TEXT NOT NULL, signature TEXT NOT NULL, created INTEGER NOT NULL)');
  return d;
}
async function state(vault:string) {
  if(!/^0x[0-9a-f]{64}$/.test(vault)) throw Error('Invalid vault');
  const {rpc,genesis,code}=config();
  const g=await rpc('get_block_by_number',['0x0']);if(g.header.hash!==genesis)throw Error('Wrong chain genesis');
  const tip=await rpc('get_tip_header',[]); const height=BigInt(tip.number);
  for(let h=height;h>=0n && height-h<10000n;h--){
    const block=await rpc('get_block_by_number',[ccc.numToHex(h)]);
    for(const tx of [...block.transactions].reverse()) for(let i=0;i<tx.outputs.length;i++){
      const o=tx.outputs[i];if(i!==0||o.type?.code_hash!==code||o.type?.hash_type!=='data1'||o.type?.args!==vault)continue;
      const live=await rpc('get_live_cell',[{tx_hash:tx.hash,index:'0x0'},true]);
      if(live.status==='live') return { ...(await recoverR7(rpc,tx.hash,code,vault as ccc.Hex,genesis)),genesis,code};
    }
  }
  throw Error('Live vault not found within scan bound');
}
function check(terms:SaleTerms,signature:string,s:Awaited<ReturnType<typeof state>>) {
  verifyAuthorization(terms,signature);
  if(terms.genesis!==s.genesis || terms.covenant!==ccc.Script.from({codeHash:s.code,hashType:'data1',args:terms.vault}).hash())throw Error('Wrong covenant domain');
  const index=Number(terms.position),p=s.tree.records[index];
  if(!Number.isSafeInteger(index)||!p||p.owner!==terms.seller||String(p.p)!==terms.principal||String(p.b)!==terms.backing||String(p.revision)!==terms.revision||p.b===0n||BigInt(terms.price)===0n)throw Error('Stale or invalid position');
}
export async function publish(terms:SaleTerms,signature:string) {
  const s=await state(terms.vault);check(terms,signature,s);
  const id=createHash('sha256').update(saleMessage(terms)).digest('hex');const d=db();
  try { const r=d.prepare('INSERT OR IGNORE INTO offers VALUES (?,?,?,?,?)').run(id,terms.vault,JSON.stringify(terms),signature,Date.now());return {id,duplicate:r.changes===0}; } finally {d.close();}
}
export async function offers(vault:string) {
  const s=await state(vault),d=db();let rows:{id:string;terms:string;signature:string;created:number}[];
  try { rows=d.prepare('SELECT id,terms,signature,created FROM offers WHERE vault=? ORDER BY created DESC').all(vault) as typeof rows; } finally {d.close();}
  return {tip:s.tip,offers:rows.map(row=>{const terms=JSON.parse(row.terms) as SaleTerms;try{check(terms,row.signature,s);return {...row,terms,status:'live'};}catch{return {...row,terms,status:'stale'};}})};
}

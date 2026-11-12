import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ccc } from '@ckb-ccc/core';
import { localRequest } from '../../../../lib/r7-local-request';
import { orderMessage } from '../../../../lib/v2-engine/order.ts';
import { parseOrder, type StoredOrder } from '../../../../lib/v2-engine/local-order.ts';
export const runtime='nodejs';export const dynamic='force-dynamic';
function db(){const d=new DatabaseSync(process.env.ROVEKO_ORDER_DB||path.join(tmpdir(),'roveko-local-orders.sqlite'));d.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS orders (genesis TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(genesis,id))');return d;}
function enabled(req:Request){return process.env.NEXT_PUBLIC_LOCAL_FIXTURE==='1'&&localRequest(req);}
async function deployment(){const p=process.env.V2_LOCAL_BOOTSTRAP;if(!p) throw Error('Local deployment unavailable');return JSON.parse(await readFile(p,'utf8'));}
function verify(value:StoredOrder,d:any){
 const t=parseOrder(value),message=orderMessage(t);
 if(t.genesis!==d.genesis||t.market!==ccc.Script.from(d.scripts.market).hash()||t.asset!==ccc.Script.from(d.scripts.token).hash()||t.custody!==ccc.Script.from(d.scripts.custody).hash()) throw Error('Order market mismatch');
 if(!/^0x[0-9a-f]{130}$/i.test(value.signature)||!/^0x(?:02|03)[0-9a-f]{64}$/i.test(value.publicKey)) throw Error('Invalid signature');
 const pub=ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(message),value.signature as ccc.Hex);
 const owner=ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:ccc.hashCkbShort(pub)});
 if(pub.toLowerCase()!==value.publicKey.toLowerCase()||owner.hash()!==t.seller||ccc.Script.from(value.payoutLock).hash()!==t.payout) throw Error('Order signature or payout mismatch');return t;
}
export async function GET(req:Request){if(!enabled(req))return new Response('Disabled',{status:403});try{const d=await deployment(),database=db();try{const rows=database.prepare('SELECT payload FROM orders WHERE genesis=? ORDER BY created DESC LIMIT 100').all(d.genesis) as {payload:string}[];return Response.json({orders:rows.map(r=>JSON.parse(r.payload)),notice:'Signed listings; seller revision and availability must be checked at fill time.'},{headers:{'Cache-Control':'no-store'}});}finally{database.close();}}catch{return Response.json({error:'Local listings unavailable'},{status:503});}}
export async function POST(req:Request){if(!enabled(req))return new Response('Disabled',{status:403});try{const text=await req.text();if(text.length>8192)throw Error('Order too large');const order=JSON.parse(text) as StoredOrder,d=await deployment(),terms=verify(order,d),database=db();try{const payload=JSON.stringify(order),existing=database.prepare('SELECT payload FROM orders WHERE genesis=? AND id=?').get(terms.genesis,terms.orderId) as {payload:string}|undefined;if(existing&&existing.payload!==payload)throw Error('Order id already used');database.prepare('INSERT OR IGNORE INTO orders VALUES (?,?,?,?)').run(terms.genesis,terms.orderId,payload,Date.now());return Response.json({id:terms.orderId});}finally{database.close();}}catch{return Response.json({error:'Invalid or unavailable order'},{status:400});}}

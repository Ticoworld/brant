import { ccc } from '@ckb-ccc/core';
import { discoverCustodyPair } from './lineage.ts';
import { readFundingCell } from './funding.ts';
import { buildCancellation, buildOrderFill } from './order-transaction.ts';
import type { OrderTerms } from './order.ts';
import type { Cell } from './transaction.ts';
type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
type Config={genesis:string;funding:{txHash:string;index:string};deps:Record<string,ccc.CellDepLike>};
export type StoredOrder={terms:Record<string,string>;publicKey:string;signature:string;payoutLock:ccc.ScriptLike};
export function parseOrder(input:StoredOrder):OrderTerms {const t=input.terms;return {genesis:t.genesis,market:t.market,asset:t.asset,custody:t.custody,seller:t.seller,revision:BigInt(t.revision),quantity:BigInt(t.quantity),minimum:BigInt(t.minimum),payout:t.payout,orderId:t.orderId};}
export async function getOrderProof(seller:string,op:'fill'|'cancel',buyer?:string,quantity?:bigint) {
 const r=await fetch('/api/v2/order-proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({seller,op,buyer,quantity:quantity?.toString()})});const body=await r.json();if(!r.ok) throw Error(body.error||'Order proof unavailable');return body;
}
export async function prepareLocalOrder(rpc:Rpc,config:Config,owner:string,side:'fill'|'cancel',order:StoredOrder) {
 const terms=parseOrder(order);const data=await getOrderProof(terms.seller,side,owner,terms.quantity);if(data.genesis!==config.genesis||terms.genesis!==config.genesis||data.custody!==terms.custody||data.proof.domain.market_script_hash!==terms.market||data.proof.domain.xudt_type_script_hash!==terms.asset) throw Error('Order belongs to a different market or network');
 if(side==='cancel' && owner!==terms.seller) throw Error('Only the seller can cancel');
 const points=await discoverCustodyPair(rpc,data.tip);const rows=await Promise.all(points.map(p=>rpc('get_live_cell',[p,true]))) as {status:string;cell:{output:{capacity:string;lock:{code_hash:string;hash_type:string;args:string};type:{code_hash:string;hash_type:string;args:string}|null};data:{content:string}}}[];
 const convert=(s:{code_hash:string;hash_type:string;args:string})=>({codeHash:s.code_hash,hashType:s.hash_type as ccc.HashType,args:s.args});
 if(rows.some(x=>x.status!=='live'||!x.cell)) throw Error('Custody cells are stale');
 const cells=rows.map((r,i)=>({outPoint:{txHash:points[i].tx_hash,index:points[i].index},capacity:BigInt(r.cell.output.capacity),lock:convert(r.cell.output.lock),type:r.cell.output.type?convert(r.cell.output.type):undefined,data:r.cell.data.content}));
 if(ccc.Script.from(cells[0].lock).hash()!==terms.custody || !cells[0].type || ccc.Script.from(cells[0].type).hash()!==terms.asset) throw Error('Custody identity mismatch');
 const pinned:Record<string,string>={custody_smt:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',custody_marker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95'};
 for(const [name,expected] of Object.entries(pinned)){const dep=ccc.CellDep.from(config.deps[name]);if(dep.depType!=='code') throw Error('Invalid dependency');const r=await rpc('get_live_cell',[{tx_hash:dep.outPoint.txHash,index:ccc.numToHex(dep.outPoint.index)},true]) as {status:string;cell?:{data:{content:string}}};if(r.status!=='live'||!r.cell||ccc.hashCkb(r.cell.data.content)!==expected) throw Error('Pinned dependency unavailable');}
 if(ccc.Script.from(cells[0].lock).codeHash!==pinned.custody_smt) throw Error('Wrong custody binary');
 const funding=await readFundingCell(rpc,config.funding,owner);const genesis=await rpc('get_block_by_number',['0x0']) as {header:{hash:string};transactions:{hash:string}[]};if(genesis.header.hash!==config.genesis||!genesis.transactions[1]) throw Error('Wrong genesis');
 const deps:ccc.CellDepLike[]=[{outPoint:{txHash:genesis.transactions[1].hash,index:'0x0'},depType:'depGroup'},...Object.keys(pinned).map(n=>config.deps[n])];
 const common={cells:[...cells,funding] as [Cell,Cell,Cell],proof:data.proof,deps,genesis:config.genesis,fee:100000n};
 const transaction=side==='cancel'?buildCancellation(common,owner):buildOrderFill(common,terms,order.signature,order.publicKey,order.payoutLock);
 return {transaction,genesis:config.genesis,custodyRoot:data.proof.old_root,fee:common.fee,side,terms};
}
export async function signSubmitOrder(review:Awaited<ReturnType<typeof prepareLocalOrder>>,signer:{signTransaction(tx:ccc.Transaction):Promise<ccc.Transaction>},rpc:Rpc,send:(tx:ccc.Transaction)=>Promise<string>) {
 const tx=review.transaction,hash=tx.hash(),witness=tx.witnesses[3];
 const check=async()=>{if(await rpc('get_block_hash',['0x0'])!==review.genesis) throw Error('Network changed');let total=0n;for(let i=0;i<3;i++){const p=tx.inputs[i].previousOutput;const r=await rpc('get_live_cell',[{tx_hash:p.txHash,index:ccc.numToHex(p.index)},true]) as {status:string;cell?:{output:{capacity:string};data:{content:string}}};if(r.status!=='live'||!r.cell) throw Error('Inputs changed; review again');if(i===0&&'0x'+r.cell.data.content.slice(34)!==review.custodyRoot) throw Error('Custody root changed');total+=BigInt(r.cell.output.capacity);}if(total-tx.outputs.reduce((n,x)=>n+x.capacity,0n)!==review.fee) throw Error('Fee changed');};
 await check();const signed=await signer.signTransaction(tx);if(signed.hash()!==hash||signed.witnesses.length!==4||signed.witnesses[3]!==witness) throw Error('Wallet changed the reviewed transaction');await check();return send(signed);
}

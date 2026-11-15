import { ccc } from '@ckb-ccc/core';
import { orderMessage, orderPayload, type OrderTerms } from './order.ts';
import type { Cell } from './transaction.ts';
const MAX=(1n<<64n)-1n, FEE=1_000_000n;
const le=(v:bigint,n:number)=>{if(v<0n || v>=1n<<BigInt(8*n)) throw Error('Integer out of range');return Array.from({length:n},(_,i)=>Number((v>>BigInt(i*8))&255n).toString(16).padStart(2,'0')).join('');};
const read=(s:string)=>BigInt('0x'+(s.match(/../g)||[]).reverse().join(''));
type Proof={old_root:string;new_root:string;contract_witness:{hex:string};proof:{csmt_old_root_verified:boolean;csmt_new_root_verified:boolean}};
type Common={cells:[Cell,Cell,Cell]; proof:Proof; deps:ccc.CellDepLike[]; genesis:string; fee:bigint};
function rootData(c:Cell, root:string) {if(!/^0x[0-9a-f]{96}$/i.test(c.data)||!/^0x[0-9a-f]{64}$/i.test(root)) throw Error('Invalid custody state');return c.data.slice(0,34)+root.slice(2);}
function verify(c:Common,op:7|8) {
  const {cells,proof,fee}=c, w=proof.contract_witness?.hex?.slice(2).toLowerCase();
  if(fee<0n||fee>FEE||!proof.proof?.csmt_old_root_verified||!proof.proof.csmt_new_root_verified||!w||!/^544d533101[0-9a-f]+$/.test(w)||parseInt(w.slice(10,12),16)!==op||cells[0].data.slice(34).toLowerCase()!==proof.old_root.slice(2).toLowerCase()) throw Error('Invalid or stale order proof');
  const count=parseInt(w.slice(12,14),16), length=Number(read(w.slice(16,24)));
  if(count!==(op===7?1:2)||!Number.isSafeInteger(length)||w.length!==(12+count*96+length)*2) throw Error('Invalid order proof length');
  return Array.from({length:count},(_,i)=>{const row=w.slice(24+i*192,24+(i+1)*192);return {owner:'0x'+row.slice(0,64),old:read(row.slice(64,80)),oldRevision:read(row.slice(80,96)),next:read(row.slice(128,144)),nextRevision:read(row.slice(144,160))};});
}
function build(c:Common,outputs:{capacity:bigint;lock:unknown;type?:unknown;data:string}[],witness:string) {
  if(c.cells.some(x=>x.capacity<0n||x.capacity>MAX)||outputs.some(x=>x.capacity<0n||x.capacity>MAX)) throw Error('Insufficient capacity');
  const tx=ccc.Transaction.from({inputs:c.cells.map(x=>({previousOutput:x.outPoint,since:'0x0'})),outputs:outputs.map(x=>({capacity:x.capacity,lock:x.lock,type:x.type})) as ccc.CellOutputLike[],outputsData:outputs.map(x=>x.data) as ccc.Hex[],witnesses:['0x','0x','0x',witness] as ccc.Hex[],cellDeps:c.deps,headerDeps:[c.genesis as ccc.Hex]});
  tx.outputs.forEach((x,i)=>{if(x.capacity!==outputs[i].capacity || x.capacity<BigInt(x.occupiedSize+(tx.outputsData[i].length-2)/2)*100_000_000n) throw Error('Output below occupied capacity');});
  return tx;
}
/** Caller must reconstruct canonical history and validate live dependencies. */
export function buildCancellation(c:Common,owner:string) {
  const rows=verify(c,7), a=rows[0], wallet=ccc.Script.from(c.cells[2].lock as ccc.ScriptLike);
  if(wallet.hash()!==owner) throw Error('Cancellation funding owner mismatch');
  if(a.owner!==owner) throw Error('Cancellation proof owner mismatch');
  if(a.old!==a.next||a.oldRevision===MAX||a.nextRevision!==a.oldRevision+1n) throw Error('Cancellation balance or revision mismatch');
  const [asset,marker,funding]=c.cells;
  return build(c,[{...asset,data:rootData(asset,c.proof.new_root)},{...marker},{...funding,capacity:funding.capacity-c.fee}],c.proof.contract_witness.hex);
}
export function buildOrderFill(c:Common,order:OrderTerms,signature:string,publicKey:string,payoutLock:ccc.ScriptLike) {
  const rows=verify(c,8), seller=rows.find(x=>x.owner===order.seller), payer=ccc.Script.from(c.cells[2].lock as ccc.ScriptLike), buyer=rows.find(x=>x.owner===payer.hash());
  const recovered=ccc.recoverMessageSecp256k1(ccc.messageHashCkbSecp256k1(orderMessage(order)),signature as ccc.Hex);
  const sellerLock=ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:ccc.hashCkbShort(publicKey as ccc.Hex)});
  if(recovered.toLowerCase()!==publicKey.toLowerCase() || sellerLock.hash()!==order.seller || ccc.Script.from(payoutLock).hash()!==order.payout) throw Error('Order signature or payout mismatch');
  if(!seller||!buyer||seller.owner===buyer.owner||seller.oldRevision!==order.revision||seller.old-seller.next!==order.quantity||buyer.next-buyer.old!==order.quantity||seller.nextRevision!==seller.oldRevision+1n||buyer.nextRevision!==buyer.oldRevision+1n) throw Error('Order leaf transition mismatch');
  if(order.genesis!==c.genesis) throw Error('Wrong network');
  const [asset,marker,funding]=c.cells, extra=orderPayload(order,publicKey,signature);
  return build(c,[{...asset,data:rootData(asset,c.proof.new_root)},{...marker},{...funding,capacity:funding.capacity-order.minimum-c.fee},{capacity:order.minimum,lock:payoutLock,data:'0x'}],c.proof.contract_witness.hex+extra.slice(2));
}

import {ccc} from '@ckb-ccc/core';
import type {Cell} from './transaction.ts';
import {quote} from './curve.ts';
const H=/^0x[0-9a-f]{64}$/i;
function le(n:bigint,size:number){if(n<0n||n>=1n<<BigInt(size*8))throw Error('Integer out of range');return Array.from({length:size},(_,i)=>Number((n>>BigInt(i*8))&255n).toString(16).padStart(2,'0')).join('');}
/** Derive the exact anchor-bound Gate 2 scripts. This function does not assert
 * that any code cells are deployed, or that the anchor remains spendable. */
export function deriveMarketIdentity(p:{anchor:{txHash:string;index:string};genesis:string;base:bigint;step:bigint;supply:bigint;codes:{market:string;marker:string;owner:string;custody:string;custodyMarker:string;xudt:string}}){
  if(!H.test(p.anchor.txHash)||!H.test(p.genesis)||Object.values(p.codes).some(x=>!H.test(x))||!/^0x[0-9a-f]+$/i.test(p.anchor.index)||p.base<=0n||p.step<=0n||p.supply<=0n||p.supply>0xffffffffn)throw Error('Invalid market identity parameters');
  const anchor=p.anchor.txHash.slice(2)+le(BigInt(p.anchor.index),4), hash=(s:string)=>ccc.hashCkb('0x'+s);
  const markerId=hash(le(0n,8)+anchor+le(1n,8));
  const marker=ccc.Script.from({codeHash:p.codes.marker,hashType:'data1',args:markerId});
  const market=ccc.Script.from({codeHash:p.codes.market,hashType:'data1',args:'0x'+hash(anchor).slice(2)+le(p.base,8)+le(p.step,8)+le(p.supply,8)+marker.hash().slice(2)});
  const owner=ccc.Script.from({codeHash:p.codes.owner,hashType:'data1',args:'0x'+anchor+p.codes.xudt.slice(2)+market.hash().slice(2)+le(p.supply,16)});
  const token=ccc.Script.from({codeHash:p.codes.xudt,hashType:'data1',args:owner.hash()});
  const custodyMarker=ccc.Script.from({codeHash:p.codes.custodyMarker,hashType:'data1',args:market.hash()});
  const custody=ccc.Script.from({codeHash:p.codes.custody,hashType:'data1',args:'0x'+market.hash().slice(2)+token.hash().slice(2)+p.genesis.slice(2)+custodyMarker.hash().slice(2)});
  return {marker,market,owner,token,custodyMarker,custody,markerData:'0x'+market.hash().slice(2)+token.hash().slice(2),custodyMarkerData:'0x'+custody.hash().slice(2)+token.hash().slice(2)};
}

type Identity=ReturnType<typeof deriveMarketIdentity>;
const UNIT=100_000_000n;
const point=(c:Cell)=>({previousOutput:c.outPoint,since:'0x0'});
const equalScript=(a:unknown,b:ccc.Script)=>!!a&&ccc.Script.from(a as ccc.ScriptLike).hash()===b.hash();
function standard(lock:unknown){const s=ccc.Script.from(lock as ccc.ScriptLike);return s.codeHash==='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'&&s.hashType==='type'&&s.args.length===42;}
function checked(tx:ccc.Transaction,capacities:bigint[]){tx.outputs.forEach((o,i)=>{if(o.capacity!==capacities[i]||o.capacity<BigInt(o.occupiedSize+(tx.outputsData[i].length-2)/2)*UNIT)throw Error('Output capacity below occupied capacity');});return tx;}
/** Fund an owner-lineage cell and a buyer cell without spending the reserved
 * anchor. Every selected input must be a plain cell under the same wallet lock. */
export function buildInitializationSetup(p:{identity:Identity;anchor:{txHash:string;index:string};inputs:Cell[];ownerCapacity:bigint;buyerCapacity:bigint;fee:bigint;secpDep:ccc.CellDepLike}){
  if(!p.inputs.length||p.fee<0n||p.fee>1_000_000n||p.ownerCapacity<0n||p.buyerCapacity<0n)throw Error('Invalid setup funding');
  const wallet=ccc.Script.from(p.inputs[0].lock as ccc.ScriptLike);
  if(wallet.codeHash!=='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'||wallet.hashType!=='type'||wallet.args.length!==42)throw Error('Standard secp owner required');
  const seen=new Set<string>();let total=0n;
  for(const c of p.inputs){const key=`${c.outPoint.txHash.toLowerCase()}:${BigInt(c.outPoint.index)}`;if(seen.has(key)||key===`${p.anchor.txHash.toLowerCase()}:${BigInt(p.anchor.index)}`||c.type||c.data!=='0x'||!equalScript(c.lock,wallet))throw Error('Invalid or reserved setup input');seen.add(key);total+=c.capacity;}
  const change=total-p.ownerCapacity-p.buyerCapacity-p.fee;if(change<0n)throw Error('Insufficient setup funding');
  const capacities=[p.ownerCapacity,p.buyerCapacity,change];
  return checked(ccc.Transaction.from({inputs:p.inputs.map(point),outputs:[{capacity:p.ownerCapacity,lock:p.identity.owner},{capacity:p.buyerCapacity,lock:wallet},{capacity:change,lock:wallet}],outputsData:['0x','0x','0x'],cellDeps:[p.secpDep],witnesses:['0x']}),capacities);
}
/** One-shot issuance consumes the wallet-owned anchor at input 0 and an
 * already-created owner-lineage cell at input 1. All values require fresh
 * live-cell, code-dependency and fee verification before a signature. */
export function buildIssuance(p:{identity:Identity;anchor:Cell;ownerCell:Cell;supply:bigint;inventoryCapacity:bigint;markerCapacity:bigint;fee:bigint;deps:ccc.CellDepLike[]}){
  const {identity,anchor,ownerCell}=p;
  if(!equalScript(ownerCell.lock,identity.owner)||ownerCell.type||ownerCell.data!=='0x'||anchor.type||anchor.data!=='0x'||!standard(anchor.lock)||p.supply<=0n||p.supply>0xffffffffn||p.fee<0n||p.fee>1_000_000n)throw Error('Invalid issuance inputs');
  const anchorBytes=anchor.outPoint.txHash.slice(2)+le(BigInt(anchor.outPoint.index),4);
  if(identity.owner.args.slice(2,74)!==anchorBytes.toLowerCase()||identity.owner.args.slice(-32)!==le(p.supply,16))throw Error('Anchor or supply differs from identity');
  const change=anchor.capacity+ownerCell.capacity-p.inventoryCapacity-p.markerCapacity-p.fee;
  if(change<0n)throw Error('Insufficient issuance funding');
  const capacities=[p.inventoryCapacity,p.markerCapacity,change];
  const tx=ccc.Transaction.from({inputs:[point(anchor),point(ownerCell)],outputs:[{capacity:capacities[0],lock:identity.market,type:identity.token},{capacity:capacities[1],lock:identity.market,type:identity.marker},{capacity:change,lock:anchor.lock as ccc.ScriptLike}],outputsData:['0x'+le(p.supply,16),identity.markerData,'0x'],cellDeps:p.deps,witnesses:['0x','0x']});
  return checked(tx,capacities);
}

/** Initial purchase using a TMS1 op-0 proof generated from an empty tree.
 * The on-chain scripts verify the supplied proof; callers must independently
 * validate the proof and current cells before requesting wallet approval. */
export function buildFirstPurchase(p:{identity:Identity;inventory:Cell;marker:Cell;buyer:Cell;supply:bigint;quantity:bigint;price:bigint;custodyCapacity:bigint;custodyMarkerCapacity:bigint;fee:bigint;newRoot:string;witness:string;genesis:string;deps:ccc.CellDepLike[]}){
  const {identity,inventory,marker,buyer}=p;
  if(!equalScript(inventory.lock,identity.market)||!equalScript(inventory.type,identity.token)||!equalScript(marker.lock,identity.market)||!equalScript(marker.type,identity.marker)||marker.data.toLowerCase()!==identity.markerData.toLowerCase()||inventory.data.toLowerCase()!=='0x'+le(p.supply,16)||buyer.type||buyer.data!=='0x'||!standard(buyer.lock)||p.quantity<=0n||p.quantity>p.supply||p.price<0n||p.fee<0n||p.fee>1_000_000n||!H.test(p.genesis)||!H.test(p.newRoot))throw Error('Invalid initial purchase inputs');
  const read=(s:string)=>BigInt('0x'+s.match(/../g)!.reverse().join(''));
  const args=identity.market.args.slice(2);
  if(read(args.slice(96,112))!==p.supply || quote({base:read(args.slice(64,80)),step:read(args.slice(80,96)),supply:p.supply,inventory:p.supply},'buy',p.quantity)!==p.price || identity.custody.args.slice(130,194).toLowerCase()!==p.genesis.slice(2).toLowerCase())throw Error('Curve price, supply or genesis mismatch');
  const w=p.witness.toLowerCase(), owner=ccc.Script.from(buyer.lock as ccc.ScriptLike).hash().slice(2);
  if(!/^0x544d533101000100[0-9a-f]+$/.test(w)||w.slice(26,90)!==owner||w.slice(90,154)!=='00'.repeat(32)||w.slice(154,170)!==le(p.quantity,8)||w.slice(170,186)!=='00'.repeat(8)||w.slice(186,188)!=='01')throw Error('Initial proof owner or leaf mismatch');
  const proofBytes=Number(BigInt('0x'+w.slice(18,26).match(/../g)!.reverse().join(''))),extra=w.slice(2+(12+96+proofBytes)*2);
  if(!Number.isSafeInteger(proofBytes)||extra!==le(p.price,8))throw Error('Invalid initial proof or price limit');
  const buyerChange=buyer.capacity-p.price-p.custodyCapacity-p.custodyMarkerCapacity-p.fee;
  if(buyerChange<0n)throw Error('Insufficient initial purchase funding');
  const capacities=[inventory.capacity+p.price,marker.capacity,p.custodyCapacity,p.custodyMarkerCapacity,buyerChange];
  const tx=ccc.Transaction.from({inputs:[point(inventory),point(marker),point(buyer)],outputs:[{capacity:capacities[0],lock:identity.market,type:identity.token},{capacity:capacities[1],lock:identity.market,type:identity.marker},{capacity:capacities[2],lock:identity.custody,type:identity.token},{capacity:capacities[3],lock:identity.custody,type:identity.custodyMarker},{capacity:capacities[4],lock:buyer.lock as ccc.ScriptLike}],outputsData:['0x'+le(p.supply-p.quantity,16)+identity.custodyMarker.hash().slice(2),identity.markerData,'0x'+le(p.quantity,16)+p.newRoot.slice(2),identity.custodyMarkerData,'0x'],cellDeps:p.deps,headerDeps:[p.genesis],witnesses:['0x','0x','0x',p.witness]});
  return checked(tx,capacities);
}

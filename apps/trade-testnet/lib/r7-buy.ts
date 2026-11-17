import { ccc } from '@ckb-ccc/core';
import { cat, le, read, standard, UNIT } from './pudge/market.ts';
import { PositionTree, encodePosition } from './r7-tree.ts';
import { verifyAuthorization, type SaleTerms } from './r7-authorization.ts';

// Construct only from a freshly recovered live vault and live buyer cell.
export function buildR7Purchase(input: {terms:SaleTerms; signature:string; tree:PositionTree; vault:ccc.Cell; buyer:ccc.Cell; codeDep:ccc.CellDepLike; secpDep:ccc.CellDepLike; fee:bigint}) {
  const {terms,signature,tree,vault,buyer,fee}=input;
  const index=Number(BigInt(terms.position)), old=tree.records[index];
  if (!old || tree.id!==terms.vault || vault.cellOutput.lock.hash()!==terms.covenant || vault.cellOutput.type?.hash()!==terms.covenant) throw Error('Vault identity mismatch');
  if (old.owner!==terms.seller || old.p.toString()!==terms.principal || old.b.toString()!==terms.backing || old.revision.toString()!==terms.revision || !old.b) throw Error('Stale or unavailable position');
  const checked=verifyAuthorization(terms,signature);
  standard(buyer.cellOutput.lock);
  if (buyer.cellOutput.type || buyer.outputData!=='0x') throw Error('Buyer cell must be plain');
  const price=BigInt(terms.price), buyerHash=buyer.cellOutput.lock.hash();
  if (price<61n*UNIT || fee<0n || fee>1000000n || buyerHash===old.owner) throw Error('Invalid price, fee or buyer');
  const change=buyer.cellOutput.capacity-price-fee;
  if (change<61n*UNIT) throw Error('Insufficient buyer capacity');
  const data=ccc.bytesFrom(vault.outputData);
  if(data.length!==216 || read(data,80)!==1n || ccc.hexFrom(data.slice(128,160))!==tree.root || ccc.hexFrom(data.slice(184,216))!==terms.genesis) throw Error('Vault state mismatch');
  const proof=tree.proof(index), next={...old,owner:buyerHash,revision:old.revision+1n};
  const updated=new PositionTree(tree.n,tree.id);tree.records.forEach((r,i)=>updated.set(i,r));updated.set(index,next);
  data.set(ccc.bytesFrom(updated.root),128);
  const payload=ccc.hexFrom(cat(le(8n),le(1n),le(BigInt(index)),encodePosition(old),encodePosition(next),...proof.map(p=>ccc.bytesFrom(p)),le(price),ccc.bytesFrom(checked.publicKey),ccc.bytesFrom(signature)));
  const tx=ccc.Transaction.from({inputs:[{previousOutput:vault.outPoint},{previousOutput:buyer.outPoint}],outputs:[{capacity:vault.cellOutput.capacity,lock:vault.cellOutput.lock,type:vault.cellOutput.type},{capacity:price,lock:checked.lock},{capacity:change,lock:buyer.cellOutput.lock}],outputsData:[ccc.hexFrom(data),'0x','0x'],cellDeps:[input.secpDep,input.codeDep],witnesses:['0x','0x',payload]});
  return {tx,root:updated.root,price,fee,change};
}

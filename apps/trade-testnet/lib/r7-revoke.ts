import { ccc } from '@ckb-ccc/core';
import { cat, le, read, standard, UNIT } from './pudge/market.ts';
import { PositionTree, encodePosition } from './r7-tree.ts';

// Callers must recover the latest live vault and owner cell immediately before signing.
export function buildR7Revocation(input:{genesis:string; index:number; tree:PositionTree; vault:ccc.Cell; owner:ccc.Cell; codeDep:ccc.CellDepLike; secpDep:ccc.CellDepLike; fee:bigint}) {
  const {genesis,index,tree,vault,owner,fee}=input;
  const old=tree.records[index],lock=vault.cellOutput.lock;
  if(!Number.isSafeInteger(index)||index<0||!old||!old.b||old.revision===0xffffffffffffffffn)throw Error('Invalid position');
  standard(owner.cellOutput.lock);
  if(owner.cellOutput.type||owner.outputData!=='0x'||owner.cellOutput.lock.hash()!==old.owner)throw Error('Owner authorization required');
  if(lock.args!==tree.id||lock.hashType!=='data1'||vault.cellOutput.type?.hash()!==lock.hash())throw Error('Vault identity mismatch');
  if(fee<0n||fee>1000000n||owner.cellOutput.capacity-fee<61n*UNIT)throw Error('Invalid fee or owner capacity');
  const data=ccc.bytesFrom(vault.outputData);
  if(data.length!==216||read(data,80)!==1n||ccc.hexFrom(data.slice(128,160))!==tree.root||ccc.hexFrom(data.slice(184,216))!==genesis)throw Error('Vault state mismatch');
  const next={...old,revision:old.revision+1n},updated=new PositionTree(tree.n,tree.id);
  tree.records.forEach((r,i)=>updated.set(i,r));updated.set(index,next);data.set(ccc.bytesFrom(updated.root),128);
  const payload=ccc.hexFrom(cat(le(9n),le(1n),le(BigInt(index)),encodePosition(old),encodePosition(next),...tree.proof(index).map(p=>ccc.bytesFrom(p))));
  const tx=ccc.Transaction.from({inputs:[{previousOutput:vault.outPoint},{previousOutput:owner.outPoint}],outputs:[{capacity:vault.cellOutput.capacity,lock,type:vault.cellOutput.type},{capacity:owner.cellOutput.capacity-fee,lock:owner.cellOutput.lock}],outputsData:[ccc.hexFrom(data),'0x'],cellDeps:[input.secpDep,input.codeDep],witnesses:['0x','0x',payload]});
  return {tx,root:updated.root,fee};
}

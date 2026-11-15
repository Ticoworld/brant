import { ccc } from '@ckb-ccc/core';
import { selectFunding, type FundingCandidate } from './multi-funding.ts';

const UNIT = 100_000_000n;
export type DeploymentCode = {name:string;data:string;expectedDataHash:string};
/** Construct an unsigned, reviewable code deployment. The caller must verify
 * network, code provenance and current input liveness before wallet signing. */
export function prepareCodeDeployment(codes:DeploymentCode[], candidates:FundingCandidate[], owner:FundingCandidate['lock'], secpDep:ccc.CellDepLike, feeRate:bigint, protectedOutpoints:string[] = []) {
  if (!codes.length || feeRate <= 0n || feeRate > 1_000_000n) throw Error('Invalid code set or fee rate');
  const script=ccc.Script.from(owner), ownerHash=script.hash();
  const seen=new Set<string>();
  const outputs=codes.map(code=>{
    if(!/^0x(?:[0-9a-f]{2})+$/i.test(code.data) || !/^0x[0-9a-f]{64}$/i.test(code.expectedDataHash)) throw Error('Invalid binary');
    const actual=ccc.hashCkb(code.data);
    if(actual.toLowerCase()!==code.expectedDataHash.toLowerCase() || seen.has(actual.toLowerCase())) throw Error('Binary hash mismatch or duplicate');
    seen.add(actual.toLowerCase());
    const capacity=BigInt((code.data.length-2)/2+61)*UNIT;
    return {capacity,lock:script};
  });
  const outputCapacity=outputs.reduce((sum,o)=>sum+o.capacity,0n);
  const placeholder=ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex();
  const make=(inputs:FundingCandidate[], change:bigint)=>ccc.Transaction.from({inputs:inputs.map(c=>({previousOutput:c.outPoint})),outputs:[...outputs,{capacity:change,lock:script}],outputsData:[...codes.map(c=>c.data),'0x'],cellDeps:[secpDep],witnesses:inputs.map((_,i)=>i===0?placeholder:'0x')});
  // Size depends only on input count because all selected inputs share one
  // standard lock group; the first witness contains a 65-byte placeholder.
  const fake=(n:number)=>Array.from({length:n},(_,i)=>({outPoint:{txHash:'0x'+(i+1).toString(16).padStart(64,'0'),index:'0x0'},capacity:0n,lock:owner,data:'0x'}));
  const feeForInputs=(n:number)=>make(fake(n),61n*UNIT).estimateFee(feeRate);
  const selection=selectFunding(candidates,ownerHash,outputCapacity,61n*UNIT,feeForInputs,protectedOutpoints);
  if(selection.deficit>0n || !selection.selected.length) return {status:'insufficient' as const,...selection,outputCapacity};
  const tx=make(selection.selected,selection.change), size=BigInt(tx.toBytes().length);
  if (tx.estimateFee(feeRate)!==selection.fee) throw Error('Serialized fee changed');
  return {status:'review' as const,transaction:tx,hash:tx.hash(),size,outputCapacity,...selection};
}

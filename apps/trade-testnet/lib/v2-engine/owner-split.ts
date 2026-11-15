import {ccc} from '@ckb-ccc/core';
import {selectFunding, type FundingCandidate} from './multi-funding.ts';

/** Prepare a plain-cell split. The first output may only become an anchor
 * after the caller verifies the transaction is committed and canonical. */
export function prepareOwnerSplit(cells:FundingCandidate[],owner:FundingCandidate['lock'],dep:ccc.CellDepLike,anchorCapacity:bigint,fundingMinimum:bigint,feeRate:bigint,protectedOutpoints:string[]=[]){
 if(anchorCapacity<61n*100_000_000n||fundingMinimum<61n*100_000_000n||feeRate<=0n||feeRate>1_000_000n)throw Error('Invalid split capacities or fee rate');
 const lock=ccc.Script.from(owner),placeholder=ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex();
 const make=(inputs:FundingCandidate[],change:bigint)=>ccc.Transaction.from({inputs:inputs.map(c=>({previousOutput:c.outPoint})),outputs:[{capacity:anchorCapacity,lock},{capacity:change,lock}],outputsData:['0x','0x'],cellDeps:[dep],witnesses:inputs.map((_,i)=>i===0?placeholder:'0x')});
 const fake=(n:number)=>Array.from({length:n},(_,i)=>({outPoint:{txHash:'0x'+(i+1).toString(16).padStart(64,'0'),index:'0x0'},capacity:0n,lock:owner,data:'0x'}));
 const selected=selectFunding(cells,lock.hash(),anchorCapacity,fundingMinimum,n=>make(fake(n),fundingMinimum).estimateFee(feeRate),protectedOutpoints);
 if(!selected.selected.length||selected.deficit>0n)throw Error('Insufficient eligible capacity for owner split');
 const transaction=make(selected.selected,selected.change);
 if(transaction.estimateFee(feeRate)!==selected.fee)throw Error('Split fee changed');
 return {...selected,transaction,hash:transaction.hash(),size:BigInt(transaction.toBytes().length)};
}

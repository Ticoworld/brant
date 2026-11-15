import { ccc } from '@ckb-ccc/core';
type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
type Wallet={signTransaction(tx:ccc.Transaction):Promise<ccc.Transaction>;client:{sendTransaction(tx:ccc.Transaction):Promise<ccc.Hex>}};
/** Sign only the reviewed owner withdrawal; stale inputs require a new review. */
export async function submitWithdrawal(review:{transaction:ccc.Transaction;custodyRoot:string;fee:bigint},genesis:string,wallet:Wallet,rpc:Rpc){
  const tx=review.transaction;
  if(tx.inputs.length!==3||tx.outputs.length!==4||tx.witnesses.length!==4||review.fee<0n||review.fee>1000000n) throw Error('Invalid withdrawal review');
  const raw=tx.hash(),proof=tx.witnesses[3];
  const check=async()=>{
    const actual=await rpc('get_block_hash',['0x0']); if(typeof actual!=='string'||actual.toLowerCase()!==genesis.toLowerCase()) throw Error('Wrong wallet network');
    let sum=0n;
    for(let i=0;i<3;i++){const point=tx.inputs[i].previousOutput; const r=await rpc('get_live_cell',[{tx_hash:point.txHash,index:ccc.numToHex(point.index)},true]) as {status:string;cell?:{output:{capacity:string};data:{content:string}}}; if(r.status!=='live'||!r.cell) throw Error('Input spent; review again'); sum+=BigInt(r.cell.output.capacity); if(i===0&&r.cell.data.content.slice(34).toLowerCase()!==review.custodyRoot.slice(2).toLowerCase()) throw Error('Custody root changed');}
    if(sum-tx.outputs.reduce((n,o)=>n+o.capacity,0n)!==review.fee) throw Error('Fee changed');
  };
  await check(); const signed=await wallet.signTransaction(tx); if(signed.hash()!==raw||signed.witnesses.length!==4||signed.witnesses[3]!==proof) throw Error('Wallet changed reviewed transaction'); await check(); return wallet.client.sendTransaction(signed);
}

import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {deriveMarketIdentity} from './initialization.ts';
import {verifyInitializationStage} from './initialization-lifecycle.ts';
type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
type Point={txHash:string;index:string};
type Entry={stage:'setup'|'issuance'|'purchase';tx:unknown;inputs:Point[];indices:number[];receipt?:{txHash:string;blockHash:string;outputs:Point[]}};
type Fixture={genesis:string;wallets:{outPoint:Point}[];hashes:Record<string,string>;deps:Record<string,unknown>};
const asTx=(raw:unknown)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(raw as never));
const same=(a:Point,b:Point)=>a.txHash.toLowerCase()===b.txHash.toLowerCase()&&BigInt(a.index)===BigInt(b.index);
const input=(tx:ccc.Transaction,i:number)=>({txHash:tx.inputs[i].previousOutput.txHash,index:ccc.numToHex(tx.inputs[i].previousOutput.index)});

/** Verify every market/custody output script against the derived identity. */
export function assertLocalMarketScripts(purchase:ccc.Transaction,id:ReturnType<typeof deriveMarketIdentity>){
 if(purchase.outputs.length!==5||purchase.outputs[0].lock.hash()!==id.market.hash()||purchase.outputs[0].type?.hash()!==id.token.hash()||purchase.outputs[1].lock.hash()!==id.market.hash()||purchase.outputs[1].type?.hash()!==id.marker.hash()||purchase.outputs[2].lock.hash()!==id.custody.hash()||purchase.outputs[2].type?.hash()!==id.token.hash()||purchase.outputs[3].lock.hash()!==id.custody.hash()||purchase.outputs[3].type?.hash()!==id.custodyMarker.hash())throw Error('Initialized market identities differ');
}

/** Create a public fixture manifest only after validating all committed stages.
 * The result is a discovery hint, never a finality or public deployment claim. */
export async function createLocalManifest(rpc:Rpc,f:Fixture,j:Entry[],codeTxHash:string){
 if(!/^0x[0-9a-f]{64}$/i.test(f.genesis)||!/^0x[0-9a-f]{64}$/i.test(codeTxHash)||j.length!==3||j.some((x,i)=>x.stage!==['setup','issuance','purchase'][i]||!x.receipt))throw Error('Incomplete fixture initialization');
 if((await rpc('get_blockchain_info',[]) as {chain?:string})?.chain!=='ckb_dev'||await rpc('get_block_hash',['0x0'])!==f.genesis)throw Error('Wrong private chain');
 const txs=j.map(x=>asTx(x.tx));
 for(let i=0;i<3;i++){
  const row=await rpc('get_transaction',[txs[i].hash()]) as {transaction?:unknown;tx_status?:{status?:string;block_hash?:string}};
  if(row?.tx_status?.status!=='committed'||!row.transaction||!row.tx_status.block_hash||row.tx_status.block_hash!==j[i].receipt!.blockHash||asTx(row.transaction).hash()!==txs[i].hash())throw Error('Initialization transaction changed');
  const hdr=await rpc('get_header',[row.tx_status.block_hash]) as {hash?:string;number?:string};
  if(!hdr?.number||hdr.hash!==row.tx_status.block_hash||await rpc('get_block_hash',[hdr.number])!==hdr.hash)throw Error('Initialization block is not canonical');
 }
 if(!same(input(txs[0],0),f.wallets[2].outPoint)||!same(input(txs[1],0),f.wallets[0].outPoint)||!same(input(txs[1],1),{txHash:txs[0].hash(),index:'0x0'})||!same(input(txs[2],0),{txHash:txs[1].hash(),index:'0x0'})||!same(input(txs[2],1),{txHash:txs[1].hash(),index:'0x1'})||!same(input(txs[2],2),{txHash:txs[0].hash(),index:'0x1'}))throw Error('Initialization lineage mismatch');
 const id=deriveMarketIdentity({anchor:f.wallets[0].outPoint,genesis:f.genesis,base:1000000000n,step:100000000n,supply:2000n,codes:{market:f.hashes.market_smt,marker:f.hashes.marker_candidate,owner:f.hashes.owner_lineage_candidate,custody:f.hashes.custody_smt,custodyMarker:f.hashes.custody_marker,xudt:f.hashes.xudt}});
 const purchase=txs[2],required=[{txHash:txs[1].hash(),index:'0x0'},{txHash:txs[1].hash(),index:'0x1'},{txHash:txs[0].hash(),index:'0x1'}];
 assertLocalMarketScripts(purchase,id);
 await verifyInitializationStage(rpc,f.genesis,'purchase',purchase,required,[0,1,2,3,4]);
 const initial=[0,1,2,3].map(i=>({tx_hash:purchase.hash(),index:'0x'+i.toString(16)}));
 return {format:'roveko-local-market-v1',genesis:f.genesis,codeDeploymentTransactionHash:codeTxHash,initializationTransactionHash:purchase.hash(),stageTransactions:txs.map(x=>x.hash()),scripts:{market:id.market,marker:id.marker,owner:id.owner,token:id.token,custody:id.custody,custodyMarker:id.custodyMarker},deps:f.deps,initial,funding:{txHash:purchase.hash(),index:'0x4'}};
}

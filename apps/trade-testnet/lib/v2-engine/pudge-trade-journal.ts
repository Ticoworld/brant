import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {verifyInitializationSignature} from './initialization-signature.ts';
type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
type Market={genesis:string;scripts:{market:ccc.Script;marker:ccc.Script;custody:ccc.Script;custodyMarker:ccc.Script;token:ccc.Script}};
type Attempt={market?:string;version:1;genesis:string;owner:string;txHash:string;transaction:unknown};
const hash=/^0x[0-9a-f]{64}$/i;
export const tradeKey=(genesis:string,owner:string,market?:string)=>`roveko-pudge-trade-v1:${genesis.toLowerCase()}:${owner.toLowerCase()}${market?':'+market.toLowerCase():''}`;
const from=(value:unknown)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(value as never));
export function makeTradeAttempt(genesis:string,owner:string,tx:ccc.Transaction,market?:string):Attempt{
 if(!hash.test(genesis)||!hash.test(owner)||tx.inputs.length!==5||tx.outputs.length!==5||tx.witnesses.length!==6)throw Error('Invalid trade attempt');
 if(market&&(!hash.test(market)||tx.outputs[0].lock.hash().toLowerCase()!==market.toLowerCase()))throw Error('Trade market mismatch');
 return {...(market?{market}:{}),version:1,genesis,owner,txHash:tx.hash(),transaction:cccA.JsonRpcTransformers.transactionFrom(tx)};
}
export function parseTradeAttempt(raw:string):Attempt{
 if(raw.length>262144)throw Error('Trade record too large');const v=JSON.parse(raw) as Attempt;
 if(!v||v.version!==1||!hash.test(v.genesis)||!hash.test(v.owner)||!hash.test(v.txHash)||!v.transaction)throw Error('Invalid trade record');
 const tx=from(v.transaction);if(tx.hash().toLowerCase()!==v.txHash.toLowerCase()||tx.inputs.length!==5||tx.outputs.length!==5||tx.witnesses.length!==6)throw Error('Trade record transaction mismatch');
 if(v.market&&(!hash.test(v.market)||tx.outputs[0].lock.hash().toLowerCase()!==v.market.toLowerCase()))throw Error('Trade market mismatch');
 return {...(v.market?{market:v.market}:{}),version:1,genesis:v.genesis,owner:v.owner,txHash:v.txHash,transaction:cccA.JsonRpcTransformers.transactionFrom(tx)};
}
type CommittedRow={transaction?:unknown;tx_status?:{status?:string;block_hash?:string}};

/** Call under the owner's exclusive trade lock after validating the signature and inputs. */
export async function submitJournaledTrade(
 storage:Pick<Storage,'getItem'|'setItem'>,attempt:Attempt,
 send:()=>Promise<string>,onPersist:(raw:string)=>void,
){
 const key=tradeKey(attempt.genesis,attempt.owner,attempt.market);
 if(storage.getItem(key)!==null)throw Error('A previous trade requires reconciliation');
 const raw=JSON.stringify(attempt);
 storage.setItem(key,raw);
 onPersist(raw);
 const acknowledged=await send();
 if(acknowledged.toLowerCase()!==attempt.txHash.toLowerCase())throw Error('Wallet returned an unexpected transaction hash; reconcile before retrying');
 storage.setItem(key+':submitted',attempt.txHash);
}
async function canonicalTransaction(rpc:Rpc,txHash:string,row:CommittedRow|null){
 if(row?.tx_status?.status!=='committed'||!row.transaction||!row.tx_status.block_hash)throw Error('Transaction is not committed');
  const tx=from(row.transaction),header=await rpc('get_header',[row.tx_status.block_hash]) as {hash?:string;number?:string};
  if(tx.hash().toLowerCase()!==txHash.toLowerCase()||!header?.number||header.hash?.toLowerCase()!==row.tx_status.block_hash.toLowerCase()||String(await rpc('get_block_hash',[header.number])).toLowerCase()!==row.tx_status.block_hash.toLowerCase())throw Error('Trade or predecessor is not canonical');
 return {tx,height:header.number};
}
export async function verifyTradeInclusion(rpc:Rpc,attempt:Attempt,row:CommittedRow|null){
 const [genesis,{tx,height}]=await Promise.all([rpc('get_block_hash',['0x0']),canonicalTransaction(rpc,attempt.txHash,row)]);
 if(genesis!==attempt.genesis)throw Error('Trade network mismatch');
 const expected=from(attempt.transaction);
 if(tx.witnesses.length!==expected.witnesses.length||tx.witnesses.some((w,i)=>w.toLowerCase()!==expected.witnesses[i].toLowerCase()))throw Error('Committed trade witness differs from record');
 return height;
}
/** Resolve a submitted trade only after canonical confirmation and wallet,
 * lineage, witness and fee checks. A missing RPC result never permits retry. */
export async function reconcilePudgeTrade(rpc:Rpc,record:Attempt,market:Market|Promise<Market>){
 const attempt=parseTradeAttempt(JSON.stringify(record));
 const genesis=rpc('get_block_hash',['0x0']);
 void genesis.catch(()=>{});
 const cache=new Map<string,Promise<ccc.Transaction>>();
 function canonical(txHash:string){
  const key=txHash.toLowerCase(),cached=cache.get(key);
  if(cached)return cached;
  const pending=(async()=>{
   const row=await rpc('get_transaction',[txHash]) as CommittedRow|null;
   return (await canonicalTransaction(rpc,txHash,row)).tx;
  })();
  cache.set(key,pending);
  return pending;
 }
 const expected=from(attempt.transaction),tx=await canonical(attempt.txHash);
 if(tx.witnesses.length!==expected.witnesses.length||tx.witnesses.some((w,i)=>w.toLowerCase()!==expected.witnesses[i].toLowerCase()))throw Error('Committed trade witness differs from record');
 const inputs=await Promise.all(tx.inputs.map(async(i,index)=>{const previous=await canonical(i.previousOutput.txHash),n=Number(i.previousOutput.index),output=previous.outputs[n];if(!output)throw Error('Trade predecessor output missing');if(index===4&&previous.outputsData[n]!=='0x')throw Error('Trade wallet funding is not plain');return output;}));
 const [verifiedMarket,chainGenesis]=await Promise.all([market,genesis]);
 if(attempt.genesis.toLowerCase()!==verifiedMarket.genesis.toLowerCase()||chainGenesis!==verifiedMarket.genesis)throw Error('Trade network mismatch');
 const scripts=verifiedMarket.scripts,locks=[scripts.market,scripts.market,scripts.custody,scripts.custody],types=[scripts.token,scripts.marker,scripts.token,scripts.custodyMarker];
 for(let i=0;i<4;i++)if(inputs[i].lock.hash()!==locks[i].hash()||inputs[i].type?.hash()!==types[i].hash()||tx.outputs[i].lock.hash()!==locks[i].hash()||tx.outputs[i].type?.hash()!==types[i].hash())throw Error('Trade market identity mismatch');
 if(inputs[4].lock.hash().toLowerCase()!==attempt.owner.toLowerCase()||inputs[4].type||tx.outputs[4].lock.hash().toLowerCase()!==attempt.owner.toLowerCase()||tx.outputs[4].type||tx.outputsData[4]!=='0x')throw Error('Trade wallet identity mismatch');
 verifyInitializationSignature(tx,tx,inputs.map(i=>({lock:i.lock})),4,attempt.owner);
 const fee=inputs.reduce((n,i)=>n+i.capacity,0n)-tx.outputs.reduce((n,o)=>n+o.capacity,0n);if(fee<=0n||fee>1_000_000n)throw Error('Trade fee outside bounds');
 return {hash:tx.hash(),fee};
}

/** Persist the original signed attempt before retiring the active journal. */
export function saveTradeSettlement(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,key:string,raw:string,height:string){
 const attempt=parseTradeAttempt(raw);
 if(tradeKey(attempt.genesis,attempt.owner,attempt.market)!==key||storage.getItem(key)!==raw)return false;
 storage.setItem(key+':settled',JSON.stringify({raw,height}));
 storage.setItem(key+':confirmed',attempt.txHash);
 storage.removeItem(key);
 storage.removeItem(key+':submitted');
 return true;
}

export function readTradeSettlement(storage:Pick<Storage,'getItem'>,key:string){
 const saved=storage.getItem(key+':settled');
 if(!saved)return null;
 const {raw}=JSON.parse(saved) as {raw:string};
 const attempt=parseTradeAttempt(raw);
 if(tradeKey(attempt.genesis,attempt.owner,attempt.market)!==key)throw Error('Settlement owner or network mismatch');
 return attempt;
}

export async function recheckTradeSettlement(rpc:Rpc,storage:Pick<Storage,'getItem'>,key:string){
 const attempt=readTradeSettlement(storage,key);
 if(!attempt)return null;
 const row=await rpc('get_transaction',[attempt.txHash]) as CommittedRow|null;
 return {hash:attempt.txHash,height:await verifyTradeInclusion(rpc,attempt,row)};
}

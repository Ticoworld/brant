import {cccA} from '@ckb-ccc/core/advanced';
import {parseTradeAttempt,tradeKey} from '../../lib/v2-engine/pudge-trade-journal.ts';
import type {MarketData,Side,TradeEvent} from './types';

export type Scope='personal'|'market';
export type Filter='all'|Side;
export function activityRows(market:MarketData|null,scope:Scope,owner:string,filter:Filter) {
  if(market?.historyState!=='verified')return null;
  return market.history.filter(event=>event.status==='confirmed' &&
    (scope==='market'||!!owner&&event.owner.toLowerCase()===owner.toLowerCase()) &&
    (filter==='all'||event.side===filter)).reverse();
}
export function averageShannons(event:TradeEvent) {
  const quantity=BigInt(event.quantity);
  return (BigInt(event.amountShannons)+quantity/2n)/quantity;
}

export type LocalAttempt={kind:'trade'|'withdrawal';hash:string};
const hash=/^0x[0-9a-f]{64}$/i;
export function readActivityAttempts(storage:Pick<Storage,'getItem'>,genesis:string,owner:string,confirmed:TradeEvent[]):LocalAttempt[] {
  if(!hash.test(genesis)||!hash.test(owner))return [];
  genesis=genesis.toLowerCase();
  owner=owner.toLowerCase();
  const attempts:LocalAttempt[]=[];
  for(const kind of ['trade','withdrawal'] as const){
    try {
      const key=kind==='trade'?tradeKey(genesis,owner):'roveko-pudge-withdrawal-v1:'+genesis+':'+owner;
      const raw=storage.getItem(key);
      if(!raw||raw.length>262144)continue;
      const record=kind==='trade'?parseTradeAttempt(raw):JSON.parse(raw);
      if(record.version!==1||record.genesis.toLowerCase()!==genesis||record.owner.toLowerCase()!==owner||!hash.test(record.txHash))continue;
      const txHash=record.txHash.toLowerCase();
      if(kind==='withdrawal'){
        const tx=cccA.JsonRpcTransformers.transactionTo(record.transaction);
        if(tx.hash().toLowerCase()!==txHash||tx.inputs.length!==3||tx.outputs.length!==4||tx.witnesses.length!==4||tx.outputs[2].lock.hash().toLowerCase()!==owner)continue;
      }
      if(kind==='trade'&&confirmed.some(event=>event.status==='confirmed'&&event.hash.toLowerCase()===txHash))continue;
      attempts.push({kind,hash:txHash});
    }catch { /* Malformed or inaccessible recovery records are omitted. */ }
  }
  return attempts;
}

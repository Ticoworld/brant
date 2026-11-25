import {quote} from '../../lib/v2-engine/curve.ts';
import type {MarketData} from './types';

export function maximumWholeTokens(market:MarketData,budget:bigint){
  let low=0n,high=BigInt(market.inventory);
  const curve={base:BigInt(market.curve.base),step:BigInt(market.curve.step),supply:BigInt(market.curve.supply),inventory:BigInt(market.inventory)};
  while(low<high){const mid=(low+high+1n)>>1n;try{if(quote(curve,'buy',mid)<=budget)low=mid;else high=mid-1n;}catch{high=mid-1n;}}
  return low;
}

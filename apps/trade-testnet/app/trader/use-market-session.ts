"use client";

import {useEffect} from 'react';
import {useAccount} from './account-provider';
import {useGate2Trade} from './use-gate2-trade';
import {useMarketData,ACTIVE_MARKET_KEY} from './use-market-data';
import {useOwnerPosition} from './use-owner-position';
import type {Side} from './types';

export function useMarketSession(id: string, side: Side, interactiveV2 = false) {
  const account=useAccount(),marketQuery=useMarketData(id,interactiveV2),market=marketQuery.data?.id===id?marketQuery.data:null;
  const accountOwner=account.state==='ready'?account.owner:'';
  useEffect(()=>{if(market?.id===id&&market.historyState==='verified')localStorage.setItem(ACTIVE_MARKET_KEY,id);},[id,market?.id,market?.historyState]);

  const trade=useGate2Trade(market,marketQuery.refresh);
  const inclusion=trade.inclusion;
  const marketCaughtUp=!!inclusion&&market?.historyState==='verified'&&market.history.some(event=>event.hash===inclusion.hash);
  const position=useOwnerPosition(accountOwner,market,0,interactiveV2||side==='sell'||!!inclusion);
  useEffect(()=>{
    if(!inclusion)return;
    console.info('Brant transaction timeline',JSON.stringify({hash:inclusion.hash,stage:'refresh-request',at:Date.now()}));
    void account.refresh(inclusion.height?BigInt(inclusion.height):undefined);
  },[inclusion,account.refresh]);
  useEffect(()=>{
    if(!inclusion||marketCaughtUp)return;
    let active=true,delay=2000;
    let timer:ReturnType<typeof setTimeout>;
    const refresh=async()=>{
      await marketQuery.refresh();
      if(!active)return;
      timer=setTimeout(refresh,delay);
      delay=Math.min(delay*2,30_000);
    };
    void refresh();
    return()=>{active=false;clearTimeout(timer);};
  },[inclusion,marketCaughtUp,marketQuery.refresh]);
  return {account, marketQuery, market, trade, inclusion, marketCaughtUp, position};
}

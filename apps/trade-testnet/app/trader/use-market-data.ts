"use client";

import {useCallback,useEffect,useState} from 'react';
import type {MarketData} from './types';

const DEFAULT_MARKET='pudge-xudt';
const MARKET_MANIFEST_KEY='roveko-pudge-market-v1';
export const ACTIVE_MARKET_KEY='roveko-active-market-id-v1';
type Snapshot={data:MarketData|null;loading:boolean;error:string;lastSuccess:number;displayOnly?:boolean};
const snapshots=new Map<string,Snapshot>(),requests=new Map<string,{canonical:boolean;promise:Promise<void>}>(),listeners=new Map<string,Set<(value:Snapshot)=>void>>();
const emptySnapshot=():Snapshot=>({data:null,loading:true,error:'',lastSuccess:0});

function readSnapshot(id:string){return snapshots.get(id)||emptySnapshot();}
function publish(id:string,value:Snapshot){
  snapshots.delete(id);
  snapshots.set(id,value);
  while(snapshots.size>32)snapshots.delete(snapshots.keys().next().value!);
  for(const listener of listeners.get(id)||[])listener(value);
}

export function useMarketData(requestedId?:string, requireCanonical=false){
  const [marketId,setMarketId]=useState(requestedId||DEFAULT_MARKET),[state,setState]=useState(()=>readSnapshot(requestedId||DEFAULT_MARKET));
  useEffect(()=>{
    if(requestedId){setMarketId(requestedId);return;}
    try{const active=localStorage.getItem(ACTIVE_MARKET_KEY);setMarketId(active||DEFAULT_MARKET);}catch{setMarketId(DEFAULT_MARKET);}
  },[requestedId]);
  const requestMarket=useCallback(async function refreshMarket(force:boolean, canonical:boolean, committed?:string): Promise<void> {

    const existing=requests.get(marketId);
    if(existing){
      await existing.promise;
      if(committed&&!readSnapshot(marketId).data?.history.some(event=>event.hash===committed)){
        await refreshMarket(true,true,committed);
      }else if(canonical&&!existing.canonical){
        const settled=readSnapshot(marketId);
        if(settled.displayOnly||settled.error)await refreshMarket(true,true);
      }
      return;
    }
    const current=readSnapshot(marketId);
    const needsCanonical=canonical&&current.displayOnly;
    if(!force&&(document.hidden||(!needsCanonical&&current.lastSuccess&&Date.now()-current.lastSuccess<30_000)))return;
    publish(marketId,{...current,loading:!current.data});
    const request=(async()=>{
      try{
        let response:Response;
        if(marketId===DEFAULT_MARKET)response=await fetch(canonical?'/api/markets':'/api/markets?display=1',{cache:'no-store',signal:AbortSignal.timeout(30_000)});
        else{
          response=await fetch(`/api/markets/${encodeURIComponent(marketId)}${committed?"?committed="+encodeURIComponent(committed):canonical?"":"?display=1"}`,{cache:'no-store',signal:AbortSignal.timeout(30_000)});
          if(!response.ok){
            const manifest=localStorage.getItem(MARKET_MANIFEST_KEY);
            if(manifest){
              let saved;try{saved=JSON.parse(manifest);}catch{}
              if(saved?.format==='roveko-pudge-market-v1')response=await fetch(`/api/markets/${encodeURIComponent(marketId)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({manifest}),cache:'no-store',signal:AbortSignal.timeout(30_000)});
            }
          }
        }
        const body=await response.json();if(!response.ok)throw Error(body.error||'Pudge market is unavailable');
        if(body.id!==marketId)throw Error('Market identity does not match the requested market');
        const latest=readSnapshot(marketId).data;
        if(latest&&body.refreshedAt<latest.refreshedAt)return;
        publish(marketId,{data:body as MarketData,loading:false,error:'',lastSuccess:Date.now(),displayOnly:response.headers.get('X-Roveko-State')==='display-snapshot'||(!canonical&&body.historyState!=='verified')});
      }catch(cause){
        publish(marketId,{...readSnapshot(marketId),loading:false,error:cause instanceof Error?cause.message:'Market refresh failed'});
      }finally{requests.delete(marketId);}
    })();
    requests.set(marketId,{canonical,promise:request});return request;
  },[marketId]);
  const refresh=useCallback((force=true)=>requestMarket(force,force||requireCanonical||marketId!==DEFAULT_MARKET),[requestMarket,requireCanonical,marketId]);
  const refreshDisplay=useCallback(()=>requestMarket(true,requireCanonical||marketId!==DEFAULT_MARKET),[requestMarket,requireCanonical,marketId]);
  useEffect(()=>{
    const set=listeners.get(marketId)||new Set();set.add(setState);listeners.set(marketId,set);setState(readSnapshot(marketId));
    const update=()=>{void refresh(false);};
    if(requireCanonical&&!readSnapshot(marketId).data&&marketId!==DEFAULT_MARKET){
      void requestMarket(false,false).then(()=>{
        if(set.has(setState)&&readSnapshot(marketId).displayOnly)void requestMarket(true,true);
      });
    }else update();
    const timer=setInterval(update,30_000);
    document.addEventListener('visibilitychange',update);
    return()=>{set.delete(setState);if(!set.size)listeners.delete(marketId);clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  },[marketId,refresh,requestMarket,requireCanonical]);
  const data=state.data?.id===marketId&&(!requestedId||requestedId===marketId)?state.data:null;
  return {...state,data,refresh,refreshDisplay,incorporate:useCallback((hash:string)=>requestMarket(true,true,hash),[requestMarket])};
}

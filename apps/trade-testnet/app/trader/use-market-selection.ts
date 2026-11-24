"use client";
import {useEffect,useState} from 'react';
import {ACTIVE_MARKET_KEY} from './use-market-data';

export function useMarketSelection(){
  const [id,setId]=useState('pudge-xudt');
  const [options,setOptions]=useState([{id:'pudge-xudt',label:'RVK / CKB'}]);
  const [error,setError]=useState('');
  useEffect(()=>{
    const saved=localStorage.getItem(ACTIVE_MARKET_KEY);
    if(saved&&(saved==='pudge-xudt'||/^0x[0-9a-f]{64}$/.test(saved)))setId(saved);
    const controller=new AbortController();
    void(async()=>{
      let after='';const listed=[{id:'pudge-xudt',label:'RVK / CKB'}];
      for(let page=0;page<4;page++){
        const response=await fetch('/api/markets/catalog'+(after?'?after='+after:''),{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error('Published markets unavailable');
        const body=await response.json();
        for(const market of body.markets)if(/^0x[0-9a-f]{64}$/.test(market.market))listed.push({id:market.market,label:market.metadata.ticker+' / CKB'});
        if(!body.next)break;after=body.next;
      }
      if(!controller.signal.aborted)setOptions(listed);
    })().catch(()=>{if(!controller.signal.aborted)setError('Published markets unavailable');});
    return()=>controller.abort();
  },[]);
  return {id,options:options.some(option=>option.id===id)?options:[...options,{id,label:'Selected market'}],error,select:(value:string)=>{localStorage.setItem(ACTIVE_MARKET_KEY,value);setId(value);}};
}

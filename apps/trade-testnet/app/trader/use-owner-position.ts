"use client";

import {useCallback,useEffect,useState} from 'react';
import type {MarketData} from './types';

export function useOwnerPosition(owner:string,market:MarketData|null,revision=0,enabled=true){
  const [snapshot,setSnapshot]=useState<{key:string;balance:string}|null>(null),[state,setState]=useState<'idle'|'loading'|'ready'|'unavailable'>('idle'),[retryRevision,setRetryRevision]=useState(0);
  const key=owner&&market?JSON.stringify([owner,market.id]):'';
  useEffect(()=>{
    if(!enabled||!owner||!market){setSnapshot(null);setState('idle');return;}
    let active=true,delay=2000;
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    setState('loading');
    const load=async()=>{
      try{
        const response=await fetch('/api/v2/pudge-proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({manifest:market.manifest,owner,side:'buy',quantity:'1'}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(55_000)])});
        if(!response.ok)throw Error('Owner history proof unavailable');const body=await response.json();
        const witness=body.proof?.witness;
        if(body.genesis!==market.genesis||typeof witness!=='string'||!/^0x544d5331[0-9a-f]+$/i.test(witness)||`0x${witness.slice(26,90)}`.toLowerCase()!==owner.toLowerCase())throw Error('Owner proof identity mismatch');
        if(!/^(0|[1-9][0-9]*)$/.test(body.proof?.owner?.balance||''))throw Error('Owner balance unavailable');
        if(body.proof.old_root?.toLowerCase()!==market.custodyRoot.toLowerCase())throw Error('Owner proof is for a different custody root');
        if(active){setSnapshot({key,balance:body.proof.owner.balance});setState('ready');}
      }catch{if(active){setState('unavailable');timer=setTimeout(load,delay);delay=Math.min(delay*2,30_000);}}
    };
    void load();return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[enabled,owner,market?.id,market?.custodyRoot,revision,retryRevision,key]);
  const retry=useCallback(()=>setRetryRevision(value=>value+1),[]);
  return {balance:snapshot?.key===key?snapshot.balance:'',state:snapshot&&snapshot.key!==key?'loading' as const:state,retry};
}

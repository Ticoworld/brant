"use client";

import {useCallback,useEffect,useState} from 'react';
import type {MarketData} from './types';

const verified=new Map<string,string>();
const requests=new Map<string,Promise<string>>();

export function useOwnerPosition(owner:string,market:MarketData|null,revision=0,enabled=true){
  const [snapshot,setSnapshot]=useState<{key:string;root:string;balance:string}|null>(null),[state,setState]=useState<'idle'|'loading'|'ready'|'unavailable'>('idle'),[retryRevision,setRetryRevision]=useState(0),[error,setError]=useState('');
  const key=owner&&market?JSON.stringify([owner,market.genesis,market.identity]):'';
  useEffect(()=>{
    if(!enabled||!owner||!market){setSnapshot(null);setState('idle');return;}
    let active=true,delay=2000;

    let timer:ReturnType<typeof setTimeout>;
    setState('loading');
    const load=async()=>{
      try{
        const root=market.custodyRoot,requestKey=JSON.stringify([key,root]);
        let request=requests.get(requestKey);
        if(!request){
          request=(async()=>{
            const response=await fetch('/api/v2/pudge-proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({manifest:market.manifest,owner,side:'balance'}),signal:AbortSignal.timeout(12_000)});
            if(!response.ok){
              if(response.status===503)void fetch('/api/v2/pudge-proof',{signal:AbortSignal.timeout(5000)}).catch(()=>{});
              throw Error((await response.text()).slice(0,180)||'Balance verification failed');
            }
            const body=await response.json();
            if(body.genesis!==market.genesis||body.market!==market.identity||body.owner!==owner.toLowerCase()||body.root!==root||typeof body.balance!=='string'||!/^(0|[1-9][0-9]*)$/.test(body.balance))throw Error('Waiting for the current custody root');
            return body.balance as string;
          })().finally(()=>requests.delete(requestKey));
          requests.set(requestKey,request);
        }
        const balance=await request;
        if(active){
          if(verified.size>=16)verified.delete(verified.keys().next().value!);
          verified.set(key,balance);setSnapshot({key,root,balance});setState('ready');setError('');
        }
      }catch(cause){if(active){setError(cause instanceof Error?cause.message:'Balance verification failed');setState('unavailable');timer=setTimeout(load,delay);delay=Math.min(delay*2,30_000);}}
    };
    void load();return()=>{active=false;clearTimeout(timer);};
  },[enabled,owner,market?.id,market?.custodyRoot,revision,retryRevision,key]);
  const retry=useCallback(()=>setRetryRevision(value=>value+1),[]);
  return {balance:enabled?(snapshot?.key===key?snapshot.balance:verified.get(key)||''):'',state:state==='ready'&&(snapshot?.key!==key||snapshot?.root!==market?.custodyRoot)?'loading' as const:state,retry,error};
}

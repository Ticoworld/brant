"use client";

import {useEffect,useState} from 'react';
import type {MarketData} from './types';

export function useOwnerPosition(owner:string,market:MarketData|null,revision=0,enabled=true){
  const [balance,setBalance]=useState(''),[state,setState]=useState<'idle'|'loading'|'ready'|'unavailable'>('idle');
  useEffect(()=>{
    if(!enabled||!owner||!market){setBalance('');setState('idle');return;}
    let active=true;setState('loading');
    const load=async()=>{
      try{
        const response=await fetch('/api/v2/pudge-proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({manifest:market.manifest,owner,side:'buy',quantity:'1'})});
        if(!response.ok)throw Error('Owner history proof unavailable');const body=await response.json();
        const witness=body.proof?.witness;
        if(body.genesis!==market.genesis||typeof witness!=='string'||!/^0x544d5331[0-9a-f]+$/i.test(witness)||`0x${witness.slice(26,90)}`.toLowerCase()!==owner.toLowerCase())throw Error('Owner proof identity mismatch');
        if(!/^(0|[1-9][0-9]*)$/.test(body.proof?.owner?.balance||''))throw Error('Owner balance unavailable');
        if(active){setBalance(body.proof.owner.balance);setState('ready');}
      }catch{if(active){setBalance('');setState('unavailable');}}
    };
    void load();return()=>{active=false;};
  },[enabled,owner,market?.id,market?.custodyRoot,revision]);
  return {balance,state};
}

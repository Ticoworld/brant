"use client";

import {useCallback,useEffect,useRef,useState} from 'react';
import {useSigner} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {toast} from 'sonner';
import {loadPudgeManifest} from '../../lib/v2-engine/pudge-manifest.ts';
import {verifyPudgeInitialProof} from '../../lib/v2-engine/pudge-proof-client.ts';
import {prepareLocalReview} from '../../lib/v2-engine/local-review.ts';
import {discoverCustodyPair,discoverMarketPair} from '../../lib/v2-engine/lineage.ts';
import {readLiveSingletons} from '../../lib/v2-engine/live.ts';
import {verifyInitializationSignature} from '../../lib/v2-engine/initialization-signature.ts';
import {makeTradeAttempt,parseTradeAttempt,reconcilePudgeTrade,tradeKey} from '../../lib/v2-engine/pudge-trade-journal.ts';
import {PUDGE_GENESIS,pudgeRpc} from './rpc';
import {useAccount} from './account-provider';
import {useLocale} from '../i18n-provider';
import {copy} from './copy';
import type {MarketData,Side} from './types';

const clone=(tx:ccc.Transaction)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(cccA.JsonRpcTransformers.transactionFrom(tx)));
const rpc=(method:string,params:unknown[])=>pudgeRpc(method,params);
type Review=Awaited<ReturnType<typeof prepareLocalReview>>&{side:Side;quantity:bigint;owner:string;manifest:Awaited<ReturnType<typeof loadPudgeManifest>>};

export function useGate2Trade(market:MarketData|null,refreshMarket:()=>Promise<void>,refreshAccount:()=>Promise<void>){
  const signer=useSigner(),account=useAccount(),{locale}=useLocale(),active=useRef(signer);active.current=signer;
  const [busy,setBusy]=useState(false),[pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false),[attemptRaw,setAttemptRaw]=useState(''),[revision,setRevision]=useState(0);
  const reconcileLock=useRef(false);
  const key=account.owner?tradeKey(PUDGE_GENESIS,account.owner):'';

  const reconcile=useCallback(async(silent=false)=>{
    if(!key||reconcileLock.current)return;const raw=localStorage.getItem(key);if(!raw){setPending(false);setUncertain(false);setAttemptRaw('');return;}
    reconcileLock.current=true;setPending(true);setAttemptRaw(raw);
    try{
      if(!market)throw Error('Registered market unavailable');
      const attempt=parseTradeAttempt(raw),manifest=await loadPudgeManifest(rpc,JSON.stringify(market.manifest),verifyPudgeInitialProof);
      const result=await reconcilePudgeTrade(rpc,attempt,manifest);
      if(localStorage.getItem(key)!==raw)throw Error('Trade journal changed during reconciliation');
      localStorage.removeItem(key);setPending(false);setUncertain(false);setAttemptRaw('');setRevision(value=>value+1);
      if(!silent)toast.success(locale==='zh-CN'?'交易已确认':'Trade confirmed',{description:result.hash});
      await Promise.all([refreshMarket(),refreshAccount()]);
    }catch(error){
      setPending(true);setUncertain(true);
      if(!silent)toast.warning(locale==='zh-CN'?'交易仍待核对':'Trade still awaiting confirmation',{description:error instanceof Error?error.message:'Check again before retrying'});
    }finally{reconcileLock.current=false;}
  },[account.owner,key,locale,market,refreshAccount,refreshMarket]);

  useEffect(()=>{
    if(!key){setPending(false);setUncertain(false);setAttemptRaw('');return;}
    const raw=localStorage.getItem(key);setAttemptRaw(raw||'');setPending(!!raw);setUncertain(!!raw);
    if(raw)void reconcile(true);
  },[key,reconcile]);
  useEffect(()=>{if(!pending||!market)return;const timer=setInterval(()=>void reconcile(true),8_000);return()=>clearInterval(timer);},[pending,market,reconcile]);

  const trade=useCallback(async(side:Side,quantity:bigint,quotedAmount:bigint)=>{
    if(busy)return;setBusy(true);const toastId=toast.loading(copy(locale,'reviewing'));
    try{
      if(!market||!signer||!await signer.isConnected())throw Error('Connect a supported Pudge wallet');
      if(account.state!=='ready'||account.owner===''||!key)throw Error('Wallet account or CKB balance is not verified');
      if(!navigator.locks)throw Error('Exclusive trade lock unavailable');
      await navigator.locks.request(`roveko-gate2-trade-${account.owner.toLowerCase()}`,{mode:'exclusive',ifAvailable:true},async lock=>{
        if(!lock)throw Error('Another trade action is in progress');
        if(localStorage.getItem(key)!==null)throw Error('A previous trade requires reconciliation');
        const current=active.current;if(!current||current!==signer||!await current.isConnected())throw Error('Wallet changed before preparation');
        const address=await current.getRecommendedAddressObj(),owner=address.script.hash();
        const [walletGenesis,rpcGenesis]=await Promise.all([current.client.getHeaderByNumber(0),pudgeRpc<string>('get_block_hash',['0x0'])]);
        if(owner.toLowerCase()!==account.owner.toLowerCase()||walletGenesis?.hash?.toLowerCase()!==PUDGE_GENESIS||rpcGenesis.toLowerCase()!==PUDGE_GENESIS)throw Error('Wallet account or network changed');
        const manifest=await loadPudgeManifest(rpc,JSON.stringify(market.manifest),verifyPudgeInitialProof);
        const review=await prepareLocalReview(rpc,manifest,owner,side,quantity,address.script) as Review;
        if(review.amount!==quotedAmount){await refreshMarket();throw Error('The curve quote changed. Review the updated quote and try again.');}
        if(active.current!==current||!await current.isConnected()||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==owner.toLowerCase())throw Error('Wallet changed during preparation');
        const confirmToast=toast.loading(copy(locale,'walletApproval'),{id:toastId});
        const signed=await current.signTransaction(clone(review.transaction));
        verifyInitializationSignature(review.transaction,signed,review.inputs.map(cell=>({lock:ccc.Script.from(cell.lock as ccc.ScriptLike)})),4,owner);
        const [againGenesis,againRpcGenesis]=await Promise.all([current.client.getHeaderByNumber(0),pudgeRpc<string>('get_block_hash',['0x0'])]);
        if(active.current!==current||!await current.isConnected()||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==owner.toLowerCase()||againGenesis?.hash?.toLowerCase()!==PUDGE_GENESIS||againRpcGenesis.toLowerCase()!==PUDGE_GENESIS)throw Error('Wallet or network changed after approval');
        const marketPair=await discoverMarketPair(rpc,[manifest.initial[0],manifest.initial[1]],{indexedOnly:true,maxIndexedDepth:256});
        const custodyPair=await discoverCustodyPair(rpc,{tx_hash:marketPair[0].tx_hash,index:'0x2'});
        const fresh=await readLiveSingletons(rpc,[...marketPair,...custodyPair],PUDGE_GENESIS);
        if(fresh.custodyRoot.toLowerCase()!==review.live.custodyRoot.toLowerCase()||fresh.points.some((point,index)=>pointKey(point)!==pointKey(review.live.points[index])))throw Error('Market or custody proof changed after approval');
        for(const input of review.inputs){
          const live=await pudgeRpc<any>('get_live_cell',[{tx_hash:input.outPoint.txHash,index:input.outPoint.index},true]);
          if(live?.status!=='live'||BigInt(live.cell.output.capacity)!==input.capacity||live.cell.data.content.toLowerCase()!==input.data.toLowerCase()||scriptHash(live.cell.output.lock)!==ccc.Script.from(input.lock as ccc.ScriptLike).hash().toLowerCase()||scriptHash(live.cell.output.type)!==(input.type?ccc.Script.from(input.type as ccc.ScriptLike).hash().toLowerCase():''))throw Error('A reviewed trade input changed after approval');
        }
        const record=makeTradeAttempt(PUDGE_GENESIS,owner,signed),raw=JSON.stringify(record);
        if(localStorage.getItem(key)!==null)throw Error('A previous trade requires reconciliation');
        localStorage.setItem(key,raw);setAttemptRaw(raw);setPending(true);setUncertain(true);
        toast.loading(copy(locale,'broadcasting'),{id:confirmToast});
        const submitted=await current.client.sendTransaction(signed);
        if(submitted.toLowerCase()!==record.txHash.toLowerCase())throw Error('Wallet returned an unexpected transaction hash; reconcile before retrying');
        toast.success(locale==='zh-CN'?'交易已提交':'Trade submitted',{id:confirmToast,description:record.txHash});
      });
    }catch(error){
      toast.error(locale==='zh-CN'?'交易未完成':'Trade not completed',{id:toastId,description:error instanceof Error?error.message:'Trade preparation or approval failed'});
    }finally{setBusy(false);}
  },[account.owner,account.state,busy,key,locale,market,refreshMarket,signer]);

  return {trade,busy,pending,uncertain,attemptRaw,reconcile,revision};
}

function pointKey(point:{tx_hash:string;index:string}){return `${point.tx_hash.toLowerCase()}:${BigInt(point.index)}`;}
function scriptHash(script:unknown){if(!script)return '';const value=script as {code_hash:string;hash_type:string;args:string};return ccc.Script.from({codeHash:value.code_hash,hashType:value.hash_type as ccc.HashType,args:value.args}).hash().toLowerCase();}

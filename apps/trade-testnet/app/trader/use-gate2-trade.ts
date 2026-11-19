"use client";

import {useCallback,useEffect,useRef,useState} from 'react';
import {useSigner} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {toast} from 'sonner';
import {loadPudgeManifest} from '../../lib/v2-engine/pudge-manifest.ts';
import {verifyPudgeInitialProof} from '../../lib/v2-engine/pudge-proof-client.ts';
import {prepareLocalReview} from '../../lib/v2-engine/local-review.ts';
import {validateLiveSingletons} from '../../lib/v2-engine/live.ts';
import {quote} from '../../lib/v2-engine/curve.ts';
import {verifyInitializationSignature} from '../../lib/v2-engine/initialization-signature.ts';
import {makeTradeAttempt,parseTradeAttempt,reconcilePudgeTrade,tradeKey,verifyTradeInclusion} from '../../lib/v2-engine/pudge-trade-journal.ts';
import {PUDGE_GENESIS,pudgeRpc,pudgeReadBatch} from './rpc';
import {useAccount} from './account-provider';
import {useLocale} from '../i18n-provider';
import {copy} from './copy';
import type {MarketData,Side} from './types';

const clone=(tx:ccc.Transaction)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(cccA.JsonRpcTransformers.transactionFrom(tx)));
const rpc=(method:string,params:unknown[])=>pudgeRpc(method,params);
function tradeTiming(hash:string,stage:string,at=Date.now(),detail?:string){
  console.info('Roveko transaction timeline',JSON.stringify({hash,stage,at,detail}));
}

export function useGate2Trade(market:MarketData|null,refreshMarket:()=>Promise<void>,refreshAccount:()=>Promise<void>){
  const signer=useSigner(),account=useAccount(),{locale}=useLocale(),active=useRef(signer);active.current=signer;
  const [busy,setBusy]=useState(false),[pending,setPending]=useState(false),[uncertain,setUncertain]=useState(false),[attemptRaw,setAttemptRaw]=useState(''),[revision,setRevision]=useState(0);
  const reconcileLock=useRef(false), accounting=useRef(new Set<string>());
  const [failure,setFailure]=useState<{owner:string;message:string}|null>(null);
  const key=account.owner?tradeKey(PUDGE_GENESIS,account.owner):'';
  const currentKey=useRef(key);currentKey.current=key;
  const [status,setStatus]=useState('');
  const [receipt,setReceipt]=useState('');
  const broadcasting=useRef(false);
  const [readiness,setReadiness]=useState('syncing');
  useEffect(()=>{
    if(!market?.identity||!account.owner)return;
    const controller=new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      try{
        const response=await fetch('/api/v2/pudge-proof',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(4000)])});
        const value=await response.json();
        if(!controller.signal.aborted)setReadiness(response.ok?value.status:'unavailable');
      }catch{if(!controller.signal.aborted)setReadiness('unavailable');}
      finally{if(!controller.signal.aborted)timer=setTimeout(poll,3000);}
    };
    void poll();
    return()=>{controller.abort();clearTimeout(timer);};
  },[market?.identity,account.owner]);
  const prepared=useRef<{key:string;signer:typeof signer;readyAt?:number;controller:AbortController;review:ReturnType<typeof prepareLocalReview>}|null>(null);
  const [,renderPreparation]=useState(0);
  const [failedQuote,setFailedQuote]=useState('');
  useEffect(()=>()=>prepared.current?.controller.abort(),[signer,account.owner,market?.identity,market?.custodyRoot]);
  const quoteKey=(side:Side,quantity:bigint,amount:bigint)=>JSON.stringify([
    market?.genesis,market?.identity,market?.custodyRoot,market?.manifest.initializationTransactionHash,
    account.owner,revision,side,quantity.toString(),amount.toString(),
  ]);
  const preparation=useCallback((side:Side,quantity:bigint,amount:bigint,key:string)=>{
    const previous=prepared.current;
    if(previous?.key===key&&previous.signer===signer&&!previous.controller.signal.aborted)return previous.review;
    if(!market||!signer)throw Error('Wallet or market is unavailable');
    previous?.controller.abort();
    const controller=new AbortController(),id=crypto.randomUUID();
    const review=(async()=>{
      const address=await signer.getRecommendedAddressObj();
      if(active.current!==signer||address.script.hash()!==account.owner)throw Error('Wallet changed during preparation');
      return prepareLocalReview(rpc,market.manifest,account.owner,side,quantity,address.script,
        (stage,ms)=>console.info('Roveko quote stage',id,stage,Math.round(ms)),account.fundingHint,amount,controller.signal);
    })();
    const entry:{key:string;signer:typeof signer;readyAt?:number;controller:AbortController;review:typeof review}={key,signer,controller,review};
    prepared.current=entry;
    setFailedQuote('');
    void review.then(()=>{
      entry.readyAt=Date.now();
      if(prepared.current===entry&&!controller.signal.aborted){
        setFailure(null);renderPreparation(value=>value+1);
      }
    },()=>{
      if(prepared.current===entry&&!controller.signal.aborted){
        prepared.current=null;
        setFailedQuote(key);
      }
    });
    return review;
  },[account.owner,account.fundingHint,market,signer]);
  const prepareQuote=(side:Side,quantity:bigint,amount:bigint)=>{
    if(!market||!signer||account.state!=='ready'||pending||busy||document.hidden||localStorage.getItem(key))return;
    void preparation(side,quantity,amount,quoteKey(side,quantity,amount)).catch(()=>{});
  };
  const quoteStatus=(side:Side,quantity:bigint,amount:bigint)=>{
    const key=quoteKey(side,quantity,amount),entry=prepared.current;
    if(entry?.key===key&&entry.signer===signer&&entry.readyAt!==undefined&&!entry.controller.signal.aborted)return 'ready';
    return failedQuote===key?'unavailable':'updating';
  };

  const dismissError=()=>{if(!pending)setFailure(null);};
  const reconcile=useCallback(async(silent=true)=>{
    if(!key||reconcileLock.current||broadcasting.current)return;
    const raw=localStorage.getItem(key);
    if(!raw)return;
    const current=()=>currentKey.current===key&&localStorage.getItem(key)===raw;
    reconcileLock.current=true;
    try{
      const attempt=parseTradeAttempt(raw);
      if(tradeKey(attempt.genesis,attempt.owner)!==key)throw Error('Trade journal owner or network mismatch');
      const row=await pudgeRpc<{transaction?:unknown;tx_status?:{status?:string;reason?:string;block_hash?:string}}|null>('get_transaction',[attempt.txHash]);
      if(!current())return;
      const state=row?.tx_status?.status;
      if(state==='pending'||state==='proposed'){
        localStorage.setItem(key+':submitted',attempt.txHash);
        setReceipt('');setStatus(state);setUncertain(false);return;
      }
      if(state==='rejected'){
        if(await rpc('get_block_hash',['0x0'])!==attempt.genesis||!current())return;
        localStorage.removeItem(key);localStorage.removeItem(key+':submitted');
        setReceipt('');setAttemptRaw('');setPending(false);setUncertain(false);setStatus('rejected');
        const message=row?.tx_status?.reason||'Node rejected the transaction';
        setFailure({owner:account.owner,message});
        toast.error('Trade rejected',{description:message,id:attempt.txHash});
        return;
      }
      if(state!=='committed'){
        setReceipt('');
        const acknowledged=localStorage.getItem(key+':submitted')===attempt.txHash;
        setStatus(acknowledged?'submitted':'unknown');setUncertain(!acknowledged);return;
      }
      try{await verifyTradeInclusion(rpc,attempt,row);}
      catch(error){
        if(current()){setReceipt('');setStatus('rechecking');setUncertain(false);}
        throw error;
      }
      if(!current())return;
      localStorage.setItem(key+':submitted',attempt.txHash);
      const notifiedKey=key+':notified';
      if(localStorage.getItem(notifiedKey)!==attempt.txHash){
        tradeTiming(attempt.txHash,'canonical-confirmation');
        localStorage.setItem(notifiedKey,attempt.txHash);
        toast.success(locale==='zh-CN'?'交易已确认':'Trade confirmed',{id:attempt.txHash});
      }
      setReceipt(attempt.txHash);setStatus('confirmed');setUncertain(false);
      if(!market||accounting.current.has(raw))return;
      accounting.current.add(raw);
      void (async()=>{
        try{
          const manifest=loadPudgeManifest(rpc,JSON.stringify(market.manifest),verifyPudgeInitialProof);
          void manifest.catch(()=>{});
          const result=await reconcilePudgeTrade(rpc,attempt,manifest);
          await verifyTradeInclusion(rpc,attempt,await rpc('get_transaction',[attempt.txHash]) as typeof row);
          if(!current())return;
          tradeTiming(result.hash,'reconciliation-complete');
          localStorage.setItem(key+':confirmed',result.hash);
          localStorage.removeItem(key);localStorage.removeItem(key+':submitted');
          setFailure(null);setPending(false);setAttemptRaw('');setRevision(value=>value+1);
          await Promise.all([refreshMarket(),refreshAccount()]);
        }catch(error){
          if(current())setFailure({owner:account.owner,message:'Trade confirmed. Waiting for updated trading data.'});
        }finally{accounting.current.delete(raw);}
      })();
    }catch(error){
      if(current()&&!silent)toast.error('Unable to check trade status',{description:error instanceof Error?error.message:undefined});
    }finally{reconcileLock.current=false;}
  },[account.owner,key,locale,market,refreshAccount,refreshMarket]);

  useEffect(()=>{
    const raw=key?localStorage.getItem(key):null;
    setReceipt(!raw&&key?localStorage.getItem(key+':confirmed')||'':'');
    setStatus(raw&&localStorage.getItem(key+':submitted')?'submitted':'');
    setAttemptRaw(raw||'');setPending(!!raw);setUncertain(!!raw&&!localStorage.getItem(key+':submitted'));
  },[key]);
  useEffect(()=>{
    if(!pending||busy)return;
    void reconcile();
    const timer=setInterval(()=>void reconcile(),2000);
    return()=>clearInterval(timer);
  },[pending,busy,reconcile]);
  useEffect(()=>{if(key&&receipt)tradeTiming(receipt,'receipt-displayed');},[key,receipt]);

  const trade=useCallback(async(side:Side,quantity:bigint,quotedAmount:bigint)=>{
    if(busy)return;const started=performance.now(),clickedAt=Date.now();let broadcastHash:string|undefined;
    setBusy(true);setStatus('preparing');setFailure(null);
    try{
      if(!market||!signer||!await signer.isConnected())throw Error('Connect a supported Pudge wallet');
      if(account.state!=='ready'||account.owner===''||!key)throw Error('Wallet account or CKB balance is not verified');
      if(!navigator.locks)throw Error('Exclusive trade lock unavailable');
      await navigator.locks.request(`roveko-gate2-trade-${account.owner.toLowerCase()}`,{mode:'exclusive',ifAvailable:true},async lock=>{
        if(!lock)throw Error('Another trade action is in progress');
        if(localStorage.getItem(key)!==null)throw Error('A previous trade requires reconciliation');
        const current=active.current;if(!current||current!==signer||!await current.isConnected())throw Error('Wallet changed before preparation');
        const address=await current.getRecommendedAddressObj(),owner=address.script.hash();
        const walletGenesis=current.client.getHeaderByNumber(0);
        void walletGenesis.catch(()=>{});
        if(owner.toLowerCase()!==account.owner.toLowerCase())throw Error('Wallet account or network changed');
        const cacheKey=quoteKey(side,quantity,quotedAmount);
        const review=await preparation(side,quantity,quotedAmount,cacheKey);
        const validationStarted=performance.now();
        try{
          const [genesis]=await Promise.all([walletGenesis,validateReviewedInputs(review,side,quantity,quotedAmount)]);
          if(genesis?.hash?.toLowerCase()!==PUDGE_GENESIS)throw Error('Switch UTXO Global to Pudge and try again.');
        }catch(error){
          prepared.current=null;
          void refreshMarket();
          throw error;
        }
        console.info('Roveko trade validation',Math.round(performance.now()-validationStarted));
        if(active.current!==current||!await current.isConnected()||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==owner.toLowerCase())throw Error('Wallet changed during preparation');
        setStatus('awaiting-wallet');
        const reviewedHash=review.transaction.hash();
        tradeTiming(reviewedHash,'click',clickedAt);
        tradeTiming(reviewedHash,'wallet-handoff');
        let signed:ccc.Transaction;
        try{signed=await current.signTransaction(clone(review.transaction));}
        catch(error){
          const walletError=error as {code?:unknown;message?:unknown}|null;
          const message=typeof error==='string'?error:typeof walletError?.message==='string'?walletError.message:'';
          if(String(walletError?.code)==='4001'||/reject|denied|declined|cancel/i.test(message)){
            setStatus('rejected');return;
          }
          throw Error(message||'Wallet approval failed. Open UTXO Global and try again.');
        }
        prepared.current=null;
        setStatus('broadcasting');
        tradeTiming(reviewedHash,'signature-received');
        verifyInitializationSignature(review.transaction,signed,review.inputs.map(cell=>({lock:ccc.Script.from(cell.lock as ccc.ScriptLike)})),4,owner);
        const [againGenesis,againRpcGenesis]=await Promise.all([current.client.getHeaderByNumber(0),pudgeRpc<string>('get_block_hash',['0x0'])]);
        if(active.current!==current||!await current.isConnected()||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==owner.toLowerCase()||againGenesis?.hash?.toLowerCase()!==PUDGE_GENESIS||againRpcGenesis.toLowerCase()!==PUDGE_GENESIS)throw Error('Wallet or network changed after approval');
        await validateReviewedInputs(review,side,quantity,quotedAmount);
        const record=makeTradeAttempt(PUDGE_GENESIS,owner,signed),raw=JSON.stringify(record);
        if(localStorage.getItem(key)!==null)throw Error('A previous trade requires reconciliation');
        broadcasting.current=true;
        localStorage.setItem(key,raw);setAttemptRaw(raw);setPending(true);setUncertain(false);setStatus('broadcasting');
        broadcastHash=record.txHash;
        tradeTiming(broadcastHash,'broadcast-started');
        const submitted=await current.client.sendTransaction(signed);
        if(submitted.toLowerCase()!==record.txHash.toLowerCase())throw Error('Wallet returned an unexpected transaction hash; reconcile before retrying');
        localStorage.setItem(key+':submitted',record.txHash);setStatus('submitted');setUncertain(false);
        tradeTiming(record.txHash,'node-acknowledged');
        toast(locale==='zh-CN'?'交易已提交':'Trade submitted',{id:record.txHash,action:{label:copy(locale,'explorer'),onClick:()=>window.open('https://pudge.explorer.nervos.org/transaction/'+record.txHash,'_blank','noopener,noreferrer')}});
      });
    }catch(error){
      const message=error instanceof Error?error.message:'Trade preparation or approval failed';
      if(broadcastHash)tradeTiming(broadcastHash,'broadcast-failure',Date.now(),message);
      if(key&&localStorage.getItem(key)){setStatus('unknown');setUncertain(true);}
      else setStatus('failed');
      setFailure({owner:account.owner,message});
      toast.error(locale==='zh-CN'?'交易未完成':'Trade not completed',{description:message});
    }finally{broadcasting.current=false;setBusy(false);}
  },[account.owner,account.state,busy,key,locale,market,signer,preparation,revision,refreshMarket]);

  return {trade,dismissError,prepareQuote,quoteStatus,readiness,busy,pending,uncertain,attemptRaw,reconcile,revision,status,receipt:key?receipt:'',error:failure?.owner===account.owner?failure.message:''};
}

async function validateReviewedInputs(review:Awaited<ReturnType<typeof prepareLocalReview>>,side:Side,quantity:bigint,amount:bigint){
  const funding=review.inputs[4];
  const calls=[
    {method:'get_block_hash',params:['0x0']},
    ...review.live.points.map(point=>({method:'get_live_cell',params:[point,true]})),
    {method:'get_live_cell',params:[{tx_hash:funding.outPoint.txHash,index:funding.outPoint.index},true]},
    ...review.transaction.cellDeps.map(dep=>({method:'get_live_cell',params:[
      {tx_hash:dep.outPoint.txHash,index:ccc.numToHex(dep.outPoint.index)},false,
    ]})),
  ];
  calls.push({method:'tx_pool_info',params:[]});
  const rows=await pudgeReadBatch(calls).catch(()=>Promise.all(calls.map(call=>rpc(call.method,call.params))));
  const fresh=validateLiveSingletons(review.live.points,PUDGE_GENESIS,rows[0],rows.slice(1,5));
  const fundingLive=rows[5] as typeof fresh.cells[number] extends infer Cell?{status:string;cell?:Cell}:never;
  const deps=rows.slice(6,6+review.transaction.cellDeps.length) as {status:string}[];
  const pool=rows.at(-1) as {min_fee_rate:string};
  if(deps.some(dep=>dep.status!=='live'))throw Error('A reviewed transaction dependency is unavailable');
  if(fresh.custodyRoot!==review.live.custodyRoot||quote(fresh.curve,side,quantity)!==amount)throw Error('Market or custody quote changed');
  if(fundingLive?.status!=='live'||!fundingLive.cell)throw Error('Reviewed funding is no longer live');
  for(const [index,input] of review.inputs.entries()){
    const cell=index===4?fundingLive.cell!:fresh.cells[index];
    if(BigInt(cell.output.capacity)!==input.capacity||cell.data.content.toLowerCase()!==input.data.toLowerCase()||scriptHash(cell.output.lock)!==ccc.Script.from(input.lock as ccc.ScriptLike).hash().toLowerCase()||scriptHash(cell.output.type)!==(input.type?ccc.Script.from(input.type as ccc.ScriptLike).hash().toLowerCase():''))throw Error('A reviewed trade input changed');
  }
  if(pool){
    const tx=clone(review.transaction);
    tx.witnesses[4]=ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex();
    const rate=BigInt(pool.min_fee_rate)*2n;
    const fee=review.inputs.reduce((total,input)=>total+input.capacity,0n)-tx.outputs.reduce((total,output)=>total+output.capacity,0n);
    if(rate<2000n||rate>200000n||tx.estimateFee(rate)>fee)throw Error('Trade fee is insufficient or outside review bounds');
  }
}

function scriptHash(script:unknown){if(!script)return '';const value=script as {code_hash:string;hash_type:string;args:string};return ccc.Script.from({codeHash:value.code_hash,hashType:value.hash_type as ccc.HashType,args:value.args}).hash().toLowerCase();}

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
import {makeTradeAttempt,parseTradeAttempt,reconcilePudgeTrade,tradeKey} from '../../lib/v2-engine/pudge-trade-journal.ts';
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
  const reconcileLock=useRef(false);
  const [failure,setFailure]=useState<{owner:string;message:string}|null>(null);
  const key=account.owner?tradeKey(PUDGE_GENESIS,account.owner):'';
  const [status,setStatus]=useState('');
  const [receipt,setReceipt]=useState('');
  const broadcasting=useRef(false);
  const prepared=useRef<{key:string;signer:typeof signer;started:number;controller:AbortController;review:ReturnType<typeof prepareLocalReview>}|null>(null);
  useEffect(()=>()=>prepared.current?.controller.abort(),[signer,account.owner,market?.identity,market?.custodyRoot]);
  const quoteKey=(side:Side,quantity:bigint,amount:bigint)=>JSON.stringify([
    market?.genesis,market?.identity,market?.custodyRoot,market?.manifest.initializationTransactionHash,
    account.owner,account.fundingHint?.txHash,account.fundingHint?.index,revision,side,quantity.toString(),amount.toString(),
  ]);
  const preparation=useCallback((side:Side,quantity:bigint,amount:bigint,key:string)=>{
    const previous=prepared.current;
    if(previous?.key===key&&previous.signer===signer&&!previous.controller.signal.aborted&&Date.now()-previous.started<30_000)return previous.review;
    if(!market||!signer)throw Error('Wallet or market is unavailable');
    previous?.controller.abort();
    const controller=new AbortController(),id=crypto.randomUUID();
    const review=(async()=>{
      const address=await signer.getRecommendedAddressObj();
      if(active.current!==signer||address.script.hash()!==account.owner)throw Error('Wallet changed during preparation');
      return prepareLocalReview(rpc,market.manifest,account.owner,side,quantity,address.script,
        (stage,ms)=>console.info('Roveko quote stage',id,stage,Math.round(ms)),account.fundingHint,amount,controller.signal);
    })();
    const entry={key,signer,started:Date.now(),controller,review};
    prepared.current=entry;
    void review.catch(()=>{if(prepared.current===entry)prepared.current=null;});
    return review;
  },[account.owner,account.fundingHint,market,signer]);
  const prepareQuote=(side:Side,quantity:bigint,amount:bigint)=>{
    if(!market||!signer||account.state!=='ready'||pending||busy||document.hidden||localStorage.getItem(key))return;
    void preparation(side,quantity,amount,quoteKey(side,quantity,amount)).catch(()=>{});
  };

  const reconcile=useCallback(async(silent=false)=>{
    if(!key||reconcileLock.current||broadcasting.current)return;const raw=localStorage.getItem(key);if(!raw){setPending(false);setUncertain(false);setAttemptRaw('');return;}
    reconcileLock.current=true;setPending(true);setAttemptRaw(raw);
    try{
      const attempt=parseTradeAttempt(raw);
      const row=await pudgeRpc<{tx_status?:{status?:string;reason?:string}}|null>('get_transaction',[attempt.txHash]);
      const state=row?.tx_status?.status;
      if(state==='pending'||state==='proposed'){tradeTiming(attempt.txHash,state);setStatus(state);setUncertain(false);return;}
      if(state==='rejected'){
        if(localStorage.getItem(key)===raw){
          localStorage.removeItem(key);localStorage.removeItem(key+':submitted');
          setPending(false);setUncertain(false);setStatus('rejected');
          setFailure({owner:account.owner,message:row?.tx_status?.reason||'Node rejected the transaction'});
        }
        return;
      }
      if(state!=='committed')throw Error('Node has not reported a transaction status');
      setStatus('reconciling');setUncertain(false);
      if(!market)throw Error('Registered market unavailable');
      const manifest=await loadPudgeManifest(rpc,JSON.stringify(market.manifest),verifyPudgeInitialProof);
      const result=await reconcilePudgeTrade(rpc,attempt,manifest);
      tradeTiming(result.hash,'canonical-confirmation');
      if(localStorage.getItem(key)!==raw)throw Error('Trade journal changed during reconciliation');
      localStorage.setItem(key+':confirmed',result.hash);
      localStorage.removeItem(key);localStorage.removeItem(key+':submitted');
      setReceipt(result.hash);setStatus('confirmed');setPending(false);setUncertain(false);setAttemptRaw('');setRevision(value=>value+1);
      if(!silent)toast.success(locale==='zh-CN'?'交易已确认':'Trade confirmed',{description:result.hash});
      await Promise.all([refreshMarket(),refreshAccount()]);
    }catch(error){
      const acknowledged=!!localStorage.getItem(key+':submitted');
      setPending(true);setUncertain(!acknowledged);setStatus(acknowledged?'submitted':'unknown');
      if(!silent)toast.warning(locale==='zh-CN'?'交易仍待核对':'Trade still awaiting confirmation',{description:error instanceof Error?error.message:'Check again before retrying'});
    }finally{reconcileLock.current=false;}
  },[account.owner,key,locale,market,refreshAccount,refreshMarket]);

  useEffect(()=>{
    if(!key){setPending(false);setUncertain(false);setAttemptRaw('');setReceipt('');return;}
    const raw=localStorage.getItem(key),submitted=!!localStorage.getItem(key+':submitted');
    setReceipt(localStorage.getItem(key+':confirmed')||'');
    setAttemptRaw(raw||'');setPending(!!raw);setUncertain(!!raw&&!submitted);
    if(raw)void reconcile(true);
  },[key,reconcile]);
  useEffect(()=>{if(!pending||!market)return;const timer=setInterval(()=>void reconcile(true),8_000);return()=>clearInterval(timer);},[pending,market,reconcile]);
  useEffect(()=>{if(key&&receipt)tradeTiming(receipt,'receipt-displayed');},[key,receipt]);

  const trade=useCallback(async(side:Side,quantity:bigint,quotedAmount:bigint)=>{
    if(busy)return;const started=performance.now(),clickedAt=Date.now();let broadcastHash:string|undefined;
    setBusy(true);setStatus('preparing');setFailure(null);const toastId=toast.loading(copy(locale,'reviewing'));
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
        const cacheKey=quoteKey(side,quantity,quotedAmount);
        let review=await preparation(side,quantity,quotedAmount,cacheKey);
        const validationStarted=performance.now();
        try{await validateReviewedInputs(review,side,quantity,quotedAmount,true);}
        catch{
          prepared.current=null;
          toast.loading(locale==='zh-CN'?'正在更新报价':'Refreshing executable quote',{id:toastId});
          review=await preparation(side,quantity,quotedAmount,cacheKey);
          await validateReviewedInputs(review,side,quantity,quotedAmount,true);
        }
        if(active.current!==current||!await current.isConnected()||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==owner.toLowerCase())throw Error('Wallet changed during preparation');
        setStatus('awaiting-wallet');
        const confirmToast=toast.loading(copy(locale,'walletApproval'),{id:toastId});
        prepared.current=null;
        console.info('Roveko trade preparation',JSON.stringify({validationMs:Math.round(performance.now()-validationStarted),totalMs:Math.round(performance.now()-started)}));
        const reviewedHash=review.transaction.hash();
        tradeTiming(reviewedHash,'click',clickedAt);
        tradeTiming(reviewedHash,'wallet-handoff');
        const signed=await current.signTransaction(clone(review.transaction));
        tradeTiming(reviewedHash,'signature-received');
        verifyInitializationSignature(review.transaction,signed,review.inputs.map(cell=>({lock:ccc.Script.from(cell.lock as ccc.ScriptLike)})),4,owner);
        const [againGenesis,againRpcGenesis]=await Promise.all([current.client.getHeaderByNumber(0),pudgeRpc<string>('get_block_hash',['0x0'])]);
        if(active.current!==current||!await current.isConnected()||(await current.getRecommendedAddressObj()).script.hash().toLowerCase()!==owner.toLowerCase()||againGenesis?.hash?.toLowerCase()!==PUDGE_GENESIS||againRpcGenesis.toLowerCase()!==PUDGE_GENESIS)throw Error('Wallet or network changed after approval');
        await validateReviewedInputs(review,side,quantity,quotedAmount,false);
        const record=makeTradeAttempt(PUDGE_GENESIS,owner,signed),raw=JSON.stringify(record);
        if(localStorage.getItem(key)!==null)throw Error('A previous trade requires reconciliation');
        broadcasting.current=true;
        localStorage.setItem(key,raw);setAttemptRaw(raw);setPending(true);setUncertain(false);setStatus('broadcasting');
        toast.loading(copy(locale,'broadcasting'),{id:confirmToast});
        broadcastHash=record.txHash;
        tradeTiming(broadcastHash,'broadcast-started');
        const submitted=await current.client.sendTransaction(signed);
        if(submitted.toLowerCase()!==record.txHash.toLowerCase())throw Error('Wallet returned an unexpected transaction hash; reconcile before retrying');
        localStorage.setItem(key+':submitted',record.txHash);setStatus('submitted');setUncertain(false);
        tradeTiming(record.txHash,'node-acknowledged');
        toast.success(locale==='zh-CN'?'交易已提交':'Trade submitted',{id:confirmToast,description:record.txHash});
      });
    }catch(error){
      const message=error instanceof Error?error.message:'Trade preparation or approval failed';
      if(broadcastHash)tradeTiming(broadcastHash,'broadcast-failure',Date.now(),message);
      if(key&&localStorage.getItem(key)){setStatus('unknown');setUncertain(true);}
      else setStatus(/reject|denied|cancel/i.test(message)?'rejected':'failed');
      setFailure({owner:account.owner,message});
      toast.error(locale==='zh-CN'?'交易未完成':'Trade not completed',{id:toastId,description:message});
    }finally{broadcasting.current=false;setBusy(false);}
  },[account.owner,account.state,busy,key,locale,market,signer,preparation,revision]);

  return {trade,prepareQuote,busy,pending,uncertain,attemptRaw,reconcile,revision,status,receipt:key?receipt:'',error:failure?.owner===account.owner?failure.message:''};
}

async function validateReviewedInputs(review:Awaited<ReturnType<typeof prepareLocalReview>>,side:Side,quantity:bigint,amount:bigint,checkFee:boolean){
  const funding=review.inputs[4];
  const calls=[
    {method:'get_block_hash',params:['0x0']},
    ...review.live.points.map(point=>({method:'get_live_cell',params:[point,true]})),
    {method:'get_live_cell',params:[{tx_hash:funding.outPoint.txHash,index:funding.outPoint.index},true]},
    ...review.transaction.cellDeps.map(dep=>({method:'get_live_cell',params:[
      {tx_hash:dep.outPoint.txHash,index:ccc.numToHex(dep.outPoint.index)},false,
    ]})),
  ];
  if(checkFee)calls.push({method:'tx_pool_info',params:[]});
  const rows=await pudgeReadBatch(calls).catch(()=>Promise.all(calls.map(call=>rpc(call.method,call.params))));
  const fresh=validateLiveSingletons(review.live.points,PUDGE_GENESIS,rows[0],rows.slice(1,5));
  const fundingLive=rows[5] as typeof fresh.cells[number] extends infer Cell?{status:string;cell?:Cell}:never;
  const deps=rows.slice(6,6+review.transaction.cellDeps.length) as {status:string}[];
  const pool=checkFee?rows.at(-1) as {min_fee_rate:string}:null;
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

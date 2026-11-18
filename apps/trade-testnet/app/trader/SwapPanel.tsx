"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {useAccount} from './account-provider';
import {useLocale} from '../i18n-provider';
import {quote} from '../../lib/v2-engine/curve.ts';
import {copy} from './copy';
import TokenInput from './TokenInput';
import SwapInfoBoard from './SwapInfoBoard';
import type {MarketData,Side} from './types';
import {formatCkb,parseCkb} from './rpc';
import {PUDGE_TRADE_CHANGE_CAPACITY,PUDGE_TRADE_FEE} from '../../lib/v2-engine/market-capacity.ts';

const FEE=PUDGE_TRADE_FEE;
function maximumWholeTokens(market:MarketData,budget:bigint){
  let low=0n,high=BigInt(market.inventory);
  const curve={base:BigInt(market.curve.base),step:BigInt(market.curve.step),supply:BigInt(market.curve.supply),inventory:BigInt(market.inventory)};
  while(low<high){const mid=(low+high+1n)>>1n;try{if(quote(curve,'buy',mid)<=budget)low=mid;else high=mid-1n;}catch{high=mid-1n;}}
  return low;
}

export default function SwapPanel({market,tokenBalance,tokenBalanceState,ckbBalance,hasFundingCell,walletReady,walletState,pending,busy,readiness,tradeError,onTrade,onPrepare,quoteStatus,tradeStatus,onQuoteChange,onSideChange,onRefreshTokenBalance,className=''}:{market:MarketData;tokenBalance:bigint|null;tokenBalanceState:'idle'|'loading'|'ready'|'unavailable';ckbBalance:bigint|null;hasFundingCell:boolean;walletReady:boolean;walletState:string;pending:boolean;busy:boolean;readiness?:string;tradeError?:string;onTrade:(side:Side,quantity:bigint,amount:bigint)=>Promise<void>;tradeStatus?:string;quoteStatus?:(side:Side,quantity:bigint,amount:bigint)=>string;onPrepare?:(side:Side,quantity:bigint,amount:bigint)=>void;onQuoteChange?:(price:number|null,side:Side)=>void;onSideChange?:(side:Side)=>void;onRefreshTokenBalance:()=>void;className?:string}){
  const account=useAccount();
  const {locale}=useLocale();const [side,setSide]=useState<Side>('buy'),[budget,setBudget]=useState(''),[quantityText,setQuantityText]=useState('');
  const curve={base:BigInt(market.curve.base),step:BigInt(market.curve.step),supply:BigInt(market.curve.supply),inventory:BigInt(market.inventory)};
  const quoteState=useMemo(()=>{
    try{
      let quantity=0n,amount=0n,invalid=false,tooSmall=false;
      if(side==='buy'){const input=parseCkb(budget);if(input>0n){quantity=maximumWholeTokens(market,input);if(quantity>0n)amount=quote(curve,'buy',quantity);else tooSmall=true;}}
      else{if(!/^[0-9]+$/.test(quantityText))return {quantity,amount,invalid:quantityText!=='',tooSmall:false,impactBps:null as number|null,projectedPrice:null as number|null};quantity=BigInt(quantityText);if(quantity===0n)return {quantity,amount,invalid:false,tooSmall:false,impactBps:null as number|null,projectedPrice:null as number|null};amount=quote(curve,'sell',quantity);}
      if(quantity===0n)return {quantity,amount,invalid,tooSmall,impactBps:null as number|null,projectedPrice:null as number|null};
      const marginal=quote(curve,side,1n),denominator=marginal*quantity,difference=side==='buy'?amount-denominator:denominator-amount;
      const impactBps=denominator===0n?0:Number(difference*10_000n/denominator);
      return {quantity,amount,invalid:false,tooSmall:false,impactBps,projectedPrice:Number(amount)/100_000_000/Number(quantity)};
    }catch{return {quantity:0n,amount:0n,invalid:side==='sell'?quantityText!=='':budget!=='',tooSmall:false,impactBps:null as number|null,projectedPrice:null as number|null};}
  },[budget,curve.base,curve.inventory,curve.step,curve.supply,market,quantityText,side,tokenBalance]);
  useEffect(()=>onQuoteChange?.(quoteState.projectedPrice,side),[onQuoteChange,quoteState.projectedPrice,side]);
  const ckbAvailable=ckbBalance===null?`— CKB`: `${formatCkb(ckbBalance,4)} CKB`;
  const tokenAvailable=tokenBalance===null?'—':tokenBalance.toString();
  const sideChange=(next:Side)=>{setSide(next);setBudget('');setQuantityText('');onSideChange?.(next);};
  const reset=()=>{setBudget('');setQuantityText('');};
  const sellPresets=[25,50,75,100].map(percent=>{const value=tokenBalance?((tokenBalance*BigInt(percent))/100n).toString():'0';return {label:`${percent}% · ${value} ${market.token.symbol}`,value,disabled:value==='0'};});
  const budgetActions=['20','50','100','250'].map(value=>({label:`${value} CKB`,value}));
  const sellBalanceMissing=side==='sell'&&(tokenBalanceState!=='ready'||tokenBalance===null);
  const sellBalanceInsufficient=side==='sell'&&tokenBalance!==null&&quoteState.quantity>tokenBalance;
  const ckbUnavailable=walletReady&&ckbBalance===null;
  const ckbInsufficient=walletReady&&ckbBalance!==null&&quoteState.quantity>0n&&!quoteState.invalid&&(side==='buy'?quoteState.amount>ckbBalance:!hasFundingCell);
  const disabled=busy||walletState==='checking'||(walletReady&&(pending||(!!readiness&&readiness!=='ready')||quoteState.quantity===0n||quoteState.invalid||sellBalanceMissing||sellBalanceInsufficient||ckbInsufficient));
  const prepare=useRef(onPrepare);
  const reviewStatus=quoteStatus?.(side,quoteState.quantity,quoteState.amount);
  const updating=!disabled&&walletReady&&reviewStatus==='updating';
  prepare.current=onPrepare;
  useEffect(()=>{
    if(disabled||!walletReady)return;
    const timer=setTimeout(()=>prepare.current?.(side,quoteState.quantity,quoteState.amount),300);
    return()=>clearTimeout(timer);
  },[disabled,walletReady,side,quoteState.quantity,quoteState.amount,market.identity,market.custodyRoot,account.owner]);
  const action=!walletReady?(walletState==='checking'?copy(locale,'walletChecking'):walletState==='connecting'?copy(locale,'connecting'):copy(locale,'connect')):side==='buy'?copy(locale,'buyAction'):sellBalanceMissing?(['idle','loading'].includes(tokenBalanceState)?copy(locale,'checkingHoldings'):copy(locale,'holdingsUnavailable')):sellBalanceInsufficient?copy(locale,'insufficientTokens'):copy(locale,'sellAction');
  const inputValue=side==='buy'?budget:quantityText;
  const outputValue=side==='buy'?quoteState.quantity.toString():formatCkb(quoteState.amount);
  const inputUnit=side==='buy'?'CKB':market.token.symbol,outputUnit=side==='buy'?market.token.symbol:'CKB';
  const inputBalance=side==='buy'?ckbAvailable:`${tokenAvailable} ${market.token.symbol}`;
  const inputActions=side==='buy'?budgetActions:sellPresets;
  const capacityRequired=(side==='buy'?quoteState.amount:0n)+PUDGE_TRADE_CHANGE_CAPACITY+FEE;
  const totalRequired=side==='buy'?quoteState.amount+FEE:(quoteState.amount>FEE?quoteState.amount-FEE:0n);
  return <aside className={`min-w-0 rounded-[5px] border border-[#28302f] bg-[#141a19] p-4 sm:p-5 ${className}`}>
    <div aria-label={locale==='zh-CN'?'交易方向':'Trade direction'} className="mb-5 grid grid-cols-2 gap-1 rounded-[4px] border border-[#303a37] bg-[#0d1211] p-1">
      {(['buy','sell'] as const).map(value=><button key={value} type="button" aria-pressed={side===value} onClick={()=>sideChange(value)} className={`min-h-9 rounded-[3px] text-[12px] font-semibold transition-colors ${side===value?(value==='buy'?'bg-[#72dfb0] text-[#0a1710]':'bg-[#f08e89] text-[#24100f]'):'text-[#a4afab] hover:bg-[#1b2421]'}`}>{copy(locale,value)}</button>)}
    </div>
    <div className="mb-2 flex items-center justify-between gap-3"><h2 className="m-0 text-[13px] font-semibold text-[#e6ece9]">{copy(locale,'trade')}</h2><span className="text-[10px] text-[#86918c]">{market.pair}</span></div>
    <div className="mb-4 flex flex-col gap-2">
      <TokenInput id={side==='buy'?'swap-budget':'swap-quantity'} label={copy(locale,'pay')} value={inputValue} unit={inputUnit} balance={inputBalance} inputMode="decimal" onChange={value=>side==='buy'?(setBudget(value),setQuantityText('')):(setQuantityText(value),setBudget(''))} actions={inputActions}/>
      <div aria-hidden="true" className="relative z-10 -my-5 mx-auto grid size-9 place-items-center rounded-full border border-[#394742] bg-[#18201d] text-[17px] text-[#a8b7b0]">{side==='buy'?'↓':'↑'}</div>
      <TokenInput id="swap-estimate" label={copy(locale,'receive')} value={outputValue} unit={outputUnit} readOnly onChange={()=>{}}/>
    </div>
    <SwapInfoBoard locale={locale} side={side} impactBps={quoteState.impactBps} fee={FEE} price={side==='buy'?market.buyOneShannons:market.sellOneShannons} capacity={capacityRequired} quoteAmount={quoteState.amount} totalRequired={totalRequired} availableToTrade={ckbBalance} tokenQuantity={quoteState.quantity} symbol={market.token.symbol}/>
    {side==='sell'&&tokenBalanceState==='loading'&&<p role="status" aria-live="polite" className="mb-0 mt-3 text-[11px] text-[#a8b7b0]">{copy(locale,'checkingHoldings')}</p>}
    {side==='sell'&&tokenBalanceState==='unavailable'&&<div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#e3be85]"><span>{copy(locale,'holdingsUnavailable')}</span><button type="button" onClick={onRefreshTokenBalance} className="min-h-8 rounded-[3px] border border-[#75613c] px-3 text-[11px] text-[#f0dfb8] hover:bg-[#2b241a]">{copy(locale,'retry')}</button></div>}
    {quoteState.invalid&&<p role="alert" className="mb-0 mt-3 text-[11px] text-[#f0b8ad]">{copy(locale,side==='sell'?'fractionalToken':'invalidBudget')}</p>}
    {quoteState.tooSmall&&<p role="status" className="mb-0 mt-3 text-[11px] text-[#e8cc94]">{copy(locale,'budgetTooSmall')}</p>}
    {ckbInsufficient&&quoteState.quantity>0n&&<p role="alert" className="mb-0 mt-3 text-[11px] text-[#f0b8ad]">{copy(locale,'insufficientCkb')}</p>}
    {ckbUnavailable&&quoteState.quantity>0n&&<p role="status" className="mb-0 mt-3 text-[11px] text-[#a4afab]">{copy(locale,'balanceUnavailable')}</p>}
    {tradeError&&<p role="alert" className="mb-0 mt-3 break-words text-[11px] text-[#f0b8ad]">{tradeError}</p>}
    {walletReady&&readiness&&readiness!=='ready'&&<p role="status" className="mb-0 mt-3 text-[11px] text-[#a4afab]">{readiness==='unavailable'?'Trading state unavailable. Roveko will retry.':'Synchronizing trading state'}</p>}
    <button type="button" disabled={disabled||updating} aria-busy={updating||busy||walletState==='connecting'||walletState==='checking'} onClick={()=>walletReady?void onTrade(side,quoteState.quantity,quoteState.amount):account.connect()} className={`mt-4 min-h-12 w-full rounded-[4px] text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${side==='buy'?'bg-[#72dfb0] text-[#0a1710] hover:bg-[#8ce9bd]':'bg-[#f08e89] text-[#24100f] hover:bg-[#f5a39e]'}`}>
      {busy?copy(locale,tradeStatus==='awaiting-wallet'?'walletApproval':tradeStatus==='broadcasting'?'broadcasting':'reviewing'):pending&&walletReady?(tradeStatus==='submitted'?'Submitted · Awaiting confirmation':copy(locale,'pending')):updating?'Updating quote':action}
    </button>
    {pending&&<p className="mb-0 mt-3 text-[11px] leading-5 text-[#edc474]">{copy(locale,'unknown')}</p>}
    <p className="mb-0 mt-3 text-[10px] leading-5 text-[#79847f]">{market.token.metadata==='off-chain-testnet-registry'?copy(locale,'registryDescription'):market.token.description||copy(locale,'metadataUnavailable')}</p>
  </aside>;
}

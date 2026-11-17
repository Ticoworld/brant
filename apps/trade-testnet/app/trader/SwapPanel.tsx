"use client";

import {useEffect,useMemo,useState} from 'react';
import {useLocale} from '../i18n-provider';
import {quote} from '../../lib/v2-engine/curve.ts';
import {copy} from './copy';
import TokenInput from './TokenInput';
import SwapInfoBoard from './SwapInfoBoard';
import type {MarketData,Side} from './types';
import {formatCkb,parseCkb} from './rpc';

const FEE=1_000_000n;
function maximumWholeTokens(market:MarketData,budget:bigint){
  let low=0n,high=BigInt(market.inventory);
  const curve={base:BigInt(market.curve.base),step:BigInt(market.curve.step),supply:BigInt(market.curve.supply),inventory:BigInt(market.inventory)};
  while(low<high){const mid=(low+high+1n)>>1n;try{if(quote(curve,'buy',mid)<=budget)low=mid;else high=mid-1n;}catch{high=mid-1n;}}
  return low;
}

export default function SwapPanel({market,tokenBalance,tokenBalanceState,ckbBalance,walletReady,pending,busy,onTrade,onQuoteChange,onSideChange,className=''}:{market:MarketData;tokenBalance:bigint|null;tokenBalanceState:'idle'|'loading'|'ready'|'unavailable';ckbBalance:bigint|null;walletReady:boolean;pending:boolean;busy:boolean;onTrade:(side:Side,quantity:bigint,amount:bigint)=>Promise<void>;onQuoteChange?:(price:number|null,side:Side)=>void;onSideChange?:(side:Side)=>void;className?:string}){
  const {locale}=useLocale();const [side,setSide]=useState<Side>('buy'),[budget,setBudget]=useState(''),[quantityText,setQuantityText]=useState('');
  const curve={base:BigInt(market.curve.base),step:BigInt(market.curve.step),supply:BigInt(market.curve.supply),inventory:BigInt(market.inventory)};
  const quoteState=useMemo(()=>{
    try{
      let quantity=0n,amount=0n;
      if(side==='buy'){const input=parseCkb(budget);if(input>0n){quantity=maximumWholeTokens(market,input);if(quantity>0n)amount=quote(curve,'buy',quantity);}}
      else{if(!/^[1-9][0-9]*$/.test(quantityText))return {quantity,amount,impactBps:null as number|null,projectedPrice:null as number|null};quantity=BigInt(quantityText);amount=quote(curve,'sell',quantity);}
      if(quantity===0n)return {quantity,amount,impactBps:null as number|null,projectedPrice:null as number|null};
      const marginal=quote(curve,side,1n),denominator=marginal*quantity,difference=side==='buy'?amount-denominator:denominator-amount;
      const impactBps=denominator===0n?0:Number(difference*10_000n/denominator);
      return {quantity,amount,impactBps,projectedPrice:Number(amount)/100_000_000/Number(quantity)};
    }catch{return {quantity:0n,amount:0n,impactBps:null as number|null,projectedPrice:null as number|null};}
  },[budget,curve.base,curve.inventory,curve.step,curve.supply,market,quantityText,side,tokenBalance]);
  useEffect(()=>onQuoteChange?.(quoteState.projectedPrice,side),[onQuoteChange,quoteState.projectedPrice,side]);
  const ckbAvailable=ckbBalance===null?'—':formatCkb(ckbBalance,4);
  const tokenAvailable=tokenBalance===null?'—':tokenBalance.toString();
  const sideChange=(next:Side)=>{setSide(next);setBudget('');setQuantityText('');onSideChange?.(next);};
  const reset=()=>{setBudget('');setQuantityText('');};
  const sellPresets=[25,50,75,100].map(percent=>({label:`${percent}%`,value:tokenBalance?((tokenBalance*BigInt(percent))/100n).toString():'0'}));
  const budgetActions=['20','50','100','250'].map(value=>({label:`${value} CKB`,value}));
  const sellBalanceMissing=side==='sell'&&(tokenBalanceState!=='ready'||tokenBalance===null);
  const sellBalanceInsufficient=side==='sell'&&tokenBalance!==null&&quoteState.quantity>tokenBalance;
  const disabled=!walletReady||pending||busy||quoteState.quantity===0n||sellBalanceMissing||sellBalanceInsufficient||(side==='buy'&&ckbBalance!==null&&ckbBalance<quoteState.amount+FEE);
  const action=!walletReady?copy(locale,'connect'):side==='buy'?copy(locale,'buyAction'):sellBalanceMissing?(['idle','loading'].includes(tokenBalanceState)?copy(locale,'checkingHoldings'):copy(locale,'holdingsUnavailable')):sellBalanceInsufficient?copy(locale,'insufficientTokens'):copy(locale,'sellAction');
  const inputValue=side==='buy'?budget:quantityText;
  const outputValue=side==='buy'?quoteState.quantity.toString():formatCkb(quoteState.amount);
  const inputUnit=side==='buy'?'CKB':'xUDT',outputUnit=side==='buy'?'xUDT':'CKB';
  const inputBalance=side==='buy'?ckbAvailable:tokenAvailable;
  const inputActions=side==='buy'?budgetActions:sellPresets;
  return <aside className={`min-w-0 rounded-[5px] border border-[#28302f] bg-[#141a19] p-4 sm:p-5 ${className}`}>
    <div aria-label={locale==='zh-CN'?'交易方向':'Trade direction'} className="mb-5 grid grid-cols-2 gap-1 rounded-[4px] border border-[#303a37] bg-[#0d1211] p-1">
      {(['buy','sell'] as const).map(value=><button key={value} type="button" aria-pressed={side===value} onClick={()=>sideChange(value)} className={`min-h-9 rounded-[3px] text-[12px] font-semibold transition-colors ${side===value?(value==='buy'?'bg-[#72dfb0] text-[#0a1710]':'bg-[#f08e89] text-[#24100f]'):'text-[#a4afab] hover:bg-[#1b2421]'}`}>{copy(locale,value)}</button>)}
    </div>
    <div className="mb-2 flex items-center justify-between gap-3"><h2 className="m-0 text-[13px] font-semibold text-[#e6ece9]">{copy(locale,'trade')}</h2><span className="text-[10px] text-[#86918c]">{copy(locale,'routeMarket')}</span></div>
    <div className="mb-4 flex flex-col gap-2">
      <TokenInput id={side==='buy'?'swap-budget':'swap-quantity'} label={copy(locale,'pay')} value={inputValue} unit={inputUnit} balance={inputBalance} inputMode={side==='buy'?'decimal':'numeric'} onChange={value=>side==='buy'?(setBudget(value.replace(/[^0-9.]/g,'')),setQuantityText('')):(setQuantityText(value.replace(/[^0-9]/g,'')),setBudget(''))} actions={inputActions}/>
      <div aria-hidden="true" className="relative z-10 -my-5 mx-auto grid size-9 place-items-center rounded-full border border-[#394742] bg-[#18201d] text-[17px] text-[#a8b7b0]">{side==='buy'?'↓':'↑'}</div>
      <TokenInput id="swap-estimate" label={copy(locale,'receive')} value={outputValue} unit={outputUnit} readOnly onChange={()=>{}}/>
    </div>
    <SwapInfoBoard locale={locale} side={side} impactBps={quoteState.impactBps} fee={FEE} price={side==='buy'?market.buyOneShannons:market.sellOneShannons} capacity={locale==='zh-CN'?'批准前检查':'Checked before approval'}/>
    <button type="button" disabled={disabled} onClick={()=>void onTrade(side,quoteState.quantity,quoteState.amount)} className={`mt-4 min-h-12 w-full rounded-[4px] text-[13px] font-semibold transition-colors ${side==='buy'?'bg-[#72dfb0] text-[#0a1710] hover:bg-[#8ce9bd]':'bg-[#f08e89] text-[#24100f] hover:bg-[#f5a39e]'}`}>
      {busy?copy(locale,'reviewing'):pending?copy(locale,'pending'):!walletReady?copy(locale,'connect'):action}
    </button>
    {pending&&<p className="mb-0 mt-3 text-[11px] leading-5 text-[#edc474]">{copy(locale,'unknown')}</p>}
    <p className="mb-0 mt-3 text-[10px] leading-5 text-[#79847f]">{copy(locale,'metadataUnavailable')}</p>
  </aside>;
}

import {copy} from './copy';
import type {Locale} from '../i18n';
import {formatCkb} from './rpc';

export default function SwapInfoBoard({locale,side,impactBps,fee,price,capacity,quoteAmount,totalRequired,availableToTrade,tokenQuantity,symbol}:{locale:Locale;side:'buy'|'sell';impactBps:number|null;fee:bigint;price:string;capacity:bigint;quoteAmount:bigint;totalRequired:bigint;availableToTrade:bigint|null;tokenQuantity:bigint;symbol:string}){
  const impact=impactBps===null?'—':`${(impactBps/100).toFixed(2)}%`;
  return <section className="mt-3 rounded-[4px] border border-[#303a37] bg-[#151b19] px-4 py-3">
    <div className="flex items-center justify-between gap-4 text-[12px]"><span className="text-[#aab5b1]">{copy(locale,side==='buy'?'buyPrice':'sellPrice')}</span><span className="text-right font-medium tabular-nums text-[#e9efec]">{formatCkb(price)} CKB / {symbol}</span></div>
    <div className="mt-2 flex items-center justify-between gap-4 text-[12px]"><span className="text-[#aab5b1]">{copy(locale,'quote')}</span><span className="text-right tabular-nums text-[#e9efec]">{tokenQuantity===0n?'—':side==='buy'?`${tokenQuantity} ${symbol} · ${formatCkb(quoteAmount)} CKB`:`${formatCkb(quoteAmount)} CKB`}</span></div>
    <div className="mt-2 flex items-center justify-between gap-4 text-[12px]"><span className="text-[#aab5b1]">{copy(locale,'priceImpact')}</span><span className={`text-right tabular-nums ${impactBps!==null&&impactBps>500?'text-[#f08e89]':'text-[#b9c8c1]'}`}>{impact}</span></div>
    {tokenQuantity>0n&&<div className="mt-2 flex items-center justify-between gap-4 text-[12px]"><span className="text-[#aab5b1]">{copy(locale,'fee')}</span><span className="text-right tabular-nums text-[#e9efec]">{formatCkb(fee)} CKB</span></div>}
    {tokenQuantity>0n&&<div className="mt-2 flex items-center justify-between gap-4 text-[11px]"><span className="text-[#899590]">{copy(locale,'minimumFunding')}</span><span className="text-right tabular-nums text-[#9eaaa5]">{formatCkb(capacity)} CKB</span></div>}
    {tokenQuantity>0n&&<div className="mt-2 flex items-center justify-between gap-4 border-t border-[#303a37] pt-2 text-[11px]"><span className="text-[#899590]">{copy(locale,side==='buy'?'totalRequired':'netProceeds')}</span><span className="text-right tabular-nums text-[#dce5e1]">{formatCkb(totalRequired)} CKB</span></div>}
    {availableToTrade!==null&&<div className="mt-2 flex items-center justify-between gap-4 text-[11px]"><span className="text-[#899590]">{copy(locale,'availableToTrade')}</span><span className="text-right tabular-nums text-[#dce5e1]">{formatCkb(availableToTrade)} CKB</span></div>}
    <p className="mb-0 mt-2 text-[10px] text-[#7e8985]">{copy(locale,'priceImpactHint')}</p>
  </section>;
}

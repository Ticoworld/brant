import {copy} from './copy';
import type {Locale} from '../i18n';
import {formatCkb} from './rpc';

export default function SwapInfoBoard({locale,side,impactBps,fee,price,capacity}:{locale:Locale;side:'buy'|'sell';impactBps:number|null;fee:bigint;price:string;capacity:string}){
  const impact=impactBps===null?'—':`${(impactBps/100).toFixed(2)}%`;
  return <section className="mt-3 rounded-[4px] border border-[#303a37] bg-[#151b19] px-4 py-3">
    <div className="flex items-center justify-between gap-4 text-[12px]"><span className="text-[#aab5b1]">{copy(locale,side==='buy'?'buyPrice':'sellPrice')}</span><span className="text-right font-medium tabular-nums text-[#e9efec]">{formatCkb(price)} CKB / xUDT</span></div>
    <div className="mt-2 flex items-center justify-between gap-4 text-[12px]"><span className="text-[#aab5b1]">{copy(locale,'priceImpact')}</span><span className={`text-right tabular-nums ${impactBps!==null&&impactBps>500?'text-[#f08e89]':'text-[#b9c8c1]'}`}>{impact}</span></div>
    <div className="mt-2 flex items-center justify-between gap-4 text-[12px]"><span className="text-[#aab5b1]">{copy(locale,'fee')}</span><span className="text-right tabular-nums text-[#e9efec]">{formatCkb(fee)} CKB</span></div>
    <div className="mt-2 flex items-center justify-between gap-4 border-t border-[#303a37] pt-2 text-[11px]"><span className="text-[#899590]">{copy(locale,'capacity')}</span><span className="text-right text-[#9eaaa5]">{capacity}</span></div>
    <p className="mb-0 mt-2 text-[10px] text-[#7e8985]">{copy(locale,'priceImpactHint')}</p>
  </section>;
}

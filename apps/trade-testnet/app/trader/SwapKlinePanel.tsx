"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {AreaSeries,ColorType,LineSeries,createChart,createOptionsChart} from 'lightweight-charts';
import type {UTCTimestamp} from 'lightweight-charts';
import type {MarketData,Side} from './types';
import type {Locale} from '../i18n';
import {copy} from './copy';
import {formatCkb} from './rpc';

export default function SwapKlinePanel({market,locale,projectedPrice,side}:{market:MarketData;locale:Locale;projectedPrice:number|null;side:Side}){
  const [view,setView]=useState<'curve'|'full'|'history'>(market.historyState==='verified'&&market.history.some(row=>row.status==='confirmed')?'history':'curve'),container=useRef<HTMLDivElement>(null),manuallySelectedView=useRef(false);
  const chinese=locale==='zh-CN';
  const labels={curve:chinese?'当前区间':'Near current price',full:chinese?'完整曲线':'Full curve',history:copy(locale,'history')};
  useEffect(()=>{
    if(!manuallySelectedView.current&&market.historyState==='verified'&&market.history.some(row=>row.status==='confirmed'))setView('history');
  },[market.historyState,market.history]);
  const historyPoints=useMemo(()=>{
    // Multiple confirmed executions can share the same block timestamp.
    // One volume-weighted point per second preserves their combined price.
    const buckets=new Map<number,{amount:bigint;quantity:bigint}>();
    for(const row of market.history){
      if(row.status!=='confirmed')continue;
      const time=Number(BigInt(row.timestampMs)/1000n),quantity=BigInt(row.quantity);
      if(!Number.isSafeInteger(time)||quantity<=0n)continue;
      const amount=BigInt(row.amountShannons),bucket=buckets.get(time);
      if(bucket){bucket.amount+=amount;bucket.quantity+=quantity;}
      else buckets.set(time,{amount,quantity});
    }
    return [...buckets.entries()].sort(([a],[b])=>a-b).map(([time,{amount,quantity}])=>({
      time,value:Number(amount*10000n/quantity)/1_000_000_000_000,
    }));
  },[market.history]);

  useEffect(()=>{
    const element=container.current;if(!element)return;
    if(view==='history'&&historyPoints.length===0)return;
    const base=BigInt(market.curve.base),step=BigInt(market.curve.step),supply=Number(BigInt(market.curve.supply)),sold=Number(BigInt(market.curve.sold));
    const options={width:element.clientWidth,height:360,layout:{background:{type:ColorType.Solid as const,color:'#111615'},textColor:'#9ba6a2',fontFamily:'Arial, Helvetica, sans-serif',fontSize:11},grid:{vertLines:{color:'#252d2b'},horzLines:{color:'#252d2b'}},rightPriceScale:{borderColor:'#303a37',scaleMargins:{top:.12,bottom:.12}},timeScale:{borderColor:'#303a37'},crosshair:{vertLine:{color:'#65706c',labelBackgroundColor:'#29332f'},horzLine:{color:'#65706c',labelBackgroundColor:'#29332f'}}};
    const chart=(()=>{
      if(view==='history'){
        const historyChart=createChart(element,{...options,timeScale:{...options.timeScale,timeVisible:true}});
        historyChart.addSeries(LineSeries,{color:'#72dfb0',lineWidth:2,priceLineVisible:false,lastValueVisible:true})
          .setData(historyPoints.map(point=>({...point,time:point.time as UTCTimestamp})));
        return historyChart;
      }
      const curveChart=createOptionsChart(element,{
        ...options,
        localization:{priceFormatter:(value:number)=>value.toFixed(2),timeFormatter:(value:number)=>value.toLocaleString(locale)},
      });
      const low=view==='full'?0:Math.max(0,sold-10);
      const high=view==='full'?supply:Math.min(supply,sold+20);
      const stride=Math.max(1,Math.ceil((high-low)/400));
      const positions=new Set([low,high,sold]);
      for(let position=low;position<high;position+=stride)positions.add(position);
      const series=curveChart.addSeries(AreaSeries,{lineColor:'#5ed4df',topColor:'rgba(94,212,223,.24)',bottomColor:'rgba(94,212,223,.015)',lineWidth:2,priceLineVisible:false,lastValueVisible:false});
      series.setData([...positions].sort((a,b)=>a-b).map(position=>({time:position,value:Number(base+step*BigInt(position))/100_000_000})));
      if(sold<supply)series.createPriceLine({
        price:Number(BigInt(market.buyOneShannons))/100_000_000,
        color:'#72dfb0',lineWidth:1,lineStyle:2,axisLabelVisible:true,
        title:locale==='zh-CN'?'当前买入':'Current buy',
      });
      return curveChart;
    })();
    chart.timeScale().fitContent();
    const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width)chart.applyOptions({width});});observer.observe(element);
    return()=>{observer.disconnect();chart.remove();};
  },[historyPoints,locale,market.curve,market.buyOneShannons,view]);

  return <section className="flex min-h-[530px] min-w-0 flex-col overflow-hidden rounded-[5px] border border-[#28302f] bg-[#111615]">
    <div className="flex min-h-[62px] flex-wrap items-center justify-between gap-3 border-b border-[#28302f] px-4 py-3 sm:px-5">
      <div className="min-w-0"><span className="text-[16px] font-semibold text-[#edf1ef]">{market.pair}</span><div className="mt-1 text-[11px] text-[#8f9b96]">{view==='history'?(chinese?'已确认成交均价（同秒按数量加权）':'Confirmed execution prices (volume-weighted per second)'):(chinese?'假设曲线价格（CKB / RVK）':'Hypothetical curve prices (CKB per RVK)')}</div></div>
      <div aria-label={locale==='zh-CN'?'图表视图':'Chart view'} className="inline-flex rounded-[4px] border border-[#303a37] bg-[#0c1110] p-0.5">
        {(['curve','full','history'] as const).map(item=><button key={item} type="button" onClick={()=>{manuallySelectedView.current=true;setView(item);}} aria-pressed={view===item} className={`min-h-7 rounded-[3px] px-3 text-[10px] font-medium transition-colors ${view===item?'bg-[#26322e] text-[#e8f4ed]':'text-[#87938e] hover:text-[#d7e0dc]'}`}>{labels[item]}</button>)}
      </div>
    </div>
    <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-[#28302f] px-4 py-3 text-xs sm:px-5">
      <div><div className="text-[#899590]">{copy(locale,'buyPrice')} · 1 {market.token.symbol}</div><strong className="tabular-nums">{market.inventory==='0'?'—':`${formatCkb(market.buyOneShannons)} CKB`}</strong></div>
      <div><div className="text-[#899590]">{copy(locale,'sellPrice')} · 1 {market.token.symbol}</div><strong className="tabular-nums">{market.curve.sold==='0'?'—':`${formatCkb(market.sellOneShannons)} CKB`}</strong></div>
      {projectedPrice!==null&&Number.isFinite(projectedPrice)&&<div><div className="text-[#899590]">{copy(locale,side)} · {chinese?'报价均价':'Quote average'}</div><strong className="tabular-nums">{projectedPrice.toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:4})} CKB / {market.token.symbol}</strong></div>}
    </div>
    {view==='history'&&market.historyState==='unavailable'?<div className="grid min-h-[360px] flex-1 place-items-center px-6 text-center"><div><p className="text-sm font-medium text-[#d7e0dc]">{copy(locale,'noHistory')}</p><p className="text-[11px] text-[#85918c]">{copy(locale,'transactionHistory')}</p></div></div>:view==='history'&&!historyPoints.length?<div className="grid min-h-[360px] flex-1 place-items-center px-6 text-center"><p className="text-sm text-[#9ba6a2]">{copy(locale,'noHistory')}</p></div>:<div ref={container} className="min-h-[360px] flex-1 px-1"/>}
    <div className="flex min-h-9 items-center justify-between border-t border-[#28302f] px-4 text-[10px] text-[#77827e] sm:px-5"><span>{view==='history'?(chinese?'确认时间':'Confirmed time'):(chinese?'已售代币':'Tokens sold')}</span><a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer" className="text-[#8d9994] no-underline hover:text-[#c7d3ce]">TradingView Lightweight Charts™</a></div>
  </section>;
}

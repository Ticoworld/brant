"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {AreaSeries,ColorType,LineSeries,createChart} from 'lightweight-charts';
import type {Time} from 'lightweight-charts';
import type {MarketData,Side} from './types';
import type {Locale} from '../i18n';
import {copy} from './copy';
import {formatCkb} from './rpc';

const CURVE_EPOCH=1_704_067_200;

export default function SwapKlinePanel({market,locale,projectedPrice,side}:{market:MarketData;locale:Locale;projectedPrice:number|null;side:Side}){
  const [view,setView]=useState<'curve'|'history'>('curve'),container=useRef<HTMLDivElement>(null);
  const historyPoints=useMemo(()=>{
    const rows=market.history.filter(row=>row.status==='confirmed').slice().sort((a,b)=>Number(BigInt(a.timestampMs)-BigInt(b.timestampMs))||a.blockNumber.localeCompare(b.blockNumber));
    const points:{time:number;value:number}[]=[];
    for(const row of rows){const timestamp=Math.floor(Number(BigInt(row.timestampMs)/1000n)),amount=Number(BigInt(row.amountShannons))/100_000_000,quantity=Number(BigInt(row.quantity));if(!Number.isFinite(timestamp)||!quantity)continue;const point={time:timestamp,value:amount/quantity};if(points.at(-1)?.time===timestamp)points[points.length-1]=point;else points.push(point);}
    return points;
  },[market.history]);

  useEffect(()=>{
    const element=container.current;if(!element)return;
    if(view==='history'&&historyPoints.length===0)return;
    const base=BigInt(market.curve.base),step=BigInt(market.curve.step),supply=Number(BigInt(market.curve.supply)),sold=Number(BigInt(market.curve.sold));
    const chart=createChart(element,{width:element.clientWidth,height:360,layout:{background:{type:ColorType.Solid,color:'#111615'},textColor:'#9ba6a2',fontFamily:'Arial, Helvetica, sans-serif',fontSize:11},grid:{vertLines:{color:'#252d2b'},horzLines:{color:'#252d2b'}},rightPriceScale:{borderColor:'#303a37',scaleMargins:{top:.12,bottom:.12}},timeScale:{borderColor:'#303a37',timeVisible:view==='history',secondsVisible:false,tickMarkFormatter:(time:Time)=>{
      if(view==='history'){const date=new Date(Number(time)*1000);return new Intl.DateTimeFormat(locale==='zh-CN'?'zh-CN':'en',{month:'short',day:'2-digit'}).format(date);}
      const value=typeof time==='number'?time:CURVE_EPOCH;return `${Math.round(value-CURVE_EPOCH)}`;
    }},crosshair:{vertLine:{color:'#65706c',labelBackgroundColor:'#29332f'},horzLine:{color:'#65706c',labelBackgroundColor:'#29332f'}},handleScroll:{mouseWheel:true,pressedMouseMove:true},handleScale:{mouseWheel:true,pinch:true}});
    const points=view==='curve'?Array.from({length:Math.ceil(supply/5)+1},(_,i)=>Math.min(supply,i*5)).concat([sold]).filter((n,i,a)=>a.indexOf(n)===i).sort((a,b)=>a-b).map(n=>({time:(CURVE_EPOCH+n) as any,value:Number(base+step*BigInt(n))/100_000_000})):historyPoints.map(p=>({time:p.time as any,value:p.value}));
    const series=view==='curve'
      ?chart.addSeries(AreaSeries,{lineColor:'#5ed4df',topColor:'rgba(94,212,223,.24)',bottomColor:'rgba(94,212,223,.015)',lineWidth:2,priceLineVisible:false,lastValueVisible:false})
      :chart.addSeries(LineSeries,{color:'#72dfb0',lineWidth:2,priceLineVisible:false,lastValueVisible:false});
    series.setData(points);
    if(view==='curve'){
      const current=Number(base+step*BigInt(sold))/100_000_000;
      series.createPriceLine({price:current,color:'#72dfb0',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:locale==='zh-CN'?'当前买入':'Current buy'});
    }
    if(projectedPrice!==null&&Number.isFinite(projectedPrice))series.createPriceLine({price:projectedPrice,color:side==='buy'?'#f0c36a':'#f08e89',lineWidth:1,lineStyle:1,axisLabelVisible:true,title:locale==='zh-CN'?'预计成交':'Projected'});
    chart.timeScale().fitContent();
    const observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width;if(width)chart.applyOptions({width});});observer.observe(element);
    return()=>{observer.disconnect();chart.remove();};
  },[historyPoints,locale,market.curve,projectedPrice,side,view]);

  const price=market.buyOneShannons;
  return <section className="flex min-h-[530px] min-w-0 flex-col overflow-hidden rounded-[5px] border border-[#28302f] bg-[#111615]">
    <div className="flex min-h-[62px] flex-wrap items-center justify-between gap-3 border-b border-[#28302f] px-4 py-3 sm:px-5">
      <div className="min-w-0"><div className="flex items-center gap-3"><span className="text-[16px] font-semibold text-[#edf1ef]">{market.pair}</span></div><div className="mt-1 text-[11px] text-[#8f9b96]">{copy(locale,'chartCurrent')}</div></div>
      <div aria-label={locale==='zh-CN'?'图表视图':'Chart view'} className="inline-flex rounded-[4px] border border-[#303a37] bg-[#0c1110] p-0.5">
        {(['curve','history'] as const).map(item=><button key={item} type="button" onClick={()=>setView(item)} aria-pressed={view===item} className={`min-h-7 rounded-[3px] px-3 text-[10px] font-medium transition-colors ${view===item?'bg-[#26322e] text-[#e8f4ed]':'text-[#87938e] hover:text-[#d7e0dc]'}`}>{copy(locale,item)}</button>)}
      </div>
    </div>
    <div className="flex items-end justify-between gap-3 border-b border-[#28302f] px-4 py-3 sm:px-5">
      <div><div className="text-[10px] text-[#899590]">{copy(locale,'buyPrice')} · {market.token.symbol}</div><div className="mt-1 text-[24px] font-semibold leading-7 tabular-nums text-[#edf1ef]">{formatCkb(price)} CKB</div></div>
      <div className="pb-1 text-right text-[10px] text-[#78847f]">{locale==='zh-CN'?'当前买入价格':'Current Buy Price'}</div>
    </div>
    {view==='history'&&market.historyState==='unavailable'?<div className="grid min-h-[360px] flex-1 place-items-center px-6 text-center"><div><p className="text-sm font-medium text-[#d7e0dc]">{copy(locale,'noHistory')}</p><p className="text-[11px] text-[#85918c]">{copy(locale,'transactionHistory')}</p></div></div>:view==='history'&&!historyPoints.length?<div className="grid min-h-[360px] flex-1 place-items-center px-6 text-center"><p className="text-sm text-[#9ba6a2]">{copy(locale,'noHistory')}</p></div>:<div ref={container} className="min-h-[360px] flex-1 px-1"/>}
    <div className="flex min-h-9 items-center justify-between border-t border-[#28302f] px-4 text-[10px] text-[#77827e] sm:px-5"><span>{view==='curve'?(locale==='zh-CN'?'已售代币':'Tokens sold'):(locale==='zh-CN'?'确认时间':'Confirmed time')}</span><a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer" className="text-[#8d9994] no-underline hover:text-[#c7d3ce]">TradingView Lightweight Charts™</a></div>
  </section>;
}

"use client";

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useCallback,useState} from 'react';
import {useLocale} from '../i18n-provider';
import type {Locale} from '../i18n';
import {useAccount} from './account-provider';
import {copy} from './copy';
import {formatCkb} from './rpc';
import type {MarketData,Side,TradeEvent} from './types';
import {useMarketData} from './use-market-data';
import {useMarketSession} from './use-market-session';
import TraderShell from './shell';
import SwapPanel from './SwapPanel';
import SwapKlinePanel from './SwapKlinePanel';

const Gate2LaunchFlow=dynamic(()=>import('../v2/deploy/review'),{ssr:false});

export {default as MarketsScreen} from './MarketsScreen';

export function MarketScreen({id}:{id:string}){
  const {locale}=useLocale();
  const [side,setSide]=useState<Side>('buy');
  const {account,marketQuery,market,trade,inclusion,marketCaughtUp,position}=useMarketSession(id,side);
  const [projectedQuote,setProjectedQuote]=useState<{price:number|null;side:Side}>({price:null,side:'buy'});
  const onQuoteChange=useCallback((price:number|null,side:Side)=>setProjectedQuote({price,side}),[]);
  const tokenBalance=position.state==='ready'?BigInt(position.balance):null;
  const ckbBalance=account.availableToTrade!==''?BigInt(account.availableToTrade):null;
  if(!market)return <TraderShell><LoadState loading={marketQuery.loading} error={marketQuery.error} retry={marketQuery.refresh} locale={locale}/></TraderShell>;
  return <TraderShell><div className="space-y-5">
    {(marketQuery.error||inclusion&&!marketCaughtUp)&&<div role="status" className="flex flex-wrap items-center justify-between gap-3 border-y border-[#5b4a31] py-2.5 text-[11px] text-[#e7ce9c]"><span>{locale==='zh-CN'?'更新失败，显示上次验证的数据':'Showing last verified market data while syncing'} · {market.tip.number}</span><button type="button" onClick={()=>void marketQuery.refresh()} className="min-h-7 rounded-[3px] border border-[#75613c] px-2.5 hover:bg-[#2b241a]">{copy(locale,'retry')}</button></div>}
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#28302f] pb-4">
      <div className="min-w-0"><Link href="/" className="text-[11px] text-[#8d9994] no-underline hover:text-[#d8e2dd]">{copy(locale,'markets')}</Link><div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><h1 className="m-0 text-[20px] font-semibold">{market.token.name}</h1><span className="text-xs text-[#9ba6a2]">{market.pair}</span></div><p className="mb-0 mt-1 text-[11px] text-[#7f8b86]">{market.token.metadata==='off-chain-testnet-registry'?copy(locale,'registryDescription'):market.token.description||copy(locale,'metadataUnavailable')}</p><TokenIdentityDetails market={market} locale={locale}/></div>
      <Link href="/activity" className="text-[10px] text-[#8d9994] underline decoration-[#48534e] underline-offset-2 hover:text-[#d5e0da]">{copy(locale,'transactionHistory')}</Link>
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(330px,1fr)] lg:items-start">
      <div className="order-2 min-w-0 space-y-4 lg:order-1"><MarketSummary market={market} locale={locale}/><SwapKlinePanel market={market} locale={locale} projectedPrice={projectedQuote.price} side={projectedQuote.side}/><MarketRecentTrades market={market} locale={locale}/></div>
      <SwapPanel className="order-1 lg:order-2" market={market} tokenBalance={tokenBalance} tokenBalanceState={position.state} ckbBalance={ckbBalance} ckbCurrent={account.balanceState==='ready'} hasFundingCell={account.hasFundingCell} walletReady={account.state==='ready'} walletState={account.state} pending={trade.pending} busy={trade.busy} tradeError={trade.error} onDismissTradeError={trade.pending?undefined:trade.dismissError} executionStatus={(trade.pending||trade.receipt)&&<section role="status" className="flex flex-wrap items-center gap-3 border-y border-[#303a37] py-3 text-xs text-[#c8d2ce]">
      <span>{trade.uncertain?copy(locale,'unknown'):({preparing:copy(locale,'reviewing'),'awaiting-wallet':copy(locale,'walletApproval'),broadcasting:copy(locale,'broadcasting'),submitted:'Submitted',pending:copy(locale,'pending'),proposed:'Proposed',confirmed:copy(locale,'confirmed'),rechecking:'Rechecking confirmation'}[trade.status]||(trade.pending?copy(locale,'pending'):copy(locale,'confirmed')))}</span>
      {(trade.pending||trade.receipt)&&<a href={explorer(trade.receipt||attemptHash(trade.attemptRaw))} target="_blank" rel="noreferrer" className="underline">{copy(locale,'explorer')}</a>}
      {trade.receipt&&inclusion&&!marketCaughtUp&&!trade.error&&<span>Updating trading data</span>}
      {(trade.uncertain||trade.error)&&trade.pending&&<button onClick={()=>void trade.reconcile(false)} className="min-h-8 rounded-sm border border-[#46514d] px-3">{copy(locale,'reconcile')}</button>}
    </section>} onTrade={trade.trade} onPrepare={trade.prepareQuote} quoteStatus={trade.quoteStatus} tradeStatus={trade.status} readiness={trade.status==='rechecking'||inclusion&&!marketCaughtUp?'syncing':trade.readiness} onQuoteChange={onQuoteChange} onSideChange={setSide} onRefreshTokenBalance={position.retry}/>
    </div>
    {account.state==='unsupported'&&<p className="m-0 text-xs text-[#dfa89c]">{copy(locale,'wrongWallet')}</p>}
    {account.state==='error'&&account.error&&<p className="m-0 text-xs text-[#dfa89c]">{account.error}</p>}
  </div></TraderShell>;
}

function MarketSummary({market,locale}:{market:MarketData;locale:Locale}){
  const items=[[copy(locale,'buyPrice'),`${formatCkb(market.buyOneShannons,4)} CKB`],[copy(locale,'sellPrice'),`${formatCkb(market.sellOneShannons,4)} CKB`],[copy(locale,'reserve'),`${formatCkb(market.reserveShannons,2)} CKB`],[copy(locale,'inventory'),market.inventory],[copy(locale,'supply'),market.supply],[copy(locale,'circulating'),market.circulating]];
  return <section className="grid grid-cols-2 gap-x-5 gap-y-3 border-y border-[#28302f] px-1 py-3 sm:grid-cols-3 xl:grid-cols-5">{items.map(([label,value])=><div key={label} className="min-w-0"><div className="text-[10px] text-[#818d88]">{label}</div><div className="mt-1 truncate text-[12px] font-medium tabular-nums text-[#dce5e1]">{value}</div></div>)}</section>;
}

function TokenIdentityDetails({market,locale}:{market:MarketData;locale:Locale}){
  const [copied,setCopied]=useState(false),[copyFailed,setCopyFailed]=useState(false);
  const copyIdentity=async()=>{
    try{await navigator.clipboard.writeText(market.token.typeHash);setCopied(true);setCopyFailed(false);window.setTimeout(()=>setCopied(false),1800);}
    catch{setCopyFailed(true);setCopied(false);}
  };
  return <details className="mt-2 max-w-2xl text-[10px] text-[#899590]"><summary className="w-fit cursor-pointer select-none text-[#aebbb4] underline decoration-[#53625a] underline-offset-2">{copy(locale,'technicalDetails')}</summary><dl className="mt-2 grid gap-2 border-l border-[#35403b] pl-3"><IdentityRow label={copy(locale,'tokenTypeHash')} value={market.token.typeHash}/><IdentityRow label={copy(locale,'marketIdentity')} value={market.identity}/><IdentityRow label={copy(locale,'networkGenesis')} value={market.genesis}/><IdentityRow label={copy(locale,'launchTransaction')} value={market.manifest?.initializationTransactionHash||'Unavailable'}/></dl><button type="button" onClick={()=>void copyIdentity()} className="mt-2 min-h-8 rounded-[3px] border border-[#35413b] px-2.5 text-[10px] text-[#c6d1cb] hover:bg-[#19211e]">{copy(locale,'copyTokenIdentity')}</button><span role="status" className="ml-2">{copied?copy(locale,'copied'):copyFailed?copy(locale,'copyFailed'):''}</span></details>;
}

function IdentityRow({label,value}:{label:string;value:string}){
  return <div className="min-w-0"><dt>{label}</dt><dd className="m-0 mt-0.5 break-all font-mono text-[#c3cec8]">{value}</dd></div>;
}

function MarketRecentTrades({market,locale}:{market:MarketData;locale:Locale}){
  const events=market.history.filter(event=>event.status==='confirmed').slice(-5).reverse();
  return <section aria-label={copy(locale,'confirmedTrades')}><div className="flex items-center justify-between border-b border-[#28302f] pb-2"><h2 className="m-0 text-xs font-semibold text-[#d9e2de]">{copy(locale,'confirmedTrades')}</h2><Link href="/activity" className="text-[10px] text-[#8f9b96] no-underline hover:text-[#d9e2de]">{copy(locale,'activity')}</Link></div>{!events.length?<p className="mb-0 py-4 text-xs text-[#8c9893]">{copy(locale,'noHistory')}</p>:<div>{events.map(event=><TradeRow key={event.hash+':'+(event.executionIndex??0)} event={event} locale={locale} symbol={market.token.symbol}/>)}</div>}</section>;
}

export {PortfolioScreen} from './PortfolioScreen';

export {ActivityScreen} from './ActivityScreen';

export function LaunchScreen(){
  const {locale}=useLocale(),query=useMarketData(),market=query.data;
  return <TraderShell><div className="space-y-5"><header className="border-b border-[#28302f] pb-4"><h1 className="m-0 text-[21px] font-semibold">{copy(locale,'launchTitle')}</h1><p className="mb-0 mt-1 text-[11px] text-[#85918c]">{copy(locale,'firstPurchase')}</p></header>
    <section className="grid gap-4 border-b border-[#28302f] pb-5 sm:grid-cols-2 lg:grid-cols-4"><LaunchTerm label={copy(locale,'tokenName')} value={locale==='zh-CN'?'此类型不编码名称':'Not encoded by this token type'}/><LaunchTerm label={copy(locale,'symbol')} value="xUDT"/><LaunchTerm label={copy(locale,'totalSupply')} value="2,000 xUDT"/><LaunchTerm label={copy(locale,'basePrice')} value="10 CKB · +1 CKB / token"/></section>
    <p className="m-0 max-w-3xl text-xs leading-5 text-[#a2aea8]">{copy(locale,'launchTemplate')}</p>
    <p className="m-0 text-[10px] text-[#78847e]">{copy(locale,'funding')}: {copy(locale,'marketStatus')} · calculated from current wallet cells during preparation.</p>
    <section className="border-t border-[#28302f] pt-4"><Gate2LaunchFlow embedded/></section>
  </div></TraderShell>;
}

function LaunchTerm({label,value}:{label:string;value:string}){
  return <div className="border-l border-[#3d4a44] pl-3"><div className="text-[10px] text-[#83908a]">{label}</div><div className="mt-1 text-sm font-medium text-[#e0e8e4]">{value}</div></div>;
}

function TradeRow({event,locale,detailed=false,symbol='xUDT'}:{event:TradeEvent;locale:Locale;detailed?:boolean;symbol?:string}){
  return <div className="grid grid-cols-1 gap-1 border-b border-[#252d2b] px-2 py-3 sm:grid-cols-[minmax(92px,.6fr)_minmax(100px,.6fr)_minmax(130px,1fr)_minmax(120px,.8fr)_minmax(100px,.6fr)] sm:items-center sm:gap-3">
    <div className={`text-xs font-medium ${event.side==='buy'?'text-[#7de0b3]':'text-[#f09a92]'}`}>{copy(locale,event.side)}</div>
    <div className="text-xs tabular-nums text-[#d5ddd9]">{event.side==='buy'?`+${event.quantity}`:`-${event.quantity}`} {symbol} <span className="text-[10px] text-[#8b9691]">· {formatCkb(event.amountShannons,4)} CKB</span></div>
    <a href={explorer(event.hash)} target="_blank" rel="noreferrer" className="truncate font-mono text-[10px] text-[#8faaa0] underline decoration-[#34423c] underline-offset-2">{detailed?event.hash:`${event.hash.slice(0,12)}…${event.hash.slice(-7)}`}</a>
    <time className="text-[10px] text-[#95a09b]" dateTime={new Date(Number(BigInt(event.timestampMs))).toISOString()}>{new Intl.DateTimeFormat(locale==='zh-CN'?'zh-CN':'en-US',{dateStyle:'medium',timeStyle:'short'}).format(Number(BigInt(event.timestampMs)))}</time>
    <span className="text-[10px] text-[#9eb1a6]">{copy(locale,'confirmed')}</span>
  </div>;
}

function explorer(hash:string){return `https://pudge.explorer.nervos.org/transaction/${hash}`;}


function attemptHash(raw:string){try{return String(JSON.parse(raw)?.txHash||'');}catch{return '';}}

function LoadState({loading,error,retry,locale}:{loading:boolean;error:string;retry:()=>Promise<void>;locale:Locale}){
  if(loading)return <p role="status" className="py-12 text-sm text-[#a4afab]">{copy(locale,'loading')}</p>;
  return <section className="flex flex-wrap items-center justify-between gap-3 border-y border-[#533c36] py-4"><p className="m-0 text-sm text-[#f0b8ad]">{copy(locale,'unavailable')}{error?` · ${error}`:''}</p><button onClick={()=>void retry()} className="min-h-9 rounded-[3px] border border-[#4a5952] px-3 text-xs font-medium text-[#dce5e1] hover:bg-[#1a2420]">{copy(locale,'retry')}</button></section>;
}

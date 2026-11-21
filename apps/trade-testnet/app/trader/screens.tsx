"use client";

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {ccc} from '@ckb-ccc/core';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {useLocale} from '../i18n-provider';
import type {Locale} from '../i18n';
import {useAccount} from './account-provider';
import {copy} from './copy';
import {formatCkb,pudgeRpc} from './rpc';
import type {MarketData,Side,TradeEvent} from './types';
import {useMarketData} from './use-market-data';
import {useOwnerPosition} from './use-owner-position';
import {useMarketSession} from './use-market-session';
import WithdrawalPanel from './WithdrawalPanel';
import TraderShell from './shell';
import SwapPanel from './SwapPanel';
import SwapKlinePanel from './SwapKlinePanel';

const Gate2LaunchFlow=dynamic(()=>import('../v2/deploy/review'),{ssr:false});

export function MarketsScreen(){
  const {locale}=useLocale(),{data,loading,error,lastSuccess,refresh}=useMarketData('pudge-xudt'),[search,setSearch]=useState('');
  const filtered=data&&[data].filter(market=>`${market.token.name} ${market.token.symbol} ${market.pair}`.toLowerCase().includes(search.toLowerCase()));
  return <TraderShell><div className="space-y-6">
    <section className="flex flex-wrap items-end justify-between gap-4 border-b border-[#28302f] pb-5">
      <div><h1 className="m-0 text-[22px] font-semibold tracking-normal">{copy(locale,'markets')}</h1></div>
      <label className="w-full max-w-[360px] text-[11px] text-[#8f9b96]">{copy(locale,'search')}<input value={search} onChange={event=>setSearch(event.target.value)} className="mt-1 min-h-10 w-full rounded-[3px] border border-[#303a37] bg-[#111615] px-3 text-sm text-[#e6ece9] outline-none focus:border-[#6d9583]" /></label>
    </section>
    {data&&<MarketList market={data} locale={locale} />}
    {!data&&loading&&<p role="status" className="py-10 text-sm text-[#a4afab]">{copy(locale,'loading')}</p>}
    {!data&&error&&<section className="flex flex-wrap items-center justify-between gap-3 border-y border-[#533c36] py-4"><p className="m-0 text-sm text-[#f0b8ad]">{copy(locale,'unavailable')}</p><button onClick={()=>void refresh()} className="min-h-9 rounded-[3px] border border-[#4a5952] px-3 text-xs font-medium text-[#dce5e1] hover:bg-[#1a2420]">{copy(locale,'retry')}</button></section>}
    {data&&filtered?.length===0&&<p className="border-y border-[#28302f] py-8 text-sm text-[#9ba6a2]">{copy(locale,'searchEmpty')}</p>}
    {data&&<MarketRefreshState market={data} error={error} lastSuccess={lastSuccess} refresh={refresh} locale={locale} />}
  </div></TraderShell>;
}

function MarketList({market,locale}:{market:MarketData;locale:Locale}){
  return <section aria-label={copy(locale,'markets')}>
    <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(120px,.8fr)_minmax(130px,.8fr)_minmax(130px,.8fr)_minmax(140px,.8fr)_110px] gap-4 border-b border-[#303a37] px-3 py-2 text-[10px] uppercase text-[#7f8b86] md:grid">
      <span>{copy(locale,'asset')}</span><span>{copy(locale,'pair')}</span><span>{copy(locale,'buyPrice')}</span><span>{copy(locale,'sellPrice')}</span><span>{copy(locale,'reserve')}</span><span />
    </div>
    <div className="border-b border-[#28302f]">
      <div className="grid gap-3 px-2 py-4 md:grid-cols-[minmax(220px,1.4fr)_minmax(120px,.8fr)_minmax(130px,.8fr)_minmax(130px,.8fr)_minmax(140px,.8fr)_110px] md:items-center md:gap-4 md:px-3">
        <div className="flex min-w-0 items-center gap-3"><div aria-hidden="true" className="grid size-10 shrink-0 place-items-center border border-[#34423c] bg-[#14201b] text-sm font-semibold text-[#83e2b5]">{market.token.symbol.slice(0,1).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-sm font-semibold text-[#e6ece9]">{market.token.name}</div><div className="mt-0.5 text-[11px] text-[#899590]">{market.token.symbol} · {copy(locale,'supply')} {market.supply}</div></div></div>
        <div className="flex justify-between text-xs md:block"><span className="text-[#87938e] md:hidden">{copy(locale,'pair')}</span><span className="text-[#c8d2ce]">{market.pair}</span></div>
        <Metric label={copy(locale,'buyPrice')} value={`${formatCkb(market.buyOneShannons,4)} CKB`} />
        <Metric label={copy(locale,'sellPrice')} value={`${formatCkb(market.sellOneShannons,4)} CKB`} />
        <Metric label={copy(locale,'reserve')} value={`${formatCkb(market.reserveShannons,2)} CKB`} />
        <Link href={`/market/${market.id}`} className="inline-flex min-h-9 items-center justify-center rounded-[3px] bg-[#72dfb0] px-3 text-xs font-semibold text-[#0a1710] no-underline transition-colors hover:bg-[#8ce9bd]">{copy(locale,'trade')}</Link>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-2 pb-3 text-[10px] text-[#77837e] md:pl-[60px]"><span>{copy(locale,'circulating')}: {market.circulating}</span><span>{copy(locale,'inventory')}: {market.inventory}</span></div>
    </div>
    <p className="mb-0 mt-3 text-[10px] text-[#77837e]">{copy(locale,market.token.metadata==='off-chain-testnet-registry'?'registryMetadata':'metadataUnavailable')}</p>
  </section>;
}

function Metric({label,value}:{label:string;value:string}){
  return <div className="flex justify-between gap-3 text-xs md:block"><span className="text-[#87938e] md:hidden">{label}</span><span className="tabular-nums text-[#d4ddd9]">{value}</span></div>;
}

function MarketRefreshState({market,error,lastSuccess,refresh,locale}:{market:MarketData;error:string;lastSuccess:number;refresh:()=>Promise<void>;locale:Locale}){
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#252d2b] pt-3 text-[10px] text-[#7f8b86]"><span>{error?(locale==='zh-CN'?'更新失败，显示上次验证的数据':'Refresh failed · showing last verified data'):copy(locale,'marketStatus')} · {market.tip.number}</span><button title={copy(locale,'reload')} onClick={()=>void refresh()} className="min-h-7 rounded-[3px] border border-[#303a37] px-2.5 text-[#aeb8b4] hover:bg-[#19211e]">{lastSuccess?new Date(lastSuccess).toLocaleTimeString(locale==='zh-CN'?'zh-CN':'en-US',{hour:'2-digit',minute:'2-digit'}):copy(locale,'reload')}</button></div>;
}

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

export function PortfolioScreen(){
  const {locale}=useLocale(),account=useAccount(),query=useMarketData(),market=query.data,owner=account.state==='ready'?account.owner:'';
  const position=useOwnerPosition(owner,market);
  const tokenHash=market?.token.typeHash;
  const [external,setExternal]=useState<{owner:string;root:string;balance:bigint}|null>(null);
  const [externalCurrent,setExternalCurrent]=useState(false);
  const root=market?.custodyRoot;
  useEffect(()=>{
    if(!owner||!tokenHash||!root||!account.address)return;
    let active=true;
    let timer:ReturnType<typeof setTimeout>;
    const script=(value:ccc.Script)=>({code_hash:value.codeHash,hash_type:value.hashType,args:value.args});
    const refresh=async()=>{
      if(!active)return;
      setExternalCurrent(false);
      try{
        const lock=(await ccc.Address.fromString(account.address,new ccc.ClientPublicTestnet())).script;
        if(lock.hash()!==owner)throw Error('Wallet changed');
        const token=ccc.Script.from(market!.manifest.scripts.token);
        if(token.hash()!==tokenHash)throw Error('RVK identity mismatch');
        const query={script:script(lock),script_type:'lock',script_search_mode:'exact',filter:{script:script(token)},with_data:true};
        const indexed=await pudgeRpc<{block_number:string;block_hash:string}>('get_indexer_tip');
        const tip=await pudgeRpc<{number:string}>('get_tip_header');
        if(BigInt(tip.number)-BigInt(indexed.block_number)>6n)throw Error('Wallet indexer is catching up');
        const page=await pudgeRpc<{objects:{out_point:unknown}[]}>('get_cells',[query,'asc','0x64']);
        if(page.objects.length>=100)throw Error('Wallet cell page is incomplete');
        const cells=await Promise.all(page.objects.map(row=>pudgeRpc('get_live_cell',[row.out_point,true])));
        let balance=0n;
        for(const row of cells){
          const matches=(actual:any,expected:ccc.Script)=>actual?.code_hash===expected.codeHash&&actual.hash_type===expected.hashType&&actual.args===expected.args;
          const data=row.cell?.data.content;
          if(row.status!=='live'||!matches(row.cell?.output.lock,lock)||!matches(row.cell?.output.type,token)||!/^0x[0-9a-f]{32}$/i.test(data))throw Error('Wallet token Cell changed');
          balance+=BigInt('0x'+data.slice(2).match(/../g).reverse().join(''));
        }
        const [canonical,after]=await Promise.all([pudgeRpc('get_block_hash',[indexed.block_number]),pudgeRpc('get_indexer_tip')]);
        if(canonical!==indexed.block_hash||after.block_hash!==indexed.block_hash)throw Error('Wallet indexer changed');
        if(active){setExternal({owner,root,balance});setExternalCurrent(true);}
      }catch{}finally{if(active)timer=setTimeout(refresh,10000);}
    };
    void refresh();
    return()=>{active=false;clearTimeout(timer);};
  },[owner,tokenHash,root,account.address]);
  const walletBalance=external?.owner===owner?external.balance:null;
  const currentWallet=externalCurrent&&external?.root===root;
  return <TraderShell><div className="space-y-5"><header className="border-b border-[#28302f] pb-4"><h1 className="m-0 text-[21px] font-semibold">{copy(locale,'portfolio')}</h1><p className="mb-0 mt-1 break-all text-[11px] text-[#85918c]">{account.state==='ready'?walletIdentity(account.address):copy(locale,'connectPortfolio')}</p></header>
    {account.state==='ready'&&<section><div className="hidden grid-cols-[minmax(180px,1.5fr)_1fr_1fr_120px] gap-4 border-b border-[#303a37] px-3 py-2 text-[10px] uppercase text-[#7f8b86] sm:grid"><span>{copy(locale,'asset')}</span><span>{copy(locale,'yourBalance')}</span><span>{copy(locale,'marketInfo')}</span><span/></div><HoldingRow name="CKB" amount={account.totalCapacity!==''?formatCkb(account.totalCapacity,4):copy(locale,'notAvailable')} detail={account.balanceState==='ready'?`${copy(locale,'availableToTrade')}: ${formatCkb(account.availableToTrade,4)} CKB · ${copy(locale,'totalCapacity')}`:account.totalCapacity!==''?'Last verified · Updating':copy(locale,'balanceUnavailable')} unit="CKB" action={<span className="text-[10px] text-[#77837e]">CKB</span>}/><HoldingRow name={market?(locale==="zh-CN"?"Brant 内":"In Brant"):'Pudge xUDT'} amount={position.balance||(position.state==='loading'||position.state==='idle'?'Checking your RVK balance':copy(locale,'notAvailable'))} detail={position.balance&&position.state!=='ready'?'Last verified · Updating':market?.pair||'xUDT'} unit={market?.token.symbol||'xUDT'} action={market?<Link href={`/market/${market.id}`} className="text-xs text-[#9adbb7] no-underline">{copy(locale,'trade')}</Link>:null}/>{market&&<><HoldingRow name="In Wallet" amount={walletBalance?.toString()??"—"} detail={currentWallet?"Verified":walletBalance===null?"Checking wallet Cells":"Last verified"} unit={market.token.symbol} action={null}/><HoldingRow name="Total RVK" amount={currentWallet&&walletBalance!==null&&position.state==="ready"?(BigInt(position.balance)+walletBalance).toString():"—"} detail="" unit={market.token.symbol} action={null}/></>}</section>}
    {account.state!=='ready'&&<section className="border-y border-[#28302f] py-6"><p className="m-0 text-sm text-[#a4afab]">{account.error||copy(locale,'connectPortfolio')}</p></section>}
    {market&&owner&&<WithdrawalPanel key={owner+market.genesis} market={market} owner={owner} balance={BigInt(position.balance||'0')} balanceReady={position.state==='ready'} onConfirmed={async()=>{await Promise.all([query.refresh(),account.refresh()]);position.retry();}}/>}
    {market&&position.state==='unavailable'&&<div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-y border-[#5b4a31] py-3 text-xs text-[#d9b783]"><span>{position.error||copy(locale,'holdingsUnavailable')}</span><button type="button" onClick={position.retry} className="min-h-8 rounded-[3px] border border-[#75613c] px-3 text-[11px] text-[#f0dfb8] hover:bg-[#2b241a]">{copy(locale,'retry')}</button></div>}
    {!market&&query.error&&<LoadState loading={query.loading} error={query.error} retry={query.refresh} locale={locale}/>}</div></TraderShell>;
}

function HoldingRow({name,amount,detail,unit,action}:{name:string;amount:string;detail:string;unit:string;action:React.ReactNode}){
  return <div className="grid grid-cols-1 gap-2 border-b border-[#252d2b] px-3 py-3 sm:grid-cols-[minmax(180px,1.5fr)_1fr_1fr_120px] sm:items-center sm:gap-4"><div><div className="text-sm font-medium text-[#dde5e1]">{name}</div><div className="mt-0.5 text-[10px] text-[#808c87]">{detail}</div></div><div className="text-xs tabular-nums text-[#c7d1cc]">{amount}</div><div className="text-[10px] text-[#84908b]">{unit}</div><div className="text-right">{action}</div></div>;
}

export function ActivityScreen(){
  const {locale}=useLocale(),account=useAccount(),query=useMarketData(),events=query.data?.history||[];
  const rows=useMemo(()=>events.filter(event=>account.state!=='ready'||event.owner.toLowerCase()===account.owner.toLowerCase()).slice().reverse(),[events,account.owner,account.state]);
  const pendingKey=account.state==='ready'?`roveko-pudge-trade-v1:${query.data?.genesis.toLowerCase()}:${account.owner.toLowerCase()}`:'';
  const [pending,setPending]=useState('');
  useEffect(()=>{
    if(typeof window==='undefined'||!pendingKey)return;
    const read=()=>{try{setPending(localStorage.getItem(pendingKey)||'');}catch{setPending('');}};
    read();const timer=window.setInterval(read,2500);window.addEventListener('storage',read);
    return()=>{window.clearInterval(timer);window.removeEventListener('storage',read);};
  },[pendingKey]);
  let pendingHash='';try{pendingHash=pending?JSON.parse(pending).txHash:'';}catch{}
  return <TraderShell><div className="space-y-4"><header className="border-b border-[#28302f] pb-4"><h1 className="m-0 text-[21px] font-semibold">{copy(locale,'activity')}</h1><p className="mb-0 mt-1 break-all text-[11px] text-[#85918c]">{account.state==='ready'?walletIdentity(account.address):copy(locale,'transactionHistory')}</p></header>
    {pendingHash&&<div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#5a4a2e] py-3 text-xs text-[#e8cc94]"><span>{copy(locale,'pending')} · {pendingHash}</span><a href={explorer(pendingHash)} target="_blank" rel="noreferrer" className="text-[#e8d8b6] underline">{copy(locale,'explorer')}</a></div>}
    {query.data?.historyState==='unavailable'&&<p className="m-0 border-y border-[#5a4a2e] py-3 text-xs text-[#ddc18d]">{copy(locale,'noHistory')}</p>}
    <section aria-label={copy(locale,'transactionHistory')}><div className="hidden grid-cols-[minmax(92px,.6fr)_minmax(100px,.6fr)_minmax(130px,1fr)_minmax(120px,.8fr)_minmax(100px,.6fr)] gap-3 border-b border-[#303a37] px-2 py-2 text-[10px] uppercase text-[#7f8b86] sm:grid"><span>{copy(locale,'type')}</span><span>{copy(locale,'activityAmount')}</span><span>{copy(locale,'transaction')}</span><span>{copy(locale,'time')}</span><span>{copy(locale,'status')}</span></div>
      {!rows.length&&<p className="m-0 py-8 text-sm text-[#929d99]">{account.state==='ready'?copy(locale,'noActivity'):copy(locale,'noHistory')}</p>}
      {rows.map(event=><TradeRow key={event.hash+':'+(event.executionIndex??0)} event={event} locale={locale} detailed symbol={query.data?.token.symbol||'xUDT'}/>)}
    </section>
    <div className="pt-2"><button onClick={()=>void query.refresh()} className="min-h-8 rounded-[3px] border border-[#303a37] px-3 text-[11px] text-[#aeb8b4] hover:bg-[#19211e]">{copy(locale,'reload')}</button></div>
  </div></TraderShell>;
}

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

function walletIdentity(address:string){return address.length>28?`${address.slice(0,12)}…${address.slice(-8)}`:address;}

function attemptHash(raw:string){try{return String(JSON.parse(raw)?.txHash||'');}catch{return '';}}

function LoadState({loading,error,retry,locale}:{loading:boolean;error:string;retry:()=>Promise<void>;locale:Locale}){
  if(loading)return <p role="status" className="py-12 text-sm text-[#a4afab]">{copy(locale,'loading')}</p>;
  return <section className="flex flex-wrap items-center justify-between gap-3 border-y border-[#533c36] py-4"><p className="m-0 text-sm text-[#f0b8ad]">{copy(locale,'unavailable')}{error?` · ${error}`:''}</p><button onClick={()=>void retry()} className="min-h-9 rounded-[3px] border border-[#4a5952] px-3 text-xs font-medium text-[#dce5e1] hover:bg-[#1a2420]">{copy(locale,'retry')}</button></section>;
}

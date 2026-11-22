"use client";

import {ccc} from '@ckb-ccc/core';
import Link from 'next/link';
import localFont from 'next/font/local';
import {useEffect,useState} from 'react';
import {useLocale} from '../i18n-provider';
import {useAccount} from './account-provider';
import {copy} from './copy';
import {formatCkb,pudgeRpc} from './rpc';
import TraderShell from './shell';
import type {MarketData} from './types';
import {useMarketData} from './use-market-data';
import {useOwnerPosition} from './use-owner-position';
import WithdrawalPanel from './WithdrawalPanel';
import './portfolio.css';

const geist = localFont({src:'../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2',weight:'100 900'});
export function PortfolioScreen(){
  const account=useAccount(),query=useMarketData(),market=query.data,owner=account.state==='ready'?account.owner:'';
  const position=useOwnerPosition(owner,market);
  const tokenHash=market?.token.typeHash;
  const [external,setExternal]=useState<{owner:string;root:string;identity:string;balance:bigint}|null>(null);
  const [externalCurrent,setExternalCurrent]=useState(false);
  const root=market?.custodyRoot;
  const identity=market?.identity;
  useEffect(()=>{
    if(!owner||!identity||!tokenHash||!root||!account.address)return;
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
        if(active){setExternal({owner,root,identity,balance});setExternalCurrent(true);}
      }catch{}finally{if(active)timer=setTimeout(refresh,10000);}
    };
    void refresh();
    return()=>{active=false;clearTimeout(timer);};
  },[owner,tokenHash,root,identity,account.address]);
  const walletBalance=external?.owner===owner?external.balance:null;
  const currentWallet=externalCurrent&&external?.owner===owner&&external?.root===root&&external?.identity===identity;
  return <PortfolioOverview account={account} market={market} position={position}
    walletBalance={walletBalance} currentWallet={currentWallet} marketError={query.error} refreshMarket={query.refresh}>
    {market&&owner&&<WithdrawalPanel key={owner+market.genesis} market={market} owner={owner}
      balance={BigInt(position.balance||'0')} balanceReady={position.state==='ready'}
      onConfirmed={async()=>{await Promise.all([query.refresh(),account.refresh()]);position.retry();}}/>}
  </PortfolioOverview>;
}

export function PortfolioOverview({account, market, position, walletBalance, currentWallet, marketError='', refreshMarket, children}: {
  account: ReturnType<typeof useAccount>;
  market: MarketData | null;
  position: ReturnType<typeof useOwnerPosition>;
  walletBalance: bigint | null;
  currentWallet: boolean;
  marketError?: string;
  refreshMarket?: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const {locale}=useLocale();
  const zh=locale==='zh-CN';
  const ready=account.state==='ready';
  const ckbCurrent=account.balanceState==='ready';
  const custodyCurrent=position.state==='ready' && position.balance!=='';
  const total=custodyCurrent && currentWallet && walletBalance!==null
    ? (BigInt(position.balance)+walletBalance).toLocaleString(locale) : null;
  const verified=zh?'已验证':'Verified';
  const unavailable=copy(locale,'notAvailable');
  const checking=zh?'正在检查':'Checking';
  const lastKnown=zh?'上次验证余额':'Last verified balance';
  const symbol=market?.token.symbol;
  const status=(current:boolean, hasValue:boolean)=>current ? verified : hasValue ? lastKnown : checking;
  const opening=account.state==='checking'||account.state==='connecting';
  return <TraderShell wide><div className={`portfolio-overview ${geist.className}`}>
    <header className="portfolio-heading">
      <h1>{copy(locale,'portfolio')}</h1>
      {ready && <p title={account.address}>{zh?'已连接钱包':'Connected wallet'} · <span>{account.address.slice(0,12)}…{account.address.slice(-8)}</span></p>}
    </header>
    {!ready ? <section className="portfolio-surface portfolio-connect">
      <h2>{copy(locale,'connect')}</h2>
      <p>{zh?'连接 Pudge 钱包以查看 CKB 和 RVK 余额。':'Connect a Pudge wallet to view your CKB and RVK balances.'}</p>
      {account.error && <p role="alert">{account.error}</p>}
      <button type="button" className="portfolio-primary" disabled={opening} onClick={account.connect}>{opening?copy(locale,'walletChecking'):copy(locale,'connect')}</button>
    </section> : <div className="portfolio-layout">
      <section className="portfolio-surface portfolio-assets" aria-label={zh?'资产':'Assets'}>
        <div className="portfolio-asset">
          <div className="portfolio-asset-heading"><span aria-hidden="true" className="portfolio-mark">C</span><h2>CKB</h2></div>
          <div className="portfolio-balances">
            <Balance label={zh?'钱包 CKB 总容量':'Total wallet CKB capacity'} value={account.totalCapacity===''?null:formatCkb(account.totalCapacity)} unit="CKB" state={account.balanceState==='error'?unavailable:status(ckbCurrent,account.totalCapacity!=='')}/>
            <Balance label={zh?'可用于 Brant 交易':'Available for Brant trading'} value={ckbCurrent&&account.availableToTrade!==''?formatCkb(account.availableToTrade):null} unit="CKB"
              state={account.balanceState==='indexer-lag'?copy(locale,'walletIndexing'):ckbCurrent?(account.hasFundingCell?verified:(zh?'没有合格的资金 Cell':'No eligible funding Cell')):account.balanceState==='error'?unavailable:checking}/>
          </div>
          {account.error&&<p role="status">{account.error} <button type="button" onClick={()=>void account.refresh()}>{copy(locale,'retry')}</button></p>}
        </div>
        {market && symbol && <div className="portfolio-asset">
          <div className="portfolio-asset-heading"><span aria-hidden="true" className="portfolio-mark portfolio-mark-rvk">{symbol[0]}</span><div><h2>{symbol}</h2><p>{market.token.name}</p></div><Link href={'/market/'+market.id}>{copy(locale,'trade')} ↗</Link></div>
          <div className="portfolio-rvk-total"><Balance label={zh?`${symbol} 总额`:`Total ${symbol}`} value={total} unit={symbol} state={total===null?(zh?'等待两个余额完成验证':'Awaiting both balance checks'):verified}/></div>
          <div className="portfolio-balances">
            <Balance label={zh?'Brant 内':'In Brant'} value={position.balance!==''?BigInt(position.balance).toLocaleString(locale):null} unit={symbol} state={position.state==='unavailable'?(position.balance!==''?lastKnown:unavailable):status(custodyCurrent,position.balance!=='')}/>
            <Balance label={zh?'钱包内':'In wallet'} value={walletBalance?.toLocaleString(locale)??null} unit={symbol} state={currentWallet?verified:walletBalance!==null?lastKnown:(zh?'检查中或暂不可用':'Checking or temporarily unavailable')}/>
          </div>
          {position.state==='unavailable'&&<p role="alert">{position.error||copy(locale,'holdingsUnavailable')} <button type="button" onClick={position.retry}>{copy(locale,'retry')}</button></p>}
        </div>}
        {marketError && <p role="alert">{copy(locale,'unavailable')} {refreshMarket&&<button type="button" onClick={()=>void refreshMarket()}>{copy(locale,'retry')}</button>}</p>}
      </section>
      {children && <aside className="portfolio-surface portfolio-management" aria-label={zh?'资产管理':'Asset management'}>
        <h2>{zh?'提取到钱包':'Withdraw to wallet'}</h2>
        <p>{zh?'将 Brant 托管中的代币提取到已连接的 Pudge 钱包。':'Move tokens from Brant custody to your connected Pudge wallet.'}</p>
        <div className="portfolio-withdrawal">{children}</div>
      </aside>}
    </div>}
  </div></TraderShell>;
}

function Balance({label,value,unit,state}: {label:string;value:string|null;unit:string;state:string}) {
  return <div className="portfolio-balance"><dl>
    <dt>{label}</dt><dd>{value===null?'—':<><span>{value}</span> <small>{unit}</small></>}</dd>
  </dl><p>{state}</p></div>;
}

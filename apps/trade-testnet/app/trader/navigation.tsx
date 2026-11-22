"use client";

import Link,{useLinkStatus} from 'next/link';
import {usePathname} from 'next/navigation';
import {LanguageSwitcher,useLocale} from '../i18n-provider';
import {useAccount} from './account-provider';
import {copy} from './copy';

const items=[['/','markets'],['/market/pudge-xudt','trade'],['/portfolio','portfolio'],['/activity','activity'],['/launch','launch']] as const;

export default function TraderNavigation(){
  const pathname=usePathname(),account=useAccount(),{locale}=useLocale();
  const addressLabel=account.address?`${account.address.slice(0,10)}…${account.address.slice(-5)}`:copy(locale,'connect');
  const walletStatus={
    'wrong-network':'walletWrongNetwork',unsupported:'walletUnsupported',
    'connection-timeout':'connectionTimeout','connection-rejected':'walletRejected',error:'walletRequestFailed',
  } as const;
  const issue=walletStatus[account.state as keyof typeof walletStatus];
  return <header className="sticky top-0 z-20 border-b border-[#28302f] bg-[#0b0d0e]/95 backdrop-blur">
    <div className="mx-auto flex min-h-[64px] w-full max-w-[1440px] flex-wrap items-center gap-x-6 px-4 sm:flex-nowrap sm:px-6 xl:px-8">
      <Link href="/" className="order-1 inline-flex shrink-0 items-center gap-2.5 py-3 text-[17px] font-bold text-[#edf1ef] no-underline">
        <img src="/icon.svg" alt="" width={24} height={24} />
        <span>Brant</span>
      </Link>
      <nav aria-label={locale==='zh-CN'?'主导航':'Primary navigation'} className="order-3 -mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center overflow-x-auto border-t border-[#202625] px-2 sm:order-2 sm:mx-0 sm:w-auto sm:flex-1 sm:border-0 sm:px-0">
        {items.map(([href,key])=>{const active=pathname===href||(key==='trade'&&pathname.startsWith('/market/'));return <Link key={href} href={href} aria-current={active?'page':undefined} className={`shrink-0 border-b-2 px-3 py-[21px] text-[13px] font-medium no-underline transition-colors ${active?'border-[#72dfb0] text-[#e7f8ee]':'border-transparent text-[#98a29f] hover:text-[#edf1ef]'}`}>{copy(locale,key)}<NavigationProgress/></Link>;})}
      </nav>
      <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:ml-0">
        <details className="relative hidden sm:block">
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-sm px-2 text-[11px] text-[#b4bfbb] hover:bg-[#1a2220]"><i className="size-1.5 rounded-full bg-[#72dfb0]"/>Pudge</summary>
          <div className="absolute right-0 top-10 z-30 w-48 border border-[#39423f] bg-[#141a19] p-3 text-xs shadow-xl"><div className="font-medium text-[#edf1ef]">{copy(locale,'pudge')}</div><div className="mt-1 text-[#929d99]">{copy(locale,'readonly')}</div></div>
        </details>
        {account.state==='ready'&&account.availableToTrade!==''&&<span title={`${copy(locale,'yourBalance')}: ${formatBalance(account.totalCapacity)} CKB · ${copy(locale,'availableToTrade')}: ${formatBalance(account.availableToTrade)} CKB`} className="hidden text-[11px] tabular-nums text-[#c8d2ce] lg:block">{account.balanceState==='ready'?copy(locale,'availableToTrade'):(locale==='zh-CN'?'上次验证余额':'Last verified')}: {formatBalance(account.availableToTrade)} CKB</span>}
        {account.state==='ready'&&['error','indexer-lag'].includes(account.balanceState)&&<button type="button" title={account.error} onClick={()=>void account.refresh()} className="text-[11px] text-[#a4afab]">{copy(locale,'retry')}</button>}
        <div className="max-w-[165px]">
        {issue&&<div role="status" className="py-1 text-[11px] text-[#e8cc94]">{copy(locale,issue)}</div>}
        <button type="button" title={account.address||copy(locale,'connect')} onClick={account.connect} aria-busy={account.state==='connecting'||account.state==='checking'} className="max-w-[170px] truncate rounded-sm border border-[#46514d] bg-[#1b2421] px-3 py-2 text-[11px] font-semibold text-[#e7efeb] transition-colors hover:bg-[#26322d] sm:max-w-[220px] sm:text-xs">
          {account.state==='checking'?copy(locale,'walletChecking'):account.state==='connecting'?copy(locale,'connecting'):issue||account.state==='disconnected'?copy(locale,'connect'):addressLabel}
        </button>
        </div>
        <LanguageSwitcher/>
      </div>
    </div>
  </header>;
}

function formatBalance(value:string){
  const n=BigInt(value),whole=n/100_000_000n,fraction=(n%100_000_000n).toString().padStart(8,'0').replace(/0+$/,'');
  return `${whole.toLocaleString('en-US')}${fraction?`.${fraction}`:''}`;
}

function NavigationProgress(){
  const {pending}=useLinkStatus();
  return pending?<span role="status" aria-label="Loading page" className="ml-1 inline-block size-2 animate-spin rounded-full border border-current border-r-transparent"/>:null;
}

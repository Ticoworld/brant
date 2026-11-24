"use client";

import Link from 'next/link';
import {useLinkStatus} from 'next/link';
import {usePathname} from 'next/navigation';
import localFont from 'next/font/local';
import {useLocale} from '../i18n-provider';
import {useAccount} from './account-provider';
import {copy} from './copy';
import './navigation.css';

const geist = localFont({src:'../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2',weight:'100 900'});
const items = [['/','markets'],['/market/pudge-xudt','trade'],['/portfolio','portfolio'],['/activity','activity'],['/launch','launch']] as const;
const walletIssues = {
  'wrong-network':'walletWrongNetwork',unsupported:'walletUnsupported',
  'connection-timeout':'connectionTimeout','connection-rejected':'walletRejected',error:'walletRequestFailed',
} as const;

function NavigationLabel({label}: {label: string}) {
  const {pending} = useLinkStatus();
  return <span className="brant-nav-label" aria-busy={pending}>{label}</span>;
}

export default function TraderNavigation() {
  const account = useAccount();
  return <NavigationHeader account={account}/>;
}

export function NavigationHeader({account}: {account: Pick<ReturnType<typeof useAccount>, 'state'|'address'|'connect'>}) {
  const pathname = usePathname();
  const {locale,setLocale} = useLocale();
  const zh = locale === 'zh-CN';
  const network=process.env.NODE_ENV!=='production'&&process.env.NEXT_PUBLIC_BRANT_ISOLATED_TEST==='1'?'Isolated':'Pudge';
  const opening = account.state === 'checking' || account.state === 'connecting';
  const address = account.state === 'ready' ? account.address : '';
  const issue = walletIssues[account.state as keyof typeof walletIssues];
  const walletLabel = opening ? copy(locale, account.state === 'checking' ? 'walletChecking' : 'connecting')
    : address ? `${address.slice(0, 9)}…${address.slice(-5)}` : copy(locale,'connect');

  return <header className={`brant-header ${geist.className}`}>
    <div className="brant-header-inner">
      <Link href="/" className="brant-brand"><img src="/brand/brant-horizontal-white.svg" alt="Brant" width={1037} height={273}/></Link>
      <nav aria-label={zh ? '主导航' : 'Primary navigation'}>
        {items.map(([href,key]) => <Link key={key} href={href} prefetch={key === 'trade' ? true : undefined}
          aria-current={pathname===href || key==='trade'&&pathname.startsWith('/market/') ? 'page' : undefined}>
          <NavigationLabel label={copy(locale,key)}/>
        </Link>)}
      </nav>
      <div className="brant-header-meta">
        <span className="brant-network" data-wrong-network={account.state==='wrong-network'} title={network==='Pudge'?copy(locale,'pudge'):network}><i aria-hidden="true"/>{network}</span>
        <button type="button" className="brant-wallet" title={address||undefined} onClick={account.connect} disabled={opening} aria-busy={opening}>{walletLabel}</button>
        <button type="button" onClick={() => setLocale(zh?'en':'zh-CN')} aria-label={zh?'Switch to English':'切换到简体中文'}>{zh?'EN':'简中'}</button>
      </div>
      {issue && <p role="status" className="brant-wallet-status">{copy(locale,issue)}</p>}
    </div>
  </header>;
}

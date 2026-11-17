import TraderNavigation from './navigation';
import {useAccount} from './account-provider';
import {useLocale} from '../i18n-provider';
import {copy} from './copy';

export default function TraderShell({children}:{children:React.ReactNode}){
  const account=useAccount(),{locale}=useLocale();
  const notice=account.state==='connecting'?copy(locale,'walletConnecting'):account.state==='checking'?copy(locale,'walletChecking'):account.state==='connection-timeout'?copy(locale,'connectionTimeout'):account.state==='connection-rejected'?copy(locale,'walletRejected'):account.state==='wrong-network'?copy(locale,'walletWrongNetwork'):account.state==='unsupported'?copy(locale,'walletUnsupported'):account.state==='indexer-lag'?copy(locale,'walletIndexing'):account.state==='error'?copy(locale,'walletRequestFailed'):'';
  const canRetry=account.state==='connecting'||account.state==='connection-timeout'||account.state==='connection-rejected'||account.state==='wrong-network'||account.state==='unsupported';
  return <div className="min-h-screen bg-[#0b0d0e] text-[#edf1ef]"><TraderNavigation/>{notice&&<div role="status" className="border-b border-[#5b4a31] bg-[#171511] px-4 py-2.5 text-xs text-[#e8cc94]"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3"><span>{notice}</span><button type="button" onClick={()=>canRetry?account.connect():void account.refresh()} className="min-h-8 rounded-[3px] border border-[#76613b] px-3 text-[11px] text-[#f0dfb8] hover:bg-[#2c251a]">{canRetry?copy(locale,'connect'):copy(locale,'retry')}</button></div></div>}<main className="mx-auto w-full max-w-[1440px] px-4 pb-12 pt-5 sm:px-6 sm:pt-7 xl:px-8">{children}</main></div>;
}

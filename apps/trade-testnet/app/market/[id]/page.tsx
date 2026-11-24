import {notFound} from 'next/navigation';
import {getCatalogMarket, marketHash} from '../../../lib/v2-engine/shared-market-catalog';
import TraderShell from '../../trader/shell';
import localFont from 'next/font/local';
import TradePreview from '../../trader/TradePreview';
import {MarketScreen} from '../../trader/screens';
import '../../trade-preview/preview.css';

const geist = localFont({
  src: '../../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2',
  weight: '100 900',
  variable: '--preview-font',
});

export default async function Page({params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if (marketHash.test(id)) {
    const market = await getCatalogMarket(id);
    if (!market) notFound();
    return <TraderShell wide>
      <section className="grid gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {market.logo && <img src={market.logo} alt="" width={64} height={64}/>}
        <h1>{market.metadata.name} ({market.metadata.ticker})</h1>
        <p>{market.metadata.description}</p>
        <code>{market.token}</code>
      </section>
    </TraderShell>;
  }
  if(id!=='pudge-xudt'||process.env.BRANT_CLASSIC_TRADE==='1')return <MarketScreen id={id}/>;
  return <div className={geist.variable}><TradePreview /></div>;
}

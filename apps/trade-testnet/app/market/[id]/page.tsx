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
  if(id!=='pudge-xudt'||process.env.BRANT_CLASSIC_TRADE==='1')return <MarketScreen id={id}/>;
  return <div className={geist.variable}><TradePreview /></div>;
}

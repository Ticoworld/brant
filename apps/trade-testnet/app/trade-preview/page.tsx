import localFont from 'next/font/local';
import TradePreview from '../trader/TradePreview';
import './preview.css';

const geist = localFont({
  src: '../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2',
  weight: '100 900',
  variable: '--preview-font',
});

export default function Page() {
  return <div className={geist.variable}><TradePreview /></div>;
}

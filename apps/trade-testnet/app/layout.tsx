import './style.css';
import { LocaleProvider } from './i18n-provider';
export const metadata={title:'Trade · backed claims testnet',description:'Bounded CKB-backed financial claim research pilot'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><LocaleProvider>{children}</LocaleProvider></body></html>}

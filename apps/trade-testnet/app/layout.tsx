import './style.css';
import { LocaleProvider } from './i18n-provider';
export const metadata={title:'Roveko · CKB Markets',description:'Roveko token trading on CKB Pudge testnet'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><LocaleProvider>{children}</LocaleProvider></body></html>}

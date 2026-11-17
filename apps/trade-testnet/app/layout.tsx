import './globals.css';
import {LocaleProvider} from './i18n-provider';
import AppProviders from './providers';

export const metadata={title:'ROVEKO · CKB Markets',description:'Verified Gate 2 xUDT trading on CKB Pudge Testnet'};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><LocaleProvider><AppProviders>{children}</AppProviders></LocaleProvider></body></html>;
}

import './globals.css';
import {LocaleProvider} from './i18n-provider';
import AppProviders from './providers';

const title = 'Brant · CKB Pudge Testnet';
const description = 'Brant is a native CKB token launch and trading platform on CKB Pudge Testnet.';

export const metadata = { title, description, applicationName: 'Brant', openGraph: { title, description, siteName: 'Brant', type: 'website' }, twitter: { card: 'summary', title, description } };

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><LocaleProvider><AppProviders>{children}</AppProviders></LocaleProvider></body></html>;
}

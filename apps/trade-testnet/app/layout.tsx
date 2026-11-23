import './globals.css';
import {LocaleProvider} from './i18n-provider';
import AppProviders from './providers';
import type {Metadata} from 'next';

const title = 'Brant · CKB Pudge Testnet';
const description = 'Brant is a native CKB token launch and trading platform on CKB Pudge Testnet.';

export const metadata: Metadata = {
  title,
  description,
  applicationName: 'Brant',
  icons: {
    icon: [
      {url: '/brand/favicon.ico', type: 'image/x-icon'},
      {url: '/brand/favicon.svg', type: 'image/svg+xml', sizes: 'any'},
    ],
    apple: {url: '/brand/apple-touch-icon.png', sizes: '180x180', type: 'image/png'},
  },
  manifest: '/brand/site.webmanifest',
  openGraph: {title, description, siteName: 'Brant', type: 'website'},
  twitter: {card: 'summary', title, description},
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body><LocaleProvider><AppProviders>{children}</AppProviders></LocaleProvider></body></html>;
}

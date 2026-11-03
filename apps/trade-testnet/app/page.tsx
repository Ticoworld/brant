'use client';
import dynamic from 'next/dynamic';
const WalletApp=dynamic(()=>import('./wallet-app'),{ssr:false,loading:()=> <p>Loading testnet wallet connector…</p>});
export default function Page(){return <WalletApp/>}

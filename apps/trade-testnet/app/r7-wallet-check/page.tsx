import WalletCheck from './wallet-check';
export const dynamic='force-dynamic';
export default function Page(){return process.env.R7_LOCAL_ENABLED==='1'?<WalletCheck/>:<main>Private signature check disabled.</main>;}

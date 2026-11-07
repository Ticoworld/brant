import WalletTest from './wallet-test';
export const dynamic='force-dynamic';
export default function Page(){return process.env.PUDGE_WALLET_TEST==='1'?<WalletTest/>:<main>Wallet test disabled.</main>}

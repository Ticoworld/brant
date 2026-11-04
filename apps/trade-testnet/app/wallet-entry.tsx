"use client";
import dynamic from "next/dynamic";
const WalletApp = dynamic(() => import("./wallet-app"), {
  ssr: false,
  loading: () => <p role="status">Loading Trade…</p>,
});
export default function WalletEntry({
  initialMarketId,
}: {
  initialMarketId?: string;
}) {
  return <WalletApp initialMarketId={initialMarketId} />;
}

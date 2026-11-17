"use client";
import dynamic from "next/dynamic";
const WalletApp = dynamic(() => import("./wallet-app"), {
  ssr: false,
  loading: () => <p role="status">Loading Trade…</p>,
});
export default function WalletEntry({
  initialMarketId,
  initialView = "Markets",
}: {
  initialMarketId?: string;
  initialView?: "Markets" | "My Positions" | "Create Market" | "Activity";
}) {
  return <WalletApp initialMarketId={initialMarketId} initialView={initialView} />;
}

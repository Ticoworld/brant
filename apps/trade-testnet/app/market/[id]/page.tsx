import WalletEntry from "../../wallet-entry";
export default async function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WalletEntry initialMarketId={id} />;
}

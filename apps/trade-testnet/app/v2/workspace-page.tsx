"use client";

import Link from "next/link";
import { Provider, useSigner } from "@ckb-ccc/connector-react";
import { ccc } from "@ckb-ccc/core";
import Navigation from "./navigation";
import { useLocale } from "../i18n-provider";
import { rovekoSignersController } from "./signers";
import OrderPanel from "./order-panel";
import WithdrawalPanel from "./withdrawal-panel";
import "./v2.css";

type WorkspaceKind = "markets" | "portfolio" | "orders" | "activity" | "withdrawal";

export default function WorkspacePage({ kind }: { kind: WorkspaceKind }) {
  const localMode = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LOCAL_FIXTURE === "1" && process.env.NEXT_PUBLIC_PUDGE_TEST_HOOK !== "1";
  const client = ccc.ClientPublicTestnet.open({ urls: localMode && typeof window !== "undefined" ? [`${window.location.origin}/api/local-rpc`] : ["https://testnet.ckb.dev/"] }).value;
  return <Provider name="ROVEKO" defaultClient={client} clientOptions={[{ name: localMode ? "Disposable local CKB" : "CKB Pudge", client }]} signersController={rovekoSignersController}><WorkspaceContent kind={kind} localMode={localMode} /></Provider>;
}

function WorkspaceContent({ kind, localMode }: { kind: WorkspaceKind; localMode: boolean }) {
  const { t } = useLocale();
  const signer = useSigner();
  const title = {
    markets: t("discover"),
    portfolio: t("portfolio"),
    orders: t("openOrders"),
    activity: t("activity"),
    withdrawal: t("externalWithdrawal"),
  }[kind];
  const detail = {
    markets: t("marketUnavailableDetail"),
    portfolio: t("portfolioUnavailable"),
    orders: t("ordersUnavailable"),
    activity: t("activityUnavailable"),
    withdrawal: t("withdrawalUnavailable"),
  }[kind];
  return (
    <main className="min-h-screen bg-[#0c1210] text-[#eef2ec]">
      <Navigation active={kind === "markets" ? "/v2/discover" : kind === "withdrawal" ? "/v2/withdraw" : `/v2/${kind}`} />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#91b6a2]">{t("pudgeTestnet")}</p>
        <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
        <section className="mt-7 max-w-3xl border-y border-[#2d3a35] py-6" aria-live="polite">
          <p className="font-medium text-[#dbe6df]">{t("verifiedDataRequired")}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9eaaa2]">{detail}</p>
          {kind === "orders" && <p className="mt-3 text-sm text-[#9eaaa2]">{t("noAutomaticMatching")}</p>}
          {kind === "withdrawal" && <p className="mt-3 text-sm text-[#9eaaa2]">{t("publicHistoryRequired")}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/v2" className="inline-flex min-h-10 items-center rounded border border-[#496052] px-4 text-sm text-[#bce7ce] no-underline hover:bg-[#18251e]">{t("trade")}</Link>
            <Link href="/v2/deploy" className="inline-flex min-h-10 items-center rounded bg-[#72dfb0] px-4 text-sm font-semibold text-[#102219] no-underline hover:bg-[#8de8c0]">{t("deployTestMarket")}</Link>
          </div>
        </section>
        {localMode && (kind === "orders" || kind === "withdrawal") && <details className="mt-6 max-w-3xl border-b border-[#2d3a35] pb-5">
          <summary className="cursor-pointer text-sm font-medium text-[#bce7ce]">{t("isolatedLocalActions")}</summary>
          <p className="my-3 text-sm text-[#9eaaa2]">{t("localFixtureNotice")}</p>
          {kind === "orders" && <OrderPanel signer={signer} />}
          {kind === "withdrawal" && <WithdrawalPanel signer={signer} />}
        </details>}
        {kind === "portfolio" && <p className="mt-5 text-sm text-[#9eaaa2]">{t("withdrawDiscoverability")} <Link href="/v2/withdraw" className="text-[#9ce2bf] underline underline-offset-4">{t("withdraw")}</Link>.</p>}
      </div>
    </main>
  );
}

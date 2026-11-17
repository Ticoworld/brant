"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Provider, useSigner } from "@ckb-ccc/connector-react";
import { ccc } from "@ckb-ccc/core";
import Navigation from "./navigation";
import { useLocale } from "../i18n-provider";
import { rovekoSignersController } from "./signers";
import OrderPanel from "./order-panel";
import WithdrawalPanel from "./withdrawal-panel";
import DiscoverBoard from "./discover-board";
import ConnectorClientBridge from "./connector-client-bridge";
import { ActivitySection, LaunchSection, PortfolioSection } from "./workspace-sections";
import PublicJourney from "./public-journey";
import "./v2.css";

type WorkspaceKind = "markets" | "portfolio" | "orders" | "activity" | "withdrawal" | "launch";

export default function WorkspacePage({ kind }: { kind: WorkspaceKind }) {
  const localMode = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LOCAL_FIXTURE === "1" && process.env.NEXT_PUBLIC_PUDGE_TEST_HOOK !== "1";
  const client = ccc.ClientPublicTestnet.open({ urls: localMode && typeof window !== "undefined" ? [`${window.location.origin}/api/local-rpc`] : ["https://testnet.ckb.dev/"] }).value;
  return <Provider name="ROVEKO" defaultClient={client} clientOptions={[{ name: localMode ? "Disposable local CKB" : "CKB Pudge", client }]} signersController={rovekoSignersController} connectorProps={{ style: { "--background": "#111714", "--divider": "#29352f", "--btn-primary": "#1b2721", "--btn-primary-hover": "#26362e", "--btn-secondary": "#29352f", "--btn-secondary-hover": "#37473e", "--btn-color": "#e9f0eb", "--btn-color-hover": "#ffffff", "--icon-primary": "#e9f0eb", "--icon-secondary": "#a5b1a8", color: "#e9f0eb", "--tip-color": "#a5b1a8", "--tip-color-hover": "#e9f0eb" } as React.CSSProperties }}><WorkspaceContent kind={kind} localMode={localMode} /></Provider>;
}

function WorkspaceContent({ kind, localMode }: { kind: WorkspaceKind; localMode: boolean }) {
  const { t } = useLocale();
  const connectedSigner = useSigner();
  const [localTestSigner, setLocalTestSigner] = useState<typeof connectedSigner>(undefined);
  const [ownerHash, setOwnerHash] = useState("");
  const signer = localMode && localTestSigner ? localTestSigner : connectedSigner;
  const [uiDemo, setUiDemo] = useState(false);
  useEffect(() => {
    if (!localMode) return;
    const target = window as Window & { rovWorkspaceTestConnect?: (value: NonNullable<typeof connectedSigner>) => void };
    target.rovWorkspaceTestConnect = (value) => setLocalTestSigner(value);
    return () => { delete target.rovWorkspaceTestConnect; };
  }, [localMode]);
  useEffect(() => {
    let active = true;
    if (!signer) {
      setOwnerHash("");
      return () => { active = false; };
    }
    signer.getRecommendedAddressObj().then((address) => {
      if (active) setOwnerHash(address.script.hash());
    }).catch(() => {
      if (active) setOwnerHash("");
    });
    return () => { active = false; };
  }, [signer]);
  useEffect(() => {
    setUiDemo(process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).get("uiDemo") === "1");
  }, []);
  const title = {
    markets: t("discover"),
    portfolio: t("portfolio"),
    orders: t("openOrders"),
    activity: t("activity"),
    withdrawal: t("externalWithdrawal"),
    launch: t("launch"),
  }[kind];
  const detail = {
    markets: t("marketUnavailableDetail"),
    portfolio: t("portfolioUnavailable"),
    orders: t("ordersUnavailable"),
    activity: t("activityUnavailable"),
    withdrawal: t("withdrawalUnavailable"),
    launch: "",
  }[kind];
  return (
    <>
    <ConnectorClientBridge />
    <main className="v2-app flex min-h-screen w-full flex-col bg-[#090a0a] pb-0 text-[#eceeec]">
      <Navigation active={kind === "markets" ? "/" : kind === "withdrawal" ? "/v2/withdraw" : `/${kind}`} />
      <h1 className="sr-only">{title}</h1>
      {kind === "markets" ? (
        <DiscoverBoard localMode={localMode} />
      ) : kind === "portfolio" ? (
        localMode ? <PortfolioSection demo={uiDemo} localMode ownerHash={ownerHash} /> : <PublicJourney ownerHash={ownerHash} activity={false} />
      ) : kind === "activity" ? (
        localMode ? <ActivitySection demo={uiDemo} localMode ownerHash={ownerHash} /> : <PublicJourney ownerHash={ownerHash} activity />
      ) : kind === "launch" ? (
        <LaunchSection localMode={localMode} />
      ) : (
        <div className="w-full px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex min-h-10 flex-wrap items-center justify-between gap-3 border-b border-[#2d3a35] pb-3">
            <span className="text-sm font-semibold">{title}</span>
            <span className="text-xs text-[#9eaaa2]">{t("pudgeTestnet")}</span>
          </div>
          <section className="mt-4 w-full border-y border-[#2d3a35] py-5" aria-live="polite">
            <p className="font-medium text-[#dbe6df]">{t("verifiedDataRequired")}</p>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9eaaa2]">{detail}</p>
            {kind === "orders" && <p className="mt-3 text-sm text-[#9eaaa2]">{t("noAutomaticMatching")}</p>}
            {kind === "withdrawal" && <p className="mt-3 text-sm text-[#9eaaa2]">{t("publicHistoryRequired")}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/" className="inline-flex min-h-9 items-center border-b border-[#496052] px-1 text-xs text-[#bce7ce] no-underline hover:text-white">{t("trade")}</Link>
              <Link href="/launch" className="inline-flex min-h-9 items-center border-b border-[#72dfb0] px-1 text-xs font-semibold text-[#72dfb0] no-underline hover:text-[#a3f0cc]">{t("launch")}</Link>
            </div>
          </section>
          {localMode && (kind === "orders" || kind === "withdrawal") && <details className="mt-5 border-b border-[#2d3a35] pb-5">
            <summary className="cursor-pointer text-sm font-medium text-[#bce7ce]">{t("isolatedLocalActions")}</summary>
            <p className="my-3 text-sm text-[#9eaaa2]">{t("localFixtureNotice")}</p>
            {kind === "orders" && <OrderPanel signer={signer} />}
            {kind === "withdrawal" && <WithdrawalPanel signer={signer} />}
          </details>}
        </div>
      )}
    </main>
    </>
  );
}

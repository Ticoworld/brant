"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitcher, useLocale } from "./i18n-provider";
import MarketChart from "./market-chart";
import type { Activity, ExperienceProps, MarketView, Position } from "../lib/pudge/types";
import registry from "../public/pudge-markets.json";

const short = (value: string, start = 8, end = 6) =>
  value.length > start + end + 3
    ? `${value.slice(0, start)}…${value.slice(-end)}`
    : value;

function phaseLabel(phase: string, zh: boolean) {
  if (!zh) return phase;
  return ({ Funding: "缴款中", Active: "已激活", Closed: "已关闭" } as Record<string, string>)[phase] ?? phase;
}

function Freshness({ market }: { market: MarketView }) {
  const { locale } = useLocale();
  if (!market.observedAt) return null;
  const zh = locale === "zh-CN";
  const checkedAt = new Date(market.observedAt);
  const time = checkedAt.toLocaleTimeString(zh ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const source = market.freshness === "cached"
    ? zh ? "缓存视图" : "Cached view"
    : zh ? "链上状态已核验" : "On-chain state checked";
  return <span className="mt-1 block text-[12px] text-rv-subtle"><time dateTime={checkedAt.toISOString()}>{source} · {time}</time></span>;
}

function atoms(value: string) {
  if (!/^\d+(\.\d{1,8})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, "0"));
}

function ckb(value: bigint) {
  const whole = value / 100_000_000n;
  const fraction = (value % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function Title({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="m-0 text-[12px] font-medium uppercase text-rv-subtle">{eyebrow}</p>
      <h1 className="m-0 mt-2 text-[24px] font-semibold leading-tight text-rv-text">{title}</h1>
      {detail && <p className="mb-0 mt-2 max-w-3xl text-[14px] leading-6 text-rv-muted">{detail}</p>}
    </div>
  );
}

function WalletButton({ p }: { p: ExperienceProps }) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      disabled={p.busy}
      onClick={p.address ? p.onCheck : p.onConnect}
      className="inline-flex h-10 min-w-36 max-w-56 items-center justify-center gap-2 overflow-hidden rounded-md border border-rv-line bg-rv-surface px-3 text-[14px] font-medium text-rv-text transition-colors hover:border-rv-subtle hover:bg-rv-input disabled:opacity-60"
    >
      <Wallet aria-hidden="true" size={16} />
      <span className="truncate">
        {p.address ? short(p.address) : p.connected ? t("checkWalletCompatibility") : t("connectWallet")}
      </span>
    </button>
  );
}

function Header({ p }: { p: ExperienceProps }) {
  const { t, locale } = useLocale();
  const links = [
    { view: "Markets" as const, href: "/", label: t("markets") },
    { view: "My Positions" as const, href: "/portfolio", label: t("portfolio") },
    { view: "Activity" as const, href: "/activity", label: t("activity") },
    { view: "Create Market" as const, href: "/launch", label: t("launch") },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-rv-line bg-rv-canvas/95 backdrop-blur">
      <div className="mx-auto flex min-h-[68px] max-w-[1480px] flex-wrap items-center gap-x-6 px-4 sm:px-6">
        <a
          href="/"
          onClick={(event) => {
            event.preventDefault();
            p.onNavigate("Markets");
          }}
          aria-label={locale === "zh-CN" ? "Roveko 市场" : "Roveko markets"}
          className="order-1 inline-flex shrink-0 items-center gap-2 py-3 text-[18px] font-semibold text-rv-text no-underline"
        >
          <span className="grid size-8 place-items-center rounded-[4px] border border-rv-accent/50 text-[15px] font-bold text-rv-accent">R</span>
          ROVEKO
        </a>
        <div className="order-2 ml-auto flex items-center gap-2 sm:order-4 sm:ml-0">
          <span className="hidden items-center gap-2 px-2 text-[13px] font-medium text-rv-muted md:inline-flex">
            <i aria-hidden="true" className="size-2 rounded-full bg-rv-accent" />
            CKB Pudge
          </span>
          <WalletButton p={p} />
          <LanguageSwitcher />
        </div>
        <nav aria-label={t("primaryNavigation")} className="order-4 -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto border-t border-rv-line px-2 sm:order-2 sm:mx-0 sm:w-auto sm:flex-1 sm:border-0 sm:px-0">
          {links.map((item) => {
            const active = p.route.view === item.view || (item.view === "Markets" && p.route.view === "Market");
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  p.onNavigate(item.view);
                }}
                className={`shrink-0 border-b-2 px-3 py-[17px] text-[14px] font-medium no-underline transition-colors ${active ? "border-rv-accent text-rv-text" : "border-transparent text-rv-muted hover:text-rv-text"}`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function Status({ p }: { p: ExperienceProps }) {
  const { locale, t } = useLocale();
  const zh = locale === "zh-CN";
  const translated: Record<string, string> = {
    "Connect a supported testnet wallet, or open a known market to inspect it.": "请连接受支持的测试网钱包，或打开已知市场进行查看。",
    "Loading verified market state from Pudge.": "正在从 Pudge 加载已验证的市场状态。",
    "Market reconstructed from committed history and its live Cell.": "已根据已提交的历史记录和当前链上 Cell 重建市场。",
    "Wallet account changed. Check compatibility again before managing positions.": "钱包账户已更改。请重新检查兼容性，再管理持仓。",
    "Waiting for your wallet approval.": "正在等待钱包批准。",
    "Submitted. Waiting for commitment; submission is not settlement.": "交易已提交，正在等待链上确认；提交不等于结算。",
    "Review the exact amounts and outputs before opening your wallet.": "打开钱包前，请核对确切金额和输出。",
    "Wallet lock matches the ordinary CKB secp profile. Complete external-wallet signing is not yet accepted.": "钱包锁符合普通 CKB secp 配置；外部钱包签名的完整兼容性尚未验证。",
    "Market closed. Permitted cushion returned, less the transaction fee.": "市场已关闭。扣除交易手续费后，允许返还的剩余容量已退回。",
    "Unsigned offer prepared. Save the file and collect both owners’ signatures.": "未签名报价已准备好。请保存文件并收集双方持有人的签名。",
    "Signature added. Save the offer file and return it to the other consenting owner.": "签名已添加。请保存报价文件并交还另一位同意转让的持有人。",
  };
  const displayStatus = zh && p.error
    ? t("operationFailed")
    : zh
      ? translated[p.status] ?? p.status
      : p.status;
  if (!p.error && !p.busy && /^Connect a supported|^Connect and verify/.test(p.status)) return null;
  return (
    <div role={p.error ? "alert" : "status"} aria-live="polite" className={`mx-auto flex w-full max-w-[1480px] items-start gap-3 px-4 pt-4 text-[14px] sm:px-6 ${p.error ? "text-[#f09a9a]" : "text-rv-muted"}`}>
      {p.busy ? <span className="mt-1 size-3 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : p.error ? <CircleAlert aria-hidden="true" size={17} /> : <Check aria-hidden="true" size={17} className="text-rv-accent" />}
      <div className="min-w-0"><p className="m-0 leading-5">{displayStatus}</p>{zh && p.error && <details className="mt-1 text-[12px] text-rv-subtle"><summary className="cursor-pointer">{t("technicalDetails")}</summary><p className="mb-0 mt-1 break-words">{p.status}</p></details>}</div>
    </div>
  );
}

function Footer() {
  const { t } = useLocale();
  return (
    <footer className="mt-auto flex min-h-10 items-center justify-between gap-3 border-t border-rv-line px-4 text-[12px] text-rv-subtle sm:px-6">
      <span className="inline-flex items-center gap-2"><i aria-hidden="true" className="size-1.5 rounded-full bg-rv-accent" />{t("pudgeTestnet")}</span>
      <a className="inline-flex items-center gap-1 text-rv-muted no-underline hover:text-rv-text" href="https://pudge.explorer.nervos.org/" target="_blank" rel="noreferrer">Pudge Explorer <ExternalLink aria-hidden="true" size={13} /></a>
    </footer>
  );
}

function Shell({ p, children }: { p: ExperienceProps; children: React.ReactNode }) {
  const { locale } = useLocale();
  return (
    <div className="flex min-h-dvh flex-col bg-rv-canvas text-rv-text">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-rv-surface focus:px-3 focus:py-2">{locale === "zh-CN" ? "跳到主内容" : "Skip to workspace"}</a>
      <Header p={p} />
      <Status p={p} />
      <main id="workspace" tabIndex={-1} aria-busy={p.busy} className="mx-auto flex w-full max-w-[1480px] flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function MarketRow({ p, market }: { p: ExperienceProps; market: MarketView }) {
  const { locale } = useLocale();
  const zh = locale === "zh-CN";
  return (
    <a
      href={`/market/${market.id}`}
      onClick={(event) => {
        event.preventDefault();
        p.onOpenMarket(market.id);
      }}
      className="grid min-h-[88px] grid-cols-1 items-center gap-y-3 border-b border-rv-line px-4 py-4 text-rv-text no-underline transition-colors hover:bg-rv-surface sm:grid-cols-[minmax(220px,1.6fr)_minmax(115px,1fr)_minmax(115px,1fr)_minmax(118px,0.85fr)_78px] sm:gap-4 sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md border border-rv-line bg-rv-input text-[12px] font-bold text-rv-accent">CKB</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="text-[15px] font-semibold">{zh ? "Pudge 担保债权" : "Pudge backed claims"}</strong>
            <span className="rounded-full border border-rv-accent/40 px-2 py-0.5 text-[12px] text-rv-accent">{phaseLabel(market.phase, zh)}</span>
          </div>
          <span className="mt-1 block truncate text-[13px] text-rv-subtle">{short(market.id, 10, 8)}</span>
          <Freshness market={market} />
        </div>
      </div>
      <Metric label={zh ? "当前担保" : "Backing remaining"} value={`${market.backing} CKB`} />
      <Metric label={zh ? "已缴款" : "Contributed"} value={`${market.contributed} CKB`} />
      <Metric label={zh ? "已分配位置" : "Funded positions"} value={`${market.positions.filter((item) => !item.empty).length} / ${market.positions.length}`} />
      <span className="hidden items-center justify-end gap-1 text-[13px] font-medium text-rv-accent sm:inline-flex">{zh ? "打开" : "Open"}<ArrowUpRight size={15} /></span>
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-rv-accent sm:hidden">{zh ? "打开市场" : "Open market"}<ArrowUpRight size={15} /></span>
    </a>
  );
}

function PendingMarketRow({ p, id }: { p: ExperienceProps; id: string }) {
  const { locale, t } = useLocale();
  const zh = locale === "zh-CN";
  return (
    <a
      href={`/market/${id}`}
      onClick={(event) => {
        event.preventDefault();
        p.onOpenMarket(id);
      }}
      className="grid min-h-[88px] grid-cols-1 items-center gap-y-3 border-b border-rv-line px-4 py-4 text-rv-text no-underline transition-colors hover:bg-rv-surface sm:grid-cols-[minmax(220px,1.6fr)_minmax(115px,1fr)_minmax(115px,1fr)_minmax(118px,0.85fr)_78px] sm:gap-4 sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md border border-rv-line bg-rv-input text-[12px] font-bold text-rv-accent">CKB</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="text-[15px] font-semibold">{zh ? "Pudge 担保债权" : "Pudge backed claims"}</strong>
            <span className="rounded-full border border-rv-line px-2 py-0.5 text-[12px] text-rv-muted">{t("loadingMarketState")}</span>
          </div>
          <span className="mt-1 block truncate text-[13px] text-rv-subtle">{short(id, 10, 8)}</span>
        </div>
      </div>
      <Metric label={zh ? "剩余担保" : "Backing remaining"} value="—" />
      <Metric label={zh ? "已缴款" : "Contributed"} value="—" />
      <Metric label={zh ? "已分配位置" : "Funded positions"} value="—" />
      <span className="hidden items-center justify-end gap-1 text-[13px] font-medium text-rv-accent sm:inline-flex">{zh ? "打开" : "Open"}<ArrowUpRight size={15} /></span>
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-rv-accent sm:hidden">{zh ? "打开市场" : "Open market"}<ArrowUpRight size={15} /></span>
    </a>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="m-0 text-[12px] text-rv-subtle">{label}</p><p className="mb-0 mt-1 truncate text-[14px] font-medium tabular-nums text-rv-text">{value}</p></div>;
}

function Markets({ p }: { p: ExperienceProps }) {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState("");
  const zh = locale === "zh-CN";
  const markets = p.markets.filter((market) => `${market.id} ${market.phase}`.toLowerCase().includes(query.toLowerCase()));
  function openQuery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (query.trim()) p.onOpenMarket(query.trim());
  }
  return (
    <Shell p={p}>
      <div className="flex flex-col justify-between gap-5 border-b border-rv-line pb-6 sm:flex-row sm:items-end">
        <Title eyebrow="CKB PUDGE · PUBLIC MARKETS" title={t("markets")} detail={zh ? "检查已验证的链上市场和担保状态。无需连接钱包。" : "Inspect verified on-chain markets and backing state. No wallet connection required."} />
        <form onSubmit={openQuery} className="flex h-11 w-full max-w-[490px] items-center gap-2 rounded-md border border-rv-line bg-rv-surface px-3 focus-within:border-rv-subtle">
          <Search aria-hidden="true" size={17} className="shrink-0 text-rv-subtle" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? "市场标识" : "Market identity"} aria-label={t("marketLinkOrIdentity")} className="min-w-0 flex-1 bg-transparent text-[14px] text-rv-text outline-none placeholder:text-rv-subtle" />
          <button type="submit" className="h-8 shrink-0 rounded border border-rv-line px-3 text-[13px] text-rv-muted hover:bg-rv-input">{t("openMarket")}</button>
        </form>
      </div>

      <section aria-labelledby="verified-markets" className="mt-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2"><h2 id="verified-markets" className="m-0 text-[17px] font-semibold">{zh ? "已验证市场" : "Verified markets"}</h2><span className="text-[13px] text-rv-subtle">{markets.length || (p.discovery.state === "idle" ? registry.markets.length : 0)}</span></div>
          <button type="button" onClick={() => p.onDiscover()} disabled={p.busy} className="inline-flex h-9 items-center gap-2 rounded border border-rv-line px-3 text-[13px] text-rv-muted hover:bg-rv-surface disabled:opacity-50"><RefreshCw size={14} aria-hidden="true" />{zh ? "刷新" : "Refresh"}</button>
        </div>
        <div className="overflow-hidden rounded-xl border border-rv-line bg-rv-surface">
          <div className="hidden h-[52px] grid-cols-[minmax(220px,1.6fr)_minmax(115px,1fr)_minmax(115px,1fr)_minmax(118px,0.85fr)_78px] items-center gap-4 rounded-t-xl border-b border-rv-line bg-[#222831] px-6 text-[13px] font-medium text-rv-muted sm:grid">
            <span>{zh ? "市场" : "Market"}</span><span>{zh ? "剩余担保" : "Backing"}</span><span>{zh ? "已缴款" : "Contributed"}</span><span>{zh ? "已缴款位置" : "Funded positions"}</span><span />
          </div>
          {markets.map((market) => <MarketRow key={market.id} p={p} market={market} />)}
          {markets.length === 0 && !query.trim() && p.discovery.state === "idle" && registry.markets.map((entry) => <PendingMarketRow key={entry.id} p={p} id={entry.id} />)}
          {markets.length === 0 && (p.discovery.state === "unavailable" || query.trim()) && <div className="grid min-h-48 place-items-center px-5 py-8 text-center"><div><p className="m-0 text-[15px] font-medium">{p.discovery.state === "unavailable" ? t("discoveryUnavailable") : t("noVerifiedMarkets")}</p><p className="mb-0 mt-2 max-w-lg text-[14px] leading-6 text-rv-muted">{p.discovery.message}</p>{p.discovery.state === "unavailable" && <button type="button" onClick={() => p.onDiscover()} className="mt-4 h-10 rounded border border-rv-line px-4 text-[14px] hover:bg-rv-input">{t("retryRecovery")}</button>}</div></div>}
        </div>
        <p className="mb-0 mt-4 flex items-start gap-2 text-[13px] leading-5 text-rv-subtle"><CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={15} />{zh ? "此部署为 CKB 担保债权市场，不发行可互换代币，也没有可验证的代币价格或交易量。" : "This deployment is a CKB-backed claim market. It does not issue a fungible token or provide verified token pricing or volume."}</p>
      </section>
    </Shell>
  );
}

function MarketHeader({ p, market }: { p: ExperienceProps; market: MarketView }) {
  const { locale, t } = useLocale();
  const zh = locale === "zh-CN";
  return (
    <div className="border-b border-rv-line pb-5">
      <button type="button" onClick={() => p.onNavigate("Markets")} className="mb-5 inline-flex h-8 items-center gap-2 rounded px-2 text-[13px] text-rv-muted hover:bg-rv-surface"><ArrowLeft size={15} aria-hidden="true" />{t("backToMarkets")}</button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-md border border-rv-line bg-rv-surface text-[12px] font-bold text-rv-accent">CKB</span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h1 className="m-0 text-[22px] font-semibold">{zh ? "Pudge 担保债权" : "Pudge backed claims"}</h1><span className="rounded-full border border-rv-accent/40 px-2.5 py-1 text-[12px] text-rv-accent">{phaseLabel(market.phase, zh)}</span></div>
            <button type="button" onClick={() => navigator.clipboard.writeText(market.id)} className="mt-1 inline-flex max-w-full items-center gap-2 text-[13px] text-rv-subtle hover:text-rv-text"><span className="truncate">{market.id}</span><Copy size={13} aria-hidden="true" /></button>
            <Freshness market={market} />
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
        <Metric label={t("backingRemaining")} value={`${market.backing} CKB`} />
        <Metric label={t("contributed")} value={`${market.contributed} CKB`} />
        <Metric label={t("fundedSlots")} value={`${market.positions.filter((item) => !item.empty).length} / ${market.positions.length}`} />
        <Metric label={t("maturity")} value={market.maturity === "0" ? t("noAddedDelay") : `Block ${market.maturity}`} />
      </div>
    </div>
  );
}

function PositionTable({ p, market }: { p: ExperienceProps; market: MarketView }) {
  const { locale, t } = useLocale();
  const selected = p.route.claim;
  const zh = locale === "zh-CN";
  return (
    <section className="min-w-0" aria-labelledby="position-list-title">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="position-list-title" className="m-0 text-[16px] font-semibold">{t("positions")}</h2>
        <span className="text-[13px] text-rv-subtle">{market.positions.length} {zh ? "个位置" : "slots"}</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-rv-line">
        <div className="hidden h-11 grid-cols-[minmax(125px,1fr)_minmax(120px,1fr)_minmax(130px,1fr)_100px] items-center gap-3 border-b border-rv-line bg-rv-surface px-4 text-[12px] font-medium text-rv-muted sm:grid"><span>{zh ? "位置 / 持有人" : "Position / owner"}</span><span>{t("contributed")}</span><span>{t("backingRemaining")}</span><span /></div>
        {market.positions.map((position) => {
          const active = selected === position.index;
          return (
            <button key={position.index} type="button" aria-pressed={active} onClick={() => p.onSelectPosition(position.index)} className={`grid w-full grid-cols-1 items-center gap-y-2 border-b border-rv-line px-4 py-3 text-left transition-colors last:border-0 sm:grid-cols-[minmax(125px,1fr)_minmax(120px,1fr)_minmax(130px,1fr)_100px] sm:gap-3 sm:py-3 ${active ? "bg-[#202a25]" : "bg-rv-canvas hover:bg-rv-surface"}`}>
              <span className="flex min-w-0 items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-md border border-rv-line text-[13px] font-semibold text-rv-muted">{position.index + 1}</span><span className="min-w-0"><strong className="block text-[14px] font-medium">{position.empty ? (zh ? "未缴款" : "Unfunded") : position.mine ? (zh ? "你的钱包" : "Your wallet") : (zh ? "持有人" : "Position owner")}</strong><span className="block truncate text-[12px] text-rv-subtle">{position.empty ? (zh ? "可缴款" : "Available to fund") : short(position.owner)}</span></span></span>
              <span className="flex justify-between gap-3 text-[13px] sm:block"><span className="text-rv-subtle sm:hidden">{t("contributed")}</span><span className="tabular-nums">{position.contribution} CKB</span></span>
              <span className="flex justify-between gap-3 text-[13px] sm:block"><span className="text-rv-subtle sm:hidden">{t("backingRemaining")}</span><span className="tabular-nums">{position.backing} CKB</span></span>
              <span className="hidden justify-end text-[13px] text-rv-accent sm:flex">{active ? (zh ? "已选" : "Selected") : (zh ? "查看" : "Manage")}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function PositionPanel({ p, market, position }: { p: ExperienceProps; market: MarketView; position?: Position }) {
  const { locale, t } = useLocale();
  const zh = locale === "zh-CN";
  const [mode, setMode] = useState<"redeem" | "sell">("redeem");
  const [advanced, setAdvanced] = useState(false);
  const value = atoms(p.fields.amount);
  const rowRemaining = position ? atoms(position.backing) : null;
  const canContribute = value !== null && value >= (atoms(market.minimum) ?? 0n);
  const canRedeem = value !== null && rowRemaining !== null && value > 0n && value <= rowRemaining;
  const locked = p.busy || p.deployment !== "Configured";
  const active = market.phase === "Active";
  const presets = [25, 50, 75, 100];
  const percentage = (pct: number) => {
    if (!position) return;
    const base = atoms(active ? position.backing : position.contribution);
    if (base === null) return;
    p.update("amount", ckb((base * BigInt(pct)) / 100n));
  };

  return (
    <aside aria-labelledby="execution-title" className="h-fit rounded-xl border border-rv-line bg-rv-surface p-3 sm:rounded-[20px] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div><p className="m-0 text-[12px] font-medium uppercase text-rv-subtle">{zh ? "担保债权" : "CKB-backed claim"}</p><h2 id="execution-title" className="m-0 mt-1 text-[17px] font-semibold">{position ? `#${position.index + 1}` : (zh ? "选择位置" : "Select a position")}</h2></div>
        <span className="rounded-full border border-rv-line px-2.5 py-1 text-[12px] text-rv-muted">{phaseLabel(market.phase, zh)}</span>
      </div>
      {!position ? (
        <div className="rounded-md border border-rv-line bg-rv-canvas px-4 py-5 text-[14px] leading-6 text-rv-muted">{zh ? "选择一个位置查看可用的缴款、退款或赎回操作。" : "Select a position to inspect its available contribution, refund, or redemption action."}</div>
      ) : !p.address ? (
        <div className="rounded-md border border-rv-line bg-rv-canvas p-4">
          <p className="m-0 text-[14px] leading-6 text-rv-muted">{position.empty ? (zh ? "连接并检查钱包后即可缴款。" : "Connect and check a wallet to contribute to this position.") : (zh ? "连接并检查钱包以管理此位置。" : "Connect and check a wallet to manage this position.")}</p>
          <button type="button" onClick={p.connected ? p.onCheck : p.onConnect} className="mt-4 h-11 w-full rounded-md bg-rv-accent text-[14px] font-semibold text-[#12231a] hover:bg-[#a6ecc4]">{p.connected ? t("checkWalletCompatibility") : t("connectWallet")}</button>
        </div>
      ) : !active && position.empty ? (
        <>
          <AmountInput p={p} label={zh ? "缴款金额" : "Contribution amount"} helper={`${zh ? "最低" : "Minimum"} ${market.minimum} CKB`} />
          <div className="mt-3 rounded-md border border-rv-line bg-rv-canvas px-4 pb-2 pt-1.5">
            <InfoRow label={zh ? "初始担保 · 80%" : "Initial backing · 80%"} value={value !== null ? `${ckb((value * 4n) / 5n)} CKB` : "—"} />
            <InfoRow label={zh ? "创建者总收入 · 20%" : "Creator gross · 20%"} value={value !== null ? `${ckb(value - (value * 4n) / 5n)} CKB` : "—"} />
            <InfoRow label={zh ? "网络费 · 另计" : "Network fee · additional"} value="0.001 CKB" />
          </div>
          <button type="button" disabled={locked || !canContribute} onClick={() => p.onAction("contribute")} className="mt-4 h-12 w-full rounded-md bg-rv-accent text-[15px] font-semibold text-[#12231a] hover:bg-[#a6ecc4] disabled:cursor-not-allowed disabled:bg-[#46524b] disabled:text-[#acb5af]">{zh ? "审核缴款" : "Review contribution"}</button>
          <p className="mb-0 mt-3 text-[13px] leading-5 text-rv-muted">{zh ? "市场激活时会将缴款总额的20%分配给创建者。激活前可退款。" : "20% is allocated to the creator at activation. Contributions can be refunded before activation."}</p>
        </>
      ) : !active && position.mine ? (
        <>
          <div className="rounded-md border border-rv-line bg-rv-canvas px-4 pb-2 pt-1.5"><InfoRow label={zh ? "退款总额" : "Gross refund"} value={`${position.contribution} CKB`} /><InfoRow label={zh ? "网络费 · 扣除" : "Network fee · deducted"} value="0.001 CKB" /><InfoRow strong label={zh ? "预计到账" : "Estimated receipt"} value={`${ckb((atoms(position.contribution) ?? 0n) - 100_000n)} CKB`} /></div>
          <button type="button" disabled={locked} onClick={() => p.onAction("refund")} className="mt-4 h-12 w-full rounded-md bg-rv-accent text-[15px] font-semibold text-[#12231a] hover:bg-[#a6ecc4] disabled:opacity-50">{zh ? "审核退款" : "Review refund"}</button>
          <p className="mb-0 mt-3 text-[13px] leading-5 text-rv-muted">{zh ? "退款仅适用于尚未激活的已缴款位置。" : "Refund is available only for your funded position before activation."}</p>
        </>
      ) : !position.remaining ? (
        <div className="rounded-md border border-rv-line bg-rv-canvas px-4 py-5 text-[14px] leading-6 text-rv-muted">{zh ? "此位置已全部结算，没有剩余担保可赎回或转让。" : "This position is fully settled. No backing remains to redeem or assign."}</div>
      ) : position.mine ? (
        <>
          <div role="tablist" aria-label={zh ? "持仓操作" : "Position actions"} className="mb-4 grid h-10 grid-cols-2 gap-1 rounded-md bg-rv-canvas p-1">
            <button role="tab" aria-selected={mode === "redeem"} type="button" onClick={() => setMode("redeem")} className={`rounded text-[14px] font-medium ${mode === "redeem" ? "bg-rv-input text-rv-text" : "text-rv-muted hover:text-rv-text"}`}>{zh ? "赎回" : "Redeem"}</button>
            <button role="tab" aria-selected={mode === "sell"} type="button" onClick={() => setMode("sell")} className={`rounded text-[14px] font-medium ${mode === "sell" ? "bg-rv-input text-rv-text" : "text-rv-muted hover:text-rv-text"}`}>{zh ? "转让" : "Assign"}</button>
          </div>
          {mode === "redeem" ? <>
            <AmountInput p={p} label={zh ? "赎回总额" : "Gross redemption"} helper={`${zh ? "剩余担保" : "Remaining backing"}: ${position.backing} CKB`} />
            <div className="mt-2 grid grid-cols-4 gap-2">{presets.map((pct) => <button key={pct} type="button" onClick={() => percentage(pct)} className="h-9 rounded border border-rv-line text-[13px] tabular-nums text-rv-muted hover:bg-rv-input">{pct}%</button>)}</div>
            <div className="mt-3 rounded-md border border-rv-line bg-rv-canvas px-4 pb-2 pt-1.5"><InfoRow label={zh ? "网络费 · 扣除" : "Network fee · deducted"} value="0.001 CKB" /><InfoRow strong label={zh ? "预计到账" : "Estimated receipt"} value={value !== null ? `${ckb(value > 100_000n ? value - 100_000n : 0n)} CKB` : "—"} /></div>
            {market.maturity !== "0" && (!market.tip || BigInt(market.tip) < BigInt(market.maturity)) ? <p className="mb-0 mt-3 text-[13px] leading-5 text-[#e7c97c]">{zh ? `赎回将于区块 ${market.maturity} 开放。` : `Redemption opens at block ${market.maturity}.`}</p> : <button type="button" disabled={locked || !canRedeem} onClick={() => p.onAction("redeem")} className="mt-4 h-12 w-full rounded-md bg-rv-accent text-[15px] font-semibold text-[#12231a] hover:bg-[#a6ecc4] disabled:opacity-50">{zh ? "审核赎回" : "Review redemption"}</button>}
          </> : <>
            <p className="m-0 text-[14px] leading-6 text-rv-muted">{zh ? "转让需要买方和卖方共同签署。准备报价后，请将未签名交易交给买方审核。" : "Assignment requires both buyer and seller consent. Prepare an offer, then share the unsigned transaction for the buyer’s review."}</p>
            <label className="mt-4 block text-[13px] font-medium text-rv-muted">{zh ? "买方地址" : "Buyer address"}<input value={p.fields.buyer} onChange={(event) => p.update("buyer", event.target.value)} className="mt-2 h-11 w-full rounded-md border border-rv-line bg-rv-canvas px-3 text-[14px] text-rv-text outline-none focus:border-rv-subtle" placeholder="ckt1…" /></label>
            <label className="mt-3 block text-[13px] font-medium text-rv-muted">{zh ? "價格 · CKB" : "Price · CKB"}<input inputMode="decimal" value={p.fields.price} onChange={(event) => p.update("price", event.target.value)} className="mt-2 h-11 w-full rounded-md border border-rv-line bg-rv-canvas px-3 text-[14px] text-rv-text outline-none focus:border-rv-subtle" /></label>
            <button type="button" disabled={locked || !p.fields.buyer || !atoms(p.fields.price)} onClick={() => p.onOffer("prepare")} className="mt-4 h-12 w-full rounded-md bg-rv-accent text-[15px] font-semibold text-[#12231a] hover:bg-[#a6ecc4] disabled:opacity-50">{zh ? "准备转让报价" : "Prepare assignment offer"}</button>
            {p.fields.envelope && <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => p.onOffer("sign")} className="h-10 rounded border border-rv-line px-3 text-[14px] hover:bg-rv-input">{zh ? "在钱包中签名" : "Sign in wallet"}</button><button type="button" onClick={() => navigator.clipboard.writeText(p.fields.envelope)} className="inline-flex h-10 items-center gap-2 rounded border border-rv-line px-3 text-[14px] hover:bg-rv-input"><Copy size={14} />{zh ? "复制报价" : "Copy offer"}</button></div>}
          </>}
        </>
      ) : (
        <>
          <p className="m-0 text-[14px] leading-6 text-rv-muted">{zh ? "此位置由其他钱包持有。二级转让仅在双方同意并提交完整签名交易后结算。" : "This position belongs to another wallet. A secondary assignment settles only after both owners consent and provide a fully signed transaction."}</p>
          <label className="mt-4 block text-[13px] font-medium text-rv-muted">{zh ? "你的买方地址" : "Your buyer address"}<input value={p.fields.buyer} onChange={(event) => p.update("buyer", event.target.value)} className="mt-2 h-11 w-full rounded-md border border-rv-line bg-rv-canvas px-3 text-[14px] text-rv-text outline-none focus:border-rv-subtle" placeholder="ckt1…" /></label>
          <label className="mt-3 block text-[13px] font-medium text-rv-muted">{zh ? "卖方报价文件" : "Seller offer file"}<textarea value={p.fields.envelope} onChange={(event) => p.update("envelope", event.target.value)} rows={4} className="mt-2 w-full resize-y rounded-md border border-rv-line bg-rv-canvas p-3 text-[13px] leading-5 text-rv-text outline-none focus:border-rv-subtle" placeholder={zh ? "粘贴完整报价 JSON" : "Paste the complete offer JSON"} /></label>
          <label className="mt-3 block text-[13px] font-medium text-rv-muted">{zh ? "约定价格 · CKB" : "Agreed price · CKB"}<input inputMode="decimal" value={p.fields.price} onChange={(event) => p.update("price", event.target.value)} className="mt-2 h-11 w-full rounded-md border border-rv-line bg-rv-canvas px-3 text-[14px] text-rv-text outline-none focus:border-rv-subtle" /></label>
          <button type="button" disabled={locked || !p.address || !p.fields.envelope || !p.fields.buyer || !atoms(p.fields.price)} onClick={() => p.onOffer("submit")} className="mt-4 h-12 w-full rounded-md bg-rv-accent text-[15px] font-semibold text-[#12231a] hover:bg-[#a6ecc4] disabled:opacity-50">{zh ? "审核并提交转让" : "Review and submit assignment"}</button>
        </>
      )}
      <button type="button" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced} className="mt-4 flex w-full items-center justify-center gap-1 py-2 text-[13px] text-rv-subtle hover:text-rv-text">{zh ? "市场详细信息" : "Market details"}<ChevronDown size={14} className={advanced ? "rotate-180" : ""} /></button>
      {advanced && <dl className="mt-1 border-t border-rv-line pt-3"><InfoRow label={zh ? "市场标识" : "Market identity"} value={short(market.id, 10, 8)} /><InfoRow label={zh ? "最低缴款" : "Minimum contribution"} value={`${market.minimum} CKB`} /><InfoRow label={zh ? "网络" : "Network"} value="CKB Pudge testnet" /><InfoRow label={zh ? "状态根" : "State root"} value={short(market.root, 10, 8)} /></dl>}
    </aside>
  );
}

function AmountInput({ p, label, helper }: { p: ExperienceProps; label: string; helper: string }) {
  return (
    <div className="rounded-[12px] bg-rv-surface p-2">
      <div className="flex items-center justify-between gap-3 px-2 py-2">
        <label htmlFor="position-amount" className="text-[14px] font-medium text-rv-muted">{label}</label>
        <span className="shrink-0 text-[13px] text-rv-subtle">{helper}</span>
      </div>
      <div className="grid min-h-[68px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-[12px] bg-rv-canvas px-3 py-2 sm:min-h-[76px] sm:gap-4 sm:px-[18px]">
        <span className="inline-flex h-10 items-center gap-2 rounded-[12px] bg-rv-input px-3 text-[14px] font-semibold text-rv-text sm:h-12 sm:text-[16px]"><span className="grid size-6 place-items-center rounded-md border border-rv-line text-[10px] font-bold text-rv-accent">C</span>CKB</span>
        <input id="position-amount" inputMode="decimal" autoComplete="off" value={p.fields.amount} onChange={(event) => p.update("amount", event.target.value)} className="h-11 min-w-0 w-full bg-transparent text-right text-[24px] font-medium tabular-nums text-rv-text outline-none placeholder:text-rv-subtle sm:text-[28px]" placeholder="0.0" />
      </div>
    </div>
  );
}

function InfoRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-start justify-between gap-3 py-1.5 text-[13px]"><dt className="min-w-0 text-rv-muted">{label}</dt><dd className={`m-0 max-w-[62%] break-all text-right tabular-nums ${strong ? "font-semibold text-rv-text" : "text-rv-muted"}`}>{value}</dd></div>;
}

function MarketWorkspace({ p }: { p: ExperienceProps }) {
  const { locale, t } = useLocale();
  const zh = locale === "zh-CN";
  const market = p.market;
  if (!market) {
    return <Shell p={p}><div className="flex min-h-72 flex-col items-center justify-center text-center"><Clock3 size={24} className="mb-4 text-rv-subtle" /><Title eyebrow="CKB PUDGE" title={p.loadingMarket ? t("openingMarket") : t("marketUnavailable")} detail={p.loadingMarket ? t("checkingLiveHistory") : zh && p.error ? t("operationFailed") : p.status} />{zh && p.error && <details className="mt-2 text-left text-[12px] text-rv-subtle"><summary className="cursor-pointer">{t("technicalDetails")}</summary><p className="mt-1 max-w-xl break-words">{p.status}</p></details>}<button type="button" onClick={p.onRecover} disabled={p.busy} className="mt-5 inline-flex h-10 items-center gap-2 rounded border border-rv-line px-4 text-[14px] hover:bg-rv-surface"><RefreshCw size={15} />{t("retryRecovery")}</button></div></Shell>;
  }
  const selected = p.route.claim === undefined ? undefined : market.positions[p.route.claim];
  return (
    <Shell p={p}>
      <MarketHeader p={p} market={market} />
        <div className="mt-6 grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:gap-6">
        <div className="min-w-0 space-y-6">
          <section className="min-w-0" aria-labelledby="chart-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div><h2 id="chart-heading" className="m-0 text-[16px] font-semibold">{t("confirmedExecutionHistory")}</h2><p className="mb-0 mt-1 text-[13px] text-rv-subtle">{t("committedPricesOnly")}</p></div>
              <div role="tablist" aria-label={t("chartRange")} className="flex h-9 items-center gap-1 rounded-md border border-rv-line bg-rv-surface p-1 text-[12px]"><button role="tab" aria-selected="true" className="h-7 rounded bg-rv-input px-2.5 text-rv-text">{t("all")}</button><button role="tab" aria-selected="false" disabled className="h-7 rounded px-2.5 text-rv-subtle">1D</button><button role="tab" aria-selected="false" disabled className="h-7 rounded px-2.5 text-rv-subtle">1W</button></div>
            </div>
            <div className="flex min-h-[280px] flex-col rounded-xl border border-rv-line bg-rv-surface p-2 sm:min-h-[330px] sm:rounded-[20px] sm:p-3">
              <MarketChart marketId={market.id} loading={p.loadingMarket} />
              <p className="m-0 border-t border-rv-line px-2 pt-3 text-[13px] leading-5 text-rv-subtle">{zh ? "此合约记录担保债权，目前没有可验证的代币价格、曲线或交易量。" : "This contract records backed claims. It has no verified token price, bonding curve, or trade volume."}</p>
            </div>
          </section>
          <PositionTable p={p} market={market} />
        </div>
        <PositionPanel p={p} market={market} position={selected} />
      </div>
    </Shell>
  );
}

function Portfolio({ p }: { p: ExperienceProps }) {
  const { locale, t } = useLocale();
  const zh = locale === "zh-CN";
  const positions = p.markets.flatMap((market) => market.positions.filter((position) => position.mine).map((position) => ({ market, position })));
  const totalBacking = positions.reduce((sum, item) => sum + (atoms(item.position.backing) ?? 0n), 0n);
  return (
    <Shell p={p}>
      <Title eyebrow={zh ? "CKB PUDGE · 账户" : "CKB PUDGE · ACCOUNT"} title={t("portfolio")} detail={zh ? "根据已验证的公开市场恢复此钱包的债权持仓。" : "Claim positions reconstructed from verified public markets for this wallet."} />
      {!p.address ? <section aria-labelledby="portfolio-overview" className="mt-7">
        <h2 id="portfolio-overview" className="mb-3 mt-0 text-[18px] font-medium">{zh ? "账户概览" : "Account overview"}</h2>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-2 md:gap-8 md:overflow-visible md:px-0">
          <article className="flex min-w-[300px] snap-start flex-col overflow-hidden rounded-[20px] border border-rv-line bg-rv-surface md:min-w-0">
            <h3 className="m-0 flex h-12 items-center bg-rv-input px-6 text-[14px] font-medium">{zh ? "担保债权持仓" : "Backed claim positions"}</h3>
            <div className="flex min-h-[168px] flex-1 flex-col items-center justify-center px-5 py-6 text-center">
              <p className="m-0 text-[14px] text-rv-muted">{zh ? "连接钱包查看持仓" : "Connect a wallet to view positions"}</p>
              <p className="mb-0 mt-2 max-w-sm text-[13px] leading-5 text-rv-subtle">{zh ? "市场可匿名浏览；持仓会与已检查的钱包锁定脚本核对。" : "Markets are public. Positions are matched to the checked wallet lock."}</p>
              <button type="button" onClick={p.connected ? p.onCheck : p.onConnect} className="mt-5 h-10 rounded-md bg-rv-accent px-5 text-[14px] font-semibold text-[#12231a] hover:bg-[#a6ecc4]">{p.connected ? t("checkWalletCompatibility") : t("connectWallet")}</button>
            </div>
          </article>
          <article className="flex min-w-[300px] snap-start flex-col overflow-hidden rounded-[20px] border border-rv-line bg-rv-surface md:min-w-0">
            <h3 className="m-0 flex h-12 items-center bg-rv-input px-6 text-[14px] font-medium">{zh ? "CKB 钱包余额" : "Wallet CKB balance"}</h3>
            <div className="flex min-h-[168px] flex-1 items-center justify-center px-5 py-6 text-center">
              <p className="m-0 max-w-sm text-[14px] leading-6 text-rv-subtle">{zh ? "检查支持的钱包后，这里会显示已验证的余额。" : "A verified balance appears after a supported wallet is checked."}</p>
            </div>
          </article>
        </div>
      </section> : <>
        <section aria-labelledby="portfolio-overview" className="mt-7">
          <h2 id="portfolio-overview" className="mb-3 mt-0 text-[18px] font-medium">{zh ? "账户概览" : "Account overview"}</h2>
          <div className="grid snap-x grid-cols-1 gap-3 overflow-x-auto md:grid-cols-2 md:gap-6">
            <div className="min-w-0 snap-start rounded-[20px] border border-rv-line bg-rv-surface p-5 sm:p-6"><p className="m-0 text-[14px] text-rv-muted">{zh ? "担保债权持仓" : "Backed claim positions"}</p><p className="mb-0 mt-4 text-[28px] font-medium tabular-nums">{positions.length}</p><p className="mb-0 mt-2 text-[13px] text-rv-subtle">{zh ? "已验证市场中的持仓" : "Across verified markets"}</p></div>
            <div className="min-w-0 snap-start rounded-[20px] border border-rv-line bg-rv-surface p-5 sm:p-6"><p className="m-0 text-[14px] text-rv-muted">{zh ? "剩余担保" : "Remaining backing"}</p><p className="mb-0 mt-4 text-[28px] font-medium tabular-nums">{ckb(totalBacking)} <span className="text-[16px] text-rv-muted">CKB</span></p><p className="mb-0 mt-2 text-[13px] text-rv-subtle">{zh ? "不包括钱包 CKB 余额" : "Excludes wallet CKB balance"}</p></div>
          </div>
        </section>
        <section className="mt-8" aria-labelledby="holdings-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 id="holdings-heading" className="m-0 text-[18px] font-medium">{zh ? "我的位置" : "My positions"}</h2><span className="text-[13px] text-rv-subtle">{p.address}</span></div>
          <div className="overflow-hidden rounded-lg border border-rv-line">
            <div className="hidden h-11 grid-cols-[minmax(180px,1.5fr)_1fr_1fr_88px] items-center gap-4 border-b border-rv-line bg-rv-surface px-4 text-[12px] font-medium text-rv-muted sm:grid"><span>{t("market")}</span><span>{t("contributed")}</span><span>{t("backingRemaining")}</span><span /></div>
            {positions.map(({ market, position }) => <div key={`${market.id}:${position.index}`} className="grid grid-cols-1 items-center gap-y-2 border-b border-rv-line px-4 py-4 last:border-0 sm:grid-cols-[minmax(180px,1.5fr)_1fr_1fr_88px] sm:gap-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-md border border-rv-line text-[11px] font-bold text-rv-accent">CKB</span><div><strong className="block text-[14px] font-medium">{zh ? "Pudge 担保债权" : "Pudge backed claim"} · #{position.index + 1}</strong><span className="text-[13px] text-rv-subtle">{phaseLabel(market.phase, zh)}</span></div></div><Metric label={t("contributed")} value={`${position.contribution} CKB`} /><Metric label={t("backingRemaining")} value={`${position.backing} CKB`} /><button type="button" onClick={() => p.onOpenMarket(market.id)} className="h-9 rounded border border-rv-line text-[13px] hover:bg-rv-surface">{t("openMarketAction")}</button></div>)}
            {positions.length === 0 && <p className="m-0 px-4 py-6 text-[14px] text-rv-muted">{p.discovery.state === "idle" || p.discovery.state === "complete" ? t("noPositions") : p.discovery.message}</p>}
          </div>
        </section>
      </>}
    </Shell>
  );
}

function ActivityPage({ p }: { p: ExperienceProps }) {
  const { locale, t } = useLocale();
  const zh = locale === "zh-CN";
  return (
    <Shell p={p}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rv-line pb-5"><Title eyebrow={zh ? "CKB PUDGE · 交易" : "CKB PUDGE · TRANSACTIONS"} title={t("activity")} detail={zh ? "本次会话中检查或提交的交易状态。" : "Transactions checked or submitted in this browser session."} /><span className="text-[13px] text-rv-subtle">{t("sessionActivity")}</span></div>
      <div className="mt-6 overflow-hidden rounded-lg border border-rv-line">
        <div className="hidden h-11 grid-cols-[minmax(150px,1fr)_minmax(95px,0.8fr)_minmax(120px,1fr)_minmax(170px,1.4fr)] items-center gap-4 border-b border-rv-line bg-rv-surface px-4 text-[12px] font-medium text-rv-muted sm:grid"><span>{zh ? "操作" : "Action"}</span><span>{t("status")}</span><span>{zh ? "交易哈希" : "Transaction hash"}</span><span>{zh ? "详情" : "Details"}</span></div>
        {p.activity.map((item, index) => <ActivityRow key={`${item.hash ?? item.label}:${index}`} item={item} zh={zh} />)}
        {p.activity.length === 0 && <div className="grid min-h-48 place-items-center px-5 py-8 text-center"><div><Clock3 size={22} className="mx-auto mb-3 text-rv-subtle" /><h2 className="m-0 text-[15px] font-medium">{t("noActivity")}</h2><p className="mb-0 mt-2 max-w-lg text-[14px] leading-6 text-rv-muted">{zh ? "提交或恢复操作后，状态会显示在此处。此页面不会推测链上交易。" : "Submission and recovery states appear here. This page does not infer on-chain transactions."}</p></div></div>}
      </div>
    </Shell>
  );
}

function ActivityRow({ item, zh }: { item: Activity; zh: boolean }) {
  const statusColors: Record<Activity["state"], string> = {
    "Awaiting wallet": "text-[#e7c97c]",
    Pending: "text-[#e7c97c]",
    Committed: "text-rv-accent",
    Unconfirmed: "text-[#e7c97c]",
    Failed: "text-[#f09a9a]",
    Signed: "text-rv-muted",
  };
  const details: Record<string, string> = {
    "Approve the exact reviewed outputs in your wallet.": "请在钱包中批准已审核的确切交易输出。",
    "Wallet signing did not complete; no broadcast by this step.": "钱包签名未完成；此步骤未广播交易。",
    "Submission did not return a transaction hash. Check chain state before retrying.": "提交未返回交易哈希。重试前请检查链上状态。",
    "Submitted; waiting for commitment. Do not resubmit blindly.": "已提交，正在等待链上确认。请勿盲目重新提交。",
    "Commitment unconfirmed. Inspect this transaction before any retry.": "尚未确认。重试前请检查此交易。",
    "Committed on Pudge. Additional confirmations remain a chain-risk consideration.": "已在 Pudge 上确认。仍需考虑后续确认带来的链上风险。",
  };
  const labels: Record<string, string> = {
    "Fund position": "缴款",
    "Refund position": "退款",
    "Redeem backing": "赎回担保",
    "Paid assignment": "付费转让",
    "Create backed-claim market": "创建担保债权市场",
    "Activate market": "激活市场",
    "Close market": "关闭市场",
  };
  return <div className="grid grid-cols-1 gap-y-2 border-b border-rv-line px-4 py-4 last:border-0 sm:grid-cols-[minmax(150px,1fr)_minmax(95px,0.8fr)_minmax(120px,1fr)_minmax(170px,1.4fr)] sm:items-center sm:gap-4"><strong className="text-[14px] font-medium">{zh ? labels[item.label] ?? item.label : item.label}</strong><span className={`text-[13px] ${statusColors[item.state]}`}>{zh ? ({ "Awaiting wallet": "等待钱包", Pending: "待确认", Committed: "已提交", Unconfirmed: "未确认", Failed: "失败", Signed: "已签名" } as const)[item.state] : item.state}</span>{item.hash ? <a className="truncate text-[13px] text-rv-muted underline decoration-rv-line underline-offset-2 hover:text-rv-text" href={`https://pudge.explorer.nervos.org/transaction/${item.hash}`} target="_blank" rel="noreferrer">{short(item.hash, 10, 8)}</a> : <span className="text-[13px] text-rv-subtle">—</span>}<p className="m-0 text-[13px] leading-5 text-rv-muted">{zh ? details[item.detail] ?? item.detail : item.detail}</p></div>;
}

function Launch({ p }: { p: ExperienceProps }) {
  const { locale, t } = useLocale();
  const zh = locale === "zh-CN";
  return (
    <Shell p={p}>
      <Title eyebrow={zh ? "CKB PUDGE · 创建市场" : "CKB PUDGE · MARKET CREATION"} title={t("createMarketHeading")} detail={zh ? "创建采用固定 CKB 担保和参与名额的担保债权市场。" : "Create a backed-claim market with fixed CKB backing and participant slots."} />
      <div className="mt-7 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        <section className="max-w-2xl rounded-lg border border-rv-line bg-rv-surface p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="text-[14px] font-medium text-rv-muted">{t("participantSlots")}<input type="number" min="1" max="8" step="1" value={p.fields.slots} onChange={(event) => p.update("slots", event.target.value)} className="mt-2 h-11 w-full rounded-md border border-rv-line bg-rv-canvas px-3 text-[15px] text-rv-text outline-none focus:border-rv-subtle" /></label>
            <label className="text-[14px] font-medium text-rv-muted">{t("maturityBlock")}<input type="number" min="0" step="1" value={p.fields.maturity} onChange={(event) => p.update("maturity", event.target.value)} className="mt-2 h-11 w-full rounded-md border border-rv-line bg-rv-canvas px-3 text-[15px] text-rv-text outline-none focus:border-rv-subtle" /></label>
            <label className="text-[14px] font-medium text-rv-muted sm:col-span-2">{t("creatorAddress")} <span className="font-normal text-rv-subtle">({t("optional")})</span><input value={p.fields.creator} onChange={(event) => p.update("creator", event.target.value)} className="mt-2 h-11 w-full rounded-md border border-rv-line bg-rv-canvas px-3 text-[14px] text-rv-text outline-none focus:border-rv-subtle" placeholder={p.address || "ckt1…"} /></label>
          </div>
          <dl className="mt-6 border-t border-rv-line pt-3"><InfoRow label={zh ? "最低缴款" : "Minimum contribution"} value="0.125 CKB / slot" /><InfoRow label={t("initialBacking")} value={zh ? "缴款金额的 80%" : "80% of contributions"} /><InfoRow label={t("creatorGrossProceeds")} value={zh ? "激活时分配 20%" : "20% at activation"} /><InfoRow label={t("networkFee")} value="0.001 CKB" /></dl>
          <button type="button" disabled={p.busy || p.deployment !== "Configured" || !p.address} onClick={p.onCreate} className="mt-5 h-12 w-full rounded-md bg-rv-accent text-[15px] font-semibold text-[#12231a] hover:bg-[#a6ecc4] disabled:cursor-not-allowed disabled:bg-[#46524b] disabled:text-[#acb5af]">{zh ? "审核市场创建" : t("reviewMarketCreation")}</button>
          {!p.address && <p className="mb-0 mt-3 text-center text-[13px] text-rv-muted">{zh ? "连接并检查钱包后即可创建市场。" : "Connect and check a wallet before creating a market."}</p>}
        </section>
        <aside className="rounded-lg border border-rv-line bg-rv-surface p-4 sm:p-5"><div className="flex items-center gap-2 text-[#e7c97c]"><CircleAlert size={17} /><h2 className="m-0 text-[15px] font-semibold">{zh ? "市场限制" : "Market limits"}</h2></div><ul className="mb-0 mt-4 space-y-3 pl-5 text-[14px] leading-6 text-rv-muted"><li>{zh ? "这是担保债权协议，不会发行可互换代币。" : "This creates a backed-claim agreement, not a fungible token."}</li><li>{zh ? "转让需要买方和卖方共同签名，不保证有买方或即时结算。" : "Assignments require both parties to sign; no buyer or immediate settlement is guaranteed."}</li><li>{zh ? "提交前会重新验证公开部署和市场标识。" : "The public deployment and market identity are revalidated before submission."}</li></ul></aside>
      </div>
    </Shell>
  );
}

function ReviewDialog({ p }: { p: ExperienceProps }) {
  const { locale, t } = useLocale();
  const zh = locale === "zh-CN";
  const review = p.review;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);
  if (!review) return null;
  return (
    <dialog ref={ref} aria-labelledby="review-title" onCancel={(event) => { event.preventDefault(); if (!p.busy) p.onCancel(); }} className="fixed m-auto max-h-[min(90dvh,760px)] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-lg border border-rv-line bg-rv-surface p-0 text-rv-text shadow-2xl backdrop:bg-black/70">
      <div className="flex items-center justify-between gap-4 border-b border-rv-line px-5 py-4"><div><p className="m-0 text-[12px] uppercase text-rv-subtle">{zh ? "CKB Pudge · 交易审核" : "CKB Pudge · transaction review"}</p><h2 id="review-title" className="m-0 mt-1 text-[17px] font-semibold">{review.title}</h2></div><button type="button" onClick={p.onCancel} disabled={p.busy} aria-label={zh ? "关闭交易审核" : "Close transaction review"} className="grid size-9 place-items-center rounded border border-rv-line text-rv-muted hover:bg-rv-input">×</button></div>
      <dl className="px-5 py-3">{review.lines.filter((item) => !/^0x[0-9a-fA-F]{64}$/.test(item.value)).map((item) => <InfoRow key={item.label} label={item.label} value={item.value} />)}<InfoRow label={t("networkFee")} value={`${review.fee} CKB`} /></dl>
      <details className="mx-5 border-t border-rv-line py-3 text-[13px] text-rv-muted"><summary className="cursor-pointer">{zh ? "高级交易详情" : "Advanced transaction details"}</summary><code className="mt-3 block break-all text-[12px]">{review.hash}</code>{review.outputs.map((output, index) => <div key={index} className="mt-3"><strong className="block font-medium text-rv-text">{zh ? `输出 ${index + 1}` : `Output ${index + 1}`} · {output.capacity} CKB</strong><code className="mt-1 block break-all text-[12px]">{output.lock}</code></div>)}</details>
      <p className="mx-5 my-3 text-[13px] leading-5 text-rv-muted">{zh ? "请核对确切的交易详情。打开钱包后，钱包会显示待签名的交易请求，然后 Roveko 才会广播交易。" : "Review the exact transaction details. The wallet will show the signed transaction request before Roveko broadcasts it."}</p>
      <div className="flex justify-end gap-2 border-t border-rv-line px-5 py-4"><button type="button" onClick={p.onCancel} disabled={p.busy} className="h-10 rounded border border-rv-line px-4 text-[14px] hover:bg-rv-input">{t("cancel")}</button><button type="button" onClick={p.onConfirm} disabled={p.busy} className="h-10 rounded bg-rv-accent px-4 text-[14px] font-semibold text-[#12231a] disabled:opacity-50">{p.busy ? (zh ? "正在检查…" : "Checking…") : review.button}</button></div>
    </dialog>
  );
}

export default function PudgeExperience({ ...p }: ExperienceProps) {
  const page = p.route.view;
  return <>{page === "Markets" ? <Markets p={p} /> : page === "Market" ? <MarketWorkspace p={p} /> : page === "My Positions" ? <Portfolio p={p} /> : page === "Activity" ? <ActivityPage p={p} /> : <Launch p={p} />}<ReviewDialog p={p} /></>;
}

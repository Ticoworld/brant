import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useLocale } from "../i18n-provider";
import { createLocalRpc, recoverLocalOwnerJourney, type LocalMarketSnapshot } from "../../lib/v2-engine/local-workspace.ts";

const DeploymentTools = dynamic(() => import("./deploy/review"));

export function LaunchSection({ localMode = false }: { localMode?: boolean }) {
  const { locale } = useLocale();
  const copy = (en: string, zh: string) => locale === "zh-CN" ? zh : en;

  if (localMode) return (
    <section className="flex min-h-[calc(100vh-52px)] w-full flex-1 flex-col bg-[#0b0b0c] text-[#f1f1f2]">
      <header className="flex h-11 shrink-0 items-center border-b border-[#252527] px-4 sm:px-5">
        <h1 className="m-0 text-[14px] font-semibold">{copy("Create a market", "创建市场")}</h1>
      </header>
      <div className="flex flex-1 flex-col px-4 pt-8 sm:px-5 sm:pt-10">
        <p className="mb-0 text-[13px] text-[#a0a0a5]">{copy("Private CKB node", "本地 CKB 节点")}</p>
        <Link href="/v2/deploy" className="mt-4 w-fit text-[12px] font-medium text-[#63d994] no-underline hover:text-[#8be3b0]">{copy("Open local launch", "打开本地创建流程")} <span aria-hidden="true">↗</span></Link>
      </div>
    </section>
  );

  return (
    <section className="flex min-h-[calc(100vh-52px)] w-full flex-1 flex-col bg-[#0b0b0c] text-[#f1f1f2]">
      <header className="flex h-11 shrink-0 items-center border-b border-[#252527] px-4 sm:px-5">
        <h1 className="m-0 text-[14px] font-semibold">{copy("Create a market", "创建市场")}</h1>
      </header>
      <div className="flex flex-1 flex-col px-4 pt-8 sm:px-5 sm:pt-10">
        <p className="mb-0 text-[13px] text-[#a0a0a5]">{copy("Market creation is not available yet.", "市场创建暂不可用。")}</p>
        <Link href="/" className="mt-4 w-fit text-[12px] font-medium text-[#63d994] no-underline hover:text-[#8be3b0]">{copy("Discover markets", "发现市场")} <span aria-hidden="true">↗</span></Link>
        <details className="mt-8 border-t border-[#252527] py-3">
          <summary className="w-fit cursor-pointer text-[11px] text-[#85858a]">{copy("Testnet deployment tools", "测试网部署工具")}</summary>
          <DeploymentTools embedded />
        </details>
      </div>
    </section>
  );
}

export function PortfolioSection({ demo = false, localMode = false, ownerHash = "" }: { demo?: boolean; localMode?: boolean; ownerHash?: string }) {
  const { t, locale } = useLocale();
  if (localMode) return <LocalPortfolioSection ownerHash={ownerHash} />;
  const copy = (en: string, zh: string) => locale === "zh-CN" ? zh : en;
  const demoRows = [
    { symbol: "CKB", name: "Nervos Network", balance: "1,240.00", value: "124.00 CKB" },
    { symbol: "KITE", name: "Kite", balance: "18,250.00", value: "133.20 CKB" },
    { symbol: "MOSS", name: "Moss", balance: "4,800.00", value: "8.64 CKB" },
    { symbol: "WAVE", name: "Wave", balance: "2,100.00", value: "11.76 CKB" },
    { symbol: "LUMA", name: "Luma", balance: "6,400.00", value: "26.88 CKB" },
    { symbol: "PINE", name: "Pine", balance: "2,850.00", value: "9.41 CKB" },
    { symbol: "MICA", name: "Mica", balance: "3,200.00", value: "3.84 CKB" },
    { symbol: "NOVA", name: "Nova", balance: "1,900.00", value: "11.59 CKB" },
  ];
  const recentRows = [
    { type: "Buy", market: "KITE", amount: "+250 CKB" },
    { type: "Sell", market: "MOSS", amount: "−1,200 MOSS" },
    { type: "Launch", market: "WAVE", amount: "2,100 WAVE" },
  ];
  return (
    <section className="flex min-h-[calc(100vh-52px)] w-full flex-1 flex-col bg-[#0b0b0c] text-[#f1f1f2]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#252527] px-4 sm:px-5">
        <h1 className="m-0 text-[14px] font-semibold">{t("portfolio")}</h1>
        <Link href="/v2/withdraw" className="text-[12px] font-medium text-[#62d792] no-underline hover:text-[#8be3b0]">{t("withdraw")} <span aria-hidden="true">↗</span></Link>
      </header>
      <div className="grid border-b border-[#252527] md:grid-cols-[minmax(190px,0.9fr)_minmax(320px,2fr)_minmax(220px,1fr)]">
        <section className="px-4 py-5 sm:px-5 md:min-h-[190px]">
          <h2 className="m-0 text-[11px] font-medium text-[#85858a]">{copy("Total value", "总价值")}</h2>
          <p className="mb-0 mt-3 text-[26px] font-semibold leading-none tabular-nums text-[#ededee]">— <span className="text-[12px] font-normal text-[#85858a]">CKB</span></p>
          <p className="mb-0 mt-3 text-[11px] leading-5 text-[#85858a]">{copy("Available after wallet and market verification", "钱包和市场验证后可查看")}</p>
        </section>
        <section className="border-y border-[#252527] px-4 py-4 sm:px-5 md:border-x md:border-y-0">
          <div className="flex items-center justify-between gap-4">
            <h2 className="m-0 text-[12px] font-semibold text-[#dedee0]">{copy("Performance", "表现")}</h2>
            <div aria-label={copy("Chart range", "图表范围")} className="flex gap-3 text-[10px] font-medium text-[#626267]">
              <span>1D</span><span>7D</span><span>30D</span><span>ALL</span>
            </div>
          </div>
          <div className="relative mt-3 grid h-[116px] place-items-center overflow-hidden border-b border-l border-[#29292c] bg-[linear-gradient(to_right,#202023_1px,transparent_1px),linear-gradient(to_bottom,#202023_1px,transparent_1px)] bg-[size:25%_25%] text-center">
            <div className="relative px-3">
              <p className="m-0 text-[11px] font-medium text-[#c2c2c5]">{copy("No verified performance history", "暂无已验证的表现记录")}</p>
              <p className="mb-0 mt-1 text-[10px] text-[#737378]">{copy("A chart appears after confirmed activity", "确认交易后将显示图表")}</p>
            </div>
          </div>
        </section>
        <section className="px-4 py-5 sm:px-5">
          <h2 className="m-0 text-[12px] font-semibold text-[#dedee0]">{copy("Account", "账户")}</h2>
          <dl className="mb-0 mt-4 space-y-3 text-[11px]">
            <div className="flex justify-between gap-4"><dt className="text-[#85858a]">{copy("Holdings", "持仓")}</dt><dd className="m-0 tabular-nums text-[#c8c8cb]">—</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#85858a]">{copy("Realized P&L", "已实现盈亏")}</dt><dd className="m-0 tabular-nums text-[#c8c8cb]">—</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#85858a]">{copy("Activity", "活动")}</dt><dd className="m-0 tabular-nums text-[#c8c8cb]">—</dd></div>
          </dl>
        </section>
      </div>
      <div className="grid flex-1 md:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <section className="flex min-w-0 flex-col border-b border-[#252527] md:border-b-0 md:border-r md:border-[#252527]">
          <div className="flex h-11 items-center justify-between gap-4 border-b border-[#222224] px-4 sm:px-5">
            <h2 className="m-0 text-[12px] font-semibold text-[#dedee0]">{t("holdings")}</h2>
            <span className="text-[10px] text-[#737378]">{demo ? copy("Preview data", "预览数据") : copy("Verified only", "仅显示已验证数据")}</span>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className={`h-full w-full table-fixed border-collapse text-left text-[12px] ${demo ? "min-w-[540px]" : "min-w-0"}`}>
              <caption className="sr-only">{t("holdings")}</caption>
              <thead className="h-9 border-b border-[#222224] text-[10px] font-medium text-[#85858a]">
                <tr>
                  <th scope="col" className="px-4 font-medium sm:px-5">{t("asset")}</th>
                  <th scope="col" className="px-4 text-right font-medium sm:px-5">{t("balance")}</th>
                  <th scope="col" className="px-4 text-right font-medium sm:px-5">{t("marketValue")}</th>
                  <th scope="col" className="px-4 text-right font-medium sm:px-5">{t("market")}</th>
                </tr>
              </thead>
              <tbody className="text-[12px]">
                {demo ? demoRows.map((row) => <tr key={row.symbol} className="h-[54px] border-b border-[#1e1e20]">
                  <th scope="row" className="px-4 text-left font-medium sm:px-5"><span className="text-[#eeeef0]">{row.symbol}</span><span className="ml-2 text-[#85858a]">{row.name}</span><span className="ml-2 text-[10px] text-[#b99a58]">Demo</span></th>
                  <td className="px-4 text-right tabular-nums text-[#dddde0] sm:px-5">{row.balance}</td>
                  <td className="px-4 text-right tabular-nums text-[#dddde0] sm:px-5">{row.value}</td>
                  <td className="px-4 text-right text-[10px] text-[#b99a58] sm:px-5">Demo</td>
                </tr>) : <tr>
                  <td colSpan={4} className="ro-empty-cell h-full px-5 text-center">
                    <p className="m-0 text-[12px] font-medium text-[#c4c4c7]">{t("noVerifiedHoldings")}</p>
                    <p className="mb-0 mt-1 text-[11px] text-[#77777d]">{t("holdingsVerificationHelp")}</p>
                    <Link href="/" className="mt-3 inline-block text-[11px] font-medium text-[#63d994] no-underline hover:text-[#8be3b0]">{t("discover")} <span aria-hidden="true">↗</span></Link>
                  </td>
                </tr>}
              </tbody>
            </table>
          </div>
        </section>
        <section className="flex min-w-0 flex-col">
          <div className="flex h-11 items-center justify-between gap-4 border-b border-[#222224] px-4 sm:px-5">
            <h2 className="m-0 text-[12px] font-semibold text-[#dedee0]">{copy("Recent activity", "最近活动")}</h2>
            <Link href="/activity" className="text-[11px] font-medium text-[#a9a9ae] no-underline hover:text-white">{copy("View all", "查看全部")} <span aria-hidden="true">↗</span></Link>
          </div>
          {demo ? <div>{recentRows.map((row, index) => <div key={`${row.market}-${index}`} className="flex min-h-[54px] items-center justify-between gap-4 border-b border-[#1e1e20] px-4 text-[11px] sm:px-5"><div className="min-w-0"><span className="font-medium text-[#dedee0]">{row.type}</span><span className="ml-2 text-[#85858a]">{row.market}</span><span className="ml-2 text-[10px] text-[#b99a58]">Demo</span></div><span className="shrink-0 tabular-nums text-[#c9c9cc]">{row.amount}</span></div>)}</div> : <div className="grid flex-1 place-items-center px-5 py-8 text-center"><p className="m-0 text-[11px] leading-5 text-[#85858a]">{t("activityVerificationHelp")}</p></div>}
        </section>
      </div>
    </section>
  );
}

export function ActivitySection({ demo = false, localMode = false, ownerHash = "" }: { demo?: boolean; localMode?: boolean; ownerHash?: string }) {
  const { t, locale } = useLocale();
  const copy = (en: string, zh: string) => locale === "zh-CN" ? zh : en;
  const [filter, setFilter] = useState("all");
  if (localMode) return <LocalActivitySection ownerHash={ownerHash} />;
  const demoRows = [
    { date: locale === "zh-CN" ? "11月15日 01:20" : "Nov 15, 01:20", type: locale === "zh-CN" ? "买入" : "Buy", market: "KITE", amount: "+250 CKB" },
    { date: locale === "zh-CN" ? "11月14日 22:46" : "Nov 14, 22:46", type: locale === "zh-CN" ? "卖出" : "Sell", market: "MOSS", amount: "−1,200 MOSS" },
    { date: locale === "zh-CN" ? "11月14日 19:08" : "Nov 14, 19:08", type: locale === "zh-CN" ? "创建" : "Launch", market: "WAVE", amount: "2,100 WAVE" },
    { date: locale === "zh-CN" ? "11月13日 16:32" : "Nov 13, 16:32", type: locale === "zh-CN" ? "买入" : "Buy", market: "LUMA", amount: "+90 CKB" },
    { date: locale === "zh-CN" ? "11月13日 10:05" : "Nov 13, 10:05", type: locale === "zh-CN" ? "卖出" : "Sell", market: "PINE", amount: "−640 PINE" },
    { date: locale === "zh-CN" ? "11月12日 21:18" : "Nov 12, 21:18", type: locale === "zh-CN" ? "买入" : "Buy", market: "MICA", amount: "+120 CKB" },
    { date: locale === "zh-CN" ? "11月12日 14:37" : "Nov 12, 14:37", type: locale === "zh-CN" ? "卖出" : "Sell", market: "KITE", amount: "−2,400 KITE" },
    { date: locale === "zh-CN" ? "11月11日 09:52" : "Nov 11, 09:52", type: locale === "zh-CN" ? "买入" : "Buy", market: "NOVA", amount: "+175 CKB" },
    { date: locale === "zh-CN" ? "11月10日 18:24" : "Nov 10, 18:24", type: locale === "zh-CN" ? "卖出" : "Sell", market: "LUMA", amount: "−900 LUMA" },
    { date: locale === "zh-CN" ? "11月10日 11:46" : "Nov 10, 11:46", type: locale === "zh-CN" ? "买入" : "Buy", market: "WAVE", amount: "+80 CKB" },
  ];
  const visibleRows = filter === "all" ? demoRows : demoRows.filter((row) => row.type === filter);
  const filters = [
    ["all", copy("All", "全部")],
    [locale === "zh-CN" ? "买入" : "Buy", copy("Buys", "买入")],
    [locale === "zh-CN" ? "卖出" : "Sell", copy("Sells", "卖出")],
    [locale === "zh-CN" ? "创建" : "Launch", copy("Launches", "创建")],
  ];
  return (
    <section className="flex min-h-[calc(100vh-52px)] w-full flex-1 flex-col bg-[#0b0b0c] text-[#f1f1f2]">
      <header className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#252527] px-4 sm:px-5">
        <h1 className="m-0 text-[14px] font-semibold">{t("activity")}</h1>
        <span className="text-[10px] text-[#77777d]">{copy("Verified transaction history", "已验证的交易记录")}</span>
      </header>
      <nav aria-label={copy("Activity filters", "活动筛选")} className="flex h-10 shrink-0 items-stretch gap-5 border-b border-[#222224] px-4 sm:px-5">
        {filters.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-0 border-0 border-b-2 bg-transparent p-0 text-[11px] transition-colors ${filter === value ? "border-[#63d994] font-medium text-[#63d994]" : "border-transparent text-[#85858a] hover:text-[#d8d8da]"}`}>{label}</button>)}
      </nav>
      <div className="activity-table-scroll flex-1 overflow-x-auto px-4 sm:px-5">
        <table className="h-full w-full table-fixed border-collapse text-left text-[12px]">
          <caption className="sr-only">{t("activity")}</caption>
          <thead className="h-10 border-b border-[#222224] text-[10px] font-medium text-[#85858a]">
            <tr>
              <th scope="col" className="w-[34%] px-3 font-medium sm:w-auto sm:px-4">{t("date")}</th>
              <th scope="col" className="w-[28%] px-3 font-medium sm:w-auto sm:px-4">{t("activityType")}</th>
              <th scope="col" className="hidden px-3 font-medium sm:table-cell sm:px-4">{t("market")}</th>
              <th scope="col" className="w-[38%] px-3 text-right font-medium sm:w-auto sm:px-4">{t("amount")}</th>
              <th scope="col" className="hidden px-3 text-right font-medium sm:table-cell sm:px-4">{t("transaction")}</th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {demo ? visibleRows.map((row, index) => <tr key={`${row.market}-${index}`} className="h-[54px] border-b border-[#1e1e20]">
              <td className="whitespace-nowrap px-3 tabular-nums text-[#a0a0a5] sm:px-4">{row.date}</td>
              <td className="px-3 text-[#dddde0] sm:px-4">{row.type}<span className="ml-2 text-[10px] text-[#b99a58]">Demo</span></td>
              <td className="hidden px-3 text-[#eeeef0] sm:table-cell sm:px-4">{row.market}</td>
              <td className="whitespace-nowrap px-3 text-right tabular-nums text-[#dddde0] sm:px-4">{row.amount}</td>
              <td className="hidden px-3 text-right text-[10px] text-[#b99a58] sm:table-cell sm:px-4">{copy("Preview", "预览")}</td>
            </tr>) : <tr>
              <td colSpan={5} className="ro-empty-cell activity-empty-cell px-4 text-center">
                <p className="m-0 text-[12px] font-medium text-[#c4c4c7]">{filter === "all" ? t("noVerifiedActivity") : copy("No verified activity in this filter", "此筛选暂无已验证活动")}</p>
                <p className="mb-0 mt-1 text-[11px] text-[#77777d]">{t("activityVerificationHelp")}</p>
                <Link href="/" className="mt-3 inline-block text-[11px] font-medium text-[#63d994] no-underline hover:text-[#8be3b0]">{t("discover")} <span aria-hidden="true">↗</span></Link>
              </td>
            </tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function useLocalJourney(ownerHash: string) {
  const [snapshot, setSnapshot] = useState<LocalMarketSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!ownerHash) {
      setSnapshot(null);
      setError("");
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    recoverLocalOwnerJourney(createLocalRpc(), ownerHash).then((value) => {
      if (!active) return;
      setSnapshot(value);
      setError("");
      setLoading(false);
    }).catch((cause: unknown) => {
      if (!active) return;
      setSnapshot(null);
      setError(cause instanceof Error ? cause.message : "Private-chain recovery failed");
      setLoading(false);
    });
    return () => { active = false; };
  }, [ownerHash]);

  return { snapshot, error, loading };
}

function LocalPortfolioSection({ ownerHash }: { ownerHash: string }) {
  const { t, locale } = useLocale();
  const copy = (en: string, zh: string) => locale === "zh-CN" ? zh : en;
  const { snapshot, error, loading } = useLocalJourney(ownerHash);
  const balance = snapshot?.balance;
  return (
    <section className="flex min-h-[calc(100vh-52px)] w-full flex-1 flex-col bg-[#0b0b0c] text-[#f1f1f2]">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#252527] px-4 sm:px-5">
        <h1 className="m-0 text-[14px] font-semibold">{t("portfolio")}</h1>
        <span className="text-[10px] text-[#72dfb0]">{copy("Private chain · verified", "私有链 · 已验证")}</span>
      </header>
      <div className="grid border-b border-[#252527] md:grid-cols-[minmax(190px,0.9fr)_minmax(320px,2fr)_minmax(220px,1fr)]">
        <section className="px-4 py-5 sm:px-5 md:min-h-[150px]">
          <h2 className="m-0 text-[11px] font-medium text-[#85858a]">{t("holdings")}</h2>
          <p className="mb-0 mt-3 text-[26px] font-semibold leading-none tabular-nums text-[#ededee]">{balance == null ? "—" : balance.toString()} <span className="text-[12px] font-normal text-[#85858a]">{copy("units", "份")}</span></p>
          <p className="mb-0 mt-3 text-[11px] leading-5 text-[#85858a]">{loading ? copy("Reconstructing committed market history", "正在重建已提交的市场历史") : ownerHash ? copy("Recovered from committed private-chain transitions", "已从私有链提交状态恢复") : copy("Connect a wallet to verify holdings", "连接钱包以验证持仓")}</p>
        </section>
        <section className="border-y border-[#252527] px-4 py-4 sm:px-5 md:border-x md:border-y-0">
          <h2 className="m-0 text-[12px] font-semibold text-[#dedee0]">{copy("Market", "市场")}</h2>
          {snapshot ? <dl className="mb-0 mt-4 space-y-3 text-[11px]">
            <div className="flex justify-between gap-4"><dt className="text-[#85858a]">{copy("Market identity", "市场标识")}</dt><dd className="m-0 break-all text-right font-mono text-[#c8c8cb]">{snapshot.id}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#85858a]">{copy("Remaining inventory", "剩余库存")}</dt><dd className="m-0 tabular-nums text-[#c8c8cb]">{snapshot.curve.inventory.toString()} {copy("units", "份")}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-[#85858a]">{copy("Verified activity", "已验证活动")}</dt><dd className="m-0 tabular-nums text-[#c8c8cb]">{snapshot.activity.length}</dd></div>
          </dl> : <p className="mb-0 mt-4 text-[11px] text-[#85858a]">{error || (loading ? copy("Loading verified market", "正在加载已验证市场") : copy("No verified local market", "没有已验证的本地市场"))}</p>}
        </section>
        <section className="px-4 py-5 sm:px-5">
          <h2 className="m-0 text-[12px] font-semibold text-[#dedee0]">{copy("Value", "价值")}</h2>
          <p className="mb-0 mt-3 text-[13px] tabular-nums text-[#c8c8cb]">— CKB</p>
          <p className="mb-0 mt-2 text-[10px] leading-5 text-[#85858a]">{copy("No portfolio valuation is inferred.", "不推算投资组合估值。")}</p>
        </section>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-11 items-center justify-between gap-4 border-b border-[#222224] px-4 sm:px-5">
          <h2 className="m-0 text-[12px] font-semibold text-[#dedee0]">{copy("Verified holdings", "已验证持仓")}</h2>
          <Link href="/v2" className="text-[11px] font-medium text-[#72dfb0] no-underline">{copy("Trade", "交易")} <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left text-[12px]">
            <caption className="sr-only">{copy("Verified local holdings", "已验证的本地持仓")}</caption>
            <thead className="h-9 border-b border-[#222224] text-[10px] font-medium text-[#85858a]"><tr><th className="px-4 font-medium">{copy("Market", "市场")}</th><th className="px-4 text-right font-medium">{copy("Balance", "余额")}</th><th className="px-4 text-right font-medium">{copy("Market value", "市场价值")}</th></tr></thead>
            <tbody>{snapshot ? <tr className="h-[54px] border-b border-[#1e1e20]"><th scope="row" className="px-4 text-left font-medium text-[#eeeef0]">{copy("Private CKB market", "私有 CKB 市场")}</th><td className="px-4 text-right tabular-nums text-[#dddde0]">{balance?.toString()} {copy("units", "份")}</td><td className="px-4 text-right text-[#85858a]">{copy("Unpriced", "未定价")}</td></tr> : <tr><td colSpan={3} className="px-4 py-8 text-center text-[11px] text-[#85858a]">{error || (loading ? copy("Reconstructing state", "正在重建状态") : copy("Connect a wallet to load verified holdings", "连接钱包以加载已验证持仓"))}</td></tr>}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function formatLocalCkb(value: bigint) {
  const whole = value / 100_000_000n;
  const fraction = (value % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function LocalActivitySection({ ownerHash }: { ownerHash: string }) {
  const { t, locale } = useLocale();
  const [filter, setFilter] = useState("all");
  const { snapshot, error, loading } = useLocalJourney(ownerHash);
  const copy = (en: string, zh: string) => locale === "zh-CN" ? zh : en;
  const filters = [["all", copy("All", "全部")], ["buy", copy("Buys", "买入")], ["sell", copy("Sells", "卖出")], ["launch", copy("Launches", "创建")]];
  const rows = snapshot?.activity.filter((event) => filter === "all" || event.kind === filter) ?? [];
  return (
    <section className="flex min-h-[calc(100vh-52px)] w-full flex-1 flex-col bg-[#0b0b0c] text-[#f1f1f2]">
      <header className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#252527] px-4 sm:px-5">
        <h1 className="m-0 text-[14px] font-semibold">{t("activity")}</h1>
        <span className="text-[10px] text-[#72dfb0]">{copy("Committed private-chain history", "私有链已提交历史")}</span>
      </header>
      <nav aria-label={copy("Activity filters", "活动筛选")} className="flex h-10 shrink-0 items-stretch gap-5 border-b border-[#222224] px-4 sm:px-5">
        {filters.map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-0 border-0 border-b-2 bg-transparent p-0 text-[11px] transition-colors ${filter === value ? "border-[#63d994] font-medium text-[#63d994]" : "border-transparent text-[#85858a] hover:text-[#d8d8da]"}`}>{label}</button>)}
      </nav>
      <div className="activity-table-scroll flex-1 overflow-x-auto px-4 sm:px-5">
        <table className="h-full w-full table-fixed border-collapse text-left text-[12px]">
          <caption className="sr-only">Committed private-chain activity</caption>
          <thead className="h-10 border-b border-[#222224] text-[10px] font-medium text-[#85858a]"><tr>
            <th scope="col" className="w-[18%] px-3 font-medium sm:px-4">{copy("Block", "区块")}</th><th scope="col" className="w-[20%] px-3 font-medium sm:px-4">{t("activityType")}</th><th scope="col" className="hidden px-3 font-medium sm:table-cell sm:px-4">{copy("Market", "市场")}</th><th scope="col" className="w-[34%] px-3 text-right font-medium sm:w-auto sm:px-4">{t("amount")}</th><th scope="col" className="hidden px-3 text-right font-medium sm:table-cell sm:px-4">{t("transaction")}</th>
          </tr></thead>
          <tbody>{rows.map((event) => {
            const type = event.kind === "launch" ? copy("Launch", "创建") : event.kind === "buy" ? copy("Buy", "买入") : copy("Sell", "卖出");
            const amount = event.kind === "launch" ? copy("Market initialized", "市场已初始化") : `${event.kind === "buy" ? "+" : "−"}${event.quantity} ${copy("units", "份")} · ${formatLocalCkb(event.amount || 0n)} CKB`;
            return <tr key={event.transactionHash} className="h-[54px] border-b border-[#1e1e20]">
              <td className="whitespace-nowrap px-3 tabular-nums text-[#a0a0a5] sm:px-4">{event.block.toString()}</td>
              <td className="px-3 text-[#dddde0] sm:px-4">{type}</td>
              <td className="hidden px-3 text-[#eeeef0] sm:table-cell sm:px-4">{snapshot?.id.slice(0, 14)}…</td>
              <td className="whitespace-nowrap px-3 text-right tabular-nums text-[#dddde0] sm:px-4">{amount}</td>
              <td className="hidden px-3 text-right font-mono text-[10px] text-[#a0a0a5] sm:table-cell sm:px-4" title={event.transactionHash}>{event.transactionHash.slice(0, 12)}…</td>
            </tr>;
          })}</tbody>
        </table>
        {!rows.length && <div className="grid min-h-32 place-items-center px-5 py-8 text-center"><p className="m-0 text-[11px] leading-5 text-[#85858a]">{error || (loading ? copy("Reconstructing committed history", "正在重建已提交历史") : ownerHash ? copy("No verified activity in this filter", "此筛选条件下没有已验证活动") : copy("Connect a wallet to load verified history", "连接钱包以加载已验证历史"))}</p></div>}
      </div>
    </section>
  );
}

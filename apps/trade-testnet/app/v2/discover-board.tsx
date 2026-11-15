"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale } from "../i18n-provider";
import { createLocalRpc, discoverLocalMarket } from "../../lib/v2-engine/local-workspace.ts";

type Lane = "new" | "curve" | "migrated";
type Market = { symbol: string; name: string; id: string; buy: string; sell: string; inventory: string; lane: Lane; tone: string; verified?: boolean };
type SortKey = "listed" | "price" | "inventory";

const fixtureMarkets: Market[] = [
  { symbol: "LUMA", name: "Luma", id: "0x8b2f...a901", buy: "0.0042", sell: "0.0039", inventory: "12,400", lane: "new", tone: "#e7c26d" },
  { symbol: "KITE", name: "Kite", id: "0xb936...40cd", buy: "0.0071", sell: "0.0068", inventory: "21,300", lane: "new", tone: "#75b7e7" },
  { symbol: "TIDE", name: "Tide", id: "0xd259...710a", buy: "0.0009", sell: "0.0008", inventory: "5,680", lane: "new", tone: "#65cfb0" },
  { symbol: "MOSS", name: "Moss", id: "0x61d4...a72e", buy: "0.0018", sell: "0.0016", inventory: "8,950", lane: "curve", tone: "#9ecb72" },
  { symbol: "FERN", name: "Fern", id: "0x5c12...25bf", buy: "0.0027", sell: "0.0025", inventory: "14,120", lane: "curve", tone: "#7dcf93" },
  { symbol: "PINE", name: "Pine", id: "0x2ae8...19b4", buy: "0.0033", sell: "0.0031", inventory: "9,740", lane: "curve", tone: "#91b67a" },
  { symbol: "WAVE", name: "Wave", id: "0x7d01...6fa3", buy: "0.0056", sell: "0.0052", inventory: "17,860", lane: "migrated", tone: "#6fc9d5" },
  { symbol: "MICA", name: "Mica", id: "0x943c...81de", buy: "0.0012", sell: "0.0011", inventory: "6,420", lane: "migrated", tone: "#be91db" },
  { symbol: "ORBIT", name: "Orbit", id: "0x7a41...25d8", buy: "0.0026", sell: "0.0024", inventory: "11,840", lane: "new", tone: "#d7a967" },
  { symbol: "NEON", name: "Neon", id: "0xa86c...190e", buy: "0.0013", sell: "0.0012", inventory: "8,310", lane: "new", tone: "#dc78a7" },
  { symbol: "FLINT", name: "Flint", id: "0x431e...9bc2", buy: "0.0038", sell: "0.0035", inventory: "16,200", lane: "new", tone: "#d68563" },
  { symbol: "LOOP", name: "Loop", id: "0xc218...78ab", buy: "0.0007", sell: "0.0006", inventory: "4,950", lane: "new", tone: "#b59bd8" },
  { symbol: "NOVA", name: "Nova", id: "0x8d52...c310", buy: "0.0061", sell: "0.0058", inventory: "23,700", lane: "new", tone: "#d2c36c" },
  { symbol: "EMBER", name: "Ember", id: "0xe276...4af1", buy: "0.0021", sell: "0.0019", inventory: "10,620", lane: "new", tone: "#e07d63" },
  { symbol: "SAGE", name: "Sage", id: "0x2e65...38a4", buy: "0.0015", sell: "0.0014", inventory: "7,320", lane: "curve", tone: "#8bbd7d" },
  { symbol: "CLOVE", name: "Clove", id: "0x415b...a90d", buy: "0.0044", sell: "0.0041", inventory: "18,450", lane: "curve", tone: "#bdca7a" },
  { symbol: "ROOT", name: "Root", id: "0x6c79...d14e", buy: "0.0008", sell: "0.0007", inventory: "5,260", lane: "curve", tone: "#78b794" },
  { symbol: "BLOOM", name: "Bloom", id: "0xfa32...e611", buy: "0.0031", sell: "0.0029", inventory: "13,980", lane: "curve", tone: "#d493bd" },
  { symbol: "HAZE", name: "Haze", id: "0x884a...11c7", buy: "0.0022", sell: "0.0020", inventory: "9,410", lane: "curve", tone: "#8998c9" },
  { symbol: "GROVE", name: "Grove", id: "0x317d...9e02", buy: "0.0052", sell: "0.0049", inventory: "20,160", lane: "curve", tone: "#89b46d" },
  { symbol: "RILL", name: "Rill", id: "0x0a52...71c8", buy: "0.0017", sell: "0.0016", inventory: "8,220", lane: "migrated", tone: "#69b5c8" },
  { symbol: "LILT", name: "Lilt", id: "0x44e3...aa10", buy: "0.0036", sell: "0.0033", inventory: "15,340", lane: "migrated", tone: "#cb91c5" },
  { symbol: "COVE", name: "Cove", id: "0xb602...43a9", buy: "0.0024", sell: "0.0022", inventory: "10,780", lane: "migrated", tone: "#78c7b3" },
  { symbol: "WREN", name: "Wren", id: "0xd172...60e4", buy: "0.0006", sell: "0.0005", inventory: "3,860", lane: "migrated", tone: "#d1a462" },
  { symbol: "FLUX", name: "Flux", id: "0x12bd...5803", buy: "0.0049", sell: "0.0046", inventory: "19,820", lane: "migrated", tone: "#8c9bd1" },
  { symbol: "MINT", name: "Mint", id: "0x8a12...4c70", buy: "0.0011", sell: "0.0010", inventory: "6,050", lane: "migrated", tone: "#78c992" },
  { symbol: "ASH", name: "Ash", id: "0xe05d...7312", buy: "0.0029", sell: "0.0027", inventory: "12,610", lane: "migrated", tone: "#929398" },
];

const laneKeys: Lane[] = ["new", "curve", "migrated"];

function formatCkb(value: bigint) {
  const whole = value / 100_000_000n;
  const fraction = (value % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export default function DiscoverBoard({ localMode = false }: { localMode?: boolean }) {
  const { t, locale } = useLocale();
  const copy = (en: string, zh: string) => locale === "zh-CN" ? zh : en;
  const [demo, setDemo] = useState(false);
  const [query, setQuery] = useState("");
  const [activeLane, setActiveLane] = useState<"all" | Lane>("all");
  const [sort, setSort] = useState<SortKey>("listed");
  const [localMarket, setLocalMarket] = useState<Market | null>(null);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDemo(process.env.NODE_ENV !== "production" && (process.env.NEXT_PUBLIC_UI_DEMO === "1" || params.get("uiDemo") === "1"));
    setQuery(params.get("q") ?? "");
  }, []);

  useEffect(() => {
    if (!localMode) return;
    let active = true;
    discoverLocalMarket(createLocalRpc()).then(({ snapshot }) => {
      if (!active) return;
      setLocalMarket({
        symbol: "LOCAL",
        name: copy("Private CKB market", "私有 CKB 市场"),
        id: snapshot.id,
        buy: formatCkb(snapshot.buyOne),
        sell: formatCkb(snapshot.sellOne),
        inventory: snapshot.curve.inventory.toString(),
        lane: "new",
        tone: "#72dfb0",
        verified: true,
      });
      setLocalError("");
    }).catch((error: unknown) => {
      if (!active) return;
      setLocalMarket(null);
      setLocalError(error instanceof Error ? error.message : "Private market unavailable");
    });
    return () => { active = false; };
  }, [localMode, locale]);

  const markets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = localMode ? localMarket ? [localMarket] : [] : demo ? fixtureMarkets : [];
    const filtered = source.filter((market) => `${market.symbol} ${market.name} ${market.id}`.toLowerCase().includes(normalized));
    if (sort === "price") return filtered.sort((a, b) => Number(b.buy) - Number(a.buy));
    if (sort === "inventory") return filtered.sort((a, b) => Number(b.inventory.replaceAll(",", "")) - Number(a.inventory.replaceAll(",", "")));
    return filtered;
  }, [query, sort, demo, localMode, localMarket]);

  const visibleLanes = laneKeys.filter((lane) => activeLane === "all" || activeLane === lane);
  const laneGrid = activeLane === "all" ? "md:grid-cols-3" : "md:grid-cols-1";

  return (
    <section aria-labelledby="discover-heading" className="flex min-h-[calc(100vh-52px)] w-full flex-1 flex-col bg-[#0b0b0c] text-[#f1f1f2]">
      <h1 id="discover-heading" className="sr-only">{t("discover")}</h1>
      <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-1 border-b border-[#252527] px-4 sm:px-5">
        <div className="flex h-12 min-w-0 items-center gap-5">
          <h2 className="m-0 shrink-0 text-[14px] font-semibold text-[#f0f0f1]">{t("markets")}</h2>
          <nav aria-label={t("marketViews")} className="flex h-full items-stretch gap-4 text-[12px]">
            {(["all", ...laneKeys] as const).map((lane) => (
              <button key={lane} type="button" aria-pressed={activeLane === lane} onClick={() => setActiveLane(activeLane === lane && lane !== "all" ? "all" : lane)} className={`flex min-h-0 items-center border-0 border-b-2 bg-transparent p-0 text-[12px] transition-colors ${activeLane === lane ? "border-[#63d994] font-medium text-[#63d994]" : "border-transparent text-[#858589] hover:text-[#d8d8da]"}`}>
                {t(lane)}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex h-12 items-center gap-4 text-[10px] text-[#85858a]">
          {demo && !localMode && <span className="text-[#b99a58]">{copy("Preview data", "预览数据")}</span>}
          <label className={`flex items-center gap-2 ${!demo || localMode ? "text-[#55555a]" : ""}`}>
            <span>{copy("Sort", "排序")}</span>
            <select aria-label={copy("Sort markets", "排序市场")} disabled={!demo || localMode} value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="min-h-8 border-0 bg-transparent p-0 pr-1 text-[11px] text-[#d9d9dc] outline-none focus-visible:ring-1 focus-visible:ring-[#77777d] disabled:cursor-not-allowed disabled:text-[#55555a]">
              <option value="listed">{copy("Listed", "最新")}</option>
              <option value="price">{copy("Buy price", "买入价格")}</option>
              <option value="inventory">{copy("Inventory", "库存")}</option>
            </select>
          </label>
          {!demo && <Link href="/launch" className="text-[11px] font-medium text-[#63d994] no-underline hover:text-[#8be3b0]">{copy("Launch market", "创建市场")} <span aria-hidden="true">↗</span></Link>}
        </div>
      </div>

      <div className={`grid min-h-0 flex-1 grid-cols-1 overflow-x-auto ${laneGrid}`}>
        {visibleLanes.map((lane, index) => {
          const rows = markets.filter((market) => market.lane === lane);
          return (
            <section key={lane} aria-label={t(lane)} className={`flex min-h-[300px] flex-col border-b border-[#252527] md:min-h-0 md:border-b-0 ${activeLane === "all" && index < visibleLanes.length - 1 ? "md:border-r md:border-[#202022]" : ""}`}>
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#202022] px-4">
                <h3 className="m-0 text-[12px] font-semibold text-[#dddde0]">{t(lane)}</h3>
                <span className="text-[10px] tabular-nums text-[#737378]">{demo || localMode ? rows.length : "—"}</span>
              </div>
              <div className="grid h-9 shrink-0 grid-cols-[minmax(0,1fr)_112px_84px] items-center gap-2 border-b border-[#1d1d1f] px-4 text-[10px] font-medium text-[#77777d]">
                <span>{copy("Token", "代币")}</span><span className="text-right">{copy("Buy / sell · CKB", "买入 / 卖出 · CKB")}</span><span className="text-right">{copy("Inventory", "库存")}</span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {rows.map((market) => {
                  const row = <article key={market.symbol} className="grid min-h-[72px] grid-cols-[minmax(0,1fr)_112px_84px] items-center gap-2 border-b border-[#1e1e20] px-4 py-2 transition-colors hover:bg-[#111113]">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-[3px] text-[12px] font-bold text-[#101012]" style={{ backgroundColor: market.tone }}>{market.symbol.slice(0, 1)}</span>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-baseline gap-1.5">
                          <strong className="truncate text-[12px] font-semibold text-[#eeeef0]">{market.symbol}</strong>
                          <span className="truncate text-[10px] text-[#85858a]">{market.name}</span>
                          {market.verified && <span className="shrink-0 text-[9px] text-[#72dfb0]">{copy("Verified local", "本地已验证")}</span>}
                        </div>
                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[9px] text-[#77777d]">
                          <span className="truncate">{market.id}</span><span aria-hidden="true">·</span><span>CKB</span>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 text-right tabular-nums">
                      <div className="text-[11px] font-medium text-[#e6e6e8]">{market.buy}</div>
                      <div className="mt-0.5 text-[10px] text-[#85858a]">{market.sell}</div>
                    </div>
                    <div className="text-right text-[10px] tabular-nums text-[#c4c4c7]">{market.inventory}</div>
                  </article>;
                  return market.verified ? <Link key={market.symbol} href="/v2" aria-label={`Trade ${market.symbol}`} className="block text-inherit no-underline">{row}</Link> : row;
                })}
                {!rows.length && (
                  <div className="flex min-h-32 items-center justify-center px-4 py-8 text-center">
                    <div>
                      <p className="m-0 text-[12px] font-medium text-[#c9c9cc]">{demo && !localMode ? copy("No matching CKB markets", "没有匹配的 CKB 市场") : localMode && localError ? copy("Local market unavailable", "本地市场不可用") : t("noVerifiedMarkets")}</p>
                      <p className="mb-0 mt-1 text-[11px] leading-5 text-[#77777d]">{demo && !localMode ? copy("Try another filter", "试试其他筛选条件") : localMode && localError ? localError : t("deploymentUnverified")}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

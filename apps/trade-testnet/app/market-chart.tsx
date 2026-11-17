"use client";

import { ColorType, LineSeries, createChart } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "./i18n-provider";

export type ConfirmedPricePoint = { time: number; price: number };

export default function MarketChart({
  marketId,
  loading,
}: {
  marketId: string;
  loading: boolean;
}) {
  const { locale, t } = useLocale();
  const zh = locale === "zh-CN";
  const host = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<ConfirmedPricePoint[]>([]);
  const [historyError, setHistoryError] = useState(false);
  useEffect(() => {
    let active = true;
    setHistory([]);
    setHistoryError(false);
    fetch("/api/pudge/history?id=" + encodeURIComponent(marketId), {
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw Error(result.error ?? "History unavailable.");
        return result;
      })
      .then((result) => {
        if (active && Array.isArray(result.executions))
          setHistory(result.executions as ConfirmedPricePoint[]);
      })
      .catch(() => {
        if (active) setHistoryError(true);
      });
    return () => {
      active = false;
    };
  }, [marketId]);
  useEffect(() => {
    if (!host.current) return;
    const chart = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#171a20" },
        textColor: "#858c99",
        fontFamily: "Geist, Arial, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: "#242830" },
        horzLines: { color: "#242830" },
      },
      rightPriceScale: { borderColor: "#30353e" },
      timeScale: { borderColor: "#30353e", timeVisible: true },
      crosshair: {
        vertLine: { color: "#8de4b2", labelBackgroundColor: "#2a4b39" },
        horzLine: { color: "#8de4b2", labelBackgroundColor: "#2a4b39" },
      },
    });
    const series = chart.addSeries(LineSeries, {
      color: "#8de4b2",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    if (history.length) {
      series.setData(
        history.map(({ time, price }) => ({ time: time as never, value: price })),
      );
    }
    return () => chart.remove();
  }, [history]);

  return (
    <div className="relative flex min-h-[242px] flex-1 flex-col sm:min-h-[278px]">
      <div
        ref={host}
        className="relative min-h-[218px] flex-1"
        aria-label={zh ? "已确认的 CKB 担保债权执行历史图表" : "Confirmed CKB backed-claim execution history chart"}
      />
      {!history.length && (
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-7 z-10 grid place-items-center px-5 text-center">
          <div className="max-w-sm">
            <p className="m-0 text-[14px] font-medium text-rv-muted">
              {loading ? t("loadingConfirmedMarketData") : historyError ? t("historyUnavailable") : t("noConfirmedPriceHistory")}
            </p>
            <p className="mb-0 mt-1 text-[13px] leading-5 text-rv-subtle">
              {loading
                ? t("chartUpdatesAfterStateCheck")
                : historyError
                  ? t("confirmedHistoryCouldNotLoad")
                  : t("noVerifiedTokenExecutions")}
            </p>
          </div>
        </div>
      )}
      <p className="m-0 flex h-7 shrink-0 items-center justify-end px-2 text-[12px] text-rv-subtle">
        Charts by TradingView
      </p>
    </div>
  );
}

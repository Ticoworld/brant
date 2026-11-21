"use client";

import {useEffect, useRef, useState} from 'react';
import {AreaSeries, ColorType, createChart, createOptionsChart, type IChartApiBase, type UTCTimestamp} from 'lightweight-charts';
import type {MarketData} from './types';

const seriesStyle = {
  lineColor: '#6CDDB5',
  topColor: 'rgba(108,221,181,.24)',
  bottomColor: 'rgba(108,221,181,.01)',
  lineWidth: 2 as const,
  lastValueVisible: false,
  priceLineVisible: false,
};

function fitChart<HorzScaleItem>(chart: IChartApiBase<HorzScaleItem>) {
  const scale = chart.timeScale();
  const fit = () => scale.fitContent();
  scale.subscribeSizeChange(fit);
  fit();
}

export default function PreviewChart({market, zh, loading}: {market: MarketData | null; zh: boolean; loading: boolean}) {
  const [history, setHistory] = useState(false);
  const plot = useRef<HTMLDivElement>(null);
  const historyAvailable = market?.historyState === 'verified' && market.history.length > 0;
  useEffect(() => {
    const element = plot.current;
    if (!element || !market) return;
    const options = {
      autoSize: true,
      layout: {background: {type: ColorType.Solid as const, color: '#151A19'}, textColor: '#859490', fontFamily: getComputedStyle(element).fontFamily, fontSize: 12},
      grid: {vertLines: {color: '#202826'}, horzLines: {color: '#252e2b'}},
      rightPriceScale: {borderVisible: false, scaleMargins: {top: .16, bottom: .12}},
      timeScale: {borderVisible: false, rightOffset: 2},
    };
    if (history) {
      const points = new Map<number, number>();
      for (const event of market.history) {
        const time = Number(BigInt(event.timestampMs) / 1000n);
        const quantity = Number(event.quantity);
        if (quantity > 0) points.set(time, Number(event.amountShannons) / 1e8 / quantity);
      }
      const chart = createChart(element, {...options, timeScale: {...options.timeScale, timeVisible: true}});
      chart.addSeries(AreaSeries, {...seriesStyle, pointMarkersVisible: true}).setData(
        [...points].sort(([a], [b]) => a - b).map(([time, value]) => ({time: time as UTCTimestamp, value})),
      );
      fitChart(chart);
      return () => chart.remove();
    }
    const sold = Number(market.curve.sold);
    const low = Math.max(0, sold - 10);
    const high = Math.min(Number(market.curve.supply) - 1, sold + 20);
    const base = BigInt(market.curve.base);
    const step = BigInt(market.curve.step);
    const chart = createOptionsChart(element, options);
    const series = chart.addSeries(AreaSeries, seriesStyle);
    series.setData(Array.from({length: high - low + 1}, (_, index) => {
      const time = low + index;
      return {time, value: Number(base + step * BigInt(time)) / 1e8};
    }));
    if (sold <= high) {
      series.createPriceLine({price: Number(market.buyOneShannons) / 1e8, color: '#6CDDB5', lineStyle: 2, lineWidth: 1, axisLabelVisible: true});
    }
    fitChart(chart);
    return () => chart.remove();
  }, [market, history]);

  const curveLabel = zh ? '联合曲线' : 'Bonding curve';
  const historyLabel = zh ? '价格历史' : 'Price history';
  const visible = market && (!history || historyAvailable);
  return (
    <section className="preview-card preview-chart" aria-labelledby="preview-chart-title">
      <div className="preview-card-heading">
        <h2 id="preview-chart-title">{history ? historyLabel : curveLabel}</h2>
        <div className="preview-chart-tabs" aria-label={zh ? '图表视图' : 'Chart view'}>
          <button type="button" aria-pressed={!history} onClick={() => setHistory(false)}>{zh ? '曲线' : 'Curve'}</button>
          <button type="button" aria-pressed={history} onClick={() => setHistory(true)}>{historyLabel}</button>
        </div>
      </div>
      <p className="preview-chart-caption">{history ? (zh ? '已确认成交的平均价格' : 'Confirmed execution averages') : (zh ? '当前价格附近的确定性曲线' : 'Deterministic curve near current price')} · CKB / RVK</p>
      {visible ? <div key={String(history)} ref={plot} className="preview-plot" role="img" aria-label={history ? historyLabel : curveLabel} /> :
        <div className="preview-plot preview-empty" role="status">{loading ? (zh ? '正在验证市场…' : 'Verifying market…') : (zh ? '图表数据暂不可用' : 'Chart data unavailable')}</div>}
      <footer><span>{history ? (zh ? '确认时间' : 'Confirmation time') : (zh ? '已售 RVK' : 'RVK sold')}</span><a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer">Lightweight Charts™</a></footer>
    </section>
  );
}

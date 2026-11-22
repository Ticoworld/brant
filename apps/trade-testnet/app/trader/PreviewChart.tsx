"use client";

import {useEffect, useRef, useState} from 'react';
import {AreaSeries, ColorType, LineSeries, createOptionsChart, createSeriesMarkers, type SeriesMarker, type IChartApiBase} from 'lightweight-charts';
import {useLocale} from '../i18n-provider';
import type {MarketData, TradeEvent} from './types';

// Lightweight Charts™ is a product of TradingView, Inc. © 2023 TradingView, Inc.
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

function curvePrice(market: MarketData, sold: number) {
  return Number(BigInt(market.curve.base) + BigInt(market.curve.step) * BigInt(sold)) / 1e8;
}

export default function PreviewChart({market, zh, loading, projected}: {projected: number | null; market: MarketData | null; zh: boolean; loading: boolean}) {
  const [history, setHistory] = useState(false);
  const [hover, setHover] = useState<{sold: number; price: number} | null>(null);
  const [hoverTrade, setHoverTrade] = useState<TradeEvent | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const historyAvailable = market?.historyState === 'verified' && market.history.length > 0;
  useEffect(() => {
    const element = plot.current;
    if (!element || !market) return;
    const options = {
      autoSize: true,
      layout: {attributionLogo: false, background: {type: ColorType.Solid as const, color: '#151A19'}, textColor: '#859490', fontFamily: getComputedStyle(element).fontFamily, fontSize: 12},
      grid: {vertLines: {color: '#202826'}, horzLines: {color: '#252e2b'}},
      rightPriceScale: {borderVisible: false, alignLabels: true, tickMarkDensity: 3, scaleMargins: {top: .15, bottom: .15}},
      timeScale: {borderVisible: false, allowBoldLabels: false, rightOffset: 1},
    };
    if (history) {
      // Use execution order so multiple trades in the same block each get a point.
      const events = market.history.filter(event => event.status === 'confirmed' && BigInt(event.quantity) > 0n);
      const chart = createOptionsChart(element, options);
      const series = chart.addSeries(LineSeries, {
        lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 4,
        lastValueVisible: false, priceLineVisible: false,
      });
      series.setData(events.map((event, index) => ({
        time: index + 1, value: averagePrice(event),
        color: event.side === 'buy' ? '#6CDDB5' : '#F08087',
      })));
      chart.subscribeCrosshairMove(event => {
        const point = event.seriesData.get(series);
        setHoverTrade(point ? events[point.time - 1] ?? null : null);
      });
      fitChart(chart);
      return () => chart.remove();
    }
    const sold = Number(market.curve.sold);
    const low = Math.max(0, Math.min(sold - 10, (projected ?? sold) - 2));
    const high = Math.min(Number(market.curve.supply), Math.max(sold + 20, (projected ?? sold) + 2));
    const stride = Math.max(1, Math.ceil((high - low) / 240));
    const chart = createOptionsChart(element, options);
    const series = chart.addSeries(AreaSeries, seriesStyle);
    const positions = new Set([low, high, sold]);
    if (projected !== null) positions.add(projected);
    for (let position = low; position < high; position += stride) positions.add(position);
    series.setData([...positions].sort((a, b) => a - b).map(time => ({time, value: curvePrice(market, time)})));
    const markers: SeriesMarker<number>[] = [
      {time: sold, position: 'atPriceMiddle', price: curvePrice(market, sold), shape: 'circle', size: 0.65, color: '#6CDDB5'},
    ];
    if (projected !== null) markers.push({
      time: projected, position: 'atPriceMiddle', price: curvePrice(market, projected), shape: 'circle', size: 0.65, color: '#ecbd84',
    });
    createSeriesMarkers(series, markers.sort((a, b) => a.time - b.time));
    chart.subscribeCrosshairMove(event => {
      const point = event.seriesData.get(series);
      setHover(point && 'value' in point ? {sold: point.time, price: point.value} : null);
    });
    fitChart(chart);
    return () => chart.remove();
  }, [market, history, projected]);

  const curveLabel = zh ? '联合曲线' : 'Bonding curve';
  const historyLabel = zh ? '价格历史' : 'Price history';
  const afterTradeHint = zh ? '假设所选交易按当前市场状态执行，此点为交易后的下一档曲线买入报价。'
    : 'Next marginal buy quote if this trade executes against the displayed market state.';
  const visible = market && (!history || historyAvailable);
  return (
    <section className="preview-card preview-chart" aria-labelledby="preview-chart-title">
      <div className="preview-card-heading">
        <h2 id="preview-chart-title">{history ? historyLabel : curveLabel}</h2>
        <div className="preview-chart-tabs" aria-label={zh ? '图表视图' : 'Chart view'}>
          <button type="button" aria-pressed={!history} onClick={() => {setHover(null); setHoverTrade(null); setHistory(false);}}>{zh ? '曲线' : 'Curve'}</button>
          <button type="button" aria-pressed={history} onClick={() => {setHover(null); setHoverTrade(null); setHistory(true);}}>{historyLabel}</button>
        </div>
      </div>
      <p className="preview-chart-caption">{history ? (zh ? '已确认成交价格' : 'Confirmed trade prices') : (zh ? '曲线边际价格' : 'Marginal curve price')} · CKB / RVK</p>
      {market && !history && <div className="preview-curve-key">
        <span data-marker="current">{zh ? '当前' : 'Current'} · <CurveValue sold={Number(market.curve.sold)} price={curvePrice(market, Number(market.curve.sold))} /></span>
        {projected !== null && <span data-marker="projected" title={afterTradeHint}>{zh ? '交易后' : 'After trade'}<span className="sr-only"> ({afterTradeHint})</span> · <CurveValue sold={projected} price={curvePrice(market, projected)} /></span>}
      </div>}
      {visible ? <div key={String(history)} ref={plot} className="preview-plot" role="img" aria-label={history ? historyLabel : curveLabel} /> :
        <div className="preview-plot preview-empty" role="status">{loading ? (zh ? '正在验证市场…' : 'Verifying market…') : (zh ? '图表数据暂不可用' : 'Chart data unavailable')}</div>}
      <footer><span>{!history && hover ? <CurveValue {...hover} /> : history ? (zh ? '成交顺序' : 'Execution order') : (zh ? '已售 RVK' : 'RVK sold')}</span><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Lightweight Charts™ by TradingView</a>
        {history && hoverTrade && <span className="preview-history-readout">
          {hoverTrade.side === 'buy' ? (zh ? '买入' : 'Buy') : (zh ? '卖出' : 'Sell')} {hoverTrade.quantity} RVK · {averagePrice(hoverTrade).toLocaleString(zh ? 'zh-CN' : 'en', {maximumFractionDigits: 8})} CKB / RVK · <time>{new Date(Number(hoverTrade.timestampMs)).toLocaleString(zh ? 'zh-CN' : 'en')}</time>
        </span>}
      </footer>
    </section>
  );
}

function CurveValue({sold, price}: {sold: number; price: number}) {
  const {locale} = useLocale();
  return <>{sold.toLocaleString(locale)} {locale === 'zh-CN' ? '已售 RVK' : 'RVK sold'} · {price.toLocaleString(locale, {maximumFractionDigits: 8})} CKB / RVK</>;
}

function averagePrice(event: TradeEvent) {
  return Number(event.amountShannons) / 1e8 / Number(event.quantity);
}

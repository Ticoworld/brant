"use client";

import {useEffect, useMemo, useRef, useState} from 'react';
import {CandlestickSeries, ColorType, HistogramSeries, createChart, type Time, type UTCTimestamp} from 'lightweight-charts';
import type {MarketData, TradeEvent} from './types';
import {buildVerifiedPriceSeries, intervals, executionKey, type PriceBar, type Timeframe} from './verified-price-series';
import {formatCkb} from './rpc';

const up = '#6cddb5';
const down = '#f08087';
const ckb = (value: bigint) => Number(value) / 1e8;
const timestamp = (time: number) => time as UTCTimestamp;

export default function PreviewChart({market, zh, loading, stale}: {
  market: MarketData | null; zh: boolean; loading: boolean; stale: boolean;
}) {
  const [frame, setFrame] = useState<Timeframe>('4h');
  const [hover, setHover] = useState<PriceBar | null>(null);
  const plot = useRef<HTMLDivElement>(null);
  const reset = useRef<() => void>(() => {});
  const series = useMemo(() => market && buildVerifiedPriceSeries(market, frame), [market, frame]);
  const locale = zh ? 'zh-CN' : 'en';
  const utc = useMemo(() => new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
  }), [locale]);

  useEffect(() => {
    const element = plot.current;
    if (!element || !series) return;
    const chart = createChart(element, {
      autoSize: true,
      layout: {
        attributionLogo: false, background: {type: ColorType.Solid, color: '#151a19'},
        panes: {enableResize: false, separatorColor: '#33413c'}, textColor: '#abb9b4', fontFamily: getComputedStyle(element).fontFamily, fontSize: 12,
      },
      localization: {locale, timeFormatter: (time: Time) => typeof time === 'number' ? utc.format(time * 1000) + ' UTC' : ''},
      grid: {vertLines: {color: '#222b28'}, horzLines: {color: '#27312e'}},
      rightPriceScale: {borderVisible: false, minimumWidth: 59},
      timeScale: {borderVisible: false, timeVisible: true, secondsVisible: false, allowBoldLabels: false, rightOffsetPixels: 18, maxBarSpacing: series.bars.length <= 3 ? 64 : 0},
      crosshair: {horzLine: {labelVisible: false}},
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down,
      lastValueVisible: false, priceLineVisible: false,
      priceFormat: {type: 'custom', minMove: 0.00000001, formatter: (price: number) => price.toLocaleString(locale,{maximumFractionDigits:8})},
    });
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: {type: 'volume'}, lastValueVisible: false, priceLineVisible: false,
    }, 1);
    chart.panes()[0].setStretchFactor(0.77);
    chart.panes()[1].setStretchFactor(0.23);
    volume.priceScale().applyOptions({scaleMargins:{top:0.12,bottom:0}});
    candles.setData(series.bars.map(bar => ({
      time: timestamp(bar.time), open: ckb(bar.open), high: ckb(bar.high), low: ckb(bar.low), close: ckb(bar.close),
    })));
    volume.setData(series.bars.map(bar => ({
      time: timestamp(bar.time), value: ckb(bar.volume), color: bar.close >= bar.open ? '#438773' : '#9c555c',
    })));
    if (series.latest !== null) candles.createPriceLine({
      price: ckb(series.latest), color: up, lineWidth: 1, lineStyle: 2, axisLabelVisible: false,
    });
    const byTime = new Map(series.bars.map(bar => [bar.time, bar]));
    chart.subscribeCrosshairMove(({time}) => setHover(typeof time === 'number' ? byTime.get(time) ?? null : null));
    const fit = () => chart.timeScale().fitContent();
    reset.current = fit;
    chart.timeScale().subscribeSizeChange(fit);
    fit();
    return () => {
      reset.current = () => {};
      chart.remove();
    };
  }, [series, locale, utc]);

  const active = series && (hover && series.bars.includes(hover) ? hover : series.bars.at(-1));
  return (
    <section className="preview-card preview-chart" aria-labelledby="preview-chart-title">
      <div className="preview-card-heading">
        <h2 id="preview-chart-title">{zh ? '价格图表' : 'Price chart'}</h2>
        {series && <button className="preview-chart-fit" type="button" onClick={() => reset.current()}>{zh ? '重置视图' : 'Reset view'} ↺</button>}
      </div>
      <div className="preview-chart-toolbar">
        <p id="preview-price-basis">{zh ? '已验证交易形成的边际买入价' : 'Marginal Buy price from verified trades'}</p>
        <div className="preview-chart-tabs" aria-label={zh ? '时间周期' : 'Timeframe'}>
          {(Object.keys(intervals) as Timeframe[]).map(item => <button key={item} type="button" aria-pressed={frame === item} onClick={() => {setHover(null); setFrame(item);}}>{item}</button>)}
        </div>
      </div>
      {series && active ? <>
        <div className="preview-candle-readout" aria-label={zh ? '蜡烛图数据' : 'Candle details'}>
          <span>{utc.format(active.time * 1000)} UTC</span>
          <span>{zh ? '开' : 'O'} <b>{formatCkb(active.open)}</b> · {zh ? '高' : 'H'} <b>{formatCkb(active.high)}</b> · {zh ? '低' : 'L'} <b>{formatCkb(active.low)}</b> · {zh ? '收' : 'C'} <b>{formatCkb(active.close)}</b> CKB/RVK</span>
          <span>{zh ? '成交量' : 'Volume'} <b>{formatCkb(active.volume)} CKB</b> · {active.buys} {zh ? '笔买入' : 'Buy'} / {active.sells} {zh ? '笔卖出' : 'Sell'} · {active.quantity.toString()} RVK</span>
        </div>
        <div className="preview-plot-wrap">
          {series.latest !== null && <span className="preview-current-price">{stale ? (zh ? '上次验证' : 'Last verified') : (zh ? '当前' : 'Current')} · {formatCkb(series.latest)} CKB/RVK</span>}
          
          <div ref={plot} className="preview-plot" role="img" aria-label={zh ? '价格蜡烛图和成交量' : 'Price candles and volume'} aria-describedby="preview-price-basis"/>
        </div>
      </> : <div className="preview-plot preview-empty" role="status">{loading ? (zh ? '正在验证市场…' : 'Verifying market…') : (zh ? '已验证价格历史暂不可用' : 'Verified price history unavailable')}</div>}
      <footer>
        <span>{series && series.bars.length <= 3 ? (zh ? '成交较少，仅显示有成交的周期 · 成交量以 CKB 计' : 'Sparse history · populated intervals only · Volume in CKB') : (zh ? '成交量 · CKB · UTC' : 'Volume · CKB · UTC')}</span>
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">Lightweight Charts™ by TradingView</a>
      </footer>
    </section>
  );
}

export function RecentTrades({market, zh}: {market: MarketData | null; zh: boolean}) {
  const symbol = market?.token.symbol ?? 'RVK';
  const locale = zh ? 'zh-CN' : 'en';
  const rows = market?.historyState === 'verified' ? market.history.filter(event => event.status === 'confirmed').slice(-6).reverse() : [];
  return <section className="preview-card preview-recent" aria-labelledby="preview-recent-title">
    <div className="preview-card-heading">
      <h2 id="preview-recent-title">{zh ? '最近成交' : 'Recent trades'}</h2>
      <a href="/activity">{zh ? '查看活动' : 'View activity'} ↗</a>
    </div>
    {rows.length ? <table>
      <thead><tr>{(zh ? ['时间','方向','数量','金额','成交均价','交易'] : ['Time','Side','Quantity','Amount','Average price','Transaction']).map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{rows.map(event => {
        const date = new Date(Number(event.timestampMs));
        return <tr key={executionKey(event)}>
          <td><time dateTime={date.toISOString()}>{date.toLocaleString(locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time></td>
          <td data-tone={event.side === 'buy' ? 'mint' : 'sell'}>{event.side === 'buy' ? (zh ? '买入' : 'Buy') : (zh ? '卖出' : 'Sell')}</td>
          <td>{event.quantity} {symbol}</td>
          <td>{formatCkb(event.amountShannons)} CKB</td>
          <td>{averagePrice(event).toLocaleString(locale,{maximumFractionDigits:8})} CKB/{symbol}</td>
          <td><a aria-label={(zh ? '交易浏览器 ' : 'Transaction explorer ') + executionKey(event)} href={'https://pudge.explorer.nervos.org/transaction/' + event.hash} target="_blank" rel="noreferrer">↗</a></td>
        </tr>;
      })}</tbody>
    </table> : <p className="preview-chart-caption">{zh ? '暂无已验证成交记录' : 'Verified trades unavailable'}</p>}
  </section>;
}

function averagePrice(event: TradeEvent) {
  return ckb(BigInt(event.amountShannons)) / Number(event.quantity);
}

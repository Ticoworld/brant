"use client";

import Link from 'next/link';
import {useState} from 'react';
import {useLocale} from '../i18n-provider';
import {quote} from '../../lib/v2-engine/curve';
import {useAccount} from './account-provider';
import {useMarketData} from './use-market-data';
import {formatCkb} from './rpc';
import type {MarketData, Side} from './types';
import PreviewChart from './PreviewChart';

const marketId = 'pudge-xudt';

export default function TradePreview() {
  const {locale, setLocale} = useLocale();
  const zh = locale === 'zh-CN';
  const account = useAccount();
  const {data: market, loading, error, refresh} = useMarketData(marketId);
  const address = account.state === 'ready' ? account.address : '';
  return (
    <div className="trade-preview">
      <header className="preview-nav">
        <Link href="/" className="preview-brand"><img src="/icon.svg" width="30" height="30" alt="" />Brant</Link>
        <nav aria-label={zh ? '主导航' : 'Main navigation'}>
          <Link href="/" className="preview-discover">{zh ? '市场' : 'Markets'}</Link>
          <Link href="/trade-preview" aria-current="page">{zh ? '交易预览' : 'Trade preview'}</Link>
          <Link href={`/market/${marketId}`}>{zh ? '原版交易' : 'Classic Trade'}</Link>
        </nav>
        <div className="preview-nav-meta">
          <span className="preview-network"><i />Pudge</span>
          {address && <span title={address}>{address.slice(0, 9)}…{address.slice(-5)}</span>}
          <button type="button" onClick={() => setLocale(zh ? 'en' : 'zh-CN')} aria-label={zh ? 'Switch to English' : '切换到简体中文'}>{zh ? 'EN' : '简中'}</button>
        </div>
      </header>
      <main className="preview-canvas">
        <header className="preview-market">
          <div className="preview-identity">
            <TokenMark symbol="RVK" />
            <div><h1>{market?.pair ?? 'RVK / CKB'}</h1><p>{market?.token.name ?? 'Roveko Genesis'} <span>·</span> Pudge Testnet</p></div>
          </div>
          <dl className="preview-prices">
            <Metric label={zh ? '买入价 / RVK' : 'Buy price / RVK'} value={market && market.inventory !== '0' ? formatCkb(market.buyOneShannons) : '—'} unit="CKB" tone="mint" />
            <Metric label={zh ? '卖出价 / RVK' : 'Sell price / RVK'} value={market && market.curve.sold !== '0' ? formatCkb(market.sellOneShannons) : '—'} unit="CKB" tone="sell" />
          </dl>
        </header>
        <div className="preview-layout">
          <TradeTicket market={market} balance={account.state === 'ready' && account.balanceState === 'ready' ? account.availableToTrade : ''} zh={zh} />
          <div className="preview-market-column">
            <PreviewChart market={market} zh={zh} loading={loading} />
            <section className="preview-card preview-state" aria-labelledby="preview-state-title">
              <div className="preview-card-heading">
                <h2 id="preview-state-title">{zh ? '市场状态' : 'Market state'}</h2>
                <button type="button" onClick={() => void refresh()}>{zh ? '刷新' : 'Refresh'} ↻</button>
              </div>
              <dl>
                <Metric label={zh ? '可用曲线储备' : 'Spendable curve reserve'} value={market ? formatCkb(market.reserveShannons) : '—'} unit="CKB" />
                <Metric label={zh ? '市场可用库存' : 'Market inventory'} value={market ? BigInt(market.inventory).toLocaleString(locale) : '—'} unit="RVK" />
                <Metric label={zh ? '共享默克尔托管' : 'Shared Merkle custody'} value={market ? BigInt(market.custody).toLocaleString(locale) : '—'} unit="RVK" />
                <Metric label={zh ? '链上验证' : 'Canonical verification'} value={market ? (error ? (zh ? '上次验证' : 'Last verified') : (zh ? '已验证' : 'Verified')) : '—'} tone={market && !error ? 'mint' : undefined} />
              </dl>
              <p role="status">{market && <>{zh ? '已验证区块' : 'Verified block'} {BigInt(market.tip.number).toLocaleString(locale)} · {new Date(market.refreshedAt).toLocaleTimeString(locale)}</>}
                {error && <span>{market ? ' · ' : ''}{zh ? '市场刷新失败' : 'Market refresh failed'}</span>}
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Metric({label, value, unit, tone}: {label: string; value: string; unit?: string; tone?: string}) {
  return <div><dt>{label}</dt><dd data-tone={tone}>{value} {unit && <small>{unit}</small>}</dd></div>;
}

function TokenMark({symbol}: {symbol: string}) {
  return <span aria-hidden="true" className="preview-token-mark" data-ckb={symbol === 'CKB'}>{symbol === 'CKB' ? 'C' : 'R'}</span>;
}

function TradeTicket({market, balance, zh}: {market: MarketData | null; balance: string; zh: boolean}) {
  const [side, setSide] = useState<Side>('buy');
  const [quantity, setQuantity] = useState('1');
  const [showQuote, setShowQuote] = useState(false);
  const symbol = market?.token.symbol ?? 'RVK';
  const buying = side === 'buy';
  const validQuantity = /^[0-9]{1,10}$/.test(quantity) && BigInt(quantity) > 0n;
  let amount: bigint | null = null;
  if (market && validQuantity) {
    try {
      amount = quote({
        base: BigInt(market.curve.base),
        step: BigInt(market.curve.step),
        supply: BigInt(market.curve.supply),
        inventory: BigInt(market.inventory),
      }, side, BigInt(quantity));
      if (!buying && amount > BigInt(market.reserveShannons)) amount = null;
    } catch {
      // Quotes outside the existing curve constraints have no display amount.
    }
  }

  const tokenWell = (
    <label className="preview-well" key="token">
      <span>{buying ? (zh ? '买入数量' : 'You receive') : (zh ? '卖出数量' : 'You sell')}</span>
      <span className="preview-well-row">
        <input inputMode="numeric" maxLength={10} value={quantity} placeholder="0" onChange={event => {setQuantity(event.target.value); setShowQuote(false);}} />
        <span className="preview-token"><TokenMark symbol={symbol} />{symbol}</span>
      </span>
    </label>
  );
  const ckbWell = (
    <div className="preview-well" key="ckb">
      <span>{buying ? (zh ? '预计支付' : 'Estimated cost') : (zh ? '预计收款' : 'Estimated proceeds')}</span>
      <div className="preview-well-row">
        <output>{amount === null ? '—' : formatCkb(amount)}</output>
        <span className="preview-token"><TokenMark symbol="CKB" />CKB</span>
      </div>
    </div>
  );
  return (
    <section className="preview-card preview-ticket" data-side={side} aria-labelledby="preview-ticket-title">
      <div className="preview-card-heading"><h2 id="preview-ticket-title">{zh ? '交易' : 'Trade'}</h2><span>{zh ? '只读预览' : 'Read-only preview'}</span></div>
      <div className="preview-segment" aria-label={zh ? '交易方向' : 'Trade side'}>
        {(['buy', 'sell'] as const).map(option => (
          <button type="button" key={option} aria-pressed={side === option} onClick={() => {setSide(option); setShowQuote(false);}}>
            {option === 'buy' ? (zh ? '买入' : 'Buy') : (zh ? '卖出' : 'Sell')}
          </button>
        ))}
      </div>
      <div className="preview-wells">
        {buying ? [ckbWell, tokenWell] : [tokenWell, ckbWell]}
        <span className="preview-direction" aria-hidden="true">↓</span>
      </div>
      <div className="preview-presets" aria-label={zh ? '数量预设' : 'Quantity presets'}>
        {[1, 5, 10, 25].map(value => <button type="button" key={value} aria-pressed={String(value) === quantity} onClick={() => {setQuantity(String(value)); setShowQuote(false);}}>{value} {symbol}</button>)}
      </div>
      <div className="preview-ticket-details">
        {balance && <p>{zh ? '钱包可用余额' : 'Available wallet balance'} <strong>{formatCkb(balance)} CKB</strong></p>}
        <p>{zh ? '价格依据' : 'Pricing'} <strong>{zh ? '确定性联合曲线' : 'Deterministic bonding curve'}</strong></p>
      </div>
      {market && quantity && amount === null && <p role="status" className="preview-note">{zh ? '该数量无法报价。请输入可用范围内的整数。' : 'Quote unavailable. Enter a whole quantity within market limits.'}</p>}
      <button type="button" className="preview-action" disabled={amount === null} onClick={() => setShowQuote(true)}>{zh ? '查看报价' : 'Preview quote'}</button>
      <p className="preview-note" role="status">
        {showQuote && amount !== null ? `${buying ? (zh ? '买入' : 'Buy') : (zh ? '卖出' : 'Sell')} ${BigInt(quantity)} ${symbol} · ${formatCkb(amount)} CKB ${zh ? '（未含费用）' : 'before fees'}` : (zh ? '报价未含费用。此预览仅供查看。' : 'Quotes exclude fees. View-only on Pudge Testnet.')}
      </p>
    </section>
  );
}

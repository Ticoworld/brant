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
  const [side, setSide] = useState<Side>('buy');
  const [quantity, setQuantity] = useState('1');


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

  const projected = market && amount !== null
    ? Number(market.curve.sold) + (buying ? 1 : -1) * Number(quantity) : null;
  const stale = !!error || !!market && Date.now() - market.refreshedAt > 60_000;
  const address = account.state === 'ready' ? account.address : '';
  return (
    <div className="trade-preview">
      <header className="preview-nav"><div className="preview-nav-inner">
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
      </div></header>
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
          <TradeTicket side={side} setSide={setSide} quantity={quantity} setQuantity={setQuantity} amount={amount} market={market} balance={account.state === 'ready' && account.balanceState === 'ready' ? account.availableToTrade : ''} zh={zh} />
          <div className="preview-market-column">
            <PreviewChart projected={projected} market={market} zh={zh} loading={loading} />
            <section className="preview-card preview-state" aria-labelledby="preview-state-title">
              <div className="preview-card-heading">
                <h2 id="preview-state-title">{zh ? '市场状态' : 'Market state'}</h2>
                <button type="button" onClick={() => void refresh()}>{zh ? '刷新' : 'Refresh'} ↻</button>
              </div>
              <dl>
                <Metric label={zh ? '可用曲线储备' : 'Spendable curve reserve'} detail={zh ? '不含 Cell 占用容量' : 'Excludes occupied Cell capacity'} value={market ? formatCkb(market.reserveShannons) : '—'} unit="CKB" />
                <Metric label={zh ? '市场可用库存' : 'Market inventory'} detail={market && (zh ? '已验证供应量 ' : 'Verified supply ') + BigInt(market.supply).toLocaleString(locale) + ' RVK'} value={market ? BigInt(market.inventory).toLocaleString(locale) : '—'} unit="RVK" />
                <Metric label={zh ? '共享默克尔托管' : 'Shared Merkle custody'} detail={zh ? '不含外部 L1 持有量' : 'Excludes external L1 holdings'} value={market ? BigInt(market.custody).toLocaleString(locale) : '—'} unit="RVK" />
                <Metric label={zh ? '链上验证' : 'Canonical verification'} detail={market && <><span title={market.tip.hash}>{zh ? '区块' : 'Block'} {BigInt(market.tip.number).toLocaleString(locale)}</span><br/><time dateTime={new Date(market.refreshedAt).toISOString()}>{new Date(market.refreshedAt).toLocaleString(locale)}</time></>} value={market ? (stale ? (zh ? '上次验证' : 'Last verified') : (zh ? '已验证' : 'Verified')) : '—'} tone={market && !stale ? 'mint' : undefined} />
              </dl>
              <p role="status">
                {error && <span>{market ? ' · ' : ''}{zh ? '市场刷新失败' : 'Market refresh failed'}</span>}
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function Metric({label, value, unit, tone, detail}: {label: string; value: string; unit?: string; tone?: string; detail?: React.ReactNode}) {
  return <div><dt>{label}</dt><dd data-tone={tone}>{value} {unit && <small>{unit}</small>}</dd>{detail && <dd className="preview-metric-detail">{detail}</dd>}</div>;
}

function TokenMark({symbol}: {symbol: string}) {
  return <span aria-hidden="true" className="preview-token-mark" data-ckb={symbol === 'CKB'}>{symbol === 'CKB' ? 'C' : 'R'}</span>;
}

function TradeTicket({market, balance, zh, side, setSide, quantity, setQuantity, amount}: {market: MarketData | null; balance: string; zh: boolean; side: Side; setSide: (side: Side) => void; quantity: string; setQuantity: (quantity: string) => void; amount: bigint | null}) {
  const [showQuote, setShowQuote] = useState(false);
  const symbol = market?.token.symbol ?? 'RVK';
  const buying = side === 'buy';
  const unitPrice = market && (buying ? market.inventory !== '0' : market.curve.sold !== '0')
    ? BigInt(buying ? market.buyOneShannons : market.sellOneShannons) : null;
  const count = amount === null ? null : BigInt(quantity);
  const baseline = count !== null && unitPrice !== null ? count * unitPrice : null;
  const impact = amount !== null && baseline
    ? Number((buying ? amount - baseline : baseline - amount) * 10_000n / baseline) / 100 : null;
  const unit = ' CKB / RVK';
  const tokenWell = (
    <label className="preview-well preview-editable" key="token">
      <span>{buying ? (zh ? '买入数量' : 'RVK quantity to buy') : (zh ? '卖出数量' : 'RVK quantity to sell')}</span>
      <span className="preview-well-row">
        <input aria-invalid={!!market && !!quantity && amount === null} inputMode="numeric" pattern="[0-9]*" maxLength={10} value={quantity} placeholder="0" onChange={event => {setQuantity(event.target.value); setShowQuote(false);}} />
        <span className="preview-token"><TokenMark symbol={symbol} />{symbol}</span>
      </span>
    </label>
  );
  const ckbWell = (
    <div className="preview-well preview-estimate" key="ckb">
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
        {tokenWell}
        <div className="preview-presets" aria-label={zh ? '数量预设' : 'Quantity presets'}>
          {[1, 5, 10, 25].map(value => <button type="button" key={value} aria-pressed={String(value) === quantity} onClick={() => {setQuantity(String(value)); setShowQuote(false);}}>{value} {symbol}</button>)}
        </div>
        {ckbWell}
      </div>
      <div className="preview-ticket-details">
        {balance && <p>{zh ? '钱包可用余额' : 'Available wallet balance'} <strong>{formatCkb(balance)} CKB</strong></p>}
        <p>{zh ? '当前单价' : 'Current unit price'} <strong>{unitPrice === null ? '—' : formatCkb(unitPrice) + unit}</strong></p>
        <p>{zh ? '平均成交价' : 'Average execution price'} <strong>{amount === null || count === null ? '—' : formatCkb((amount + count / 2n) / count) + unit}</strong></p>
        <p>{zh ? '价格影响' : 'Price impact'} <strong>{impact === null ? '—' : impact.toLocaleString(zh ? 'zh-CN' : 'en', {maximumFractionDigits: 2}) + '%'}</strong></p>
        <p>{zh ? '费用' : 'Fees'} <strong>{zh ? '未计入预览' : 'Excluded from preview'}</strong></p>
      </div>
      {market && quantity && amount === null && <p role="status" className="preview-note">{zh ? '该数量无法报价。请输入可用范围内的整数。' : 'Quote unavailable. Enter a whole quantity within market limits.'}</p>}
      <button type="button" className="preview-action" disabled={amount === null} onClick={() => setShowQuote(true)}>{zh ? '查看报价' : 'Preview quote'}</button>
      <p className="preview-note" role="status">
        {showQuote && amount !== null ? `${buying ? (zh ? '买入' : 'Buy') : (zh ? '卖出' : 'Sell')} ${BigInt(quantity)} ${symbol} · ${formatCkb(amount)} CKB ${zh ? '（未含费用）' : 'before fees'}` : (zh ? '报价未含费用。此预览仅供查看。' : 'Quotes exclude fees. View-only on Pudge Testnet.')}
      </p>
    </section>
  );
}

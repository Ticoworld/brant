"use client";

import {NavigationHeader} from './navigation';
import {useEffect, useRef, useState} from 'react';
import {useLocale} from '../i18n-provider';
import {quote} from '../../lib/v2-engine/curve';
import {PUDGE_TRADE_CHANGE_CAPACITY, PUDGE_TRADE_FEE} from '../../lib/v2-engine/market-capacity';
import {copy} from './copy';
import {useMarketSession} from './use-market-session';
import {formatCkb} from './rpc';
import type {MarketData, Side} from './types';
import PreviewChart from './PreviewChart';

const marketId = 'pudge-xudt';

export default function TradePreview() {
  const [side, setSide] = useState<Side>('buy');
  const session = useMarketSession(marketId, side, true);
  return <TradeV2 session={session} side={side} setSide={setSide} />;
}

export function TradeV2({session, side, setSide}: {
  session: ReturnType<typeof useMarketSession>;
  side: Side;
  setSide: (side: Side) => void;
}) {
  const {locale} = useLocale();
  const zh = locale === 'zh-CN';
  const {account, marketQuery, market, trade, inclusion, marketCaughtUp, position} = session;
  const {loading, error, refresh} = marketQuery;
  const [quantity, setQuantity] = useState('1');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(timer);
  }, []);

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
  const stale = !!error || !!market && now - market.refreshedAt > 60_000;
  const catchingUp = trade.status === 'rechecking' || !!inclusion && !marketCaughtUp;
  const historyUnavailable = !!market && market.historyState !== 'verified';
  const walletReady = account.state === 'ready';
  const balance = walletReady && account.balanceState === 'ready' && account.availableToTrade !== ''
    ? BigInt(account.availableToTrade) : null;
  const holdings = walletReady && position.state === 'ready' ? BigInt(position.balance) : null;
  const count = amount === null ? 0n : BigInt(quantity);
  const fundingInsufficient = balance !== null && (!account.hasFundingCell || (buying && amount !== null && amount > balance));
  const ownershipInsufficient = !buying && holdings !== null && count > holdings;
  const blocked = !market || stale || catchingUp || historyUnavailable;
  const canPrepare = walletReady && !blocked && !trade.busy && !trade.pending &&
    trade.readiness === 'ready' && amount !== null && balance !== null && !fundingInsufficient &&
    (buying || (holdings !== null && !ownershipInsufficient));
  const review = canPrepare && amount !== null ? trade.quoteStatus(side, count, amount) : '';
  const prepareQuote = trade.prepareQuote;
  const prepareRef = useRef(prepareQuote);
  prepareRef.current = prepareQuote;
  useEffect(() => {
    if (!canPrepare || amount === null) return;
    const timer = setTimeout(() => prepareRef.current(side, count, amount), 300);
    return () => clearTimeout(timer);
  }, [canPrepare, side, count, amount, market?.identity, market?.custodyRoot, account.owner, trade.revision]);

  const walletIssue = {
    'wrong-network': 'walletWrongNetwork',
    unsupported: 'walletUnsupported',
    'connection-timeout': 'connectionTimeout',
    'connection-rejected': 'walletRejected',
    error: 'walletRequestFailed',
  } as const;
  const issue = walletIssue[account.state as keyof typeof walletIssue];
  const walletOpening = account.state === 'checking' || account.state === 'connecting';
  const statusLabels: Record<string, string> = {
    preparing: copy(locale, 'reviewing'),
    'awaiting-wallet': copy(locale, 'walletApproval'),
    broadcasting: copy(locale, 'broadcasting'),
    submitted: zh ? '已提交' : 'Submitted',
    pending: copy(locale, 'pending'),
    proposed: zh ? '已提议' : 'Proposed',
    confirmed: copy(locale, 'confirmed'),
    rechecking: zh ? '正在重新验证确认状态' : 'Rechecking confirmation',
    rejected: trade.error ? (zh ? '交易被拒绝' : 'Transaction rejected') : (zh ? '钱包批准已取消' : 'Wallet approval rejected'),
    failed: zh ? '交易未完成' : 'Trade failed',
  };
  const status = walletReady && (trade.uncertain ? copy(locale, 'unknown') : statusLabels[trade.status]);
  const attemptHash = trade.pending && trade.attemptRaw ? readAttemptHash(trade.attemptRaw) : '';
  const receipt = walletReady ? trade.receipt || attemptHash : '';
  const action = !walletReady
    ? copy(locale, walletOpening ? (account.state === 'checking' ? 'walletChecking' : 'connecting') : 'connect')
    : review === 'unavailable' ? (zh ? '重新准备报价' : 'Retry quote preparation')
    : zh ? (buying ? '买入 RVK' : '卖出 RVK') : (buying ? 'Buy RVK' : 'Sell RVK');
  const submit = () => {
    if (!walletReady) {account.connect(); return;}
    if (!canPrepare || amount === null || !market || Date.now() - market.refreshedAt > 60_000) return;
    if (review === 'unavailable') prepareQuote(side, count, amount);
    if (review === 'ready') void trade.trade(side, count, amount);
  };
  return (
    <div className="trade-preview">
      <NavigationHeader account={account}/>
      <main className="preview-canvas">
        <header className="preview-market">
          <div className="preview-identity">
            <TokenMark symbol="RVK" />
            <div><h1>{market?.pair ?? 'RVK / CKB'}</h1><p>{market?.token.name ?? 'Roveko Genesis'}</p></div>
          </div>
          <dl className="preview-prices">
            <Metric label={zh ? '买入价 / RVK' : 'Buy price / RVK'} value={market && market.inventory !== '0' ? formatCkb(market.buyOneShannons) : '—'} unit="CKB" tone="mint" />
            <Metric label={zh ? '卖出价 / RVK' : 'Sell price / RVK'} value={market && market.curve.sold !== '0' ? formatCkb(market.sellOneShannons) : '—'} unit="CKB" tone="sell" />
          </dl>
        </header>
        <div className="preview-layout">
          <TradeTicket
            side={side} setSide={setSide} quantity={quantity} setQuantity={setQuantity}
            amount={amount} market={market} balance={balance} holdings={holdings} zh={zh}
            action={action} submit={submit}
            disabled={walletOpening || trade.busy || (walletReady && (!canPrepare || review === 'updating'))}
          >
            {issue && <p role="alert" className="preview-note">{copy(locale, issue)}</p>}
            {blocked && <p role="status" className="preview-note">
              {catchingUp ? (zh ? '正在重新验证市场状态' : 'Rechecking verified market state')
                : historyUnavailable ? (zh ? '无法验证交易历史，交易已暂停' : 'Trading is paused while canonical market history is unavailable.')
                : stale ? (zh ? '市场数据已过期，请刷新' : 'Market data is stale. Refresh to continue.')
                : copy(locale, loading ? 'loading' : 'unavailable')}
            </p>}
            {walletReady && fundingInsufficient && <p role="alert" className="preview-note">{copy(locale, 'insufficientCkb')}</p>}
            {walletReady && balance === null && <p className="preview-note">{copy(locale, 'balanceUnavailable')} <button type="button" onClick={() => void account.refresh()}>{copy(locale, 'retry')}</button></p>}
            {walletReady && !buying && holdings === null && <p className="preview-note">
              {copy(locale, position.state === 'unavailable' ? 'holdingsUnavailable' : 'checkingHoldings')}
              {position.state === 'unavailable' && <> <button type="button" onClick={position.retry}>{copy(locale, 'retry')}</button></>}
            </p>}
            {ownershipInsufficient && <p role="alert" className="preview-note">{copy(locale, 'insufficientTokens')}</p>}
            {walletReady && !blocked && trade.readiness !== 'ready' && <p role="status" className="preview-note">
              {trade.readiness === 'unavailable' ? (zh ? '交易状态暂不可用' : 'Trading state unavailable') : (zh ? '正在同步交易状态' : 'Synchronizing trading state')}
            </p>}
            {review === 'updating' && <p role="status" className="preview-note">{zh ? '正在准备报价…' : 'Preparing quote…'}</p>}
            {(status || receipt) && <div role="status" className="preview-note preview-settlement">
              <span>{status}</span>
              {receipt && <a href={`https://pudge.explorer.nervos.org/transaction/${receipt}`} target="_blank" rel="noreferrer">{copy(locale, 'explorer')}</a>}
              {trade.pending && (trade.uncertain || trade.error || trade.status === 'rechecking') &&
                <button type="button" onClick={() => void trade.reconcile(false)}>{copy(locale, 'reconcile')}</button>}
            </div>}
            {walletReady && trade.error && <p role="alert" className="preview-note">
              {trade.error} {!trade.pending && <button type="button" onClick={trade.dismissError}>{zh ? '关闭' : 'Dismiss'}</button>}
            </p>}
          </TradeTicket>
          <div className="preview-market-column">
            <PreviewChart projected={market && projected === Number(market.supply) ? null : projected} market={market} zh={zh} loading={loading} />
            <section className="preview-card preview-state" aria-labelledby="preview-state-title">
              <div className="preview-card-heading">
                <h2 id="preview-state-title">{zh ? '市场状态' : 'Market state'}</h2>
                <button type="button" onClick={() => void refresh()}>{zh ? '刷新' : 'Refresh'} ↻</button>
              </div>
              <dl>
                <Metric label={zh ? '可用曲线储备' : 'Spendable curve reserve'} detail={zh ? '不含 Cell 占用容量' : 'Excludes occupied Cell capacity'} value={market ? formatCkb(market.reserveShannons) : '—'} unit="CKB" />
                <Metric label={zh ? '市场可用库存' : 'Market inventory'} detail={market && (zh ? '已验证供应量 ' : 'Verified supply ') + BigInt(market.supply).toLocaleString(locale) + ' RVK'} value={market ? BigInt(market.inventory).toLocaleString(locale) : '—'} unit="RVK" />
                <Metric label={zh ? '共享默克尔托管' : 'Shared Merkle custody'} detail={zh ? '不含外部 L1 持有量' : 'Excludes external L1 holdings'} value={market ? BigInt(market.custody).toLocaleString(locale) : '—'} unit="RVK" />
                <Metric label={zh ? '链上验证' : 'Canonical verification'} detail={market && <><span title={market.tip.hash}>{zh ? '区块' : 'Block'} {BigInt(market.tip.number).toLocaleString(locale)}</span><br/><time dateTime={new Date(market.refreshedAt).toISOString()}>{new Date(market.refreshedAt).toLocaleString(locale)}</time></>} value={market ? (blocked ? (zh ? '上次验证' : 'Last verified') : (zh ? '已验证' : 'Verified')) : '—'} tone={market && !blocked ? 'mint' : undefined} />
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

function readAttemptHash(raw: string) {
  try {
    const hash = JSON.parse(raw)?.txHash;
    return typeof hash === 'string' && /^0x[0-9a-f]{64}$/i.test(hash) ? hash : '';
  } catch { return ''; }
}

function TradeTicket({market, balance, holdings, zh, side, setSide, quantity, setQuantity, amount, action, submit, disabled, children}: {
  market: MarketData | null;
  balance: bigint | null;
  holdings: bigint | null;
  zh: boolean;
  side: Side;
  setSide: (side: Side) => void;
  quantity: string;
  setQuantity: (quantity: string) => void;
  amount: bigint | null;
  action: string;
  submit: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const symbol = market?.token.symbol ?? 'RVK';
  const buying = side === 'buy';
  const unitPrice = market && (buying ? market.inventory !== '0' : market.curve.sold !== '0')
    ? BigInt(buying ? market.buyOneShannons : market.sellOneShannons) : null;
  const count = amount === null ? null : BigInt(quantity);
  const baseline = count !== null && unitPrice !== null ? count * unitPrice : null;
  const impact = amount !== null && baseline
    ? Number((buying ? amount - baseline : baseline - amount) * 10_000n / baseline) / 100 : null;
  // Presentation warning only. 10% is 1,000 basis points.
  const highImpact = impact !== null && impact >= 10;
  const unit = ' CKB / RVK';
  const tokenWell = (
    <label className="preview-well preview-editable" key="token">
      <span>{buying ? (zh ? '买入数量' : 'RVK quantity to buy') : (zh ? '卖出数量' : 'RVK quantity to sell')}</span>
      <span className="preview-well-row">
        <input aria-invalid={!!market && !!quantity && amount === null} inputMode="numeric" pattern="[0-9]*" maxLength={10} value={quantity} placeholder="0" onChange={event => {setQuantity(event.target.value);}} />
        <span className="preview-token"><TokenMark symbol={symbol} />{symbol}</span>
      </span>
    </label>
  );
  const ckbWell = (
    <div className="preview-well preview-estimate" key="ckb">
      <span>{buying ? (zh ? '预计交易金额' : 'Estimated trade amount') : (zh ? '预计收入总额' : 'Estimated gross proceeds')}</span>
      <div className="preview-well-row">
        <output>{amount === null ? '—' : formatCkb(amount)}</output>
        <span className="preview-token"><TokenMark symbol="CKB" />CKB</span>
      </div>
    </div>
  );
  return (
    <section className="preview-card preview-ticket" data-side={side} aria-labelledby="preview-ticket-title">
      <div className="preview-card-heading"><h2 id="preview-ticket-title">{zh ? '交易' : 'Trade'}</h2></div>
      <div className="preview-segment" aria-label={zh ? '交易方向' : 'Trade side'}>
        {(['buy', 'sell'] as const).map(option => (
          <button type="button" key={option} aria-pressed={side === option} onClick={() => {setSide(option);}}>
            {option === 'buy' ? (zh ? '买入' : 'Buy') : (zh ? '卖出' : 'Sell')}
          </button>
        ))}
      </div>
      <div className="preview-wells">
        {tokenWell}
        <div className="preview-presets" aria-label={zh ? '数量预设' : 'Quantity presets'}>
          {[1, 5, 10, 25].map(value => <button type="button" key={value} aria-pressed={String(value) === quantity} onClick={() => {setQuantity(String(value));}}>{value} {symbol}</button>)}
        </div>
        {ckbWell}
      </div>
      <div className="preview-ticket-details">
        {balance !== null && <p>{zh ? '已验证可交易余额' : 'Verified CKB available to trade'} <strong>{formatCkb(balance)} CKB</strong></p>}
        {holdings !== null && <p>{zh ? '已验证托管余额' : 'Verified custody balance'} <strong>{holdings.toString()} {symbol}</strong></p>}
        <p>{zh ? '当前单价' : 'Current unit price'} <strong>{unitPrice === null ? '—' : formatCkb(unitPrice) + unit}</strong></p>
        <p>{zh ? '平均成交价' : 'Average execution price'} <strong>{amount === null || count === null ? '—' : formatCkb((amount + count / 2n) / count) + unit}</strong></p>
        <p>{zh ? '价格影响' : 'Price impact'} <strong>{impact === null ? '—' : impact.toLocaleString(zh ? 'zh-CN' : 'en', {maximumFractionDigits: 2}) + '%'}</strong></p>
        {amount !== null && <>
          <p>{zh ? '网络费用' : 'Network fee'} <strong>{formatCkb(PUDGE_TRADE_FEE)} CKB</strong></p>
          <p className="preview-total">{buying ? (zh ? '应付总额' : 'Total to pay') : (zh ? '扣费后收入' : 'Net proceeds')} <strong>{formatCkb(buying ? amount + PUDGE_TRADE_FEE : amount > PUDGE_TRADE_FEE ? amount - PUDGE_TRADE_FEE : 0n)} CKB</strong></p>
          <details className="preview-funding">
            <summary>{zh ? '钱包资金要求' : 'Wallet funding requirements'}</summary>
            <p>{zh ? '最低合格资金 Cell 容量' : 'Minimum eligible funding Cell capacity'} <strong>{formatCkb((buying ? amount : 0n) + PUDGE_TRADE_CHANGE_CAPACITY + PUDGE_TRADE_FEE)} CKB</strong></p>
            <p>{zh ? '返还给钱包的找零容量' : 'Change capacity returned to wallet'} <strong>{formatCkb(PUDGE_TRADE_CHANGE_CAPACITY)} CKB</strong></p>
            <p>{zh ? '需要一个合格的 CKB Cell。' : 'One eligible CKB Cell is required.'}</p>
          </details>
        </>}
      </div>
      {highImpact && <div role="status" className="preview-impact-warning">
        <strong>{zh ? '价格影响较高' : 'High price impact'}</strong>
        <p>{zh ? '交易数量越大，成交价格沿曲线变化越多。此笔交易的平均成交价与当前单价相差至少 10%。' : 'This trade size moves along the curve. Its average execution price differs from the current unit price by at least 10%.'}</p>
      </div>}
      {market && quantity && amount === null && <p role="status" className="preview-note">{zh ? '该数量无法报价。请输入可用范围内的整数。' : 'Quote unavailable. Enter a whole quantity within market limits.'}</p>}
      <button type="button" className="preview-action" disabled={disabled} onClick={submit}>{action}</button>
      {children}
    </section>
  );
}

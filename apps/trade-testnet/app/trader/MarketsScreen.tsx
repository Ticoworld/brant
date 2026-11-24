"use client";

import Link from 'next/link';
import localFont from 'next/font/local';
import {useEffect, useState} from 'react';
import {useLocale} from '../i18n-provider';
import {copy} from './copy';
import {formatCkb} from './rpc';
import TraderShell from './shell';
import type {MarketData} from './types';
import {useMarketData} from './use-market-data';
import './markets.css';

const geist = localFont({src:'../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2',weight:'100 900'});

export default function MarketsScreen() {
  const query = useMarketData('pudge-xudt');
  const [catalog, setCatalog] = useState<CatalogMarket[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState(false);

  async function loadCatalog(after?: string, signal?: AbortSignal) {
    try {
      const response = await fetch('/api/markets/catalog' + (after ? '?after=' + after : ''), {signal});
      if (!response.ok) throw Error('Catalog unavailable');
      const page = await response.json();
      setCatalog(current => after ? [...current, ...page.markets] : page.markets);
      setCursor(page.next);
      setCatalogError(false);
    } catch {
      if (!signal?.aborted) setCatalogError(true);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void loadCatalog(undefined, controller.signal);
    return () => controller.abort();
  }, []);

  return <MarketsListing markets={query.data ? [query.data] : []} catalog={catalog} {...query}
    refresh={async () => {await Promise.all([query.refreshDisplay(), loadCatalog()]);}}
    catalogError={catalogError} loadMore={cursor ? () => void loadCatalog(cursor) : undefined}/>;
}

type CatalogMarket = {market: string; metadata: {name: string; ticker: string}; logo: string | null};


export function MarketsListing({markets, loading=false, error='', displayOnly=false, refresh, catalog=[], catalogError=false, loadMore}: {
  markets: MarketData[];
  catalog?: CatalogMarket[];
  catalogError?: boolean;
  loadMore?: () => void;
  loading?: boolean;
  error?: string;
  displayOnly?: boolean;
  refresh?: () => Promise<void>;
}) {
  const {locale} = useLocale();
  const zh = locale === 'zh-CN';
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const term = markets.length + catalog.length > 1 ? search.trim().toLowerCase() : '';
  const shown = markets.filter(({token, pair}) => [token.name, token.symbol, pair].some(value => value.toLowerCase().includes(term)));
  const labels = zh
    ? ['买入价格', '卖出价格', '可用曲线储备', '可用库存']
    : ['Buy price', 'Sell price', 'Spendable curve reserve', 'Available inventory'];
  const refreshListing = async () => {
    setRefreshing(true);
    try { await refresh?.(); } finally { setRefreshing(false); }
  };

  return <TraderShell wide>
    <div className={`market-discovery ${geist.className}`}>
      <header className="discovery-heading">
        <div>
          <h1>{copy(locale,'markets')}</h1>
          <p>{markets.length + catalog.length === 0 && (loading || error) ? (zh ? '市场数量未知' : 'Market count unavailable') : <>{(markets.length + catalog.length).toLocaleString(locale)} {zh ? '个已列出市场' : markets.length + catalog.length === 1 ? 'listed market' : 'listed markets'}</>}</p>
        </div>
        <div className="discovery-controls">
          {markets.length + catalog.length > 1 && <label>{copy(locale,'search')}
            <input type="search" value={search} onChange={event => setSearch(event.target.value)}/>
          </label>}
          {refresh && <button type="button" disabled={loading || refreshing} onClick={() => void refreshListing()}>
            {refreshing ? (zh ? '正在刷新…' : 'Refreshing…') : error ? copy(locale,'retry') : copy(locale,'reload')}
          </button>}
        </div>
      </header>
      <section className="discovery-list" aria-label={zh ? '市场列表' : 'Market listings'} aria-busy={loading || refreshing}>
        {shown.length > 0 && <div className="discovery-columns" aria-hidden="true">
          <span>{zh ? '市场' : 'Market'}</span>{labels.map(label => <span key={label}>{label}</span>)}<span/>
        </div>}
        {catalog.filter(({metadata}) => [metadata.name, metadata.ticker].some(value => value.toLowerCase().includes(term))).map(({market, metadata, logo}) =>
          <article key={market} className="discovery-market">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo && <img src={logo} alt="" width={40} height={40}/>}
              <div><h2>{metadata.ticker} / CKB</h2><p>{metadata.name}</p></div>
            </div>
            <Link href={'/market/' + market}>{zh ? '查看市场' : 'View market'}</Link>
          </article>)}
        {loadMore && <button type="button" onClick={loadMore}>{zh ? '加载更多' : 'Load more'}</button>}
        {catalogError && <p role="status">{zh ? '代币目录暂不可用' : 'Token catalog unavailable'}</p>}
        {shown.map(market => {
          const values = [
            market.inventory === '0' ? '—' : formatCkb(market.buyOneShannons),
            market.curve.sold === '0' ? '—' : formatCkb(market.sellOneShannons),
            formatCkb(market.reserveShannons),
            BigInt(market.inventory).toLocaleString(locale),
          ];
          const date = new Date(market.refreshedAt);
          const checkpoint = displayOnly || market.historyState !== 'verified';
          return <article key={market.id} className="discovery-market">
            <div className="discovery-row">
              <div className="discovery-identity">
                <span aria-hidden="true" className="discovery-token">{market.token.symbol.slice(0,1)}</span>
                <div><h2>{market.pair}</h2><p>{market.token.name}</p></div>
              </div>
              {labels.map((label,index) => <dl key={label} className="discovery-metric" data-index={index}>
                <dt>{label}</dt><dd>{values[index]} <small>{index < 2 ? 'CKB/' + market.token.symbol : index === 3 ? market.token.symbol : 'CKB'}</small></dd>
              </dl>)}
              <Link className="discovery-trade" href={'/market/'+market.id}>{copy(locale,'trade')} <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="discovery-provenance">
              <span>{checkpoint ? (zh ? '市场检查点' : 'Market checkpoint') : (zh ? '成交历史已验证' : 'History verified')} · {zh ? '读取时间' : 'Market read'} <time dateTime={date.toISOString()}>{date.toLocaleString(locale,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></span>
              <details>
                <summary>{zh ? '市场来源' : 'Market provenance'}</summary>
                <p>{zh ? '登记显示名称' : 'Registry display name'} · {market.token.name}</p>
                <p>{zh ? '代币类型哈希' : 'Token type hash'} <code>{market.token.typeHash}</code></p>
                <p>{zh ? '快照区块' : 'Snapshot block'} {BigInt(market.tip.number).toLocaleString(locale)}</p>
                {checkpoint && <p>{zh ? '此快照未验证链上成交历史。' : 'Canonical trading history is unavailable in this snapshot.'}</p>}
              </details>
            </div>
          </article>;
        })}
        {shown.length === 0 && catalog.length === 0 && <p className="discovery-empty" role="status">
          {loading ? copy(locale,'loading') : error ? copy(locale,'unavailable') : term ? (zh ? '没有符合搜索条件的市场' : 'No markets match your search') : (zh ? '暂无已列出市场' : 'No listed markets')}
        </p>}
      </section>
      {error && markets.length > 0 && <p className="discovery-error" role="status">
        {zh ? '刷新失败。正在显示之前的市场快照。' : 'Refresh failed. Showing the previous market snapshot.'}
      </p>}
    </div>
  </TraderShell>;
}

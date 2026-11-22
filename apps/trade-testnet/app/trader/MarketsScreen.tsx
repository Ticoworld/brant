"use client";

import Link from 'next/link';
import localFont from 'next/font/local';
import {useState} from 'react';
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
  return <MarketsListing markets={query.data ? [query.data] : []} {...query}/>;
}

export function MarketsListing({markets, loading=false, error='', displayOnly=false, refresh}: {
  markets: MarketData[];
  loading?: boolean;
  error?: string;
  displayOnly?: boolean;
  refresh?: () => Promise<void>;
}) {
  const {locale} = useLocale();
  const zh = locale === 'zh-CN';
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const term = markets.length > 1 ? search.trim().toLowerCase() : '';
  const shown = markets.filter(({token, pair}) => [token.name, token.symbol, pair].some(value => value.toLowerCase().includes(term)));
  const labels = zh
    ? ['边际买入价', '边际卖出价', '可用曲线储备', '可用库存']
    : ['Marginal Buy', 'Marginal Sell', 'Spendable curve reserve', 'Available inventory'];
  const refreshListing = async () => {
    setRefreshing(true);
    try { await refresh?.(); } finally { setRefreshing(false); }
  };

  return <TraderShell wide>
    <div className={`market-discovery ${geist.className}`}>
      <header className="discovery-heading">
        <div>
          <h1>{copy(locale,'markets')}</h1>
          <p>{markets.length.toLocaleString(locale)} {zh ? '个已列出市场' : markets.length === 1 ? 'listed market' : 'listed markets'}</p>
        </div>
        <div className="discovery-controls">
          {markets.length > 1 && <label>{copy(locale,'search')}
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
                <dt>{label}</dt><dd>{values[index]} <small>{index === 3 ? market.token.symbol : 'CKB'}</small></dd>
              </dl>)}
              <Link className="discovery-trade" href={'/market/'+market.id}>{copy(locale,'trade')} <span aria-hidden="true">↗</span></Link>
            </div>
            <div className="discovery-provenance">
              <span>{checkpoint ? (zh ? '市场检查点' : 'Market checkpoint') : (zh ? '链上已验证' : 'Chain verified')} · <time dateTime={date.toISOString()}>{date.toLocaleString(locale,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</time></span>
              <details>
                <summary>{zh ? '市场来源' : 'Market provenance'}</summary>
                <p>{zh ? '登记显示名称' : 'Registry display name'} · {market.token.name}</p>
                <p>{zh ? '代币类型哈希' : 'Token type hash'} <code>{market.token.typeHash}</code></p>
                <p>{zh ? '已验证区块' : 'Verified block'} {BigInt(market.tip.number).toLocaleString(locale)}</p>
                {checkpoint && <p>{zh ? '打开交易页面以验证成交历史。' : 'Open Trade to verify canonical trading history.'}</p>}
              </details>
            </div>
          </article>;
        })}
        {shown.length === 0 && <p className="discovery-empty" role="status">
          {loading ? copy(locale,'loading') : error ? copy(locale,'unavailable') : term ? copy(locale,'searchEmpty') : (zh ? '暂无已列出市场' : 'No listed markets')}
        </p>}
      </section>
      {error && markets.length > 0 && <p className="discovery-error" role="status">
        {zh ? '刷新失败，继续显示上次验证的数据。' : 'Refresh failed. Showing last verified data.'}
      </p>}
    </div>
  </TraderShell>;
}

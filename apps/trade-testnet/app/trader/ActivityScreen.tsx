"use client";

import Link from 'next/link';
import localFont from 'next/font/local';
import {useEffect,useMemo,useState} from 'react';
import {useLocale} from '../i18n-provider';
import {transactionStatus} from '../../lib/r7-transaction-status';
import {activityRows,averageShannons,readActivityAttempts,type Filter,type LocalAttempt,type Scope} from './activity-data';
import {useAccount} from './account-provider';
import {copy} from './copy';
import {formatCkb,PUDGE_GENESIS,pudgeRpc} from './rpc';
import TraderShell from './shell';
import {useMarketSelection} from './use-market-selection';
import {useMarketData} from './use-market-data';
import './activity.css';

const geist=localFont({src:'../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2',weight:'100 900'});
const explorer=(hash:string)=>'https://pudge.explorer.nervos.org/transaction/'+hash;

export function ActivityScreen(){
  const {locale}=useLocale();
  const zh=locale==='zh-CN';
  const t=(en:string,cn:string)=>zh?cn:en;
  const account=useAccount();
  const selection=useMarketSelection();
  const query=useMarketData(selection.id,true);
  const market=query.data;
  const owner=account.state==='ready'&&market?.genesis.toLowerCase()===PUDGE_GENESIS?account.owner.toLowerCase():'';
  const [selected,setSelected]=useState<Scope|null>(null);
  const [filter,setFilter]=useState<Filter>('all');
  const [refreshing,setRefreshing]=useState(false);
  const [journalRevision,setJournalRevision]=useState(0);
  const journalKey=JSON.stringify([owner,market?.genesis,market?.identity]);
  const [journals,setJournals]=useState<{key:string;records:LocalAttempt[]}>({key:'',records:[]});
  const scope=selected??(account.state==='ready'?'personal':'market');
  const history=market?.historyState==='verified'?market.history:null;
  const rows=useMemo(()=>activityRows(market,scope,owner,filter),[market,scope,owner,filter]);

  useEffect(()=>{
    if(!owner)return;
    const read=()=>setJournals({key:journalKey,records:readActivityAttempts(localStorage,PUDGE_GENESIS,owner,history??[],market?.id==='pudge-xudt'?undefined:market?.identity)});
    read();
    window.addEventListener('storage',read);
    return()=>window.removeEventListener('storage',read);
  },[owner,history,journalRevision,journalKey]);

  const attempts=journals.key===journalKey&&scope==='personal'
    ?journals.records.filter(record=>record.kind!=='trade'||!history?.some(event=>event.hash.toLowerCase()===record.hash))
    :[];
  const refresh=async()=>{
    setRefreshing(true);
    try {await query.refresh();setJournalRevision(value=>value+1);}
    finally {setRefreshing(false);}
  };
  const connectRequired=scope==='personal'&&account.state!=='ready';
  const columns=[t('Side','方向'),t('Quantity','数量'),t('CKB traded','成交金额'),t('Average price','成交均价'),t('Confirmed at','确认时间'),t('Status','状态')];
  return <TraderShell wide><div className={`activity-page ${geist.className}`}>
    <header className="activity-heading">
      <div><h1>{copy(locale,'activity')}</h1>
        <p>{scope==='personal'?t('Your Brant activity','你的 Brant 活动'):market?.pair??t('Brant market','Brant 市场')}
        {scope==='personal'&&owner&&<span title={account.address}> · {account.address.slice(0,12)}…{account.address.slice(-8)}</span>}</p></div>
      <button type="button" onClick={()=>void refresh()} disabled={refreshing||query.loading}>{refreshing?t('Refreshing…','正在刷新…'):copy(locale,'reload')}</button>
    </header>
    <div className="activity-controls">
      <label>Market <select aria-label="Activity market" value={selection.id} onChange={event=>selection.select(event.target.value)}>{selection.options.map(option=><option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      {selection.error&&<p role="status">{selection.error}</p>}
      <div className="activity-scopes" role="group" aria-label={t('Activity scope','活动范围')}>
        <button type="button" aria-pressed={scope==='personal'} onClick={()=>setSelected('personal')}>{t('My activity','我的活动')}</button>
        <button type="button" aria-pressed={scope==='market'} onClick={()=>setSelected('market')}>{t('Market trades','市场成交')}</button>
      </div>
      <label>{t('Trade type','成交类型')} <select value={filter} onChange={event=>setFilter(event.target.value as Filter)}>
        <option value="all">{t('All trades','全部成交')}</option><option value="buy">{copy(locale,'buy')}</option><option value="sell">{copy(locale,'sell')}</option>
      </select></label>
    </div>
    {attempts.length>0&&<section className="activity-surface activity-local" aria-label={t('Local transactions','本地交易')}>
      <h2>{t('Transactions to check','待核查的交易')}</h2>
      {attempts.map(attempt=><AttemptRow key={owner+attempt.kind+attempt.hash} attempt={attempt} marketId={market?.id??'pudge-xudt'}/>)}
    </section>}
    <section className="activity-surface" aria-label={t('Trade history','已验证成交')} aria-busy={refreshing||query.loading}>
      {connectRequired ? <div className="activity-empty"><p>{t('Connect a verified Pudge wallet to see your Brant activity.','连接已验证的 Pudge 钱包以查看你的 Brant 活动。')}</p>
        <button type="button" onClick={account.connect} disabled={account.state==='checking'||account.state==='connecting'}>{copy(locale,'connect')}</button></div>
      : !rows||scope==='personal'&&!owner ? <p className="activity-empty" role="status">{query.loading?t('Loading trades…','正在加载链上成交历史…'):t('Trade history unavailable','成交历史暂不可用')}</p>
      : <>
        {market&&<p className="activity-freshness" role="status">{query.error?t('Refresh failed · Last verified','刷新失败 · 上次验证'):t('Last verified','上次验证')} · <time dateTime={new Date(market.refreshedAt).toISOString()}>{new Date(market.refreshedAt).toLocaleString(locale)}</time></p>}
        {rows.length>0 ? <>
          <div className="activity-row activity-columns" aria-hidden="true">{columns.map(label=><span key={label}>{label}</span>)}<span/></div>
          {rows.map(event=>{
            const date=new Date(Number(event.timestampMs));
            const symbol=market?.token.symbol;
            return <details key={event.hash+':'+(event.executionIndex??0)} className="activity-trade">
              <summary className="activity-row">
                <strong data-side={event.side}>{copy(locale,event.side)}</strong>
                <strong>{BigInt(event.quantity).toLocaleString(locale)} {symbol}</strong>
                <strong>{formatCkb(event.amountShannons)} CKB</strong>
                <span>{formatCkb(averageShannons(event))} CKB/{symbol}</span>
                <time dateTime={date.toISOString()}>{date.toLocaleString(locale,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</time>
                <span className="activity-confirmed">{copy(locale,'confirmed')}</span>
                <span className="activity-chevron" aria-label={t('Transaction details','交易详情')}>⌄</span>
              </summary>
              <dl className="activity-details">
                <div><dt>{t('Transaction hash','交易哈希')}</dt><dd>{event.hash}</dd></div>
                <div><dt>{t('Block','区块')}</dt><dd>{BigInt(event.blockNumber).toLocaleString(locale)}</dd></div>
                <div><dt>{t('Owner lock hash','所有者锁脚本哈希')}</dt><dd>{event.owner}</dd></div>
                <div><dt>{t('Market','市场')}</dt><dd>{market?.pair}</dd></div>
                {event.executionIndex!==undefined&&<div><dt>{t('Execution index','成交序号')}</dt><dd>{event.executionIndex}</dd></div>}
                <div><dt>{t('Confirmation time','确认时间')}</dt><dd>{date.toLocaleString(locale)}</dd></div>
              </dl>
              <a className="activity-explorer" href={explorer(event.hash)} target="_blank" rel="noreferrer">{t('View on explorer','在浏览器中查看')} ↗</a>
            </details>;
          })}
        </>:<p className="activity-empty">{filter==='all'||!activityRows(market,scope,owner,'all')?.length?t('No trades yet','暂无成交'):t('No trades match this filter','没有符合筛选条件的成交')}</p>}
      </>}
    </section>
  </div></TraderShell>;
}

function AttemptRow({attempt,marketId}:{attempt:LocalAttempt;marketId:string}){
  const {locale}=useLocale();
  const zh=locale==='zh-CN';
  const [status,setStatus]=useState<'unknown'|'pending'|'committed'|'rejected'|'checking'>('unknown');
  const check=async()=>{
    setStatus('checking');
    try {setStatus(transactionStatus(await pudgeRpc('get_transaction',[attempt.hash])));}
    catch {setStatus('unknown');}
  };
  const trade=attempt.kind==='trade';
  const labels={
    unknown:zh?'提交状态未知':'Submission status unknown',
    pending:copy(locale,'pending'),
    committed:zh?'等待核实确认':'Confirming',
    rejected:zh?'节点已拒绝':'Rejected by node',
    checking:zh?'正在检查状态':'Checking status',
  };
  return <article className="activity-attempt">
    <div><strong>{trade?(zh?'交易':'Trade'):(zh?'提取':'Withdrawal')}</strong><p role="status">{labels[status]}</p></div>
    <a href={explorer(attempt.hash)} target="_blank" rel="noreferrer" title={attempt.hash}>{attempt.hash.slice(0,12)}…{attempt.hash.slice(-8)} ↗</a>
    <button type="button" onClick={()=>void check()} disabled={status==='checking'}>{zh?'检查状态':'Check status'}</button>
    <Link href={trade?'/market/'+marketId:'/portfolio'}>{trade?(zh?'在交易页面处理':'Manage in Trade'):(zh?'在资产页面处理':'Reconcile in Portfolio')}</Link>
  </article>;
}

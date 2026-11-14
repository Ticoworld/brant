'use client';
import {useEffect,useRef,useState} from 'react';
import {useCcc,useSigner} from '@ckb-ccc/connector-react';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {loadPudgeManifest,PUDGE_MARKET_KEY} from '../../lib/v2-engine/pudge-manifest.ts';
import {verifyPudgeInitialProof} from '../../lib/v2-engine/pudge-proof-client.ts';
import {prepareLocalReview} from '../../lib/v2-engine/local-review.ts';
import {discoverCustodyPair,discoverMarketPair} from '../../lib/v2-engine/lineage.ts';
import {readLiveSingletons} from '../../lib/v2-engine/live.ts';
import {verifyInitializationSignature} from '../../lib/v2-engine/initialization-signature.ts';
import {quote} from '../../lib/v2-engine/curve.ts';
import {makeTradeAttempt,parseTradeAttempt,reconcilePudgeTrade,tradeKey} from '../../lib/v2-engine/pudge-trade-journal.ts';
import {useLocale} from '../i18n-provider';
import Navigation from './navigation';

const genesis='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
type Side='buy'|'sell';
const clone=(tx:ccc.Transaction)=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(cccA.JsonRpcTransformers.transactionFrom(tx)));
const ckb=(n:bigint)=>`${n/100_000_000n}.${(n%100_000_000n).toString().padStart(8,'0')} CKB`;

export default function PudgeMarket(){
 const {t}=useLocale();
 const connector=useCcc(),connectedSigner=useSigner(),[testSigner,setTestSigner]=useState<typeof connectedSigner>(undefined);
 const signer=process.env.NODE_ENV!=='production'&&process.env.NEXT_PUBLIC_PUDGE_TEST_HOOK==='1'?testSigner||connectedSigner:connectedSigner,active=useRef(signer);active.current=signer;
 useEffect(()=>{if(process.env.NODE_ENV==='production'||process.env.NEXT_PUBLIC_PUDGE_TEST_HOOK!=='1'||!['127.0.0.1','localhost','[::1]'].includes(window.location.hostname))return;const w=window as unknown as {rovPudgeTestConnect?:(s:typeof connectedSigner)=>void};w.rovPudgeTestConnect=setTestSigner;return()=>{delete w.rovPudgeTestConnect;};},[]);
 const [address,setAddress]=useState(''),[message,setMessage]=useState('Connect a wallet and verify the market.'),[side,setSide]=useState<Side>('buy'),[quantity,setQuantity]=useState(''),[review,setReview]=useState<(Awaited<ReturnType<typeof prepareLocalReview>>&{owner:string;side:Side;quantity:bigint})|null>(null),[approved,setApproved]=useState(false),[signedReady,setSignedReady]=useState(false),[pending,setPending]=useState(false),[backup,setBackup]=useState(''),[savedAttempt,setSavedAttempt]=useState('');
 const [market,setMarket]=useState<Awaited<ReturnType<typeof readLiveSingletons>>|null>(null),signed=useRef<ccc.Transaction|null>(null),revision=useRef(0);
 const marginal=(side:Side)=>{if(!market)return '—';try{return ckb(quote(market.curve,side,1n));}catch{return '—';}};
 const rpc=async(method:string,params:unknown[])=>{const response=await fetch('/api/v2/pudge-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,params})});const body=await response.json();if(!response.ok)throw Error(body.error||'Pudge RPC failed');return body.result;};
 const initialProof=verifyPudgeInitialProof;
 const config=async()=>{const raw=localStorage.getItem(PUDGE_MARKET_KEY);if(!raw)throw Error('No verified Pudge market manifest; complete or restore deployment first');return loadPudgeManifest(rpc,raw,initialProof);};
 async function wallet(){const current=active.current;if(!current||!await current.isConnected())throw Error('Connect a Pudge wallet');const a=await current.getRecommendedAddressObj();if((await current.client.getHeaderByNumber(0))?.hash!==genesis||await rpc('get_block_hash',['0x0'])!==genesis||active.current!==current)throw Error('Wallet account or network changed');return {current,address:a,owner:a.script.hash()};}
 async function refresh(){try{
  const w=await wallet(),manifest=await config(),response=await fetch('/api/v2/pudge-proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({manifest,owner:w.owner,side:'buy',quantity:'1'})});if(!response.ok)throw Error('Canonical market proof unavailable');const result=await response.json(),proof=result.proof;
  if(result.genesis!==genesis||!proof?.tip_outpoint)throw Error('Market proof identity mismatch');
  const [m,c]=await Promise.all([discoverMarketPair(rpc,[manifest.initial[0],manifest.initial[1]]),discoverCustodyPair(rpc,proof.tip_outpoint)]),live=await readLiveSingletons(rpc,[...m,...c],genesis);
  const script=(s:{code_hash:string;hash_type:string;args:string})=>ccc.Script.from({codeHash:s.code_hash,hashType:s.hash_type as ccc.HashType,args:s.args});
  const locks=[manifest.scripts.market,manifest.scripts.market,manifest.scripts.custody,manifest.scripts.custody],types=[manifest.scripts.token,manifest.scripts.marker,manifest.scripts.token,manifest.scripts.custodyMarker];
  if(live.cells.some((c,i)=>script(c.output.lock).hash()!==locks[i].hash()||!c.output.type||script(c.output.type as {code_hash:string;hash_type:string;args:string}).hash()!==types[i].hash())||live.custodyRoot.toLowerCase()!==proof.old_root.toLowerCase())throw Error('Market identity or proof root changed');
  if(active.current!==w.current)throw Error('Wallet changed');setMarket(live);setAddress(w.address.toString());const raw=localStorage.getItem(tradeKey(genesis,w.owner));setSavedAttempt(raw||'');setPending(!!raw);setMessage(raw?'A trade attempt requires reconciliation.':'Verified Pudge market loaded.');
 }catch(e){setMarket(null);setMessage(e instanceof Error?e.message:'Market unavailable');}}
 useEffect(()=>{if(!signer){setAddress('');setMarket(null);return;}let cancelled=false;(async()=>{try{const a=await signer.getRecommendedAddressObj();if(!cancelled){setAddress(a.toString());const raw=localStorage.getItem(tradeKey(genesis,a.script.hash()));setPending(!!raw);setSavedAttempt(raw||'');}}catch{if(!cancelled)setAddress('');}})();return()=>{cancelled=true;};},[signer]);
 async function prepareInternal(s:Side,q:bigint){const w=await wallet(),manifest=await config();if(localStorage.getItem(tradeKey(genesis,w.owner))!==null)throw Error('A previous trade requires reconciliation');const next=await prepareLocalReview(rpc,manifest,w.owner,s,q,w.address.script);if(active.current!==w.current||!await w.current.isConnected()||(await w.current.getRecommendedAddressObj()).script.hash().toLowerCase()!==w.owner.toLowerCase()||(await w.current.client.getHeaderByNumber(0))?.hash!==genesis||await rpc('get_block_hash',['0x0'])!==genesis||localStorage.getItem(tradeKey(genesis,w.owner))!==null)throw Error('Wallet, network or trade attempt changed');return {...next,owner:w.owner,side:s,quantity:q};}
 async function prepare(){try{signed.current=null;setSignedReady(false);setApproved(false);setReview(null);if(!/^[1-9][0-9]*$/.test(quantity))throw Error('Enter a positive token quantity');setMessage('Reconstructing canonical market proof…');const currentRevision=revision.current,next=await prepareInternal(side,BigInt(quantity));if(revision.current!==currentRevision)throw Error('Trade terms changed; review again');setReview(next);setMarket(next.live);setMessage('Review the transaction before requesting a wallet signature.');}catch(e){setMessage(e instanceof Error?e.message:'Trade preparation failed');}}
 async function fresh(){if(!review)throw Error('Prepare a review first');const next=await prepareInternal(review.side,review.quantity);if(next.owner.toLowerCase()!==review.owner.toLowerCase()||next.transaction.hash()!==review.transaction.hash()||next.transaction.witnesses.length!==review.transaction.witnesses.length||next.transaction.witnesses.some((w,i)=>w.toLowerCase()!==review.transaction.witnesses[i].toLowerCase()))throw Error('Market, funding or proof changed; review again');}
 async function sign(){try{signed.current=null;setSignedReady(false);if(!review||!approved||!active.current)throw Error('Review the transaction first');await fresh();const tx=await active.current!.signTransaction(clone(review.transaction));verifyInitializationSignature(review.transaction,tx,review.inputs.map(c=>({lock:ccc.Script.from(c.lock as ccc.ScriptLike)})),4,review.owner);await fresh();signed.current=tx;setSignedReady(true);setMessage('Wallet signature verified. The trade has not been broadcast.');}catch(e){setMessage(e instanceof Error?e.message:'Wallet signature failed');}}
 async function broadcast(){try{if(!navigator.locks)throw Error('Exclusive trade lock unavailable');if(!review)throw Error('Prepare a trade first');await navigator.locks.request(`roveko-pudge-trade-${review.owner.toLowerCase()}`,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock||!signed.current||!active.current||!approved)throw Error('Signed review or lock unavailable');await fresh();verifyInitializationSignature(review.transaction,signed.current,review.inputs.map(c=>({lock:ccc.Script.from(c.lock as ccc.ScriptLike)})),4,review.owner);const key=tradeKey(genesis,review.owner);if(localStorage.getItem(key)!==null)throw Error('A previous trade requires reconciliation');const tx=signed.current,record=makeTradeAttempt(genesis,review.owner,tx);localStorage.setItem(key,JSON.stringify(record));setSavedAttempt(JSON.stringify(record));setPending(true);signed.current=null;setSignedReady(false);const hash=await active.current.client.sendTransaction(tx);if(hash.toLowerCase()!==record.txHash.toLowerCase())throw Error('Unexpected submission hash; reconcile before retry');setReview(null);setMessage(`Submitted ${hash}; reconcile before another trade.`);});}catch(e){signed.current=null;setSignedReady(false);setMessage(e instanceof Error?e.message:'Submission outcome unknown; reconcile before retry');}}
 async function reconcile(){try{const w=await wallet();if(!navigator.locks)throw Error('Exclusive trade lock unavailable');await navigator.locks.request(`roveko-pudge-trade-${w.owner.toLowerCase()}`,{mode:'exclusive',ifAvailable:true},async lock=>{if(!lock)throw Error('Another trade action is in progress');const key=tradeKey(genesis,w.owner),raw=localStorage.getItem(key);if(!raw)throw Error('No saved trade attempt');const attempt=parseTradeAttempt(raw),manifest=await config();if(attempt.owner.toLowerCase()!==w.owner.toLowerCase())throw Error('Trade belongs to another wallet');const checked=await reconcilePudgeTrade(rpc,attempt,manifest);if(active.current!==w.current||localStorage.getItem(key)!==raw)throw Error('Wallet or trade record changed');localStorage.removeItem(key);setPending(false);setSavedAttempt('');setReview(null);setMessage(`Confirmed ${checked.hash}; refreshing market state.`);});await refresh();}catch(e){setMessage(e instanceof Error?e.message:'Trade reconciliation failed');}}
 async function restore(){try{const w=await wallet(),attempt=parseTradeAttempt(backup);if(attempt.genesis!==genesis||attempt.owner.toLowerCase()!==w.owner.toLowerCase())throw Error('Backup belongs to another wallet or network');if(!navigator.locks)throw Error('Exclusive trade lock unavailable');await navigator.locks.request(`roveko-pudge-trade-${w.owner.toLowerCase()}`,{ifAvailable:true},lock=>{if(!lock||active.current!==w.current)throw Error('Wallet changed or another trade action is in progress');const key=tradeKey(genesis,w.owner);if(localStorage.getItem(key)!==null)throw Error('Existing trade requires reconciliation');const raw=JSON.stringify(attempt);localStorage.setItem(key,raw);setSavedAttempt(raw);setPending(true);setBackup('');setMessage('Trade backup restored. Reconcile against Pudge before continuing.');});}catch(e){setMessage(e instanceof Error?e.message:'Backup restore failed');}}
 function resetReview(){revision.current++;setReview(null);setApproved(false);signed.current=null;setSignedReady(false);}
 return (
  <main className="min-h-screen bg-[#0c1210] text-[#eef2ec] [font-family:'Segoe_UI',Arial,sans-serif]">
   <Navigation active="/v2" />
   <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-6 px-5 py-8 md:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] md:gap-12 md:px-8 md:py-12">
    <section className="min-w-0">
     <p className="text-[11px] font-semibold tracking-widest text-[#9ebbad]">{t('pudgeTestnet')} / V2</p>
     <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-4xl">{t('marketTerminal')}</h1>
     <p className="mt-2 max-w-xl text-sm leading-6 text-[#b5c1b9]">{t('marketUnavailableDetail')}</p>
     <button className="mt-5" onClick={refresh} disabled={!signer}>{t('verifyMarketFirst')}</button>
     <div className="mt-6 flex items-center gap-2 border-y border-[#2d3a35] py-3 text-sm"><i className="size-2 rounded-full bg-[#e2bb71]"/><span className="text-[#d8e1db]">{t('marketUnavailableTitle')}</span><span className="text-[#839289]">·</span><span className="text-[#a5b1a8]">{t('deploymentUnverified')}</span></div>
     <dl className="mt-5 grid grid-cols-3 border-y border-[#2d3a35]">
      {[[t('marketCapacity'),market?ckb(BigInt(market.cells[0].output.capacity)):'—'],[t('curveInventory'),market?.curve.inventory.toString()||'—'],[t('internalCirculation'),market?.custodyAmount.toString()||'—']].map(([label,value])=><div className="min-w-0 border-r border-[#2d3a35] py-4 pr-2 last:border-r-0 sm:px-4" key={label}><dt className="text-[10px] uppercase tracking-wider text-[#9ebbad] sm:text-xs">{label}</dt><dd className="mt-2 break-words text-lg font-semibold tabular-nums">{value}</dd></div>)}
     </dl>
     <dl className="grid grid-cols-2 border-b border-[#2d3a35]">
      {[[t('marginalBuyPrice'),marginal('buy')],[t('marginalSellPrice'),marginal('sell')],[t('available'),review?review.ownerBalance.toString():'—'],[t('status'),market?t('deploymentConfigured'):t('deploymentUnverified')]].map(([label,value])=><div className="min-w-0 border-r border-[#2d3a35] py-3 pr-2 last:border-r-0 sm:px-4" key={label}><dt className="text-[10px] uppercase tracking-wider text-[#9ebbad] sm:text-xs">{label}</dt><dd className="mt-1.5 break-words text-sm font-medium tabular-nums">{value}</dd></div>)}
     </dl>
     <p className="mt-4 text-sm text-[#a5b1a8]" role="status">{message==='Connect a wallet and verify the market.'?t('connectVerifyMarket'):message}</p>
     <a className="mt-2 inline-block text-sm text-[#72dfb0] underline underline-offset-4" href="/v2/deploy">{t('deployment')} / {t('independentRecovery')}</a>
    </section>
    <aside className="min-w-0 rounded-md border border-[#34443c] bg-[#151e1a] p-4 md:p-5">
     <div className="mb-5 grid grid-cols-2 gap-1 rounded-md bg-[#0e1512] p-1">
      <button className={side==='buy'?'!border-[#72dfb0] !bg-[#72dfb0] !text-[#10231a]':'!text-[#a5b1a8]'} onClick={()=>{resetReview();setSide('buy');}}>{t('buyOnCurve')}</button>
      <button className={side==='sell'?'!border-[#f08e89] !bg-[#f08e89] !text-[#301615]':'!text-[#a5b1a8]'} onClick={()=>{resetReview();setSide('sell');}}>{t('sellBack')}</button>
     </div>
     <label className="mb-2 block text-sm text-[#cbd5ce]" htmlFor="pudge-quantity">{t('tokenQuantity')}</label>
     <div className="flex min-h-16 items-center gap-3 rounded-md border border-[#3b4b43] bg-[#0e1512] px-3 focus-within:border-[#72dfb0]">
      <input className="min-w-0 flex-1 border-0 bg-transparent text-2xl tabular-nums outline-none" id="pudge-quantity" inputMode="numeric" value={quantity} onChange={e=>{resetReview();setQuantity(e.target.value.replace(/[^0-9]/g,''));}}/>
      <span className="text-xs text-[#a5b1a8]">{t('token')}</span>
     </div>
     <button className="mt-3 w-full" onClick={prepare} disabled={!signer||!market||pending}>{market?t('prepareTradeReview'):t('tradeUnavailable')}</button>
     {review&&<div className="mt-4 space-y-3 border-t border-[#2d3a35] pt-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><dt className="text-[#a5b1a8]">{t('available')}</dt><dd className="text-right tabular-nums">{review.ownerBalance.toString()}</dd><dt className="text-[#a5b1a8]">{review.side==='buy'?t('totalCost'):t('grossPayout')}</dt><dd className="text-right tabular-nums">{ckb(review.amount)}</dd><dt className="text-[#a5b1a8]">{t('exactFee')}</dt><dd className="text-right tabular-nums">{ckb(review.fee)}</dd></dl>
      <p className="break-all text-xs text-[#a5b1a8]">{t('transaction')}: {review.transaction.hash()}</p>
      <details className="text-sm text-[#a5b1a8]"><summary className="cursor-pointer">{t('advancedDetails')}</summary><ul aria-label={t('reviewTransaction')} className="mt-2 space-y-1 break-all text-xs">{review.transaction.outputs.map((o,i)=><li key={i}>Output {i} · {o.capacity.toString()} shannons · lock {o.lock.hash()} · type {o.type?.hash()||'none'} · data {review.transaction.outputsData[i]}</li>)}</ul><pre className="mt-2 max-h-72 overflow-auto rounded border border-[#34443c] bg-[#0c1210] p-3 text-xs">{JSON.stringify(review.transaction,(_,v)=>typeof v==='bigint'?v.toString():v,2)}</pre></details>
      <label className="flex items-start gap-2 text-sm text-[#cbd5ce]"><input type="checkbox" checked={approved} onChange={e=>{setApproved(e.target.checked);signed.current=null;setSignedReady(false);}}/> {t('transactionNeedsReview')}</label>
      <div className="flex flex-wrap gap-2"><button onClick={sign} disabled={!approved||pending}>{t('requestTradeSignature')}</button><button onClick={broadcast} disabled={!signedReady||!approved||pending}>{t('broadcastTrade')}</button></div>
     </div>}
     {pending&&<div className="mt-4 space-y-3 border-t border-[#2d3a35] pt-4"><p className="text-sm text-[#a5b1a8]">{t('reconcileBeforeRetry')}</p><button onClick={reconcile}>{t('reconcileTrade')}</button><label className="block text-sm">{t('exportRecoveryRecord')}<textarea className="mt-2 block w-full" readOnly rows={4} value={savedAttempt}/></label></div>}
     {!pending&&!review&&<details className="mt-4 border-t border-[#2d3a35] pt-4 text-sm text-[#a5b1a8]"><summary className="cursor-pointer">{t('restoreBackup')}</summary><textarea className="mt-3 block w-full" aria-label={t('exportRecoveryRecord')} value={backup} onChange={e=>setBackup(e.target.value)}/><button className="mt-2" onClick={restore} disabled={!backup||!signer}>{t('restoreBackup')}</button></details>}
    </aside>
   <section className="col-span-full grid gap-5 border-t border-[#2d3a35] pt-5 md:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
    <div className="min-w-0">
     <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{t('priceHistory')}</h2><span className="text-xs text-[#9eaaa2]">{market?t('verified'):t('unavailable')}</span></div>
     <div className="mt-3 grid min-h-40 place-items-center border border-[#2d3a35] bg-[#0e1512] px-5 text-center text-sm text-[#9eaaa2]">{t('priceHistoryUnavailable')}</div>
    </div>
    <div className="min-w-0">
     <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{t('activity')}</h2><a className="text-xs text-[#9ce2bf] underline underline-offset-4" href="/v2/activity">{t('activity')}</a></div>
     <p className="mt-3 min-h-40 border border-[#2d3a35] bg-[#0e1512] p-4 text-sm leading-6 text-[#9eaaa2]">{t('accountHistoryUnavailable')}</p>
    </div>
   </section>
   </div>
  </main>
 );
}

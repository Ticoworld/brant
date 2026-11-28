import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {ccc} from '@ckb-ccc/core';
import {discoverLaunchFunding} from '../lib/v2-engine/multi-funding.ts';
import {startSharedMarketApp} from './shared-market-app-runner.mjs';
export async function runSharedLaunch({rpc,genesis,hashes,deps,secp,locks,out,connectBrowserWallet,resumeMarket,priorTrades,retainedEvidence,wallets,cell,tx,sign,commit}){
 if(process.env.BRANT_WO4_FUNDING_ONLY==='1'){
  assert.notEqual(genesis,'0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606');
  const measure=async(walletCells)=>{const counts={},start=performance.now();const counted=async(method,params)=>{counts[method]=(counts[method]||0)+1;return rpc(method,params);};const selected=await discoverLaunchFunding(counted,ccc.Script.from(locks[2]),145201000000n);assert.equal(selected.length,1);assert.equal(counts.get_live_cell,1);return {walletCells,selectedInputs:selected.length,rpc:counts,ms:performance.now()-start,scope:'real isolated CKB; not public latency'};};
  const small=await measure(1),U=100000000n,fee=1000000n;
  const outputs=Array.from({length:100},()=>cell(61n*U,locks[2]));outputs.push(cell(wallets[2].capacity-6100n*U-fee,locks[2]));
  await commit('wo4-large-wallet-funding-fixture',sign(tx([wallets[2]],outputs),[wallets[2]],[2]));
  const tip=await rpc('get_tip_header');for(let attempt=0;attempt<100;attempt++){if(BigInt((await rpc('get_indexer_tip')).block_number)>=BigInt(tip.number))break;await delay(100);}
  const large=await measure(101);writeFileSync(join(out,'wo4-funding-measurements.json'),JSON.stringify({small,large},null,2));return;
 }
 const fixture={};for(const [name,key]of Object.entries({market:'market_smt',marker:'marker_candidate',custody:'custody_smt',custodyMarker:'custody_marker',ownerLock:'atomic_initializer',xudt:'xudt'}))fixture[name]={...deps[key],dataHash:hashes[key]};
 const secpCell=await rpc('get_live_cell',[{tx_hash:secp.outPoint.txHash,index:secp.outPoint.index},true]);fixture.secp={...secp,dataHash:ccc.hashCkb(secpCell.cell.data.content)};
 const appRoot=fileURLToPath(new URL('..',import.meta.url)),require=createRequire(import.meta.url),webpack=require('next/dist/compiled/webpack/webpack').webpack;
 const entry=join(out,'atomic-wallet-entry.cjs');writeFileSync(entry,`require(${JSON.stringify(join(appRoot,'tests/v2-browser-wallet-entry.cjs'))});const create=window.createDisposableTestSigner;window.createDisposableTestSigner=(...args)=>{const s=create(...args),sign=s.signOnlyTransaction.bind(s);s.signOnlyTransaction=(...v)=>{if(window.rejectAtomicOnce){window.rejectAtomicOnce=false;throw Error('Fixture wallet rejection');}window.atomicSignerEntered=performance.now();window.atomicApprovals=(window.atomicApprovals||0)+1;return sign(...v)};s.signMessageRaw=()=>{throw Error('Atomic launch must not request metadata approval')};return s;};`);
 await new Promise((ok,no)=>webpack({mode:'development',target:'web',entry,output:{path:out,filename:'atomic-wallet.js'}},(e,stats)=>e||stats.hasErrors()?no(e||Error(stats.toString({all:false,errors:true}))):ok()));
 const app=await startSharedMarketApp({genesis,fixture,out,dbPath:join(out,'atomic-browser.sqlite'),approvedCreator:ccc.Script.from(locks[2]).hash(),startupTimeoutMs:600_000});
 let pauseMining=false;let mining=!resumeMarket;const mine=(async()=>{while(mining){await delay(500);if(mining&&!pauseMining)await rpc('generate_block');}})();
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/home/timot/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',args:['--no-sandbox']});
 let page,launchedMarket;const errors=[],requests=[],trades=priorTrades?[...priorTrades]:[],quoteDiagnostics=[];
 try{
  page=await browser.newPage();page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(360000);
  page.on('console',m=>{if(m.text().includes('Brant quote')){quoteDiagnostics.push(m.text());writeFileSync(join(out,'quote-diagnostics.json'),JSON.stringify(quoteDiagnostics,null,2));}});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/v2/launch/'))requests.push({url:r.url(),status:r.status(),serverTiming:r.headers()['server-timing']});});
  await page.route('**/fixture-wallet-rpc',async route=>{const p=route.request().postDataJSON();try{if(p.method==='send_transaction'){assert(launchedMarket,'Unexpected wallet broadcast during Launch');const signed=ccc.Transaction.from((await import('@ckb-ccc/core/advanced')).cccA.JsonRpcTransformers.transactionTo(p.params[0]));assert.equal(signed.outputs[0].lock.hash(),launchedMarket);await rpc('estimate_cycles',[p.params[0]]);}
 const result=await rpc(p.method,p.params);
 if(p.method==='send_transaction'){for(let i=0;i<30;i++){await rpc('generate_block');const receipt=await rpc('get_transaction',[result]);if(receipt.tx_status.status==='committed'){assert.equal(await rpc('get_block_hash',[receipt.tx_status.block_number]),receipt.tx_status.block_hash);for(let j=0;j<100;j++){const indexed=await rpc('get_indexer_tip');if(BigInt(indexed.block_number)>=BigInt(receipt.tx_status.block_number))break;await delay(100);}trades.push({hash:result,receipt});break;}await delay(500);}assert(trades.some(t=>t.hash===result),'Trade did not commit');} await route.fulfill({json:{jsonrpc:'2.0',id:p.id,result}});}catch(e){await route.fulfill({json:{jsonrpc:'2.0',id:p.id,error:{code:-32603,message:String(e)}}});}});
  let market,catalog;
  if(!resumeMarket){
  await app.request('/api/v2/launch/sessions',{owner:ccc.Script.from(locks[2]).hash()});
  await page.goto(app.base+'/launch',{waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
  await page.locator('.brant-wallet[title^=ckt]').waitFor();
  await page.getByLabel('Token name',{exact:true}).fill('Atomic Browser');await page.getByLabel('Ticker',{exact:true}).fill('ABR');
  await page.getByLabel(/Initial purchase \(CKB\)/).fill('91');
  await page.getByRole('button',{name:'Review launch',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Launch token')||document.querySelector('p[role=alert]'));if(await page.locator('p[role=alert]').count())throw Error(await page.locator('p[role=alert]').innerText());
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByLabel(/Initial purchase \(CKB\)/).fill('92');
  await page.getByRole('button',{name:'Review launch',exact:true}).click();
  const launch=page.getByRole('button',{name:'Launch token',exact:true});await launch.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Launch token'&&!b.disabled));
  await page.route('**/api/v2/launch/submit',async route=>{await route.fetch();await route.abort('failed');},{times:1});
  await page.evaluate(()=>{window.atomicClick=performance.now();});await launch.click();await page.getByText('Submission is awaiting confirmation.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.atomicApprovals),1);
  writeFileSync(join(out,'wo4-signer-timing.json'),JSON.stringify(await page.evaluate(()=>({clickToFixtureSignerMs:window.atomicSignerEntered-window.atomicClick,kind:'isolated disposable signer; not public latency'})),null,2));
  const pendingMarket=await page.evaluate(()=>Object.entries(localStorage).find(([key])=>key.startsWith('brant-launch-session:'))?.[1]);assert(pendingMarket);
  await app.restart();await app.request('/api/v2/launch/sessions',{owner:ccc.Script.from(locks[2]).hash()});await page.reload({waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
  await page.getByLabel('Token name',{exact:true}).waitFor();assert.equal(await page.getByLabel('Token name',{exact:true}).inputValue(),'');
  await page.route('**/api/v2/launch/reconcile',route=>route.fulfill({status:503,json:{error:'Injected temporary publication outage'}}),{times:1});
  await page.getByLabel('Saved launches').selectOption(pendingMarket);
  await page.getByText('Token launched and metadata published',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.atomicApprovals||0),0);
  catalog=await app.request('/api/markets/catalog');market=catalog.markets.find(m=>m.metadata.ticker==='ABR');assert(market,'Atomic publication missing from catalog');launchedMarket=market.market;
  await page.screenshot({path:join(out,'atomic-browser-launched.png'),fullPage:true});
  await page.getByRole('link',{name:'Open market',exact:true}).waitFor();
  await page.getByRole('button',{name:'切换到简体中文',exact:true}).click();
  await page.getByRole('button',{name:'创建新代币',exact:true}).waitFor();
  await page.getByRole('button',{name:'Switch to English',exact:true}).click();
  await page.getByRole('button',{name:'Create new token',exact:true}).click();
  assert.equal(await page.getByLabel('Token name',{exact:true}).inputValue(),'');
  assert.equal(await page.getByLabel('Ticker',{exact:true}).inputValue(),'');
  await page.getByLabel('Token name',{exact:true}).fill('Second Atomic');await page.getByLabel('Ticker',{exact:true}).fill('TWO');
  await page.getByLabel(/Initial purchase \(CKB\)/).fill('91');
  await page.getByRole('button',{name:'Review launch',exact:true}).click();
  await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Launch token'&&!b.disabled));
  await page.evaluate(()=>{window.rejectAtomicOnce=true;});
  await page.getByRole('button',{name:'Launch token',exact:true}).click();
  await page.getByText('Wallet approval did not finish. You can try again.',{exact:true}).waitFor();
  pauseMining=true;
  await page.route('**/api/v2/launch/submit',async route=>{await route.fetch();await route.abort('failed');},{times:1});
  await launch.click();
  await page.getByText('Submission is awaiting confirmation.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.atomicApprovals),1);
  const secondPending=await page.evaluate(()=>Object.entries(localStorage).find(([key])=>key.startsWith('brant-launch-session:'))?.[1]);assert(secondPending);
  await app.restart();await app.request('/api/v2/launch/sessions',{owner:ccc.Script.from(locks[2]).hash()});
  await page.reload({waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
  await page.getByLabel('Saved launches').waitFor();assert.equal(await page.getByLabel('Token name',{exact:true}).inputValue(),'');
  assert(await page.getByLabel('Saved launches').locator('option').count()>=3);
  await page.getByLabel('Saved launches').selectOption(secondPending);pauseMining=false;
  await page.getByText('Token launched and metadata published',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.atomicApprovals||0),0);
  const repeated=await app.request('/api/markets/catalog');assert(repeated.markets.some(m=>m.metadata.ticker==='TWO'));
  await page.getByRole('button',{name:'Create new token',exact:true}).click();
  await page.getByLabel('Saved launches').selectOption(market.market);
  await page.getByText('Token launched and metadata published',{exact:true}).waitFor();
  }else{catalog=await app.request('/api/markets/catalog');market=catalog.markets.find(m=>m.market===resumeMarket);assert(market,'Retained atomic market missing');launchedMarket=market.market;}
  if(process.argv.includes('--creator-lifecycle')){
   const data=await app.request('/api/markets/'+market.market);
   assert.equal(data.supply,'2000');
   return;
  }
  // Stop empty-block mining before stable-snapshot funding selection. Trades
  // mine on submission, matching the existing wallet acceptance harness.
  mining=false;await mine;
  const data=await app.request('/api/markets/'+market.market);assert.equal(data.supply,'2000');
  const proof=await app.request('/api/v2/pudge-proof',{manifest:data.manifest,owner:market.owner,side:'balance'});assert.equal(proof.balance,'7');assert.equal(proof.root,data.custodyRoot);
  await page.goto(app.base+'/market/'+market.market,{waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
  await page.locator('.brant-wallet[title^=ckt]').waitFor();
  const expectedSides=['buy','buy','sell','buy','sell'];
  for(const side of priorTrades?[]:expectedSides){
    const started=Date.now();
    await page.getByRole('button',{name:side==='buy'?'Buy':'Sell',exact:true}).click();
    await page.locator('.preview-editable input').fill(side==='buy'?'20':'1');
    const label=(side==='buy'?'Buy ':'Sell ')+market.metadata.ticker;
    await page.waitForFunction(label=>{const b=document.querySelector('.preview-action');return b?.textContent===label&&!b.disabled;},label,{timeout:120000});
    const ready=Date.now(),priorCount=trades.length;
    await page.getByRole('button',{name:label,exact:true}).click();
    const key=`roveko-pudge-trade-v1:${genesis}:${market.owner}:${market.market}:settled`;
    while(trades.length===priorCount&&Date.now()-ready<120000)await delay(100);
    assert.equal(trades.length,priorCount+1);
    const trade=trades.at(-1);
    await page.waitForFunction(({key,hash})=>{const raw=localStorage.getItem(key);return raw&&JSON.parse(JSON.parse(raw).raw).txHash===hash;},{key,hash:trade.hash},{timeout:120000});
    trade.timings={preparationMs:ready-started,clickToSettledMs:Date.now()-ready};
  }
  assert.equal(trades.length,priorTrades?2:expectedSides.length);
  assert.equal(new Set(trades.map(trade=>trade.hash)).size,trades.length);
  for(const trade of trades){const current=await rpc('get_transaction',[trade.hash]);assert.equal(current.tx_status.status,'committed');assert.equal(current.tx_status.block_hash,trade.receipt.tx_status.block_hash);assert.equal(await rpc('get_block_hash',[current.tx_status.block_number]),current.tx_status.block_hash);}
  for(const path of ['/portfolio','/activity']){
    await page.goto(app.base+path,{waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
    await page.getByLabel(path==='/portfolio'?'Portfolio market':'Activity market').selectOption(market.market);
    if(path==='/portfolio')await page.waitForFunction(expected=>document.querySelector('.portfolio-rvk-total dd span')?.textContent===expected,priorTrades?'7':'8',{timeout:120000});
    else await page.locator(`a[href$="${trades[1].hash}"]`).waitFor({state:'attached'});
    await page.screenshot({path:join(out,'atomic-'+path.slice(1)+'.png'),fullPage:true});
  }
  await app.restart();await app.request('/api/v2/launch/sessions',{owner:ccc.Script.from(locks[2]).hash()});await page.goto(app.base+'/launch',{waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
  await page.getByLabel('Saved launches').selectOption(resumeMarket??market.market);
  await page.getByText('Token launched and metadata published',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.atomicApprovals||0),0);
  await app.restart({BRANT_LAUNCH_WRITES:'0'});
  const readOnlyCatalog=await app.request('/api/markets/catalog');assert(readOnlyCatalog.markets.some(m=>m.market===market.market));
  await app.browserAcceptance([market]);
  assert.deepEqual(errors,[]);writeFileSync(join(out,'atomic-browser-acceptance.json'),JSON.stringify({acceptanceVersion:4,creatorLifecycle:resumeMarket?'retained recovery only':{unsignedCancellation:true,editAndReprepare:true,repeatLaunch:true,mixedCompletedPendingReload:true,walletRejectionRetry:true,publicationFailureRetry:true,bilingual:true,creationDisabledRead:true},resumedMarket:resumeMarket,retainedTrades:Boolean(priorTrades),retainedEvidence,quoteDiagnostics,trades,portfolio:true,activity:true,wallet:'SIMULATED disposable fixture',chain:'REAL isolated',oneApproval:resumeMarket?'verified in retained Launch checkpoint':true,noMetadataApproval:true,interruptedSubmissionRecovery:true,proofBalanceVerified:true,market,catalog,requests,timings:app.timings,processes:app.processes,restart:true,errors},null,2));
 }catch(e){if(page)await page.screenshot({path:join(out,'atomic-browser-failure.png'),fullPage:true}).catch(()=>{});writeFileSync(join(out,'atomic-browser-failure.json'),JSON.stringify({error:String(e),errors,requests,quoteDiagnostics,trades},null,2));throw e;}
 finally{await browser.close();mining=false;await mine;await app.stop();}
}

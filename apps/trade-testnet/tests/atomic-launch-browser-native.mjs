import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {ccc} from '@ckb-ccc/core';
import {startSharedMarketApp} from './shared-market-app-runner.mjs';
export async function runSharedLaunch({rpc,genesis,hashes,deps,secp,locks,out,connectBrowserWallet}){
 const fixture={};for(const [name,key]of Object.entries({market:'market_smt',marker:'marker_candidate',custody:'custody_smt',custodyMarker:'custody_marker',ownerLock:'atomic_initializer',xudt:'xudt'}))fixture[name]={...deps[key],dataHash:hashes[key]};
 const secpCell=await rpc('get_live_cell',[{tx_hash:secp.outPoint.txHash,index:secp.outPoint.index},true]);fixture.secp={...secp,dataHash:ccc.hashCkb(secpCell.cell.data.content)};
 const appRoot=fileURLToPath(new URL('..',import.meta.url)),require=createRequire(import.meta.url),webpack=require('next/dist/compiled/webpack/webpack').webpack;
 const entry=join(out,'atomic-wallet-entry.cjs');writeFileSync(entry,`require(${JSON.stringify(join(appRoot,'tests/v2-browser-wallet-entry.cjs'))});const create=window.createDisposableTestSigner;window.createDisposableTestSigner=(...args)=>{const s=create(...args),sign=s.signOnlyTransaction.bind(s);s.signOnlyTransaction=(...v)=>{window.atomicApprovals=(window.atomicApprovals||0)+1;return sign(...v)};s.signMessageRaw=()=>{throw Error('Atomic launch must not request metadata approval')};return s;};`);
 await new Promise((ok,no)=>webpack({mode:'development',target:'web',entry,output:{path:out,filename:'atomic-wallet.js'}},(e,stats)=>e||stats.hasErrors()?no(e||Error(stats.toString({all:false,errors:true}))):ok()));
 const app=await startSharedMarketApp({genesis,fixture,out,dbPath:join(out,'atomic-browser.sqlite'),approvedCreator:ccc.Script.from(locks[2]).hash(),startupTimeoutMs:600_000});
 let mining=true;const mine=(async()=>{while(mining){await delay(500);if(mining)await rpc('generate_block');}})();
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/home/timot/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',args:['--no-sandbox']});
 let page,launchedMarket;const errors=[],requests=[],trades=[];
 try{
  page=await browser.newPage();page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/v2/launch/'))requests.push({url:r.url(),status:r.status(),serverTiming:r.headers()['server-timing']});});
  await page.route('**/fixture-wallet-rpc',async route=>{const p=route.request().postDataJSON();try{if(p.method==='send_transaction'){assert(launchedMarket,'Unexpected wallet broadcast during Launch');const signed=ccc.Transaction.from((await import('@ckb-ccc/core/advanced')).cccA.JsonRpcTransformers.transactionTo(p.params[0]));assert.equal(signed.outputs[0].lock.hash(),launchedMarket);await rpc('estimate_cycles',[p.params[0]]);}
 const result=await rpc(p.method,p.params);
 if(p.method==='send_transaction'){for(let i=0;i<30;i++){const receipt=await rpc('get_transaction',[result]);if(receipt.tx_status.status==='committed'){assert.equal(await rpc('get_block_hash',[receipt.tx_status.block_number]),receipt.tx_status.block_hash);trades.push({hash:result,receipt});break;}await delay(500);}assert(trades.some(t=>t.hash===result),'Trade did not commit');} await route.fulfill({json:{jsonrpc:'2.0',id:p.id,result}});}catch(e){await route.fulfill({json:{jsonrpc:'2.0',id:p.id,error:{code:-32603,message:String(e)}}});}});
  await page.goto(app.base+'/launch',{waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
  await page.getByLabel('Token name',{exact:true}).fill('Atomic Browser');await page.getByLabel('Ticker',{exact:true}).fill('ABR');
  await page.getByRole('button',{name:'Review launch',exact:true}).click();
  const launch=page.getByRole('button',{name:'Launch token',exact:true});await launch.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Launch token'&&!b.disabled));
  await page.route('**/api/v2/launch/submit',async route=>{await route.fetch();await route.abort('failed');},{times:1});
  await launch.click();await page.getByText('Submission is awaiting confirmation.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.atomicApprovals),1);
  await app.restart();await page.reload({waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
  await page.getByText('Token launched and metadata published',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.atomicApprovals||0),0);
  const catalog=await app.request('/api/markets/catalog');const market=catalog.markets.find(m=>m.metadata.ticker==='ABR');assert(market,'Atomic publication missing from catalog');launchedMarket=market.market;
  await page.screenshot({path:join(out,'atomic-browser-launched.png'),fullPage:true});
  const data=await app.request('/api/markets/'+market.market);assert.equal(data.supply,'2000');
  const proof=await app.request('/api/v2/pudge-proof',{manifest:data.manifest,owner:market.owner,side:'balance'});assert.equal(proof.balance,'7');assert.equal(proof.root,data.custodyRoot);
  await page.goto(app.base+'/market/'+market.market,{waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
  await page.locator('.preview-editable input').fill('1');
  for(const side of ['buy','sell']){
    await page.getByRole('button',{name:side==='buy'?'Buy':'Sell',exact:true}).click();
    const label=(side==='buy'?'Buy ':'Sell ')+market.metadata.ticker;
    await page.waitForFunction(label=>{const b=document.querySelector('.preview-action');return b?.textContent===label&&!b.disabled;},label,{timeout:120000});
    await page.getByRole('button',{name:label,exact:true}).click();
    const key=`roveko-pudge-trade-v1:${genesis}:${market.owner}:${market.market}:settled`;
    await page.waitForFunction(({key,side})=>{const raw=localStorage.getItem(key);return raw&&JSON.parse(JSON.parse(raw).raw).transaction.witnesses[5].slice(12,14)===(side==='buy'?'01':'04');},{key,side},{timeout:120000});
  }
  assert.equal(trades.length,2);
  for(const path of ['/portfolio','/activity']){
    await page.goto(app.base+path,{waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
    await page.getByLabel(path==='/portfolio'?'Portfolio market':'Activity market').selectOption(market.market);
    if(path==='/portfolio')await page.waitForFunction(()=>document.querySelector('.portfolio-rvk-total dd span')?.textContent==='7',undefined,{timeout:120000});
    else await page.locator(`a[href$="${trades[1].hash}"]`).waitFor({state:'attached'});
    await page.screenshot({path:join(out,'atomic-'+path.slice(1)+'.png'),fullPage:true});
  }
  await app.restart();await page.goto(app.base+'/launch',{waitUntil:'commit'});await connectBrowserWallet(page,join(out,'atomic-wallet.js'));
  await page.getByText('Token launched and metadata published',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.atomicApprovals||0),0);
  await app.browserAcceptance([market]);
  assert.deepEqual(errors,[]);writeFileSync(join(out,'atomic-browser-acceptance.json'),JSON.stringify({acceptanceVersion:2,trades,portfolio:true,activity:true,wallet:'SIMULATED disposable fixture',chain:'REAL isolated',oneApproval:true,noMetadataApproval:true,interruptedSubmissionRecovery:true,proofBalanceVerified:true,market,catalog,requests,timings:app.timings,processes:app.processes,restart:true,errors},null,2));
 }catch(e){if(page)await page.screenshot({path:join(out,'atomic-browser-failure.png'),fullPage:true}).catch(()=>{});writeFileSync(join(out,'atomic-browser-failure.json'),JSON.stringify({error:String(e),errors,requests},null,2));throw e;}
 finally{await browser.close();mining=false;await mine;await app.stop();}
}

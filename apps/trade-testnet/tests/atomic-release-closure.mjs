// Release-only gaps: independent exit and instrumented application timing. No native qualification replay.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {chromium} from 'playwright-core';
import {startSharedMarketApp} from './shared-market-app-runner.mjs';
const execute=promisify(execFile),appRoot=fileURLToPath(new URL('..',import.meta.url)),root=resolve(appRoot,'../..'),require=createRequire(import.meta.url);
export async function runReleaseClosure({rpc,genesis,hashes,deps,secp,locks,out,connectBrowserWallet}){
 const native=require(root+'/labs/rebuild/native/src/lib.cjs'),cli=root+'/labs/trade-v2-token/gate2/recovery/recover.cjs';
 const initial='0x90affaff4602b2c2996514c41747c888676ec6164eda9c03a79a69d70789eee7';
 const original=await rpc('get_transaction',[initial]);assert.equal(original.tx_status.status,'committed');
 const custody=join(out,'independent-custody.json'),token=join(out,'independent-token.json'),bundle=join(out,'independent-history.json'),report=join(out,'independent-withdrawal.json');
 writeFileSync(custody,JSON.stringify(original.transaction.outputs[2].lock));writeFileSync(token,JSON.stringify(original.transaction.outputs[0].type));
 const owner=ccc.Script.from(locks[2]).hash();
 const call=async(args,key)=>execute(process.execPath,[cli,...args],{cwd:root,env:{...process.env,TRADE_RECOVERY_RPC_LOG:join(out,'independent-rpc.jsonl'),...(key?{TRADE_RECOVERY_PRIVATE_KEY:key}:{})},timeout:180000,maxBuffer:32*1024*1024});
 const collect=['collect-blocks','--node','http://127.0.0.1:19224/','--init',initial,'--owner',owner,'--custody-lock',custody,'--xudt-type',token,'--out',bundle];
 await call(collect);const before=JSON.parse(readFileSync(bundle+'.result.json','utf8'));assert.equal(before.owner.balance,'7');assert.equal(before.entitlement_total,before.custody_amount);
 await call(['withdraw','--node','http://127.0.0.1:19224/','--bundle',bundle,'--out',report,'--sdk-root',root+'/labs/rebuild/native','--mine'],native.keys[2]);
 await call(['verify-withdrawal','--node','http://127.0.0.1:19224/','--report',report,'--sdk-root',root+'/labs/rebuild/native']);
 const post=join(out,'independent-after.json');await call([...collect.slice(0,-1),post]);
 const after=JSON.parse(readFileSync(post+'.result.json','utf8'));assert.equal(after.owner.balance,'0');assert.equal(after.custody_amount,'0');assert.equal(after.entitlement_total,'0');
 const withdrawal=JSON.parse(readFileSync(report,'utf8'));assert.equal(withdrawal.status,'committed');
 const methods=readFileSync(join(out,'independent-rpc.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line).method);assert(!methods.some(m=>['get_cells','get_indexer_tip','get_transactions'].includes(m)));
 writeFileSync(join(out,'independent-atomic-verdict.json'),JSON.stringify({verified:true,genesis,initialization:initial,owner,before,after,withdrawal,applicationRunning:false,databaseUsedByRecovery:false,indexerUsed:false,proofCacheUsed:false,collector:'canonical full blocks',rpcCounts:methods.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{})},null,2));
 const fixture={};for(const [name,key]of Object.entries({market:'market_smt',marker:'marker_candidate',custody:'custody_smt',custodyMarker:'custody_marker',ownerLock:'atomic_initializer',xudt:'xudt'}))fixture[name]={...deps[key],dataHash:hashes[key]};
 const secpCell=await rpc('get_live_cell',[{tx_hash:secp.outPoint.txHash,index:secp.outPoint.index},true]);fixture.secp={...secp,dataHash:ccc.hashCkb(secpCell.cell.data.content)};
 const entry=join(out,'timed-wallet-entry.cjs');writeFileSync(entry,`require(${JSON.stringify(join(appRoot,'tests/v2-browser-wallet-entry.cjs'))});const create=window.createDisposableTestSigner;window.createDisposableTestSigner=(...args)=>{const s=create(...args),sign=s.signOnlyTransaction.bind(s);s.signOnlyTransaction=(...v)=>{window.rcWalletAt=performance.now();window.rcApprovals=(window.rcApprovals||0)+1;return sign(...v)};s.signMessageRaw=()=>{throw Error('Separate metadata approval forbidden')};return s;};`);
 const webpack=require('next/dist/compiled/webpack/webpack').webpack;
 await new Promise((ok,no)=>webpack({mode:'development',target:'web',entry,output:{path:out,filename:'timed-wallet.js'}},(error,stats)=>error||stats.hasErrors()?no(error||Error(stats.toString({all:false,errors:true}))):ok()));
 const app=await startSharedMarketApp({genesis,fixture,out,dbPath:join(out,'atomic-browser.sqlite'),approvedCreator:owner,startupTimeoutMs:600000});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/home/timot/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',args:['--no-sandbox']});
 let submitted,commitReady,commitAt,publicationAt,receipt;const requests=[],started=new Map(),errors=[];
 try{
  const page=await browser.newPage();page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/api/v2/launch/'))started.set(r,performance.now());});
  page.on('response',async r=>{if(r.url().includes('/api/v2/launch/')){requests.push({url:r.url(),status:r.status(),responseHeadersMs:performance.now()-started.get(r.request()),serverTiming:r.headers()['server-timing']});if(r.url().endsWith('/reconcile')){const result=await r.json().catch(()=>null);if(result?.published)publicationAt=performance.now();}}});
  await page.route('**/fixture-wallet-rpc',async route=>{const p=route.request().postDataJSON();assert(p.method!=='send_transaction','Launch must broadcast through persisted API');const result=await rpc(p.method,p.params);await route.fulfill({json:{jsonrpc:'2.0',id:p.id,result}});});
  await page.route('**/api/v2/launch/submit',async route=>{const input=route.request().postDataJSON();submitted=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(input.signed)).hash();commitReady=(async()=>{for(let i=0;i<60;i++){await delay(200);await rpc('generate_block');const result=await rpc('get_transaction',[submitted]);if(result?.tx_status.status==='committed'){assert.equal(await rpc('get_block_hash',[result.tx_status.block_number]),result.tx_status.block_hash);receipt=result;commitAt=performance.now();return;} }throw Error('Timed Launch did not commit');})();await route.continue();});
  await page.route('**/api/v2/launch/reconcile',async route=>{if(commitReady)await commitReady;await route.continue();});
  await page.goto(app.base+'/launch',{waitUntil:'commit'});await connectBrowserWallet(page,join(out,'timed-wallet.js'));
  await page.getByLabel('Token name',{exact:true}).fill('Atomic Release Timing');await page.getByLabel('Ticker',{exact:true}).fill('ART');
  await page.getByRole('button',{name:'Review launch',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Launch token'&&!b.disabled));
  await page.evaluate(()=>document.querySelectorAll('button').forEach(b=>{if(b.textContent==='Launch token')b.addEventListener('click',()=>{window.rcClickAt=performance.now();},{once:true});}));
  await page.getByRole('button',{name:'Launch token',exact:true}).click();await page.getByText('Token launched and metadata published',{exact:true}).waitFor();await commitReady;
  const wallet=await page.evaluate(()=>({approvals:window.rcApprovals,clickToWalletMs:window.rcWalletAt-window.rcClickAt}));assert.equal(wallet.approvals,1);assert(publicationAt>=commitAt);assert.deepEqual(errors,[]);
  await page.screenshot({path:join(out,'timed-atomic-launch.png'),fullPage:true});
  writeFileSync(join(out,'atomic-release-timing.json'),JSON.stringify({verified:true,genesis,wallet:'SIMULATED disposable fixture',...wallet,commitmentObservationToPublicationMs:publicationAt-commitAt,measurement:'Canonical commitment observed after local block generation; first reconcile waits for that observation. Includes publication request/response, excludes unknown native commitment-to-observer delay. Not a real wallet opening latency.',transaction:submitted,receipt,requests,errors},null,2));
 }finally{await browser.close();if(commitReady)await commitReady;await app.stop();}
}

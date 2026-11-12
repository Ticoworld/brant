// Isolated disposable-chain browser test. Never run against a public network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
const require = createRequire(import.meta.url);
const webpack = require('next/dist/compiled/webpack/webpack').webpack;
const root = path.resolve(import.meta.dirname, '..');
const bootstrapPath = process.env.V2_LOCAL_BOOTSTRAP;
const proofBinary = process.env.ROVEKO_PROOF_BINARY;
assert(bootstrapPath && proofBinary, 'Set V2_LOCAL_BOOTSTRAP and ROVEKO_PROOF_BINARY');
const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, 'utf8'));
assert(process.env.TRADE_NATIVE_ROOT, 'Set TRADE_NATIVE_ROOT to the isolated fixture tooling');
const native = require(path.join(process.env.TRADE_NATIVE_ROOT, 'src/lib.cjs'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'roveko-browser-'));
const evidence = path.join(root, 'evidence', `v2-browser-${Date.now()}`);
fs.mkdirSync(evidence, { recursive:true });
await new Promise<void>((resolve,reject) => webpack({mode:'development',target:'web',entry:path.join(root,'tests/v2-browser-wallet-entry.cjs'),output:{path:dir,filename:'wallet.js'}}, (error:Error,stats:any) => error || stats.hasErrors() ? reject(error || Error(stats.toString({all:false,errors:true}))) : resolve()));
const log = fs.openSync(path.join(evidence,'next.log'),'w');
const next = spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--port','3101'],{cwd:root,env:{...process.env,NEXT_PUBLIC_LOCAL_FIXTURE:'1',ROVEKO_LOCAL_PROOFS:'1',ROVEKO_LOCAL_BROADCAST:'1',ROVEKO_LOCAL_DEPLOYMENT:bootstrapPath,ROVEKO_PROOF_BINARY:proofBinary,V2_LOCAL_BOOTSTRAP:bootstrapPath,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',log,log]});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const rpc = async (method:string, params:unknown[] = []) => {const r=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error) throw Error(JSON.stringify(j.error));return j.result;};
try {
  assert.equal((await rpc('get_block_hash',['0x0'])).toLowerCase(),bootstrap.genesis.toLowerCase(),'Wrong isolated chain');
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3101/v2')).ok)break;}catch{} await new Promise(r=>setTimeout(r,500));}
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage();
  const estimates: unknown[] = [], proofTimes: number[] = [];
  const proofStarts = new WeakMap<object, number>();
  page.on('request', request => {if(request.url().endsWith('/api/v2/proof')) proofStarts.set(request, performance.now());});
  page.on('response', response => {const start=proofStarts.get(response.request()); if(start !== undefined) proofTimes.push(performance.now()-start);});
  page.on('response', response => {if(response.url().endsWith('/api/local-rpc') && response.status() >= 400) { const p=response.request().postDataJSON(); console.error(`Local RPC ${p?.method} returned HTTP ${response.status()}`); }});
  await page.route('**/api/local-rpc', async route => {
    const payload=route.request().postDataJSON();
    if(payload?.method==='send_transaction') estimates.push(await rpc('estimate_cycles',[payload.params[0]]));
    await route.continue();
  });
  await page.goto('http://127.0.0.1:3101/v2');
  await page.addScriptTag({path:path.join(dir,'wallet.js')});
  await page.waitForFunction(() => typeof (window as any).rovTestConnect === 'function');
  const genesis=await rpc('get_block_by_number',['0x0']);
  await page.evaluate(({key,secp}:any) => {const w=window as any; w.rovTestConnect(w.createDisposableTestSigner(key,secp));},{key:native.keys[2],secp:{outPoint:{txHash:genesis.transactions[1].hash,index:'0x0'},depType:'depGroup'}});
  await page.getByLabel('Token quantity').fill('1');
  const transactions: Record<string, any> = {};
  for(const side of ['buy','sell']){
    if(side==='sell') await page.getByRole('button',{name:'Sell back'}).click();
    await page.getByRole('button',{name:'Prepare review'}).click();
    await page.getByRole('button',{name:'Sign and submit reviewed transaction'}).waitFor({timeout:180000});
    await page.getByRole('button',{name:'Sign and submit reviewed transaction'}).click();
    await page.getByRole('status').filter({hasText:/Submitted 0x/}).waitFor({timeout:180000});
    const status=await page.getByRole('status').innerText();
    const hash=status.match(/0x[0-9a-f]{64}/i)?.[0]; assert(hash,status);
    let committed;
    for (let i=0;i<12;i++) { await rpc('generate_block'); committed=await rpc('get_transaction',[hash]); if(committed?.tx_status?.status==='committed') break; }
    assert.equal(committed.tx_status.status,'committed');
    transactions[side] = {hash, ...committed};
    await page.getByText(new RegExp(`Confirmed ${hash}`)).waitFor({timeout:30000});
    fs.writeFileSync(path.join(evidence,`${side}.json`),JSON.stringify(committed,null,2));
    await page.screenshot({path:path.join(evidence,`${side}.png`),fullPage:true});
  }
  const buyTx=transactions.buy.transaction, sellTx=transactions.sell.transaction;
  const initialMarket=BigInt(bootstrap.initial[0].capacity), initialWallet=BigInt(bootstrap.funding.capacity);
  const curvePrice=17n * 100000000n;
  assert.equal(BigInt(buyTx.outputs[0].capacity),initialMarket+curvePrice);
  assert.equal(BigInt(sellTx.outputs[0].capacity),initialMarket);
  assert.equal(BigInt(buyTx.outputs[4].capacity),initialWallet-curvePrice-100000n);
  assert.equal(BigInt(sellTx.outputs[4].capacity),initialWallet-200000n);
  assert.equal(sellTx.outputs_data[0],bootstrap.initial[0].data);
  assert.equal(sellTx.outputs_data[2].slice(0,34),bootstrap.initial[2].data.slice(0,34));
  for(let i=0;i<5;i++) assert.equal((await rpc('get_live_cell',[{tx_hash:transactions.sell.hash,index:'0x'+i.toString(16)},true])).status,'live');
  await page.reload();
  await page.addScriptTag({path:path.join(dir,'wallet.js')});
  await page.waitForFunction(() => typeof (window as any).rovTestConnect === 'function');
  await page.evaluate(({key,secp}:any) => {const w=window as any;w.rovTestConnect(w.createDisposableTestSigner(key,secp));},{key:native.keys[2],secp:{outPoint:{txHash:genesis.transactions[1].hash,index:'0x0'},depType:'depGroup'}});
  await page.getByText('1993', {exact:true}).waitFor({timeout:30000});
  await page.screenshot({path:path.join(evidence,'reconnect.png'),fullPage:true});
  fs.writeFileSync(path.join(evidence,'assertions.json'),JSON.stringify({buy:transactions.buy.hash,sell:transactions.sell.hash,feeShannonsEach:'100000',curvePriceShannons:curvePrice.toString(),initialMarketCapacity:initialMarket.toString(),initialWalletCapacity:initialWallet.toString(),finalMarketCapacity:BigInt(sellTx.outputs[0].capacity).toString(),finalWalletCapacity:BigInt(sellTx.outputs[4].capacity).toString(),reconnectedInventory:'1993',estimateCycles:estimates,proofRequestMilliseconds:proofTimes},null,2));
  console.log(`V2 browser evidence: ${evidence}`);
} finally { await browser?.close(); next.kill(); }

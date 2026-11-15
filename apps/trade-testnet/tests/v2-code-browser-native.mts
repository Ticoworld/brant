// Disposable private node and fixture signer only. No Pudge transactions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
const require=createRequire(import.meta.url), root=path.resolve(import.meta.dirname,'..');
assert(process.env.V2_LOCAL_BOOTSTRAP&&process.env.TRADE_NATIVE_ROOT&&process.env.ROVEKO_GATE2_BINARIES,'Set fixture paths');
const config=JSON.parse(fs.readFileSync(process.env.V2_LOCAL_BOOTSTRAP,'utf8'));
const native=require(path.join(process.env.TRADE_NATIVE_ROOT,'src/lib.cjs'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rov-code-wallet-'));
const evidence=path.join(root,'evidence',`v2-code-browser-${Date.now()}`);fs.mkdirSync(evidence,{recursive:true});
const webpack=require('next/dist/compiled/webpack/webpack').webpack;
await new Promise<void>((resolve,reject)=>webpack({mode:'development',target:'web',entry:path.join(root,'tests/v2-browser-wallet-entry.cjs'),output:{path:temp,filename:'wallet.js'}},(e:Error,s:any)=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));
const rpc=async(method:string,params:unknown[]=[])=>{const response=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const body=await response.json();if(body.error)throw Error(JSON.stringify(body.error));return body.result;};
assert.equal(await rpc('get_block_hash',['0x0']),config.genesis);assert.equal((await rpc('get_blockchain_info')).chain,'ckb_dev');
const nodeLog=fs.openSync(path.join(evidence,'next.log'),'w');
const next=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--port','3110'],{cwd:root,env:{...process.env,NEXT_PUBLIC_LOCAL_FIXTURE:'1',ROVEKO_LOCAL_BROADCAST:'1',R7_NEXT_DIST_DIR:'.next-v2-code-browser',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',nodeLog,nodeLog]});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try {
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3110/v2/deploy')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage();await page.goto('http://127.0.0.1:3110/v2/deploy');await page.addScriptTag({path:path.join(temp,'wallet.js')});await page.waitForFunction(()=>typeof (window as any).rovDeployTestConnect==='function');
  let estimate:unknown;await page.route('**/api/local-rpc',async route=>{const payload=route.request().postDataJSON();if(payload?.method==='send_transaction')estimate=await rpc('estimate_cycles',[payload.params[0]]);await route.continue();});
  const block=await rpc('get_block_by_number',['0x0']);
  await page.evaluate(({key,secp}:any)=>{const w=window as any;w.rovDeployTestConnect(w.createDisposableTestSigner(key,secp));},{key:native.keys[2],secp:{outPoint:{txHash:block.transactions[1].hash,index:'0x0'},depType:'depGroup'}});
  const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Disposable local code deployment'})});
  await section.getByRole('button',{name:'Prepare local code review'}).click();
  await section.getByText('Local unsigned code deployment prepared.').waitFor({timeout:60000});
  const reviewText=await section.innerText();
  await section.getByRole('button',{name:'Sign local code review'}).click();
  await section.getByText('Local signature verified; not submitted.').waitFor({timeout:60000});
  await section.getByRole('button',{name:'Submit local code deployment'}).click();
  await section.getByText(/Submitted 0x/).waitFor({timeout:60000});
  const status=await section.getByRole('status').innerText(),hash=status.match(/0x[0-9a-f]{64}/i)?.[0];assert(hash,status);
  let tx:any;for(let i=0;i<15;i++){await rpc('generate_block');tx=await rpc('get_transaction',[hash]);if(tx?.tx_status?.status==='committed')break;}assert.equal(tx.tx_status.status,'committed');
  await section.getByRole('button',{name:'Check local code deployment'}).click();await section.getByText(/Local code cells confirmed/).waitFor({timeout:60000});
  assert.equal(await rpc('get_block_hash',[tx.tx_status.block_number]),tx.tx_status.block_hash);
  const cells=[];for(let i=0;i<5;i++){const cell=await rpc('get_live_cell',[{tx_hash:hash,index:'0x'+i.toString(16)},true]);assert.equal(cell.status,'live');cells.push(cell);}
  fs.writeFileSync(path.join(evidence,'code-deployment.json'),JSON.stringify({transaction:tx,canonicalBlockHash:tx.tx_status.block_hash,cells,estimate,reviewText},null,2));await page.screenshot({path:path.join(evidence,'code-deployment.png'),fullPage:true});
  console.log(`Browser code deployment ${hash}; evidence ${evidence}`);
} finally {await browser?.close();next.kill();}

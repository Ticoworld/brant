import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';

const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
assert(process.env.TRADE_NATIVE_ROOT&&process.env.ROVEKO_INIT_BOOTSTRAP&&process.env.ROVEKO_LOCAL_MARKET_MANIFEST,'Set the existing private-chain bootstrap, market manifest, and native root');
const config=JSON.parse(fs.readFileSync(process.env.ROVEKO_INIT_BOOTSTRAP,'utf8'));
const manifest=JSON.parse(fs.readFileSync(process.env.ROVEKO_LOCAL_MARKET_MANIFEST,'utf8'));
assert.equal(manifest.genesis,config.genesis);
const native=require(path.join(process.env.TRADE_NATIVE_ROOT,'src/lib.cjs'));
const runId=Date.now(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'roveko-trade-recovery-wallet-'));
const evidence=path.join(root,'evidence',`v2-trade-recovery-${runId}`);fs.mkdirSync(evidence,{recursive:true});
await new Promise<void>((resolve,reject)=>require('next/dist/compiled/webpack/webpack').webpack({mode:'development',target:'web',entry:path.join(root,'tests/v2-browser-wallet-entry.cjs'),output:{path:temp,filename:'wallet.js'}},(error:Error,stats:any)=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));
const rpc=async(method:string,params:unknown[]=[])=>{const response=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const body=await response.json();if(body.error)throw Error(JSON.stringify(body.error));return body.result;};
const tipBefore=await rpc('get_tip_header') as {hash:string};
assert.equal((await rpc('get_blockchain_info')).chain,'ckb_dev');
assert.equal(await rpc('get_block_hash',['0x0']),config.genesis);
const genesisBlock=await rpc('get_block_by_number',['0x0']) as {transactions:{hash:string}[]};
const secp={outPoint:{txHash:genesisBlock.transactions[1].hash,index:'0x0'},depType:'depGroup'};
const log=fs.openSync(path.join(evidence,'next.log'),'w');
const next=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3113'],{cwd:root,env:{...process.env,NEXT_PUBLIC_LOCAL_FIXTURE:'1',NEXT_PUBLIC_PUDGE_TEST_HOOK:'',ROVEKO_LOCAL_BROADCAST:'1',ROVEKO_LOCAL_PROOFS:'1',ROVEKO_INIT_BOOTSTRAP:process.env.ROVEKO_INIT_BOOTSTRAP,R7_NEXT_DIST_DIR:`.next-v2-trade-recovery-${runId}`,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',log,log]});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
 for(let i=0;i<120;i++){try{if((await fetch('http://127.0.0.1:3113/v2')).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,500));}
 for(const [url,init] of [['/v2','GET'],['/api/v2-init-bootstrap','GET'],['/api/local-rpc','POST']] as const){const response=await fetch(`http://127.0.0.1:3113${url}`,init==='POST'?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'get_blockchain_info',params:[]})}:undefined);await response.arrayBuffer();if(response.status>=500)throw Error(`Route warm-up failed: ${url} (${response.status})`);}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage();page.setDefaultNavigationTimeout(90000);
 let submissions=0;page.on('request',request=>{if(request.url().endsWith('/api/local-rpc')&&request.method()==='POST'&&request.postDataJSON()?.method==='send_transaction')submissions++;});
 page.on('console',message=>{if(message.type()==='error')console.error('Browser:',message.text());});
 await page.addInitScript(({key,value})=>localStorage.setItem(key,value),{key:`roveko-local-market:${config.genesis}`,value:JSON.stringify(manifest)});
 const connect=async()=>{await page.addScriptTag({path:path.join(temp,'wallet.js')});await page.waitForFunction(()=>typeof (window as any).rovTestConnect==='function');await page.evaluate(({key,secp}:any)=>{const w=window as any;w.rovTestConnect(w.createDisposableTestSigner(key,secp));},{key:native.keys[2],secp});};
 const inspect=async()=>{await page.getByText('Local curve market',{exact:true}).waitFor({timeout:90000});await page.getByText('Wallet entitlement: 7',{exact:true}).waitFor({timeout:90000});const stat=async(label:string)=>page.locator('.rv-stats > div').filter({hasText:label}).locator('strong').innerText();const result={inventory:await stat('Curve inventory'),custody:await stat('Internal circulation'),entitlement:await page.getByText('Wallet entitlement: 7',{exact:true}).innerText()};assert.equal(result.inventory,'1993');assert.equal(result.custody,'7');return result;};
 await page.goto('http://127.0.0.1:3113/v2');await connect();const first=await inspect();await page.screenshot({path:path.join(evidence,'trade-recovered.png'),fullPage:true});
 await page.reload();await connect();const afterReload=await inspect();await page.screenshot({path:path.join(evidence,'trade-recovered-after-reload.png'),fullPage:true});
 const tipAfter=await rpc('get_tip_header') as {hash:string};assert.equal(tipAfter.hash,tipBefore.hash,'Read-only recovery changed the private-chain tip');assert.equal(submissions,0,'Read-only recovery submitted a transaction');assert.deepEqual(afterReload,first);
 fs.writeFileSync(path.join(evidence,'trade-recovery.json'),JSON.stringify({genesis:config.genesis,tip:tipAfter.hash,ownerRole:'disposable wallet 2',beforeReload:first,afterReload,transactionSubmissions:submissions,chainTipUnchanged:true},null,2));
 console.log(`Read-only /v2 recovery passed: ${evidence}`);
}catch(error){console.error('Focused /v2 recovery failed');console.error(error);throw error;}finally{await browser?.close();next.kill();fs.closeSync(log);}

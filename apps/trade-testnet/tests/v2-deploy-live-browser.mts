// Read-only public Pudge smoke test using a historical public lock; no keys.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(import.meta.url),webpack=require('next/dist/compiled/webpack/webpack').webpack;
assert(process.env.ROVEKO_GATE2_BINARIES,'Set ROVEKO_GATE2_BINARIES');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'rov-pudge-review-'));
await new Promise<void>((resolve,reject)=>webpack({mode:'development',target:'web',entry:path.join(root,'tests/v2-deploy-wallet-entry.cjs'),output:{path:tmp,filename:'wallet.js'}},(e:Error,s:any)=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));
const next=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--port','3108'],{cwd:root,env:{...process.env,NEXT_PUBLIC_LOCAL_FIXTURE:'1',R7_NEXT_DIST_DIR:'.next-v2-deploy-live',NEXT_TELEMETRY_DISABLED:'1'},stdio:'ignore'});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3108/v2/deploy')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const p=await browser.newPage();await p.goto('http://127.0.0.1:3108/v2/deploy');await p.addScriptTag({path:path.join(tmp,'wallet.js')});await p.waitForFunction(()=>typeof (window as any).rovDeployTestConnect==='function');
 await p.evaluate(g=>(window as any).rovDeployTestConnect((window as any).createDeployReviewTestWallet(g,'0x36ef38ed06300fa0f357f1f360b897c476c5c4f9')),'0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606');
 await p.getByRole('button',{name:'Prepare unsigned review'}).click();
 await p.getByText(/Insufficient eligible funds|Unsigned code-cell transaction prepared/).waitFor({timeout:120000});
 const status=await p.getByRole('status').innerText();
 assert(!/error|failed/i.test(status),status);
 console.log('Pudge read-only browser review passed: '+status);
} finally {await browser?.close();next.kill();}

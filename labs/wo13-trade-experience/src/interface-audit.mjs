import {chromium} from '../../../apps/trade-testnet/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';
const out=new URL('../evidence/',import.meta.url).pathname;
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const results=[];
for(const [name,url] of [['before','http://127.0.0.1:3101'],['jupiter','https://jup.ag/swap'],['uniswap','https://app.uniswap.org/swap'],['pump','https://pump.fun/'],['ickb','https://ickb.org']]){
const ctx=await browser.newContext({viewport:{width:1440,height:1000},...(name!=='before'?{proxy:{server:process.env.HTTPS_PROXY}}:{})});
const p=await ctx.newPage();let error;
try{await p.goto(url,{waitUntil:'domcontentloaded',timeout:25000});await p.waitForTimeout(name==='before'?12000:4000);await p.screenshot({path:out+name+'.png',fullPage:false});results.push({name,url,title:await p.title(),text:(await p.locator('body').innerText()).slice(0,4500),screenshot:name+'.png'});}catch(e){error=String(e);results.push({name,url,error});}
await ctx.close();}
await browser.close();fs.writeFileSync(out+'interface-audit.json',JSON.stringify({at:new Date().toISOString(),readOnly:true,results},null,2));console.log(results.map(x=>({name:x.name,error:x.error,title:x.title})));

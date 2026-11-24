import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createWriteStream,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright-core';

/** Runs actual application routes against the harness's genuine isolated node. */
export async function startSharedMarketApp({genesis,fixture,out,dbPath}){
  const app=fileURLToPath(new URL('..',import.meta.url));
  const root=resolve(app,'../..'),config=join(out,'isolated-app-config.json');
  const base='http://127.0.0.1:3143';
  writeFileSync(config,JSON.stringify({genesis,fixture,endpoint:'http://127.0.0.1:19224/'}));
  const env={...process.env,NODE_ENV:'development',BRANT_ISOLATED_TEST:'1',BRANT_ISOLATED_CONFIG:config,
    R7_NEXT_DIST_DIR:'.next-shared-'+out.split(/[\\/]/).at(-1),NEXT_TELEMETRY_DISABLED:'1',
    NEXT_PUBLIC_BRANT_ISOLATED_TEST:'1',NEXT_PUBLIC_BRANT_ISOLATED_GENESIS:genesis,
    BRANT_LAUNCH_SQLITE_PATH:dbPath,BRANT_LAUNCH_PROOF_ORIGIN:base,BRANT_LAUNCH_WRITES:'0',
    ROVEKO_PUDGE_SNAPSHOT_KEY:'cd'.repeat(32),ROVEKO_PUDGE_PROOF_CACHE_DIR:join(out,'app-checkpoints'),
    ROVEKO_SMT_BINARY:join(root,'labs/trade-v2-token/gate2/smt-tools/target/debug/trade-v2-smt-tools'),
    ROVEKO_PROOF_BINARY:join(root,'labs/trade-v2-token/gate2/browser-proof/target/debug/trade-v2-recovery')};
  delete env.RAILWAY_PUBLIC_DOMAIN;
  let child,log;
  const timings=[];
  async function request(path,body){
    const start=performance.now();
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:body?{origin:base,host:'127.0.0.1:3143','content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120_000)});
    timings.push({path,status:response.status,ms:Math.round(performance.now()-start)});
    const text=await response.text();
    assert(response.ok,`${path}: HTTP ${response.status}: ${text.slice(0,300)}`);
    return JSON.parse(text);
  }
  async function start(){
    log=createWriteStream(join(out,'app.log'),{flags:'a'});
    child=spawn(process.execPath,[join(app,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3143'],{cwd:app,env,stdio:['ignore','pipe','pipe'],detached:true});
    child.stdout.pipe(log);child.stderr.pipe(log);
    const deadline=Date.now()+180_000;
    while(Date.now()<deadline){
      if(child.exitCode!==null)throw Error('Application exited during startup; see app.log');
      try{const response=await fetch(base+'/api/markets/catalog',{signal:AbortSignal.timeout(5000)});if(response.ok)return;}catch{}
      await delay(500);
    }
    throw Error('Application startup timed out; see app.log');
  }
  async function stop(){
    if(child&&child.exitCode===null){
      process.kill(-child.pid,'SIGTERM');
      const deadline=Date.now()+10_000;
      while(child.exitCode===null&&Date.now()<deadline)await delay(100);
      if(child.exitCode===null)process.kill(-child.pid,'SIGKILL');
    }
    log?.end();
  }
  await start();
  async function browserAcceptance(markets){
    const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/home/timot/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',args:['--no-sandbox']});
    try{
      const context=await browser.newContext();const page=await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base,{waitUntil:'domcontentloaded'});
      for(const market of markets)await page.getByText(market.metadata.name,{exact:true}).first().waitFor({timeout:90_000});
      assert.equal(await page.evaluate(()=>localStorage.getItem('roveko-pudge-market-v1')),null);
      await page.screenshot({path:join(out,'fresh-browser-discovery.png'),fullPage:true});
      for(const market of markets){
        await page.goto(base+'/market/'+market.market,{waitUntil:'domcontentloaded'});
        await page.getByText(market.metadata.name,{exact:true}).waitFor({timeout:90_000});
        assert.equal(await page.evaluate(()=>localStorage.getItem('roveko-pudge-market-v1')),null);
        await page.screenshot({path:join(out,'fresh-browser-'+market.metadata.ticker+'.png'),fullPage:true});
      }
      assert.deepEqual(errors,[]);
      return {freshContext:true,savedManifests:false,markets:markets.map(market=>market.market),errors,walletInteroperability:'NOT TESTED'};
    }finally{await browser.close();}
  }
  return {base,request,timings,stop,browserAcceptance,restart:async()=>{await stop();await start();}};
}

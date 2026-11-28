import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createWriteStream,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright-core';
import {createRequire} from 'node:module';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';

/** Runs actual application routes against the harness's genuine isolated node. */
export async function startSharedMarketApp({genesis,fixture,out,dbPath,approvedCreator,startupTimeoutMs=600_000}){
  const app=fileURLToPath(new URL('..',import.meta.url));
  const root=resolve(app,'../..'),config=join(out,'isolated-app-config.json');
  const base='http://127.0.0.1:3143';
  writeFileSync(config,JSON.stringify({genesis,fixture,endpoint:'http://127.0.0.1:19224/'}));
  const env={...process.env,NODE_ENV:'development',BRANT_ATOMIC_PUDGE_QUALIFICATION:'0',BRANT_ISOLATED_TEST:'1',BRANT_ISOLATED_CONFIG:config,
    R7_NEXT_DIST_DIR:'.next-r7-assignment/shared-native-acceptance',NEXT_TELEMETRY_DISABLED:'1',
    NEXT_PUBLIC_BRANT_ISOLATED_TEST:'1',NEXT_PUBLIC_BRANT_ISOLATED_GENESIS:genesis,
    BRANT_LAUNCH_SQLITE_PATH:dbPath,BRANT_LAUNCH_PROOF_ORIGIN:base,BRANT_LAUNCH_WRITES:approvedCreator?'1':'0',BRANT_LAUNCH_APPROVED_CREATOR:approvedCreator,
    ROVEKO_PUDGE_SNAPSHOT_KEY:'cd'.repeat(32),ROVEKO_PUDGE_PROOF_CACHE_DIR:join(out,'app-checkpoints'),
    ROVEKO_SMT_BINARY:join(root,'labs/trade-v2-token/gate2/smt-tools/target/debug/trade-v2-smt-tools'),
    ROVEKO_PROOF_BINARY:join(root,'labs/trade-v2-token/gate2/browser-proof/target/debug/trade-v2-recovery')};
  delete env.RAILWAY_PUBLIC_DOMAIN;
  let child,log,epoch=0;
  const processes=[];
  const timings=[];
  async function request(path,body){
    const start=performance.now();
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:body?{origin:base,host:'127.0.0.1:3143','sec-fetch-site':'same-origin','content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(120_000)});
    timings.push({path,epoch,side:body?.side,status:response.status,ms:Math.round(performance.now()-start)});
    const text=await response.text();
    assert(response.ok,`${path}: HTTP ${response.status}: ${text.slice(0,300)}`);
    return JSON.parse(text);
  }
  async function start(){
    log=createWriteStream(join(out,'app.log'),{flags:'a'});
    child=spawn(process.execPath,[join(app,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3143'],{cwd:app,env,stdio:['ignore','pipe','pipe'],detached:true});
    processes.push({epoch:++epoch,pid:child.pid,node:process.version,genesis});
    child.stdout.pipe(log);child.stderr.pipe(log);
    const deadline=Date.now()+startupTimeoutMs;
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
  try{await start();}catch(error){await stop();throw error;}
  async function browserAcceptance(markets){
    const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/home/timot/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',args:['--no-sandbox']});
    try{
      const context=await browser.newContext();const page=await context.newPage();
      page.setDefaultNavigationTimeout(120_000);
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base,{waitUntil:'domcontentloaded'});
      for(const market of markets)await page.getByText(market.metadata.name,{exact:true}).first().waitFor({timeout:90_000});
      assert.equal(await page.evaluate(()=>localStorage.getItem('roveko-pudge-market-v1')),null);
      await page.screenshot({path:join(out,'fresh-browser-discovery.png'),fullPage:true});
      for(const market of markets){
        const marketPage=await context.newPage();
        marketPage.on('pageerror',error=>errors.push(error.message));
        await marketPage.goto(base+'/market/'+market.market,{waitUntil:'commit',timeout:120_000});
        await marketPage.getByText(market.metadata.name,{exact:true}).waitFor({timeout:90_000});
        assert.equal(await marketPage.evaluate(()=>localStorage.getItem('roveko-pudge-market-v1')),null);
        await marketPage.screenshot({path:join(out,'fresh-browser-'+market.metadata.ticker+'.png'),fullPage:true});
        await marketPage.close();
      }
      assert.deepEqual(errors,[]);
      return {freshContext:true,savedManifests:false,markets:markets.map(market=>market.market),errors,walletInteroperability:'NOT TESTED'};
    }finally{await browser.close();}
  }
  async function legacyLaunchAcceptance(markets,{rpc}){
    const require=createRequire(import.meta.url),C=require(join(root,'labs/rebuild/native/src/lib.cjs'));
    const webpack=require('next/dist/compiled/webpack/webpack').webpack;
    await new Promise((ok,no)=>webpack({mode:'development',target:'web',entry:join(app,'tests/v2-browser-wallet-entry.cjs'),output:{path:out,filename:'legacy-launch-wallet.js'}},(error,stats)=>error||stats.hasErrors()?no(error||Error(stats.toString({all:false,errors:true}))):ok()));
    const market=markets[0],role=C.locks.findIndex(lock=>ccc.Script.from(lock).hash()===market.owner);assert(role>=0);
    const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/home/timot/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',args:['--no-sandbox']});
    try{
      const page=await browser.newPage();page.setDefaultTimeout(180000);page.setDefaultNavigationTimeout(360000);
      await page.route('**/fixture-wallet-rpc',async route=>{const payload=route.request().postDataJSON();assert(!['send_transaction','send_transaction_dry_run'].includes(payload.method));await route.fulfill({json:{jsonrpc:'2.0',id:payload.id,result:await rpc(payload.method,payload.params)}});});
      await request('/api/v2/launch/sessions',{owner:market.owner});
      await page.goto(base+'/launch',{waitUntil:'commit'});
      await page.evaluate(({owner,market})=>localStorage.setItem('brant-launch-session:'+owner,market),market);
      await page.waitForFunction(()=>Boolean(document.head&&document.body));
      await page.addScriptTag({path:join(out,'legacy-launch-wallet.js')});
      await page.waitForFunction(()=>typeof document.querySelector('ccc-connector')?.updateSigner==='function');
      for(let attempt=0;attempt<20;attempt++){if(await page.locator('ccc-connector').isVisible())break;const button=page.locator('.brant-wallet');if(await button.isEnabled())await button.click();await delay(500);}
      await page.locator('ccc-connector').waitFor({state:'visible'});
      await page.evaluate(async({key,secp})=>{const connector=document.querySelector('ccc-connector');await connector.updateComplete;await connector.updateSigner({name:'Disposable fixture',icon:''},{name:'Legacy fixture',signer:window.createDisposableTestSigner(key,secp,'/fixture-wallet-rpc')});connector.close();},{key:C.keys[role],secp:fixture.secp});
      await page.getByLabel('Saved launches').waitFor();
      assert.equal(await page.getByLabel('Token name',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Ticker',{exact:true}).inputValue(),'');
      await page.getByLabel('Saved launches').selectOption(market.market);
      await page.getByText('Metadata saved',{exact:true}).waitFor();
      assert.equal(await page.getByLabel('Token name',{exact:true}).inputValue(),market.metadata.name);
      assert.equal(await page.getByLabel('Ticker',{exact:true}).inputValue(),market.metadata.ticker);
      assert(await page.getByLabel('Ticker',{exact:true}).isDisabled());
      assert.equal(await page.getByText('Your wallet will ask you to sign a message to authorize publishing this metadata.',{exact:true}).count(),0);
      await page.getByRole('button',{name:'Create new token',exact:true}).click();
      assert.equal(await page.getByLabel('Token name',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Ticker',{exact:true}).inputValue(),'');
      await page.screenshot({path:join(out,'legacy-launch-fresh-after-saved.png'),fullPage:true});
      writeFileSync(join(out,'legacy-launch-lifecycle.json'),JSON.stringify({actualLegacyChain:true,rememberedMarket:market.market,freshDraft:true,metadataHydrated:true,publishedReadOnly:true,noPublicationPrompt:true,newDraftAfterSaved:true},null,2));
    }finally{await browser.close();}
  }
  async function securityAcceptance(markets){
    const states=await Promise.all(markets.map(market=>request('/api/markets/'+market.market)));
    const headers={origin:base,host:'127.0.0.1:3143','sec-fetch-site':'same-origin','content-type':'application/json'};
    const wrong={...states[0].manifest,initializationTransactionHash:states[1].manifest.initializationTransactionHash};
    const response=await fetch(base+'/api/v2/pudge-proof',{method:'POST',headers,body:JSON.stringify({manifest:wrong,owner:markets[0].owner,side:'balance'})});
    assert(!response.ok,'Wrong initialization identity was accepted');
    const db=new DatabaseSync(dbPath);db.exec('PRAGMA busy_timeout=5000');
    const row=db.prepare("SELECT market_key,publication FROM shared_launch_publication WHERE json_extract(publication,'$.market')=?").get(markets[0].market);
    writeFileSync(join(out,'publication-before-corruption.json'),row.publication,{flag:'wx'});
    try{
      const corrupt=JSON.parse(row.publication);corrupt.metadata.name='Corrupted publication';
      db.prepare('UPDATE shared_launch_publication SET publication=? WHERE market_key=?').run(JSON.stringify(corrupt),row.market_key);
      assert(!(await request('/api/markets/catalog')).markets.some(market=>market.market===markets[0].market));
      assert(!(await fetch(base+'/api/markets/'+markets[0].market)).ok,'Cached history bypassed corrupted publication');
    }finally{db.prepare('UPDATE shared_launch_publication SET publication=? WHERE market_key=?').run(row.publication,row.market_key);db.close();}
    const directory=join(out,'app-checkpoints');
    const snapshots=readdirSync(directory).filter(name=>name.endsWith('.snapshot'));
    assert(snapshots.length>0,'No authenticated checkpoint was exercised');
    for(const [index,file]of snapshots.entries()){
      const target=join(directory,file);
      writeFileSync(join(out,`checkpoint-before-corruption-${index}.json`),readFileSync(target));
      writeFileSync(target,'{"corrupted":true}');
    }
    await stop();await start();
    const balances=await Promise.all(states.map((state,index)=>request('/api/v2/pudge-proof',{manifest:state.manifest,owner:markets[index].owner,side:'balance'})));
    for(const [index,balance]of balances.entries()){
      assert.equal(balance.market,states[index].identity);assert.equal(balance.token,states[index].token.typeHash);assert.equal(balance.root,states[index].custodyRoot);assert.equal(balance.balance,'8');
    }
    return {wrongInitializationRejected:true,corruptPublicationRejected:true,corruptCheckpointRebuilt:true,concurrentMarketsIsolated:true};
  }
  async function walletAcceptance(markets,{connect,rpc,receipt,indexed,owner,priorRecords}){
    const require=createRequire(import.meta.url),webpack=require('next/dist/compiled/webpack/webpack').webpack;
    await new Promise((resolve,reject)=>webpack({mode:'development',target:'web',entry:join(app,'tests/v2-browser-wallet-entry.cjs'),output:{path:out,filename:'fixture-wallet.js'}},(error,stats)=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));
    const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'/home/timot/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',args:['--no-sandbox']});
    const records=priorRecords?[...priorRecords]:[],expected=markets.flatMap(market=>['buy','sell'].map(side=>({market:market.market,side})));
    let page;const pageErrors=[],walletRpc={};
    try{
      const context=await browser.newContext();page=await context.newPage();page.setDefaultNavigationTimeout(120_000);
      page.on('pageerror',error=>pageErrors.push(error.message));
      await page.route('**/fixture-wallet-rpc',async route=>{
        const payload=route.request().postDataJSON();
        walletRpc[payload.method]=(walletRpc[payload.method]||0)+1;
        try{
          assert(payload.method.startsWith('get_')||['send_transaction','estimate_cycles','tx_pool_info'].includes(payload.method));
          let result;
          if(payload.method==='send_transaction'){
            const reviewed=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(payload.params[0]));
            const next=expected[records.length];assert(next,'Unexpected fixture wallet transaction');
            assert.equal(reviewed.outputs[0].lock.hash(),next.market);
            assert.equal(reviewed.witnesses[5].slice(12,14),next.side==='buy'?'01':'04');
            const cycles=await rpc('estimate_cycles',[payload.params[0]]);
            result=await rpc(payload.method,payload.params);assert.equal(result,reviewed.hash());
            for(let block=0;block<20;block++){if((await rpc('get_transaction',[result])).tx_status.status==='committed')break;await rpc('generate_block');}
            await indexed(rpc);
            records.push({...next,hash:result,cycles,receipt:await receipt(rpc,result),transaction:payload.params[0]});
          }else result=await rpc(payload.method,payload.params);
          await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:payload.id,result})});
        }catch(error){await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({jsonrpc:'2.0',id:payload.id,error:{code:-32603,message:String(error)}})});}
      });
      for(const market of priorRecords?[]:markets){
        await page.goto(base+'/market/'+market.market,{waitUntil:'domcontentloaded'});
        await connect(page,join(out,'fixture-wallet.js'));
        await page.locator('.preview-editable input').fill('1');
        for(const side of ['buy','sell']){
          await page.getByRole('button',{name:side==='buy'?'Buy':'Sell',exact:true}).click();
          const action=page.getByRole('button',{name:(side==='buy'?'Buy ':'Sell ')+market.metadata.ticker,exact:true});
          await action.waitFor({timeout:90_000});
          await page.waitForFunction(label=>{const button=document.querySelector('.preview-action');return button?.textContent===label&&!button.disabled;},(side==='buy'?'Buy ':'Sell ')+market.metadata.ticker,{timeout:90_000});
          await action.click();
          const key=`roveko-pudge-trade-v1:${genesis}:${owner}:${market.market}`;
          await page.waitForFunction(({key,count})=>{const raw=localStorage.getItem(key+':settled');return raw&&JSON.parse(JSON.parse(raw).raw).transaction.witnesses[5].slice(12,14)===(count==='buy'?'01':'04');},{key,count:side},{timeout:90_000});
        }
        await page.screenshot({path:join(out,'wallet-trades-'+market.metadata.ticker+'.png'),fullPage:true});
      }
      assert.equal(records.length,4);
      for(const path of ['/portfolio','/activity']){
        await page.goto(base+path,{waitUntil:'domcontentloaded'});await connect(page,join(out,'fixture-wallet.js'));
        for(const market of markets){
          await page.getByLabel(path==='/portfolio'?'Portfolio market':'Activity market').selectOption(market.market);
          if(path==='/activity')await page.locator(`a[href$="${records.find(record=>record.market===market.market&&record.side==='sell').hash}"]`).waitFor({state:'attached',timeout:90_000});
          else{
            await page.getByText(market.metadata.name,{exact:true}).waitFor({timeout:90_000});
            await page.waitForFunction(()=>document.querySelector('.portfolio-rvk-total dd span')?.textContent==='1'&&document.querySelector('.portfolio-rvk-total .portfolio-balance p')?.textContent==='Verified',undefined,{timeout:90_000});
          }
          await page.screenshot({path:join(out,path.slice(1)+'-'+market.metadata.ticker+'.png'),fullPage:true});
        }
      }
      assert.equal(await page.evaluate(()=>localStorage.getItem('roveko-pudge-market-v1')),null);
      assert.deepEqual(pageErrors,[]);
      return {wallet:'SIMULATED disposable fixture signer',chain:'REAL isolated CKB',externalWalletInteroperability:'NOT TESTED',records,pageErrors,walletRpc};
    }catch(error){
      writeFileSync(join(out,'browser-wallet-partial.json'),JSON.stringify({records,pageErrors,walletRpc,error:String(error).replace(/0x[0-9a-f]{64}/gi,'[hash]')},null,2));
      if(page)await page.screenshot({path:join(out,'browser-wallet-failure.png'),fullPage:true}).catch(()=>{});
      throw error;
    }finally{await browser.close();}
  }
  return {base,request,timings,processes,stop,browserAcceptance,walletAcceptance,securityAcceptance,legacyLaunchAcceptance,restart:async(overrides={})=>{await stop();Object.assign(env,overrides);await start();}};
}

import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ccc} from '@ckb-ccc/core';

const base=process.env.ROVEKO_TEST_URL||'http://127.0.0.1:3000';
const {readFileSync}=await import('node:fs');
const records=JSON.parse(readFileSync(new URL('./fixtures/pudge-market-rpc.json',import.meta.url)));
const rpc=(method,params=[])=>records[JSON.stringify([method,params])];
const originalFetch=globalThis.fetch;
let market;
try{
  globalThis.fetch=async(_url,options)=>{
    const {id,method,params}=JSON.parse(options.body);
    return Response.json({id,result:rpc(method,params)});
  };
  const {getPudgeMarketData}=await import('../lib/pudge-market-service.ts');
  market=await getPudgeMarketData();
}finally{globalThis.fetch=originalFetch;}
const trade=market.history.find(item=>item.hash==='0xe853a6fd0f5c6cd0d73c1822c0953b728b9e2860cf641d36c4c2bee22f7a9bd1');
assert.ok(trade);
const row=rpc('get_transaction',[trade.hash]);
const header=rpc('get_header',[row.tx_status.block_hash]);
assert.equal(rpc('get_block_hash',[header.number]),header.hash);
const {code_hash:codeHash,hash_type:hashType,args}=row.transaction.outputs[4].lock;
const address=ccc.Address.from({script:{codeHash,hashType,args},prefix:'ckt'}).toString();
const otherAddress=ccc.Address.from({script:{codeHash,hashType,args:'0x'+'ab'.repeat(20)},prefix:'ckt'}).toString();
const record={version:1,genesis:market.genesis,owner:trade.owner,txHash:trade.hash,transaction:row.transaction};
const key='roveko-pudge-trade-v1:'+market.genesis+':'+trade.owner;
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block'});
    const page=await context.newPage();
    const timings=new Map();
    page.on('console',message=>{
      const prefix='Brant transaction timeline ';
      if(message.text().startsWith(prefix)){
        const {stage,at}=JSON.parse(message.text().slice(prefix.length));
        if(!timings.has(stage))timings.set(stage,at);
      }
    });
    let state='pending';
    let refreshFails=false, orphaned=false, broadcasts=0, indexerLag=width===1280;
    let delaySettlement;

    await context.route('**/*',route=>{
      const request=route.request();
      if(request.method()==='POST'&&/"send_transaction"/.test(request.postData()??'')){
        broadcasts++;
        return route.abort();
      }
      return route.fallback();
    });
    await context.route('**/api/markets**',route=>refreshFails?route.fulfill({status:503,json:{error:'Fixture refresh unavailable'}}):route.fulfill({
      json:indexerLag?{...market,history:market.history.filter(item=>item.hash!==trade.hash)}:market,
    }));
    await context.route('**/api/v2/pudge-rpc',async route=>{
      const request=route.request().postDataJSON();
      if(Array.isArray(request)){
        if(request.some(call=>call.method==='send_transaction'))return route.fallback();
        return route.fulfill({json:{result:request.map(({method,params})=>rpc(method,params))}});
      }
      const {method,params}=request;
      if(method==='get_block_hash'&&params[0]==='0x0')return route.fulfill({json:{result:market.genesis}});
      if(method==='get_header'&&params[0]===header.hash)return route.fulfill({json:{result:header}});
      if(method==='get_block_hash'&&params[0]===header.number)return route.fulfill({json:{result:orphaned?'0x'+'00'.repeat(32):header.hash}});
      if(method==='get_transaction'&&params[0]===trade.hash){
        if(delaySettlement&&route.request().frame().page()===page)await delaySettlement();
        if(state==='unknown')return route.fulfill({json:{result:null}});
        if(state==='offline')return route.fulfill({status:503,json:{error:'Fixture unavailable'}});
        return route.fulfill({json:{result:state==='committed'?row:{...row,tx_status:{status:state}}}});
      }
      if(method==='get_transaction'&&params[0]===market.manifest.initializationTransactionHash)return route.fulfill({status:503,json:{error:'Reconciliation fixture unavailable'}});
      if(method==='send_transaction')return route.fallback();
      const result=rpc(method,params);
      return result===undefined?route.continue():route.fulfill({json:{result}});
    });
    await context.route('**/*',route=>{
      const request=route.request();
      if(request.method()==='POST'&&/"send_transaction"/.test(request.postData()??''))return route.fallback();
      if(new URL(request.url()).origin===new URL(base).origin)return route.fallback();
      const body=request.postDataJSON();
      if(body?.method==='get_header_by_number'&&body.params?.[0]==='0x0'){
        return route.fulfill({json:{jsonrpc:'2.0',id:body.id,result:{...header,number:'0x0',hash:market.genesis}}});
      }
      return route.abort();
    });
    await context.addInitScript(({address,otherAddress,key,record})=>{
      if(!localStorage.getItem(key+':fixture-seeded')){
        localStorage.setItem(key,JSON.stringify(record));
        localStorage.setItem(key+':submitted',record.txHash);
        localStorage.setItem(key+':fixture-seeded','1');
      }
      let connected=sessionStorage.fixtureWalletConnected==='1';
      let selected=sessionStorage.fixtureWalletAddress||address;
      const listeners=new Map();
      window.switchFixtureOwner=other=>{
        selected=other?otherAddress:address;
        sessionStorage.fixtureWalletAddress=selected;
        for(const fn of [...(listeners.get('accountsChanged')??[])])fn([selected]);
      };
      window.utxoGlobal={ckbSigner:{
        connect:async()=>{connected=true;sessionStorage.fixtureWalletConnected='1';},isConnected:async()=>connected,getNetwork:async()=>'nervos_testnet',
        getAccount:async()=>[selected],getPublicKey:async()=>[],
        on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);},
        removeListener(event,fn){listeners.get(event)?.delete(fn);},
      }};
    },{address,otherAddress,key,record});
    const connect=async(page)=>{
    await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();
    await page.getByText(/UTXO\s*Global/i).first().click();
    await page.getByRole('button',{name:'CKB CKB',exact:true}).click();
    };
    await page.goto(base+'/market/pudge-xudt',{timeout:60000});
    await connect(page);
    await page.getByRole('status').getByText('Pending',{exact:true}).waitFor({timeout:30000});
    assert.equal(await page.getByText('Submission outcome uncertain',{exact:true}).count(),0);
    const peer=await context.newPage();
    await peer.goto(base+'/market/pudge-xudt');
    await connect(peer);
    await peer.getByRole('status').getByText('Pending',{exact:true}).waitFor();
    state='offline';
    await page.waitForTimeout(2300);
    assert.ok(await page.evaluate(key=>localStorage.getItem(key),key));
    refreshFails=width===390;
    state='committed';
    await page.getByRole('status').filter({hasText:'Confirmed'}).getByRole('link',{name:'Explorer'}).waitFor({timeout:30000});
    await peer.getByRole('status').getByText('Confirmed',{exact:true}).waitFor();
    assert.ok((await page.getByText('Trade confirmed',{exact:true}).count())+(await peer.getByText('Trade confirmed',{exact:true}).count())<=1);
    await page.waitForFunction(key=>!localStorage.getItem(key)&&!!localStorage.getItem(key+':settled'),key);
    if(indexerLag){
      await page.getByText('Updating trading data',{exact:true}).waitFor();
      await page.getByRole('button',{name:'50 CKB',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Buy Token',exact:true}).isDisabled(),true);
      indexerLag=false;
      await page.getByText('Updating trading data',{exact:true}).waitFor({state:'hidden'});
      console.log('Confirmed receipt persisted while verified history caught up');
    }
    await page.waitForFunction(()=>document.querySelector('[role=status]')!==null);
    const refreshMs=timings.get('refresh-request')-timings.get('canonical-confirmation');
    if(Number.isFinite(refreshMs))assert.ok(refreshMs>=0&&refreshMs<3000,String(refreshMs));
    const ms=timings.get('receipt-displayed')-timings.get('canonical-confirmation');
    if(Number.isFinite(ms))assert.ok(ms>=0&&ms<3000,String(ms));
    refreshFails=false;
    await page.reload();
    await page.getByRole('status').getByText('Confirmed',{exact:true}).waitFor({timeout:30000});
    assert.equal(await page.getByText('Trade confirmed',{exact:true}).count(),0);
    assert.equal(await page.evaluate(key=>localStorage.getItem(key+':confirmed'),key),trade.hash);
    if(width===1280){
      let release;
      const held=new Promise(resolve=>{release=resolve;});
      const {promise:started,resolve:markStarted}=Promise.withResolvers();
      delaySettlement=()=>{markStarted();return held;};
      await page.reload();
      await Promise.race([started,page.waitForResponse(()=>false,{timeout:15000})]);
      await page.evaluate(()=>window.switchFixtureOwner(true));
      const receipt=page.getByRole('status').getByRole('link',{name:'Explorer'});
      await receipt.waitFor({state:'hidden'});
      delaySettlement=undefined;
      const rechecked=page.waitForResponse(response=>response.url().endsWith('/api/v2/pudge-rpc')&&
        response.request().postData()?.includes(header.hash));
      release();
      await rechecked;
      assert.equal(await receipt.count(),0);
      await page.evaluate(()=>window.switchFixtureOwner(false));
      await page.getByRole('status').getByText('Confirmed',{exact:true}).waitFor();
      console.log('Delayed owner A settlement did not appear for owner B');
    }
    orphaned=true;
    await page.reload();
    await page.getByRole('status').getByText('Rechecking confirmation',{exact:true}).waitFor();
    if(width===1280){
      await peer.close();
      await page.getByRole('button',{name:'50 CKB',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Buy Token',exact:true}).isDisabled(),true);
      state='rejected';
      await page.evaluate(({key,record})=>{
        localStorage.removeItem(key+':settled');
        localStorage.removeItem(key+':confirmed');
        localStorage.setItem(key,JSON.stringify(record));
        localStorage.setItem(key+':submitted',record.txHash);
      },{key,record});
      await page.reload();
      await page.getByText('Trade rejected',{exact:true}).waitFor();
      assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),null);
      console.log('Orphaned receipt blocked trading and node rejection cleared the pending journal');
      state='unknown';
      await page.evaluate(({key,record})=>localStorage.setItem(key,JSON.stringify(record)),{key,record});
      await page.reload();
      await page.getByRole('status').getByText('Submission outcome uncertain',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Check status',exact:true}).click();
      assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),record);
      assert.equal(await page.evaluate(key=>localStorage.getItem(key+':submitted'),key),null);
      state='pending';
      await page.getByRole('status').getByText('Pending',{exact:true}).waitFor();
      console.log('Journal without acknowledgement survived reload and reconciled without resubmission');
    }
    assert.equal(broadcasts,0);
    console.log({width,verifiedInclusionToReceiptMs:ms,confirmationToRefreshMs:refreshMs});
    await context.close();
  }
}finally{await browser.close();}

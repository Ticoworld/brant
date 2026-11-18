// Browser test with an injected wallet and read-only fixture RPC.
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ccc} from '@ckb-ccc/core';

const genesis='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
const lock=ccc.Script.from({codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:'0x'+'12'.repeat(20)});
const address=ccc.Address.from({script:lock,prefix:'ckt'}).toString();
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  let reads=0,lag='0x62',fail=false,hold,rpcGenesis=genesis;
  const result=method=>{
    if(method==='get_tip_header')return {number:'0x64',hash:genesis};
    if(method==='get_indexer_tip')return {block_number:lag,block_hash:genesis};
    if(method==='get_block_hash')return rpcGenesis;
    if(method==='get_header_by_number')return {hash:genesis,number:'0x0',parent_hash:genesis,transactions_root:genesis,proposals_hash:genesis,extra_hash:genesis,dao:genesis,compact_target:'0x0',epoch:'0x0',timestamp:'0x0',version:'0x0',nonce:'0x0'};
    return {objects:[]};
  };
  await page.route(/\/api\/v2\/pudge-rpc$|https:\/\/testnet\.ckb\.dev\//,async route=>{
    const request=route.request().postDataJSON();
    if(request.method==='get_cells'){
      reads++;
      if(hold)await hold;
      if(fail){await route.fulfill({status:503,json:{error:'Fixture balance failure'}});return;}
    }
    const reply=call=>({jsonrpc:'2.0',id:call.id,result:result(call.method)});
    await route.fulfill({json:Array.isArray(request)?request.map(reply):reply(request)});
  });
  await page.addInitScript(address=>{
    let connected=false,hidden=false;
    const listeners=new Map();
    Object.defineProperty(document,'hidden',{get:()=>hidden});
    window.fixture={connects:0,signs:0,visibility(value){hidden=value;document.dispatchEvent(new Event('visibilitychange'));},
      disconnect(){connected=false;listeners.get('accountsChanged')?.();}};
    window.utxoGlobal={ckbSigner:{
      connect:async()=>{connected=true;window.fixture.connects++;},
      isConnected:async()=>connected,getNetwork:async()=>'nervos_testnet',
      getAccount:async()=>[address],getPublicKey:async()=>[],
      on:(name,fn)=>listeners.set(name,fn),removeListener:name=>listeners.delete(name),
      signTransaction:async()=>{window.fixture.signs++;throw Error('Unexpected approval');},
    }};
  },address);
  await page.goto(process.env.ROVEKO_URL||'http://127.0.0.1:3000');
  await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();
  await page.getByText(/UTXO\s*Global/i).first().click({timeout:8000}).catch(async error=>{
    console.log(await page.locator('ccc-connector').ariaSnapshot());
    throw error;
  });
  const wallet=page.locator('header button').filter({hasText:address.slice(0,10)});
  await page.getByRole('button',{name:'CKB CKB',exact:true}).click();
  await wallet.waitFor({timeout:8000}).catch(async error=>{
    console.log(await page.locator('ccc-connector').ariaSnapshot(),await page.evaluate(()=>window.fixture.connects));
    throw error;
  });
  await page.getByText('Available to trade: 0 CKB',{exact:true}).waitFor();
  await page.clock.install();
  await wallet.click();
  assert.equal(await page.getByText('Opening wallet',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>window.fixture.connects),1);
  await page.mouse.click(3,3);
  let release;
  hold=new Promise(resolve=>{release=resolve;});
  const initial=reads;
  await Promise.all([
    page.waitForRequest(request=>request.url().includes('/pudge-rpc')&&request.postDataJSON().method==='get_cells'),
    page.clock.fastForward(31_000),
  ]);
  await page.clock.fastForward(62_000);
  assert.equal(reads,initial+1);
  assert.equal(await wallet.count(),1);
  assert.equal(await page.getByText('Checking wallet',{exact:true}).count(),0);
  assert.equal(await page.getByText('Available to trade: 0 CKB',{exact:true}).count(),0);
  release();
  hold=undefined;
  await page.getByText('Available to trade: 0 CKB',{exact:true}).waitFor();
  await page.evaluate(()=>window.fixture.visibility(true));
  const hiddenReads=reads;
  await page.clock.fastForward(61_000);
  assert.equal(reads,hiddenReads);
  lag='0x40';
  await page.evaluate(()=>window.fixture.visibility(false));
  await page.getByText(/balance index is catching up/).waitFor();
  assert.equal(await wallet.count(),1);
  lag='0x62';
  fail=true;
  await page.getByRole('button',{name:'Retry',exact:true}).first().dispatchEvent('click');
  await page.getByText('Wallet or network data could not be loaded.').waitFor();
  assert.equal(await wallet.count(),1);
  for(const path of ['/portfolio','/activity','/']){
    await page.locator(`nav a[href="${path}"]`).dispatchEvent('click');
    await page.waitForURL(url=>url.pathname===path);
    assert.equal(await wallet.count(),1);
  }
  fail=false;
  rpcGenesis='0x'+'00'.repeat(32);
  await page.clock.fastForward(31_000);
  await page.getByText('The connected wallet is not using Pudge Testnet.').waitFor();
  assert.equal(await page.evaluate(()=>window.fixture.signs),0);
  rpcGenesis=genesis;
  hold=new Promise(resolve=>{release=resolve;});
  await Promise.all([
    page.waitForRequest(request=>request.url().includes('/pudge-rpc')&&request.postDataJSON().method==='get_cells'),
    page.clock.fastForward(31_000),
  ]);
  await page.evaluate(()=>window.fixture.disconnect());
  await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().waitFor();
  release();
  hold=undefined;
  await page.waitForResponse(response=>response.url().includes('/pudge-rpc')&&response.request().postDataJSON().method==='get_cells');
  assert.equal(await wallet.count(),0);
  console.log('Wallet panel, navigation, coalescing, visibility, lag, failure, wrong network, and delayed disconnect passed');
}finally{await browser.close();}

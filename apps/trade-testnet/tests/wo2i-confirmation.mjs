import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ccc} from '@ckb-ccc/core';

const base=process.env.ROVEKO_TEST_URL||'http://127.0.0.1:3000';
const get=async path=>{const response=await fetch(base+path);assert.ok(response.ok);return response.json();};
const rpc=async(method,params)=>{
  const response=await fetch(base+'/api/v2/pudge-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,params})});
  assert.ok(response.ok);
  return (await response.json()).result;
};
const market=await get('/api/markets?display=1');
const trade=market.history.find(item=>item.hash===(process.env.ROVEKO_TEST_TRADE||'0x0df97d1f6b9cb9d0e7008bf603da4766f705f70afcd8fc6b57ee638a9881ae1a'));
assert.ok(trade);
const row=await rpc('get_transaction',[trade.hash]);
const header=await rpc('get_header',[row.tx_status.block_hash]);
assert.equal(await rpc('get_block_hash',[header.number]),header.hash);
const {code_hash:codeHash,hash_type:hashType,args}=row.transaction.outputs[4].lock;
const address=ccc.Address.from({script:{codeHash,hashType,args},prefix:'ckt'}).toString();
const record={version:1,genesis:market.genesis,owner:trade.owner,txHash:trade.hash,transaction:row.transaction};
const key='roveko-pudge-trade-v1:'+market.genesis+':'+trade.owner;
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  for(const width of [1280,390]){
    const page=await browser.newPage({viewport:{width,height:850}});
    const timings=new Map();
    page.on('console',message=>{
      const prefix='Roveko transaction timeline ';
      if(message.text().startsWith(prefix)){
        const {stage,at}=JSON.parse(message.text().slice(prefix.length));
        if(!timings.has(stage))timings.set(stage,at);
      }
    });
    let state='pending';
    let incorporated=false;
    await page.route('**/api/v2/pudge-proof?trade=*',route=>route.fulfill({json:{incorporated,trade:trade.hash,owner:trade.owner}}));
    await page.route('**/api/markets**',route=>route.fulfill({json:market}));
    await page.route('**/api/v2/pudge-rpc',route=>{
      const {method,params}=route.request().postDataJSON();
      if(method==='get_header'&&params[0]===header.hash)return route.fulfill({json:{result:header}});
      if(method==='get_block_hash'&&params[0]===header.number)return route.fulfill({json:{result:header.hash}});
      if(method==='get_transaction'&&params[0]===trade.hash){
        if(state==='offline')return route.fulfill({status:503,json:{error:'Fixture unavailable'}});
        return route.fulfill({json:{result:state==='committed'?row:{...row,tx_status:{status:state}}}});
      }
      if(method==='get_transaction'&&params[0]===market.manifest.initializationTransactionHash)return route.fulfill({status:503,json:{error:'Reconciliation fixture unavailable'}});
      if(method==='send_transaction')throw Error('Fixture attempted a broadcast');
      return route.continue();
    });
    await page.addInitScript(({address,key,record})=>{
      if(!sessionStorage.seeded){
        localStorage.setItem(key,JSON.stringify(record));
        localStorage.setItem(key+':submitted',record.txHash);
        sessionStorage.seeded='1';
      }
      let connected=sessionStorage.fixtureWalletConnected==='1';
      window.utxoGlobal={ckbSigner:{
        connect:async()=>{connected=true;sessionStorage.fixtureWalletConnected='1';},isConnected:async()=>connected,getNetwork:async()=>'nervos_testnet',
        getAccount:async()=>[address],getPublicKey:async()=>[],on(){},removeListener(){},
      }};
    },{address,key,record});
    const connect=async()=>{
    await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();
    await page.getByText(/UTXO\s*Global/i).first().click();
    await page.getByRole('button',{name:'CKB CKB',exact:true}).click();
    };
    await page.goto(base+'/market/pudge-xudt',{timeout:60000});
    await connect();
    await page.getByRole('status').getByText('Pending',{exact:true}).waitFor({timeout:30000});
    assert.equal(await page.getByText('Submission outcome uncertain',{exact:true}).count(),0);
    state='offline';
    await page.waitForTimeout(2300);
    assert.ok(await page.evaluate(key=>localStorage.getItem(key),key));
    state='committed';
    await page.getByRole('status').filter({hasText:'Confirmed'}).getByRole('link',{name:'Explorer'}).waitFor({timeout:30000});
    await page.getByText('Trade confirmed',{exact:true}).waitFor();
    await page.waitForFunction(()=>!!document.querySelector('[data-sonner-toast]'));
    assert.equal(await page.getByText('Trade confirmed',{exact:true}).count(),1);
    assert.ok(await page.evaluate(key=>localStorage.getItem(key),key));
    await page.waitForFunction(()=>document.querySelector('[role=status]')!==null);
    const refreshMs=timings.get('refresh-request')-timings.get('canonical-confirmation');
    assert.ok(refreshMs>=0&&refreshMs<3000,String(refreshMs));
    const ms=timings.get('receipt-displayed')-timings.get('canonical-confirmation');
    assert.ok(ms>=0&&ms<3000,String(ms));
    await page.reload();
    await page.getByRole('status').getByText('Confirmed',{exact:true}).waitFor({timeout:30000});
    assert.equal(await page.getByText('Trade confirmed',{exact:true}).count(),0);
    state='proposed';
    await page.getByRole('status').filter({hasText:'Proposed'}).waitFor({timeout:30000});
    assert.ok(await page.evaluate(key=>localStorage.getItem(key),key));
    incorporated=true;
    state='committed';
    await page.waitForFunction(key=>!localStorage.getItem(key),key,{timeout:30000});
    assert.equal(await page.evaluate(key=>localStorage.getItem(key+':confirmed'),key),trade.hash);
    console.log({width,verifiedInclusionToReceiptMs:ms,confirmationToRefreshMs:refreshMs});
    await page.close();
  }
}finally{await browser.close();}

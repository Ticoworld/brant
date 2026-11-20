import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ccc} from '@ckb-ccc/core';
import {readFileSync} from 'node:fs';

const base=process.env.ROVEKO_TEST_URL||'http://127.0.0.1:3000';
const marketResponse=await fetch(base+'/api/markets',{signal:AbortSignal.timeout(45000)});
assert.ok(marketResponse.ok,await marketResponse.clone().text());
const market=await marketResponse.json();
assert.ok(market.manifest);
assert.equal(market.historyState,'verified');
const response=await fetch(base+'/api/v2/pudge-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method:'get_transaction',params:[market.manifest.initializationTransactionHash]})});
const {result}=await response.json();
const lock=result.transaction.outputs[4].lock;
const address=ccc.Address.from({script:{codeHash:lock.code_hash,hashType:lock.hash_type,args:lock.args},prefix:'ckt'}).toString();
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  page.on('console',message=>{if(message.text().startsWith('Roveko trade preparation'))console.log(message.text());});
  let proofs=0,rpcs=0,sends=0;
  await context.route('**/*',route=>{
    const request=route.request(),body=request.method()==='POST'?request.postData():null;
    if(body?.includes('"send_transaction"')){sends++;return route.abort();}
    if(request.url().endsWith('/api/v2/pudge-proof'))proofs++;
    if(request.url().endsWith('/api/v2/pudge-rpc'))rpcs++;
    return route.continue();
  });
  await context.addInitScript(address=>{
    let connected=sessionStorage.fixtureWalletConnected==='1';
    window.utxoGlobal={ckbSigner:{
      connect:async()=>{connected=true;sessionStorage.fixtureWalletConnected='1';},isConnected:async()=>connected,getNetwork:async()=>'nervos_testnet',
      getAccount:async()=>[address],getPublicKey:async()=>[],on(){},removeListener(){},
      signTransaction:async()=>{
        window.readiness=performance.now()-window.clicked;
        window.promptCount=(window.promptCount||0)+1;
        return new Promise((_,reject)=>{window.rejectApproval=()=>reject(Error('Fixture rejected approval'));});
      },
    }};
  },address);
  async function openTrade(tab){
    await tab.bringToFront();
    await tab.goto(base+'/market/pudge-xudt',{timeout:60000});
    await tab.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();
    await tab.getByText(/UTXO\s*Global/i).first().click();
    await tab.getByRole('button',{name:'CKB CKB',exact:true}).click();
    await tab.getByRole('button',{name:'50 CKB',exact:true}).click();
    return tab.getByRole('button',{name:'Buy Token',exact:true}).and(tab.locator(':enabled'));
  }
  const buy=await openTrade(page);
  for(let sample=0;sample<1;sample++){
    const startingProofs=proofs;
    await buy.waitFor();
    const beforeClick=[proofs,rpcs];
    await buy.evaluate(button=>{
      if(button.disabled)throw Error('Buy is disabled');
      window.readiness=null;
      window.clicked=performance.now();
      button.click();
    });
    await page.waitForFunction(()=>window.readiness!==null,{},{timeout:90000}).catch(async error=>{
      console.log(await page.getByRole('alert').allTextContents());
      throw error;
    });
    await page.getByRole('status').getByText('Approve in UTXO Global',{exact:true}).first().waitFor();
    const peer=await context.newPage();
    const competingBuy=await openTrade(peer);
    await competingBuy.click();
    await peer.getByText('Another trade action is in progress',{exact:true}).first().waitFor();
    assert.equal(await page.evaluate(()=>window.promptCount),1);
    assert.equal(await peer.evaluate(()=>window.promptCount??0),0);
    await page.evaluate(()=>window.rejectApproval());
    await buy.waitFor();
    assert.equal(await page.evaluate(()=>window.promptCount),sample+1);
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('roveko-pudge-trade-v1:')&&key.split(':').length===3)),false);
    console.log({sample,clickToWalletMs:Math.round(await page.evaluate(()=>window.readiness)),backgroundProofs:beforeClick[0]-startingProofs,clickProofs:proofs-beforeClick[0],clickRpcs:rpcs-beforeClick[1]});
    await competingBuy.click();
    await peer.getByRole('status').getByText('Approve in UTXO Global',{exact:true}).first().waitFor().catch(async error=>{
      console.log('Peer retry',await peer.getByRole('status').allTextContents(),await peer.getByRole('alert').allTextContents());
      throw error;
    });
    await peer.waitForFunction(()=>window.promptCount===1);
    assert.equal(await peer.evaluate(()=>window.promptCount),1);
    await peer.evaluate(()=>window.rejectApproval());
    await competingBuy.waitFor();
    assert.equal(sends,0);
    console.log({walletAttempts:2,blockedCompetingAttempts:1,submissionAttempts:sends});
    await peer.close();
  }
  const recordedHash='0xe853a6fd0f5c6cd0d73c1822c0953b728b9e2860cf641d36c4c2bee22f7a9bd1';
  const recorded=market.history.find(event=>event.hash===recordedHash);
  assert.ok(recorded,'The live verified history must contain the recorded Sell');
  const records=JSON.parse(readFileSync(new URL('./fixtures/pudge-market-rpc.json',import.meta.url)));
  const row=records[JSON.stringify(['get_transaction',[recordedHash]])];
  assert.equal(recorded.owner,ccc.Script.from({codeHash:lock.code_hash,hashType:lock.hash_type,args:lock.args}).hash());
  let lagging=true,prepareCalls=0;
  await page.route('**/api/markets**',route=>route.fulfill({
    json:lagging?{...market,history:market.history.filter(event=>event.hash!==recordedHash)}:market,
  }));
  await page.route('**/api/v2/pudge-proof',route=>{
    const data=route.request().postDataJSON();
    if(lagging&&data?.side==='buy'&&data?.quantity&&!data.balanceOnly&&!data.synchronize)prepareCalls++;
    return route.fallback();
  });
  const attempt={version:1,genesis:market.genesis,owner:recorded.owner,txHash:recordedHash,transaction:row.transaction};
  await page.evaluate(attempt=>{
    const key='roveko-pudge-trade-v1:'+attempt.genesis+':'+attempt.owner;
    localStorage.setItem(key,JSON.stringify(attempt));
    localStorage.setItem(key+':submitted',attempt.txHash);
  },attempt);
  await page.bringToFront();
  await page.reload();
  await page.getByRole('status').getByText('Confirmed',{exact:true}).waitFor();
  await page.getByText('Updating trading data',{exact:true}).waitFor();
  await page.getByRole('button',{name:'50 CKB',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Buy Token',exact:true}).isDisabled(),true);
  await page.getByText('Synchronizing trading state',{exact:true}).waitFor();
  assert.equal(prepareCalls,0,'Executable buy proof requested during history lag');
  const proofResponse=page.waitForResponse(response=>response.url().endsWith('/api/v2/pudge-proof')&&
    response.request().postDataJSON()?.side==='buy'&&!response.request().postDataJSON()?.balanceOnly,{timeout:45000});
  lagging=false;
  void proofResponse.catch(()=>{});
  await page.getByText('Updating trading data',{exact:true}).waitFor({state:'hidden',timeout:45000});
  const prepared=await proofResponse;
  assert.ok(prepared.ok(),`Read-only Pudge proof returned HTTP ${prepared.status()}: ${await prepared.text()}`);
  const proof=await prepared.json();
  const batchResponse=page.waitForResponse(response=>response.url().endsWith('/api/v2/pudge-rpc')&&
    Array.isArray(response.request().postDataJSON())&&response.ok(),{timeout:45000});
  await buy.click({timeout:45000});
  const batch=await batchResponse;
  const request=batch.request().postDataJSON();
  const {result}=await batch.json();
  assert.deepEqual(request.slice(1,5).map(call=>call.params[0]),proof.points);
  assert.ok(result.slice(1,5).every(cell=>cell.status==='live'));
  assert.equal('0x'+result[3].cell.data.content.slice(34),proof.proof.old_root);
  await page.waitForFunction(()=>window.promptCount===1);
  await page.getByRole('status').getByText('Approve in UTXO Global',{exact:true}).first().waitFor();
  await page.evaluate(()=>window.rejectApproval());
  assert.equal(sends,0);
  console.log({postSellWalletAttempts:1,liveSingletons:proof.points,custodyRoot:proof.proof.old_root,submissionAttempts:sends});
}finally{await browser.close();}

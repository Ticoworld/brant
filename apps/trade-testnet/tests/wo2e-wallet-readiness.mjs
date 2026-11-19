import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ccc} from '@ckb-ccc/core';

const base='http://127.0.0.1:3000';
const marketResponse=await fetch(base+'/api/markets?display=1',{signal:AbortSignal.timeout(45000)});
assert.ok(marketResponse.ok,await marketResponse.clone().text());
const market=await marketResponse.json();
assert.ok(market.manifest);
const response=await fetch(base+'/api/v2/pudge-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method:'get_transaction',params:[market.manifest.initializationTransactionHash]})});
const {result}=await response.json();
const lock=result.transaction.outputs[4].lock;
const address=ccc.Address.from({script:{codeHash:lock.code_hash,hashType:lock.hash_type,args:lock.args},prefix:'ckt'}).toString();
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
  const page=await browser.newPage();
  page.on('console',message=>{if(message.text().startsWith('Roveko trade preparation'))console.log(message.text());});
  let proofs=0,rpcs=0;
  await page.route('**/*',route=>{
    const request=route.request(),body=request.method()==='POST'?request.postData():null;
    if(body?.includes('"send_transaction"'))return route.abort();
    if(request.url().endsWith('/api/v2/pudge-proof'))proofs++;
    if(request.url().endsWith('/api/v2/pudge-rpc'))rpcs++;
    return route.continue();
  });
  await page.addInitScript(address=>{
    let connected=false;
    window.utxoGlobal={ckbSigner:{
      connect:async()=>{connected=true;},isConnected:async()=>connected,getNetwork:async()=>'nervos_testnet',
      getAccount:async()=>[address],getPublicKey:async()=>[],on(){},removeListener(){},
      signTransaction:async()=>{
        window.readiness=performance.now()-window.clicked;
        window.promptCount=(window.promptCount||0)+1;
        return new Promise((_,reject)=>{window.rejectApproval=()=>reject(Error('Fixture rejected approval'));});
      },
    }};
  },address);
  await page.goto(base+'/market/pudge-xudt',{timeout:60000});
  await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();
  await page.getByText(/UTXO\s*Global/i).first().click();
  await page.getByRole('button',{name:'CKB CKB',exact:true}).click();
  const budget=page.getByRole('button',{name:'50 CKB',exact:true});
  await budget.click({timeout:60000});
  const buy=page.getByRole('button',{name:'Buy Token',exact:true}).and(page.locator(':enabled'));
  for(let sample=0;sample<5;sample++){
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
    await page.getByRole('button',{name:'Approve in UTXO Global',exact:true}).waitFor();
    await page.evaluate(()=>window.rejectApproval());
    await buy.waitFor();
    assert.equal(await page.evaluate(()=>window.promptCount),sample+1);
    assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(key=>key.startsWith('roveko-pudge-trade-v1:')&&key.split(':').length===3)),false);
    console.log({sample,clickToWalletMs:Math.round(await page.evaluate(()=>window.readiness)),backgroundProofs:beforeClick[0]-startingProofs,clickProofs:proofs-beforeClick[0],clickRpcs:rpcs-beforeClick[1]});
  }
}finally{await browser.close();}

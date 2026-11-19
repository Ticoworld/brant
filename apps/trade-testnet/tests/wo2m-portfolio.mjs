import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {ccc} from '@ckb-ccc/core';
const base='http://127.0.0.1:3000';
const response=await fetch(base+'/api/v2/pudge-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method:'get_transaction',params:['0x7441f36f2467ae22eb223140cf5cab42430aeac5099825556f9a07f85c92179d']})});
const {result}=await response.json(),l=result.transaction.outputs[4].lock;
const address=ccc.Address.from({script:{codeHash:l.code_hash,hashType:l.hash_type,args:l.args},prefix:'ckt'}).toString();
const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
for(const width of [1280,390]){
 const page=await browser.newPage({viewport:{width,height:850}});
 let failures=0;
 await page.route('**/api/v2/pudge-proof',async route=>{
  if(route.request().method()==='POST'&&route.request().postDataJSON().side==='balance'&&failures++===0)return route.fulfill({status:502,body:'Temporary RPC failure'});
  return route.continue();
 });
 await page.addInitScript(address=>{
  let connected=false;
  window.utxoGlobal={ckbSigner:{connect:async()=>{connected=true;},isConnected:async()=>connected,getNetwork:async()=>'nervos_testnet',getAccount:async()=>[address],getPublicKey:async()=>[],on(){},removeListener(){}}};
 },address);
 await page.goto(base+'/portfolio');
 await page.getByRole('button',{name:'Connect Wallet',exact:true}).first().click();
 await page.getByText(/UTXO\s*Global/i).first().click();
 const start=Date.now();
 await page.getByRole('button',{name:'CKB CKB',exact:true}).click();
 await page.getByText('Temporary RPC failure',{exact:true}).waitFor();
 await page.locator('#withdraw-quantity').waitFor({timeout:60000});
 assert.equal(await page.getByText('Temporary RPC failure',{exact:true}).count(),0);
 const ready=Date.now()-start;
 await page.getByRole('link',{name:'Markets',exact:true}).click();
 await page.getByRole('link',{name:'Portfolio',exact:true}).click();
 await page.getByText('8',{exact:true}).first().waitFor({timeout:30000});
 console.log({width,readyMs:ready,balanceRequests:failures});
 await page.close();
}
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {ccc} from '@ckb-ccc/core';
import {startSharedMarketApp} from './shared-market-app-runner.mjs';
const C=createRequire(import.meta.url)('../../../labs/rebuild/native/src/lib.cjs');
// Read-only follow-up to an existing native run; preserve its original evidence.
if(!process.argv[2])throw Error('Pass the absolute evidence directory of a completed shared-launch native run');
const evidence=resolve(process.argv[2]),out=join(evidence,'read-followup-'+Date.now())+'/';
mkdirSync(out,{recursive:true});
const config=JSON.parse(readFileSync(join(evidence,'isolated-app-config.json')));
const chain=JSON.parse(readFileSync(join(evidence,'shared-launch-restart.json'))).after.chain;
const node=spawn(new URL('../../../labs/rebuild/native/tools/ckb',import.meta.url).pathname,['run','-C',chain,'--ba-advanced','--indexer'],{stdio:'ignore'});
let app;
try{
app=await startSharedMarketApp({...config,out,dbPath:join(evidence,'launch.sqlite')});
const catalog=await app.request('/api/markets/catalog');assert.equal(catalog.markets.length,2);
const states=await Promise.all(catalog.markets.map(market=>app.request('/api/markets/'+market.market)));
const trader=ccc.Script.from(C.locks[2]).hash(),started=performance.now();
const proofs=await Promise.all(states.map(state=>app.request('/api/v2/pudge-proof',{manifest:state.manifest,owner:trader,side:'buy',quantity:'1'})));
for(const [index,proof]of proofs.entries()){
 assert.equal(proof.market,states[index].identity);assert.equal(proof.token,states[index].token.typeHash);assert.equal(proof.proof.old_root,states[index].custodyRoot);
}
writeFileSync(out+'concurrent-market-proofs.json',JSON.stringify({ms:Math.round(performance.now()-started),markets:proofs.map(proof=>({market:proof.market,token:proof.token,root:proof.proof.old_root,points:proof.points})),processes:app.processes},null,2));
const priorRecords=JSON.parse(readFileSync(join(evidence,'browser-wallet-acceptance.json'))).records;
const rpc=async(method,params=[])=>{
 assert(method.startsWith('get_')||['estimate_cycles','tx_pool_info'].includes(method),'Read-only follow-up');
 const response=await fetch(config.endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const body=await response.json();if(body.error)throw Error(JSON.stringify(body.error));return body.result;
};
const result=await app.walletAcceptance(catalog.markets,{priorRecords,rpc,owner:trader,connect:async(page,bundle)=>{
 await page.addScriptTag({path:bundle});
 await page.waitForFunction(()=>typeof document.querySelector('ccc-connector')?.updateSigner==='function');
 for(let attempt=0;attempt<30;attempt++){
  if(await page.locator('ccc-connector').isVisible())break;
  if(await page.locator('.brant-wallet').isEnabled())await page.locator('.brant-wallet').click();
  await delay(500);
 }
 await page.locator('ccc-connector').waitFor({state:'visible'});
 await page.evaluate(async({key,secp})=>{
  const connector=document.querySelector('ccc-connector');await connector.updateComplete;
  await connector.updateSigner({name:'Disposable native fixture',icon:''},{name:'Native fixture',signer:window.createDisposableTestSigner(key,secp,'/fixture-wallet-rpc')});connector.close();
 },{key:C.keys[2],secp:config.fixture.secp});
}});
writeFileSync(out+'verified-portfolio-activity.json',JSON.stringify({...result,verifiedPortfolioTotals:true},null,2));
console.log('PASS fresh-process concurrent market proofs and verified Portfolio/Activity');
}finally{await app?.stop();node.kill();}

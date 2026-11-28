// Continue browser integration against a retained, already launched isolated market.
// Clone local chain data and SQLite so historical evidence is not overwritten.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,cpSync,mkdtempSync,openSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {runSharedLaunch} from './atomic-launch-browser-native.mjs';
const require=createRequire(import.meta.url),root=resolve(fileURLToPath(new URL('../../..',import.meta.url)));
const source=resolve(process.argv[2]),sourceChain=resolve(process.argv[3]);
const chainRoot=resolve(process.env.TRADE_GATE2_CHAIN_ROOT||'/tmp');
assert(source.startsWith(root+'/labs/trade-v2-token/gate2/evidence/'));
assert(sourceChain.startsWith('/tmp/brant-atomic-browser-resume-')||
 (sourceChain.startsWith(chainRoot+'/')&&/^trade-gate2-[A-Za-z0-9]+\/chain$/.test(sourceChain.slice(chainRoot.length+1))));
const priorTrades=process.argv[4]==='--retained-trades'?JSON.parse(readFileSync(join(source,'atomic-browser-failure.json'),'utf8')).trades:undefined;
if(priorTrades)assert.equal(priorTrades.length,2);
const config=JSON.parse(readFileSync(join(source,'isolated-app-config.json'),'utf8'));
assert.notEqual(config.genesis,'0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606');
const out=join(source,'browser-continuation-'+Date.now());mkdirSync(out);
const chain=join(mkdtempSync(join(tmpdir(),'brant-atomic-browser-resume-')),'chain');cpSync(sourceChain,chain,{recursive:true});
// CKB includes resolved system-cell file paths in its chain-spec identity.
// Keep the original immutable spec path while using the cloned data directory.
const toml=join(chain,'ckb.toml'),configuration=readFileSync(toml,'utf8');
assert(configuration.includes('data_dir = "data"'));
assert(/spec = \{ file = "(?:specs\/dev.toml|\/tmp\/trade-gate2-[^"]+\/chain\/specs\/dev.toml)" \}/.test(configuration));
writeFileSync(toml,configuration.replace('spec = { file = "specs/dev.toml" }','spec = { file = '+JSON.stringify(join(sourceChain,'specs/dev.toml'))+' }'));
copyFileSync(join(source,'atomic-browser.sqlite'),join(out,'atomic-browser.sqlite'));
const db=new DatabaseSync(join(out,'atomic-browser.sqlite'));const row=db.prepare("SELECT market FROM atomic_launch_delivery WHERE json_extract(snapshot,'$.state')='published' ORDER BY rowid DESC LIMIT 1").get();db.close();assert(row);
const C=require(root+'/labs/rebuild/native/src/lib.cjs');
const hashes={},deps={};for(const [name,key]of Object.entries({market:'market_smt',marker:'marker_candidate',custody:'custody_smt',custodyMarker:'custody_marker',ownerLock:'atomic_initializer',xudt:'xudt'})){hashes[key]=config.fixture[name].dataHash;deps[key]={outPoint:config.fixture[name].outPoint,depType:'code'};}
const secp={outPoint:config.fixture.secp.outPoint,depType:'depGroup'};
const state={sourceEvidence:source,sourceChain,chain,out,genesis:config.genesis,market:row.market,status:'running'};const save=()=>writeFileSync(join(out,'resume-state.json'),JSON.stringify(state,null,2));save();
const child=spawn(join(root,'labs/rebuild/native/tools/ckb'),['run','-C',chain,'--ba-advanced','--indexer'],{stdio:['ignore',openSync(join(out,'node.log'),'a'),openSync(join(out,'node.log'),'a')]});
let seq=0;const rpc=async(method,params=[])=>{const r=await fetch('http://127.0.0.1:19224/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++seq,method,params}),signal:AbortSignal.timeout(15000)});const body=await r.json();writeFileSync(join(out,'rpc.jsonl'),JSON.stringify({method,params,response:body})+'\n',{flag:'a'});if(body.error)throw Error(JSON.stringify(body.error));return body.result;};
try{
 let ready=false;for(let i=0;i<600;i++){if(child.exitCode!==null)throw Error('Cloned isolated node exited');try{assert.equal(await rpc('get_block_hash',['0x0']),config.genesis);ready=true;break;}catch{await delay(200);}}assert(ready,'Cloned chain not ready');
 const run=process.argv[4]==='--release-closure'?(await import('./atomic-release-closure.mjs')).runReleaseClosure:runSharedLaunch;
 await run({rpc,genesis:config.genesis,hashes,deps,secp,locks:C.locks,out,resumeMarket:process.argv[4]==='--creator-lifecycle'?undefined:String(row.market),priorTrades,retainedEvidence:source,connectBrowserWallet:async(page,bundle)=>{
  await page.waitForFunction(()=>Boolean(document.head&&document.body));await page.addScriptTag({path:bundle});await page.waitForFunction(()=>typeof document.querySelector('ccc-connector')?.updateSigner==='function');
  for(let i=0;i<20;i++){if(await page.locator('ccc-connector').isVisible())break;const button=page.locator('.brant-wallet');if(await button.isEnabled())await button.click();await delay(500);}
  await page.locator('ccc-connector').waitFor({state:'visible'});
  await page.evaluate(async({key,secp})=>{const signer=window.createDisposableTestSigner(key,secp,'/fixture-wallet-rpc');const connector=document.querySelector('ccc-connector');await connector.updateComplete;await connector.updateSigner({name:'Disposable native fixture',icon:''},{name:'Native fixture',signer});connector.close();},{key:C.keys[2],secp});
 }});state.status='complete';save();console.log('Browser continuation evidence '+out);
}catch(error){state.status='failed';state.error=String(error);save();console.error(error);process.exitCode=1;}
finally{child.kill('SIGTERM');for(let i=0;i<100&&child.exitCode===null;i++)await delay(100);if(child.exitCode===null)child.kill('SIGKILL');}

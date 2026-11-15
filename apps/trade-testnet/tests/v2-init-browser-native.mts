// Disposable CKB only; browser signer uses public fixture keys in memory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright-core';
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
assert(process.env.ROVEKO_INIT_BOOTSTRAP&&process.env.TRADE_NATIVE_ROOT&&process.env.ROVEKO_SMT_BINARY&&process.env.ROVEKO_PROOF_BINARY,'Missing isolated fixture paths');
const config=JSON.parse(fs.readFileSync(process.env.ROVEKO_INIT_BOOTSTRAP,'utf8')),native=require(path.join(process.env.TRADE_NATIVE_ROOT,'src/lib.cjs'));
const singleOwner=process.env.ROVEKO_SINGLE_OWNER==='1';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'rov-init-wallet-')),evidence=path.join(root,'evidence',`v2-init-browser-${Date.now()}`);fs.mkdirSync(evidence,{recursive:true});
await new Promise<void>((resolve,reject)=>require('next/dist/compiled/webpack/webpack').webpack({mode:'development',target:'web',entry:path.join(root,'tests/v2-browser-wallet-entry.cjs'),output:{path:temp,filename:'wallet.js'}},(e:Error,s:any)=>e||s.hasErrors()?reject(e||Error(s.toString({all:false,errors:true}))):resolve()));
const rpc=async(method:string,params:unknown[]=[])=>{const response=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const body=await response.json();if(body.error)throw Error(JSON.stringify(body.error));return body.result;};
async function checkOwnerAndFee(transaction:any,ownerInputIndices:number[],expectedFee?:bigint){
 let inputCapacity=0n;const ownerIndices:number[]=[];
 for(const [i,input] of transaction.inputs.entries()){
  const previous=await rpc('get_transaction',[input.previous_output.tx_hash]);assert.equal(previous?.tx_status?.status,'committed');
  const output=previous.transaction.outputs[Number(BigInt(input.previous_output.index))];assert(output);
  inputCapacity+=BigInt(output.capacity);
  if(output.lock.code_hash.toLowerCase()===config.wallets[2].lock.codeHash.toLowerCase()&&output.lock.hash_type===config.wallets[2].lock.hashType&&output.lock.args.toLowerCase()===config.wallets[2].lock.args.toLowerCase())ownerIndices.push(i);
 }
 assert.deepEqual(ownerIndices,ownerInputIndices);
 const fee=inputCapacity-transaction.outputs.reduce((sum:bigint,output:any)=>sum+BigInt(output.capacity),0n);
 assert(fee>0n);if(expectedFee!==undefined)assert.equal(fee,expectedFee);
 return fee.toString();
}
assert.equal(await rpc('get_block_hash',['0x0']),config.genesis);assert.equal((await rpc('get_blockchain_info')).chain,'ckb_dev');
const log=fs.openSync(path.join(evidence,'next.log'),'w');const next=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','127.0.0.1','--port','3111'],{cwd:root,env:{...process.env,NEXT_PUBLIC_LOCAL_FIXTURE:'1',ROVEKO_LOCAL_BROADCAST:'1',ROVEKO_LOCAL_PROOFS:'1',...(process.env.ROVEKO_TEST_COMBINED==='1'?{NEXT_PUBLIC_ROVEKO_REQUIRE_DEPLOYED_CODES:'1'}:{}),R7_NEXT_DIST_DIR:'.next-v2-init-browser',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore',log,log]});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:3111/v2/deploy')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});const page=await browser.newPage();await page.goto('http://127.0.0.1:3111/v2/deploy');await page.addScriptTag({path:path.join(temp,'wallet.js')});await page.waitForFunction(()=>typeof (window as any).rovDeployTestConnect==='function');
 const block=await rpc('get_block_by_number',['0x0']),secp={outPoint:{txHash:block.transactions[1].hash,index:'0x0'},depType:'depGroup'};
 const estimates:unknown[]=[], proofTimes:number[]=[];const proofStarts=new WeakMap<object,number>();
 page.on('request',request=>{if(request.url().endsWith('/api/v2-init-proof')||request.url().endsWith('/api/v2/proof'))proofStarts.set(request,performance.now());});
 page.on('response',response=>{const start=proofStarts.get(response.request());if(start!==undefined)proofTimes.push(performance.now()-start);});
 await page.route('**/api/local-rpc',async route=>{const body=route.request().postDataJSON();if(body?.method==='send_transaction')estimates.push(await rpc('estimate_cycles',[body.params[0]]));await route.continue();});
 let deployedHash='';
 const reconnect=async(role:number)=>{await page.reload();await page.addScriptTag({path:path.join(temp,'wallet.js')});await page.waitForFunction(()=>typeof (window as any).rovDeployTestConnect==='function');await page.evaluate(({key,secp}:any)=>{const w=window as any;w.rovDeployTestConnect(w.createDisposableTestSigner(key,secp));},{key:native.keys[role],secp});};
 if(process.env.ROVEKO_TEST_COMBINED==='1'){
  await page.evaluate(({key,secp}:any)=>{const w=window as any;w.rovDeployTestConnect(w.createDisposableTestSigner(key,secp));},{key:native.keys[singleOwner?2:1],secp});
  const code=page.locator('section').filter({has:page.getByRole('heading',{name:'Disposable local code deployment'})});
  await code.getByRole('button',{name:'Prepare local code review'}).click();await code.getByText('Local unsigned code deployment prepared.').waitFor({timeout:60000});
  const review=await code.innerText();await code.getByRole('button',{name:'Sign local code review'}).click();await code.getByText('Local signature verified; not submitted.').waitFor({timeout:60000});
  await code.getByRole('button',{name:'Submit local code deployment'}).click();await code.getByText(/Submitted 0x/).waitFor({timeout:60000});
  const status=await code.getByRole('status').innerText(),hash=status.match(/0x[0-9a-f]{64}/i)?.[0];assert(hash,status);let tx:any;
  for(let i=0;i<15;i++){await rpc('generate_block');tx=await rpc('get_transaction',[hash]);if(tx?.tx_status?.status==='committed')break;}assert.equal(tx.tx_status.status,'committed');
  await code.getByRole('button',{name:'Check local code deployment'}).click();await code.getByText(/Local code cells confirmed/).waitFor({timeout:60000});
  const fee=singleOwner?await checkOwnerAndFee(tx.transaction,[0]):undefined;
  deployedHash=hash;fs.writeFileSync(path.join(evidence,'code.json'),JSON.stringify({hash,tx,review,fee,estimate:estimates.at(-1)},null,2));await page.screenshot({path:path.join(evidence,'code.png'),fullPage:true});await reconnect(2);
  const storageKey='roveko-local-code-confirmed:'+config.genesis;
  const saved=await page.evaluate(k=>localStorage.getItem(k),storageKey);assert(saved,'Missing confirmed deployment record');
  await page.evaluate(k=>{const x=JSON.parse(localStorage.getItem(k)!);x.txHash='0x'+'99'.repeat(32);localStorage.setItem(k,JSON.stringify(x));},storageKey);
  const init=page.locator('section').filter({has:page.getByRole('heading',{name:'Disposable market initialization'})});
  await init.getByRole('button',{name:'Prepare local initialization stage'}).click();await init.getByText(/unavailable|mismatch|invalid/i).first().waitFor({timeout:30000});
  await page.evaluate(({k,v})=>localStorage.setItem(k,v),{k:storageKey,v:saved});
  await reconnect(0);await init.getByRole('button',{name:'Prepare local initialization stage'}).click();await init.getByText(/Connect disposable wallet 2 for setup/).waitFor({timeout:30000});await reconnect(2);
 }
 const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Disposable market initialization'})}),transactions:any[]=[];
 page.on('console', msg=>{if(msg.type()==='error') console.error('Browser:',msg.text());});
 for(const [stage,role] of [['setup',2],['issuance',singleOwner?2:0],['purchase',2]] as const){
  await page.evaluate(({key,secp}:any)=>{const w=window as any;w.rovDeployTestConnect(w.createDisposableTestSigner(key,secp));},{key:native.keys[role],secp});
  await section.getByRole('button',{name:'Prepare local initialization stage'}).click();try{await section.getByText(new RegExp(`^${stage} prepared:`)).waitFor({timeout:30000});}catch(e){console.error('Preparation status:',await section.getByRole('status').innerText());await page.screenshot({path:path.join(evidence,`${stage}-error.png`),fullPage:true});throw e;}
  await section.getByRole('button',{name:'Sign local initialization stage'}).click();await section.getByText(`${stage} signature verified; not submitted.`).waitFor({timeout:90000});
  await section.getByRole('button',{name:'Submit local initialization stage'}).click();await section.getByText(new RegExp(`^${stage} submitted 0x`)).waitFor({timeout:90000});
  const status=await section.getByRole('status').innerText(),hash=status.match(/0x[0-9a-f]{64}/i)?.[0];assert(hash,status);
  let tx:any;for(let i=0;i<15;i++){await rpc('generate_block');tx=await rpc('get_transaction',[hash]);if(tx?.tx_status?.status==='committed')break;}assert.equal(tx.tx_status.status,'committed');
  await section.getByRole('button',{name:'Confirm local initialization stage'}).click();await section.getByText(new RegExp(`^${stage} confirmed ${hash}`)).waitFor({timeout:90000});
  assert.equal(await rpc('get_block_hash',[tx.tx_status.block_number]),tx.tx_status.block_hash);
  const fee=singleOwner?await checkOwnerAndFee(tx.transaction,stage==='purchase'?[2]:[0],1_000_000n):undefined;
  if(deployedHash && stage!=='setup'){const indices=tx.transaction.cell_deps.filter((d:any)=>d.out_point.tx_hash===deployedHash).map((d:any)=>d.out_point.index).sort();assert.deepEqual(indices,stage==='issuance'?['0x3','0x4']:['0x0','0x1','0x2','0x3']);}
  transactions.push({stage,hash,tx,fee});fs.writeFileSync(path.join(evidence,`${stage}.json`),JSON.stringify({stage,hash,tx,fee,estimate:estimates.at(-1)},null,2));await page.screenshot({path:path.join(evidence,`${stage}.png`),fullPage:true});if(stage!=='purchase')await reconnect(singleOwner?2:stage==='setup'?0:2);
 }
 if(process.env.ROVEKO_TEST_COMBINED==='1'){
  await reconnect(2);const init=page.locator('section').filter({has:page.getByRole('heading',{name:'Disposable market initialization'})});
  await init.getByRole('button',{name:'Verify local market and open'}).click();
  await init.getByText('Local market manifest verified against the private chain.').waitFor({timeout:60000});
  const manifest=await page.evaluate(k=>localStorage.getItem(k),'roveko-local-market:'+config.genesis);assert(manifest,'Missing market manifest');
  fs.writeFileSync(path.join(evidence,'market-manifest.json'),manifest);
  await init.getByRole('link',{name:'Open verified local market'}).click();
  await page.addScriptTag({path:path.join(temp,'wallet.js')});await page.waitForFunction(()=>typeof (window as any).rovTestConnect==='function');
  await page.evaluate(({key,secp}:any)=>{const w=window as any;w.rovTestConnect(w.createDisposableTestSigner(key,secp));},{key:native.keys[2],secp});
  const invalidProof=await page.evaluate(async({key,secp}:any)=>{const w=window as any,signer=w.createDisposableTestSigner(key,secp),owner=(await signer.getRecommendedAddressObj()).script.hash();const r=await fetch('/api/v2/proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({owner,side:'buy',quantity:'1',initTxHash:'0x'+'99'.repeat(32)})});return r.status;},{key:native.keys[2],secp});assert(invalidProof>=400,'Unknown initialization must be refused');
  await page.getByLabel('Token quantity').fill('1');
  const tradeTx:Record<string,any>={};
  for(const side of ['buy','sell']){
   if(side==='sell')await page.getByRole('button',{name:'Sell back'}).click();
   await page.getByRole('button',{name:'Prepare review'}).click();await page.getByRole('button',{name:'Sign and submit reviewed transaction'}).waitFor({timeout:90000});
   await page.getByRole('button',{name:'Sign and submit reviewed transaction'}).click();await page.getByRole('status').filter({hasText:/Submitted 0x/}).waitFor({timeout:90000});
   const status=await page.getByRole('status').filter({hasText:/Submitted 0x/}).innerText(),hash=status.match(/0x[0-9a-f]{64}/i)?.[0];assert(hash,status);let tx:any;
   for(let i=0;i<15;i++){await rpc('generate_block');tx=await rpc('get_transaction',[hash]);if(tx?.tx_status?.status==='committed')break;}assert.equal(tx.tx_status.status,'committed');
   await page.getByRole('status').filter({hasText:new RegExp(`Confirmed ${hash}`)}).waitFor({timeout:60000});tradeTx[side]={hash,tx};fs.writeFileSync(path.join(evidence,`${side}.json`),JSON.stringify({hash,tx,estimate:estimates.at(-1)},null,2));await page.screenshot({path:path.join(evidence,`${side}.png`),fullPage:true});
  }
  const initial=transactions.at(-1).tx.transaction,buy=tradeTx.buy.tx.transaction,sell=tradeTx.sell.tx.transaction,price=1700000000n;
  assert.equal(BigInt(buy.outputs[0].capacity),BigInt(initial.outputs[0].capacity)+price);assert.equal(BigInt(sell.outputs[0].capacity),BigInt(initial.outputs[0].capacity));
  assert.equal(BigInt(buy.outputs[4].capacity),BigInt(initial.outputs[4].capacity)-price-100000n);assert.equal(BigInt(sell.outputs[4].capacity),BigInt(initial.outputs[4].capacity)-200000n);
  assert.equal(sell.outputs_data[0],initial.outputs_data[0]);assert.equal(sell.outputs_data[2].slice(0,34),initial.outputs_data[2].slice(0,34));
  for(let i=0;i<5;i++)assert.equal((await rpc('get_live_cell',[{tx_hash:tradeTx.sell.hash,index:'0x'+i.toString(16)},true])).status,'live');
  await page.reload();await page.addScriptTag({path:path.join(temp,'wallet.js')});await page.waitForFunction(()=>typeof (window as any).rovTestConnect==='function');await page.evaluate(({key,secp}:any)=>{const w=window as any;w.rovTestConnect(w.createDisposableTestSigner(key,secp));},{key:native.keys[2],secp});
  await page.getByText('1993',{exact:true}).waitFor({timeout:60000});await page.getByLabel('Token quantity').fill('1');await page.getByRole('button',{name:'Prepare review'}).click();await page.getByText('Wallet entitlement: 7').waitFor({timeout:90000});await page.screenshot({path:path.join(evidence,'reconnect.png'),fullPage:true});
  const marketKey='roveko-local-market:'+config.genesis,savedMarket=await page.evaluate(k=>localStorage.getItem(k),marketKey);assert(savedMarket);
  await page.evaluate(k=>{const m=JSON.parse(localStorage.getItem(k)!);m.codeDeploymentTransactionHash='0x'+'99'.repeat(32);localStorage.setItem(k,JSON.stringify(m));},marketKey);await page.reload();
  await page.getByText('Local market unavailable or stale.').waitFor({timeout:60000});await page.getByRole('button',{name:'Trading unavailable'}).waitFor({timeout:60000});await page.evaluate(({k,v})=>localStorage.setItem(k,v),{k:marketKey,v:savedMarket});
 }
 fs.writeFileSync(path.join(evidence,'transactions.json'),JSON.stringify({genesis:config.genesis,transactions,estimates,proofRequestMilliseconds:proofTimes},null,2));console.log(`Browser initialization evidence: ${evidence}`);
}finally{await browser?.close();next.kill();}

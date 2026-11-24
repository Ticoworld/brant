// Public Pudge reads only; no signing, submission or mining methods.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ccc} from '@ckb-ccc/core';
const folder=fileURLToPath(new URL('../../../releases/atomic-pudge-rc1/',import.meta.url));
const plan=JSON.parse(readFileSync(resolve(folder,'deployment-plan.json'),'utf8')),counts={};
const rpc=async(method,params)=>{assert(['get_block_hash','get_live_cell','get_transaction'].includes(method));counts[method]=(counts[method]||0)+1;const response=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});const body=await response.json();assert(response.ok&&!body.error);return body.result;};
assert.equal(await rpc('get_block_hash',['0x0']),plan.genesis);const verified=[];
for(const [name,dep] of Object.entries(plan.reusedDependencies)){
 const point={tx_hash:dep.outPoint.txHash,index:dep.outPoint.index};const live=await rpc('get_live_cell',[point,true]);assert.equal(live.status,'live');assert.equal(ccc.hashCkb(live.cell.data.content),dep.dataHash);
 const transaction=await rpc('get_transaction',[point.tx_hash]);assert.equal(transaction.tx_status.status,'committed');assert.equal(await rpc('get_block_hash',[transaction.tx_status.block_number]),transaction.tx_status.block_hash);
 verified.push({name,...dep,bytes:(live.cell.data.content.length-2)/2,canonicalBlockHash:transaction.tx_status.block_hash,canonicalBlockNumber:transaction.tx_status.block_number});
}
writeFileSync(resolve(folder,'public-dependencies-readonly.json'),JSON.stringify({verified:true,checkedAt:new Date().toISOString(),endpoint:'https://testnet.ckb.dev/',genesis:plan.genesis,counts,dependencies:verified,publicWrites:false},null,2)+'\n');console.log('Canonical public dependencies match all four pinned identities (reads only).');

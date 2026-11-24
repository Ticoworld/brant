import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {verifyAtomicMetadataAuthorization} from '../lib/v2-engine/atomic-launch-v2.ts';
const root=resolve(fileURLToPath(new URL('../../..',import.meta.url))),folder=resolve(root,'releases/atomic-pudge-rc1');
const base='labs/trade-v2-token/gate2/evidence/native-1795542972167',continuation=base+'/browser-continuation-1795544631172',final=continuation+'/browser-continuation-1795545122678',closure=continuation+'/browser-continuation-1795547354667';
const read=p=>JSON.parse(readFileSync(resolve(root,p),'utf8'));
const launch=read(base+'/atomic-browser-launch-checkpoint.json'),acceptance=read(final+'/atomic-browser-acceptance.json'),verdict=read(base+'/atomic-browser-integration-verdict.json'),exit=read(closure+'/independent-atomic-verdict.json'),timing=read(closure+'/atomic-release-timing.json'),plan=read('releases/atomic-pudge-rc1/deployment-plan.json');
assert.equal(launch.market,acceptance.resumedMarket);assert.equal(launch.genesis,acceptance.processes[0].genesis);assert.deepEqual(acceptance.errors,[]);assert(acceptance.portfolio&&acceptance.activity&&acceptance.restart&&acceptance.proofBalanceVerified);
const tx=raw=>ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(raw));
assert.equal(tx(launch.signedInitialization).hash(),launch.initializationReceipt.txHash);
const inputs=read('releases/atomic-pudge-rc1/retained-creator-inputs.json').map(c=>({...c,capacity:BigInt(c.capacity)}));
const metadata=verifyAtomicMetadataAuthorization(tx(launch.signedInitialization),inputs,{genesis:launch.genesis,market:launch.market,owner:inputs[0].lock?ccc.Script.from(inputs[0].lock).hash():''});assert.equal(metadata.ticker,'ABR');
for(const receipt of acceptance.trades){assert.equal(tx(receipt.receipt.transaction).hash(),receipt.hash);assert.equal(receipt.receipt.tx_status.status,'committed');}
assert.equal(exit.genesis,launch.genesis);assert.equal(exit.initialization,launch.initializationReceipt.txHash);assert.equal(exit.before.owner.balance,'7');assert.equal(exit.after.owner.balance,'0');assert.equal(exit.after.entitlement_total,'0');assert.equal(exit.withdrawal.status,'committed');assert.equal(tx(exit.withdrawal.transaction).hash(),exit.withdrawal.transaction_hash);assert.equal(exit.withdrawal.external_xudt_data,'0x07000000000000000000000000000000');assert(!exit.applicationRunning&&!exit.databaseUsedByRecovery&&!exit.indexerUsed&&!exit.proofCacheUsed);
assert.equal(timing.approvals,1);assert.equal(tx(timing.receipt.transaction).hash(),timing.transaction);assert(timing.commitmentObservationToPublicationMs>0&&timing.clickToWalletMs>0);
for(const cell of plan.codeCells){const data=readFileSync(resolve(folder,cell.file));assert.equal(ccc.hashCkb(data),cell.ckbDataHash);assert.equal(createHash('sha256').update(data).digest('hex'),cell.sha256);}
const evidence=[base+'/atomic-browser-launch-checkpoint.json',final+'/atomic-browser-acceptance.json',final+'/fresh-browser-discovery.png',final+'/fresh-browser-ABR.png',final+'/atomic-portfolio.png',final+'/atomic-activity.png',closure+'/independent-atomic-verdict.json',closure+'/atomic-release-timing.json',closure+'/timed-atomic-launch.png'];
const legacy=read('releases/atomic-pudge-rc1/ckbm-canonical-retained.json');for(const row of legacy){assert(row.canonical);assert.equal(tx(row.receipt.transaction).hash(),row.hash);}
assert.equal(tx(legacy.at(-1).receipt.transaction).outputs[0].lock.hash(),'0xeb8058b6a1f9a50e67024fd0e4e86210eba80ddea364bab3c567c114868367c0');
const receipts=evidence.map(path=>({path,bytes:statSync(resolve(root,path)).size,sha256:createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex')}));
writeFileSync(resolve(folder,'evidence-verification.json'),JSON.stringify({verified:true,chain:'REAL isolated',wallet:'SIMULATED disposable fixture',metadataSignatureVerified:true,transactionHashesVerified:true,oneMarketAcrossLinkedContinuations:true,independentExitVerified:true,qualifiedBinariesMatch:true,accounting:verdict.accounting,evidence:receipts,limits:['Original browser interrupted-execution acceptance spans linked continuations, not one uninterrupted run.','Canonical status is retained receipt evidence plus the fresh independent full-block scan; no claim of CKB consensus proof from RPC.','Real external wallet/public atomic execution remains unverified.']},null,2)+'\n');
console.log('Release evidence verified: transaction hashes, original metadata signature, linked browser acceptance, independent exit and exact binary hashes.');

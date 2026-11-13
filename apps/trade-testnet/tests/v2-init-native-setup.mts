// Private disposable-node test only. Never point at a public chain.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {deriveMarketIdentity} from '../lib/v2-engine/initialization.ts';
import {prepareLocalInitializationStage} from '../lib/v2-engine/initialization-orchestrator.ts';
import {verifyInitializationStage} from '../lib/v2-engine/initialization-lifecycle.ts';
const file=process.env.ROVEKO_INIT_BOOTSTRAP,nativeRoot=process.env.TRADE_NATIVE_ROOT;if(!file||!nativeRoot)throw Error('Set isolated bootstrap and native tooling paths');
const f=JSON.parse(fs.readFileSync(file,'utf8')), require=createRequire(import.meta.url),native=require(path.join(nativeRoot,'src/lib.cjs'));
const signGroup=require(path.join(nativeRoot,'node_modules/@nervosnetwork/ckb-sdk-core/lib/signWitnessGroup.js')).default;
const rpc=async(method:string,params:unknown[])=>{const r=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;};
assert.equal((await rpc('get_blockchain_info',[])).chain,'ckb_dev');assert.equal(await rpc('get_block_hash',['0x0']),f.genesis);assert.notEqual(f.genesis,'0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606');
const anchor=f.wallets[0],fund=f.wallets[2],input={...fund,capacity:BigInt(fund.capacity)},genesis=await rpc('get_block_by_number',['0x0']),secp={outPoint:{txHash:genesis.transactions[1].hash,index:'0x0'},depType:'depGroup' as const};
const depCell=await rpc('get_live_cell',[{tx_hash:secp.outPoint.txHash,index:'0x0'},true]);assert.equal(depCell.status,'live');const deps=[{outPoint:secp.outPoint,dataHash:ccc.hashCkb(depCell.cell.data.content)}];
const identity=deriveMarketIdentity({anchor:anchor.outPoint,genesis:f.genesis,base:1000000000n,step:100000000n,supply:2000n,codes:{market:f.hashes.market_smt,marker:f.hashes.marker_candidate,owner:f.hashes.owner_lineage_candidate,custody:f.hashes.custody_smt,custodyMarker:f.hashes.custody_marker,xudt:f.hashes.xudt}});
process.env.NEXT_PUBLIC_LOCAL_FIXTURE='1';Object.defineProperty(globalThis,'window',{value:{location:{hostname:'localhost'}},configurable:true});
const params={identity,anchor:anchor.outPoint,inputs:[input],ownerCapacity:20000000000n,buyerCapacity:200000000000n,fee:1000000n,secpDep:secp};
const reviewed=await prepareLocalInitializationStage(rpc,f.genesis,{stage:'setup',params},[input],deps),tx=reviewed.transaction;
tx.witnesses[0]=signGroup(native.keys[2],tx.hash(),[{lock:'',inputType:'',outputType:''}])[0];
const wire=cccA.JsonRpcTransformers.transactionFrom(tx);const cycles=await rpc('estimate_cycles',[wire]);const hash=await rpc('send_transaction',[wire,'passthrough']);assert.equal(hash,reviewed.hash);
for(let i=0;i<30;i++){if((await rpc('get_transaction',[hash]))?.tx_status?.status==='committed')break;await rpc('generate_block',[]);}
const receipt=await verifyInitializationStage(rpc,f.genesis,'setup',tx,[input.outPoint],[0,1,2]);
const evidence={genesis:f.genesis,hash,cycles,fee:'1000000',receipt,transaction:await rpc('get_transaction',[hash])};
const out=path.join(path.dirname(file),'initialization-setup-test.json');fs.writeFileSync(out,JSON.stringify(evidence,null,2));console.log(JSON.stringify({hash,cycles,evidence:out}));

// Private local node only. Public fixture keys are never suitable for public chains.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {deriveMarketIdentity,buildInitializationSetup,buildIssuance,buildFirstPurchase} from '../lib/v2-engine/initialization.ts';
const require=createRequire(import.meta.url), root=process.env.TRADE_NATIVE_ROOT!, dir=process.env.ROVEKO_BOOTSTRAP!;
assert(root&&dir,'Set TRADE_NATIVE_ROOT and ROVEKO_BOOTSTRAP');
const C=require(path.join(root,'src/lib.cjs'));
const signGroup=require(path.join(root,'node_modules/@nervosnetwork/ckb-sdk-core/lib/signWitnessGroup.js')).default;
const state=JSON.parse(fs.readFileSync(path.join(dir,'browser-bootstrap.json'),'utf8'));
const deployment=JSON.parse(fs.readFileSync(path.join(dir,'code-size-result.json'),'utf8'));
assert.equal(state.rpc,'http://127.0.0.1:19224'); assert(deployment.committed && deployment.submitted);
let seq=0; async function rpc(method:string,params:unknown[]=[]){const r=await fetch(state.rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++seq,method,params})});const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;}
function adapt(tx:ccc.Transaction){const v=C.camel(cccA.JsonRpcTransformers.transactionFrom(tx));for(const d of v.cellDeps)if(d.depType==='dep_group')d.depType='depGroup';return v;}
function sign(tx:ccc.Transaction,index:number,role:number){const v=adapt(tx);v.witnesses[index]=signGroup(C.keys[role],C.U.rawTransactionToHash(v),[{lock:'',inputType:'',outputType:''},...v.witnesses.slice(v.inputs.length)])[0];return v;}
async function commit(label:string,tx:any){const estimate=await rpc('estimate_cycles',[C.snake(tx)]),hash=await rpc('send_transaction',[C.snake(tx),'passthrough']);let result;for(let i=0;i<20;i++){await rpc('generate_block');result=await rpc('get_transaction',[hash]);if(result?.tx_status?.status==='committed')break;}assert.equal(result.tx_status.status,'committed');assert.equal(await rpc('get_block_hash',[result.tx_status.block_number]),result.tx_status.block_hash);fs.appendFileSync(path.join(dir,'deployment-initialization.jsonl'),JSON.stringify({label,hash,estimate,tx,result})+'\n');return tx.outputs.map((o:any,i:number)=>({...o,capacity:BigInt(o.capacity),data:tx.outputsData[i],outPoint:{txHash:hash,index:C.hex(i)}}));}
const genesis=await rpc('get_block_hash',['0x0']);assert.equal(genesis,state.genesis);assert.notEqual(genesis,'0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606');
const block=await rpc('get_block_by_number',['0x0']); const secp={outPoint:{txHash:block.transactions[1].hash,index:'0x0'},depType:'depGroup' as const};
const getCell=async(point:{txHash:string;index:string})=>{const r=await rpc('get_live_cell',[C.snake(point),true]);assert.equal(r.status,'live');return {...C.camel(r.cell.output),capacity:BigInt(r.cell.output.capacity),data:r.cell.data.content,outPoint:point};};
const anchor=await getCell({txHash:deployment.submitted,index:'0x5'});
let funding:any;for(const tx of block.transactions)for(let i=0;i<tx.outputs.length;i++){if(tx.outputs[i].lock.args===C.locks[1].args){const point={txHash:tx.hash,index:C.hex(i)}, live=await rpc('get_live_cell',[C.snake(point),true]);if(live.status==='live'&&!live.cell.output.type&&live.cell.data.content==='0x')funding=await getCell(point);}}
assert(funding,'Missing separate disposable genesis funding');
const identity=deriveMarketIdentity({anchor:anchor.outPoint,genesis,base:10n*C.UNIT,step:C.UNIT,supply:2000n,codes:{market:state.hashes.market_smt,marker:state.hashes.marker_candidate,owner:state.hashes.owner_lineage_candidate,custody:state.hashes.custody_smt,custodyMarker:state.hashes.custody_marker,xudt:state.hashes.xudt}});
const code=(i:number)=>({outPoint:{txHash:deployment.submitted,index:C.hex(i)},depType:'code' as const});
const deps=[secp,code(1),code(3),code(0),code(2),state.deps.xudt];
const setup=buildInitializationSetup({identity,anchor:anchor.outPoint,inputs:[funding],ownerCapacity:200n*C.UNIT,buyerCapacity:2000n*C.UNIT,fee:1000000n,secpDep:secp});
const setupOut=await commit('setup',sign(setup,0,1));
const issue=buildIssuance({identity,anchor,ownerCell:setupOut[0],supply:2000n,inventoryCapacity:300n*C.UNIT,markerCapacity:300n*C.UNIT,fee:1000000n,deps:[secp,code(4),state.deps.xudt,code(3)]});
const issued=await commit('issue',sign(issue,0,2));
const owner=ccc.Script.from(setupOut[1].lock).hash(), domain={genesis_hash:genesis,market_script_hash:identity.market.hash(),xudt_type_script_hash:identity.token.hash(),custody_marker_type_hash:identity.custodyMarker.hash()};
const exe=path.resolve('..','..','labs/trade-v2-token/gate2/smt-tools/target/release/trade-v2-smt-tools.exe');
const proof=JSON.parse(execFileSync(exe,['proof','-','-'],{input:JSON.stringify({domain,op:0,owners:[],updates:[{owner_lock_hash:owner,balance:'7',revision:'0',active:true}]}),encoding:'utf8'}));
const price=91n*C.UNIT,extra=Array.from({length:8},(_,i)=>Number((price>>BigInt(i*8))&255n).toString(16).padStart(2,'0')).join('');
const first=buildFirstPurchase({identity,inventory:issued[0],marker:issued[1],buyer:setupOut[1],supply:2000n,quantity:7n,price,custodyCapacity:350n*C.UNIT,custodyMarkerCapacity:350n*C.UNIT,fee:1000000n,newRoot:proof.new_root,witness:proof.contract_witness.hex+extra,genesis,deps});
const initialized=await commit('first_purchase',sign(first,2,1));
for(const cell of initialized)await getCell(cell.outPoint);
console.log(JSON.stringify({deployment:deployment.submitted,setup:setupOut[0].outPoint.txHash,issuance:issued[0].outPoint.txHash,initialization:initialized[0].outPoint.txHash,root:proof.new_root}));

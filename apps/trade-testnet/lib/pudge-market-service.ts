import {randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {quote,decodeCurve} from './v2-engine/curve.ts';
import {discoverCustodyPair,discoverMarketPair,recoverMarketHistory,recoverMarketSuccessors,type Point} from './v2-engine/lineage.ts';
import {deriveMarketIdentity} from './v2-engine/initialization.ts';
import {loadPudgeManifest} from './v2-engine/pudge-manifest.ts';
import {resolvePudgeTokenMetadata} from './pudge-market-metadata.ts';
import {deriveMarketLiquidity} from './v2-engine/market-capacity.ts';
import {verifyPudgeInitialProof} from './v2-engine/pudge-proof-client.ts';
import {PUDGE_GATE2_ANCHOR,PUDGE_GATE2_ATTEMPT,PUDGE_GATE2_BUY,PUDGE_GATE2_CODES,PUDGE_GATE2_GENESIS,PUDGE_GATE2_INITIALIZATION,PUDGE_GATE2_JOURNAL,PUDGE_GATE2_OWNER,PUDGE_GATE2_REGISTRY_ID,PUDGE_GATE2_SELL,PUDGE_GATE2_STAGE_TXS,PUDGE_GATE2_XUDT_DEP} from './v2-engine/pudge-public-registry.ts';
import type {MarketData,TradeEvent} from '../app/trader/types.ts';
import {openPudgeSnapshot,sealPudgeSnapshot} from './pudge-snapshot.ts';

type Rpc=(method:string,params:unknown[])=>Promise<any>;
type Script={code_hash:string;hash_type:string;args:string};
type Output={capacity:string;lock:Script;type?:Script|null};
type Transaction={hash:string;inputs:{previous_output:Point}[];outputs:Output[];outputs_data:string[];witnesses:string[]};
type Canonical={transaction:Transaction;blockNumber:bigint;timestampMs:bigint;blockHash:string};
type Checkpoint={data:MarketData;points:Point[];cells:{output:Output;data:string}[];deps:unknown[];hashes:string[];manifestRaw?:string};
const UNIT=100_000_000n;
const asScript=(value?:Script|null)=>value?ccc.Script.from({codeHash:value.code_hash,hashType:value.hash_type as ccc.HashType,args:value.args}):null;
const pointKey=(point:Point)=>`${point.tx_hash.toLowerCase()}:${BigInt(point.index)}`;
const expectedPoint=(hash:string,index:number):Point=>({tx_hash:hash,index:`0x${index.toString(16)}`});
const readLE=(hex:string)=>{if(!/^0x(?:[0-9a-f]{2})+$/i.test(hex))throw Error('Invalid Gate 2 cell data');return BigInt(`0x${hex.slice(2).match(/../g)!.reverse().join('')}`);};
const scriptHash=(value?:Script|null)=>asScript(value)?.hash().toLowerCase()||'';
const sameScript=(left?:Script|null,right?:Script|null)=>scriptHash(left)===scriptHash(right);
const samePoint=(left:Point,right:Point)=>pointKey(left)===pointKey(right);
const sum=(values:bigint[])=>values.reduce((total,value)=>total+value,0n);
const checkpoints=new Map<string,Checkpoint>();
const verifiedCheckpoints=new WeakSet<Checkpoint>();
const marketSnapshotScope='pudge-market-v2:'+PUDGE_GATE2_GENESIS+':'+PUDGE_GATE2_INITIALIZATION;
let registeredRefresh:Promise<MarketData>|undefined;

function requestRpc():Rpc{
  const cache=new Map<string,Promise<unknown>>(),cachedMethods=new Set(['get_transaction','get_header','get_block_by_number','get_cells']);
  return (method,params)=>{
    if(!cachedMethods.has(method))return rpc(method,params);
    const key=`${method}:${JSON.stringify(params)}`;
    let pending=cache.get(key);if(!pending){pending=rpc(method,params);cache.set(key,pending);}
    return pending;
  };
}

async function checkpoint(data:MarketData,points:Point[],cells:{output:Output;data:string}[],deps:unknown[],hashes:string[],manifestRaw?:string){
  const saved={data,points,cells,deps,hashes,...(manifestRaw?{manifestRaw}:{})};
  checkpoints.set(data.id,saved);
  verifiedCheckpoints.add(saved);
  if(data.id===PUDGE_GATE2_REGISTRY_ID&&!manifestRaw)await persistMarketCheckpoint(saved).catch(()=>{});
}

function marketCheckpointPath(){
  const directory=process.env.ROVEKO_PUDGE_PROOF_CACHE_DIR;
  return directory?path.join(path.resolve(directory),'pudge-xudt-market.json'):undefined;
}

async function persistMarketCheckpoint(saved:Checkpoint){
  const file=marketCheckpointPath();if(!file)return;
  const directory=path.dirname(file),temporary=path.join(directory,`.pudge-xudt-market.${randomUUID()}.tmp`);
  const payload=sealPudgeSnapshot(marketSnapshotScope,saved);
  if(!payload||Buffer.byteLength(payload)>8*1024*1024)return;
  await mkdir(directory,{recursive:true,mode:0o700});
  try{await writeFile(temporary,payload,{flag:'wx',mode:0o600});await rename(temporary,file);}
  finally{await rm(temporary,{force:true}).catch(()=>{});}
}

async function readMarketCheckpoint(){
  const file=marketCheckpointPath();if(!file)return null;
  try{
    const info=await stat(file);if(!info.isFile()||info.size>8*1024*1024)return null;
    const saved=openPudgeSnapshot<Checkpoint>(marketSnapshotScope,await readFile(file,'utf8'));
    if(saved?.data?.id!==PUDGE_GATE2_REGISTRY_ID||!Array.isArray(saved.points)||saved.points.length!==4||!Array.isArray(saved.cells)||saved.cells.length!==4||!Array.isArray(saved.deps)||saved.deps.length!==6||!Array.isArray(saved.hashes)||saved.hashes.length!==6)return null;
    verifiedCheckpoints.add(saved);
    return saved;
  }catch{return null;}
}

function gate2Identity(){
  return deriveMarketIdentity({anchor:PUDGE_GATE2_ANCHOR,genesis:PUDGE_GATE2_GENESIS,base:1_000_000_000n,step:100_000_000n,supply:2_000n,codes:{market:PUDGE_GATE2_CODES.market,marker:PUDGE_GATE2_CODES.marker,owner:PUDGE_GATE2_CODES.ownerLock,custody:PUDGE_GATE2_CODES.custody,custodyMarker:PUDGE_GATE2_CODES.custodyMarker,xudt:PUDGE_GATE2_CODES.xudt}});
}

function dependencyPoint(value:any):Point{
  const point=value?.outPoint||value?.out_point;
  const txHash=point?.txHash||point?.tx_hash,index=point?.index;
  if(typeof txHash!=='string'||typeof index!=='string')throw Error('Invalid Gate 2 code dependency point');
  return {tx_hash:txHash,index};
}

async function cachedMarket(id:string,manifestRaw?:string):Promise<MarketData|null>{
  let saved=checkpoints.get(id);
  if(!saved&&id===PUDGE_GATE2_REGISTRY_ID&&!manifestRaw){saved=await readMarketCheckpoint()||undefined;if(saved)checkpoints.set(id,saved);}
  if(!saved||saved.manifestRaw!==manifestRaw)return null;
  try{
    if(id===PUDGE_GATE2_REGISTRY_ID&&verifiedCheckpoints.has(saved)){
      const tip=await rpc('get_tip_header');
      if(!tip?.number||!tip.hash||BigInt(tip.number)<BigInt(saved.data.tip.number))return null;
      const [anchor,...results]=await rpcBatch([
        ['get_block_hash',[saved.data.tip.number]],
        ...saved.points.map(point=>['get_live_cell',[point,true]] as [string,unknown[]]),
        ...saved.deps.map(dep=>['get_live_cell',[dependencyPoint(dep),false]] as [string,unknown[]]),
      ]);
      const cells=results.slice(0,4),deps=results.slice(4);
      if(anchor!==saved.data.tip.hash||deps.some(dep=>dep?.status!=='live'))return null;
      if(cells.some((cell,index)=>!matchesLiveCell(cell,saved!.cells[index]))){
        return await recoverCachedMarketSuccessors(saved,gate2Identity());
      }
      if(await rpc('get_block_hash',[tip.number])!==tip.hash)return null;
      const data={...saved.data,tip,refreshedAt:Date.now()};
      saved.data=data;
      return data;
    }
    if(id===PUDGE_GATE2_REGISTRY_ID)return null;
    const [genesis,tip]=await Promise.all([rpc('get_block_hash',['0x0']) as Promise<string>,rpc('get_tip_header',[]) as Promise<{number:string;hash:string}>]);
    if(genesis.toLowerCase()!==PUDGE_GATE2_GENESIS||!tip?.number||!tip.hash)return null;
    const [liveCells,codeCells]=await Promise.all([
      Promise.all(saved.points.map(point=>rpc('get_live_cell',[point,true]) as Promise<{status?:string;cell?:{output:Output;data:{content:string}}}>)),
      Promise.all(saved.deps.map(async(dependency,index)=>({result:await rpc('get_live_cell',[dependencyPoint(dependency),true]) as {status?:string;cell?:{data?:{content?:string}}},index}))),
    ]);
    if(liveCells.some((cell,index)=>cell.status!=='live'||!cell.cell||!sameScript(cell.cell.output.lock,saved.cells[index].output.lock)||!sameScript(cell.cell.output.type,saved.cells[index].output.type)||BigInt(cell.cell.output.capacity)!==BigInt(saved.cells[index].output.capacity)||cell.cell.data.content.toLowerCase()!==saved.cells[index].data.toLowerCase())){
      return null;
    }
    if(codeCells.some(({result,index})=>result.status!=='live'||!result.cell?.data?.content||ccc.hashCkb(result.cell.data.content as ccc.Hex).toLowerCase()!==saved.hashes[index].toLowerCase()))return null;
    const stable=await rpc('get_block_hash',[tip.number]);if(typeof stable!=='string'||stable.toLowerCase()!==tip.hash.toLowerCase())return null;
    return {...saved.data,tip,refreshedAt:Date.now()};
  }catch{return null;}
}

function matchesLiveCell(cell:{status?:string;cell?:{output:Output;data:{content:string}}},expected:Checkpoint['cells'][number]){
  return cell?.status==='live'&&!!cell.cell&&sameScript(cell.cell.output.lock,expected.output.lock)&&
    sameScript(cell.cell.output.type,expected.output.type)&&BigInt(cell.cell.output.capacity)===BigInt(expected.output.capacity)&&
    cell.cell.data.content.toLowerCase()===expected.data.toLowerCase();
}

async function recoverCachedMarketSuccessors(saved:Checkpoint,identity:ReturnType<typeof deriveMarketIdentity>):Promise<MarketData|null>{
  const previous=saved.data;
  if(previous.historyState!=='verified'||!previous.history.length||previous.history.at(-1)?.hash.toLowerCase()!==saved.points[0].tx_hash.toLowerCase())return null;
  const recovered=await recoverMarketSuccessors(rpc,[saved.points[0],saved.points[1]],{maxIndexedDepth:256});
  const lineage=recovered.lineage;
  if(!lineage.length||lineage[0].transaction.hash.toLowerCase()!==saved.points[0].tx_hash.toLowerCase())throw Error('Successor history does not start at the cached market anchor');
  const history=[...previous.history];
  for(let index=1;index<lineage.length;index++){
    const prior=lineage[index-1].transaction as Transaction,next=lineage[index].transaction as Transaction,proof=parseTransition(next.witnesses[5]||''),side=proof.operation===1?'buy':proof.operation===4?'sell':null;
    if(!side)throw Error('Unrecognized Gate 2 market successor operation');
    const transition=transitionAmount(prior,next,identity,side,proof.operation),row=lineage[index];
    history.push(event(next.hash,side,transition.owner,transition.quantity,transition.amount,BigInt(row.blockNumber),BigInt(row.timestampMs)));
  }
  const marketPair=recovered.pair,custodyPair=await currentCustodyPair([saved.points[2],saved.points[3]],rpc);
  const points=[...marketPair,...custodyPair],live=await Promise.all(points.map(point=>rpc('get_live_cell',[point,true]) as Promise<{status?:string;cell?:{output:Output;data:{content:string}}}>));
  if(live.some(cell=>cell.status!=='live'||!cell.cell))throw Error('Gate 2 successor cells are not live');
  const current=lineage.at(-1)!.transaction as Transaction,marketIndex=Number(BigInt(marketPair[0].index)),custodyIndex=Number(BigInt(custodyPair[0].index));
  const custodyTransaction=custodyPair[0].tx_hash===current.hash?current:(await canonical(custodyPair[0].tx_hash)).transaction;
  const cells=live.map(cell=>cell.cell!);
  for(let index=0;index<4;index++){
    const txIndex=Number(BigInt(points[index].index));
    const tx=index<2?current:custodyTransaction;
    const output=tx.outputs[txIndex];
    if(points[index].tx_hash.toLowerCase()!==tx.hash.toLowerCase()||!output||!matchesLiveCell(live[index],{output,data:tx.outputs_data[txIndex]}))throw Error('Gate 2 successor output differs from its canonical transaction');
  }
  verifyOutput(cells[0].output,cells[0].data.content,identity.market,identity.token);
  verifyOutput(cells[1].output,cells[1].data.content,identity.market,identity.marker);
  verifyOutput(cells[2].output,cells[2].data.content,identity.custody,identity.token);
  verifyOutput(cells[3].output,cells[3].data.content,identity.custody,identity.custodyMarker);
  const marketData=current.outputs_data[marketIndex],custodyData=custodyTransaction.outputs_data[custodyIndex];
  if(cells[1].data.content.toLowerCase()!==identity.markerData.toLowerCase()||cells[3].data.content.toLowerCase()!==identity.custodyMarkerData.toLowerCase()||marketData.slice(34).toLowerCase()!==identity.custodyMarker.hash().slice(2).toLowerCase())throw Error('Gate 2 successor marker identity mismatch');
  const curve=decodeCurve(current.outputs[marketIndex].lock.args,marketData),supply=curve.supply,inventory=curve.inventory,custody=readLE(`0x${custodyData.slice(2,34)}`),root=`0x${custodyData.slice(34)}`;
  if(curve.base!==1_000_000_000n||curve.step!==100_000_000n||supply!==2_000n||custodyData.length!==98||inventory+custody>supply||!/^0x[0-9a-f]{64}$/i.test(root))throw Error('Gate 2 successor supply and custody totals do not reconcile');
  const tip=await rpc('get_tip_header',[]) as {number:string;hash:string};
  if(!tip?.number||!tip.hash)throw Error('Pudge chain tip unavailable during successor recovery');
  const stable=await rpc('get_block_hash',[tip.number]);if(typeof stable!=='string'||stable.toLowerCase()!==tip.hash.toLowerCase())throw Error('Pudge chain changed during successor recovery');
  const data:MarketData={...previous,supply:supply.toString(),inventory:inventory.toString(),circulating:(supply-inventory).toString(),custody:custody.toString(),custodyRoot:root,...marketLiquidity(current.outputs[marketIndex].capacity,previous.marketCapacityFloorShannons),buyOneShannons:quote(curve,'buy',1n).toString(),sellOneShannons:quote(curve,'sell',1n).toString(),curve:{base:curve.base.toString(),step:curve.step.toString(),supply:supply.toString(),sold:(supply-inventory).toString()},tip,refreshedAt:Date.now(),history,historyState:'verified'};
  await checkpoint(data,points,cells.map(cell=>({output:cell.output,data:cell.data.content})),saved.deps,saved.hashes,saved.manifestRaw);
  return data;
}

async function currentCustodyPair(start:[Point,Point],client:Rpc):Promise<[Point,Point]>{
  const live=await Promise.all(start.map(point=>client('get_live_cell',[point,true])));
  if(live.every(cell=>cell?.status==='live'))return start;
  return (await recoverMarketSuccessors(client,start,{maxIndexedDepth:256})).pair;
}

async function rpcBatch(calls:[string,unknown[]][]):Promise<any[]>{
  const response=await fetch('https://testnet.ckb.dev/',{
    method:'POST',headers:{'content-type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(15_000),
    body:JSON.stringify(calls.map(([method,params],id)=>({jsonrpc:'2.0',id,method,params}))),
  });
  const rows=await response.json();
  if(!response.ok||!Array.isArray(rows)||rows.length!==calls.length)throw Error('Invalid Pudge RPC batch');
  const byId=new Map(rows.map(row=>[row.id,row]));
  return calls.map((_,id)=>{
    const row=byId.get(id);
    if(!row||row.error||!Object.hasOwn(row,'result'))throw Error('Invalid Pudge RPC batch result');
    return row.result;
  });
}

async function rpc(method:string,params:unknown[]=[]){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15_000);
  try{
    const response=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store',signal:controller.signal});
    const body=await response.json();if(!response.ok||body.error)throw Error(body.error?.message||`Pudge RPC ${method} failed`);return body.result;
  }catch(error){if(controller.signal.aborted)throw Error(`Pudge RPC ${method} timed out`);throw error;}
  finally{clearTimeout(timer);}
}

async function canonical(hash:string,expectedBlockHash?:string,client:Rpc=rpc):Promise<Canonical>{
  const row=await client('get_transaction',[hash]) as {transaction?:Transaction;tx_status?:{status?:string;block_hash?:string;block_number?:string}};
  if(row?.tx_status?.status!=='committed'||!row.tx_status.block_hash||!row.tx_status.block_number||!row.transaction)throw Error(`Registered Gate 2 transaction is not committed: ${hash}`);
  if(expectedBlockHash&&row.tx_status.block_hash.toLowerCase()!==expectedBlockHash.toLowerCase())throw Error(`Registered Gate 2 block differs: ${hash}`);
  if(row.transaction.hash.toLowerCase()!==hash.toLowerCase())throw Error('Gate 2 transaction hash differs from its RPC response');
  const [blockHash,header]=await Promise.all([
    client('get_block_hash',[row.tx_status.block_number]) as Promise<string>,
    client('get_header',[row.tx_status.block_hash]) as Promise<{hash?:string;number?:string;timestamp?:string}>,
  ]);
  if(typeof blockHash!=='string'||blockHash.toLowerCase()!==row.tx_status.block_hash.toLowerCase()||header.hash?.toLowerCase()!==row.tx_status.block_hash.toLowerCase()||header.number?.toLowerCase()!==row.tx_status.block_number.toLowerCase()||!header.timestamp)throw Error('Gate 2 transaction is not in the canonical chain');
  const parsed=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(row.transaction as never));
  if(parsed.hash().toLowerCase()!==hash.toLowerCase())throw Error('Gate 2 transaction serialization hash mismatch');
  return {transaction:row.transaction,blockNumber:BigInt(header.number),timestampMs:BigInt(header.timestamp),blockHash:row.tx_status.block_hash};
}

function verifyOutput(output:Output,data:string,lock:ccc.Script,type:ccc.Script){
  if(!sameScript(output.lock,{code_hash:lock.codeHash,hash_type:lock.hashType,args:lock.args})||!sameScript(output.type,{code_hash:type.codeHash,hash_type:type.hashType,args:type.args}))throw Error('Gate 2 output script identity mismatch');
}

function parseTransition(witness:string){
  const value=witness.toLowerCase();
  if(!/^0x544d5331010[0-4]0100[0-9a-f]+$/.test(value)||value.length<2+(12+96)*2)throw Error('Invalid Gate 2 transition witness');
  const operation=Number.parseInt(value.slice(12,14),16),proofLength=Number(readLE(`0x${value.slice(18,26)}`));
  if(!Number.isSafeInteger(proofLength))throw Error('Invalid Gate 2 proof length');
  const tailStart=2+(12+96+proofLength)*2;if(value.length<tailStart)throw Error('Truncated Gate 2 proof');
  return {operation,owner:`0x${value.slice(26,90)}`,oldBalance:readLE(`0x${value.slice(90,106)}`),newBalance:readLE(`0x${value.slice(154,170)}`),tail:value.slice(tailStart)};
}

function transitionAmount(previous:Transaction,next:Transaction,identity:ReturnType<typeof deriveMarketIdentity>,side:'buy'|'sell',expectedOperation:number){
  if(previous.outputs.length<4||next.inputs.length!==5||next.outputs.length!==5||next.outputs_data.length!==5||next.witnesses.length<6)throw Error('Gate 2 trade shape is invalid');
  for(let index=0;index<4;index++){
    if(!samePoint(next.inputs[index].previous_output,expectedPoint(previous.hash,index)))throw Error('Gate 2 trade lineage is discontinuous');
  }
  verifyOutput(next.outputs[0],next.outputs_data[0],identity.market,identity.token);
  verifyOutput(next.outputs[1],next.outputs_data[1],identity.market,identity.marker);
  verifyOutput(next.outputs[2],next.outputs_data[2],identity.custody,identity.token);
  verifyOutput(next.outputs[3],next.outputs_data[3],identity.custody,identity.custodyMarker);
  if(next.outputs_data[1].toLowerCase()!==identity.markerData.toLowerCase()||next.outputs_data[3].toLowerCase()!==identity.custodyMarkerData.toLowerCase()||next.outputs[4].type||next.outputs_data[4].toLowerCase()!=='0x')throw Error('Gate 2 trade marker or wallet output changed');
  const proof=parseTransition(next.witnesses[5]);
  if(proof.operation!==expectedOperation||!/^0x[0-9a-f]{64}$/i.test(proof.owner)||scriptHash(next.outputs[4].lock)!==proof.owner.toLowerCase())throw Error('Gate 2 trade owner or operation mismatch');
  const quantity=side==='buy'?proof.newBalance-proof.oldBalance:proof.oldBalance-proof.newBalance;
  if(quantity<=0n)throw Error('Gate 2 transition quantity is invalid');
  const oldMarket=previous.outputs[0],oldCustody=previous.outputs[2];
  const curve=decodeCurve(oldMarket.lock.args,previous.outputs_data[0]);
  const amount=quote(curve,side,quantity);
  const expectedInventory=curve.inventory+(side==='buy'?-quantity:quantity);
  const oldCustodyAmount=readLE(`0x${previous.outputs_data[2].slice(2,34)}`),expectedCustody=oldCustodyAmount+(side==='buy'?quantity:-quantity);
  if(expectedCustody<0n||BigInt(next.outputs[0].capacity)!==BigInt(oldMarket.capacity)+(side==='buy'?amount:-amount)||readLE(`0x${next.outputs_data[0].slice(2,34)}`)!==expectedInventory||next.outputs_data[0].slice(34).toLowerCase()!==previous.outputs_data[0].slice(34).toLowerCase()||readLE(`0x${next.outputs_data[2].slice(2,34)}`)!==expectedCustody||next.outputs_data[2].length!==98)throw Error('Gate 2 curve or custody accounting differs from its witness');
  for(const index of [1,2,3])if(BigInt(next.outputs[index].capacity)!==BigInt(previous.outputs[index].capacity))throw Error('Gate 2 marker capacity changed');
  if(side==='sell'){
    const le=(number:bigint,size:number)=>Array.from({length:size},(_,i)=>Number((number>>BigInt(i*8))&255n).toString(16).padStart(2,'0')).join('');
    if(proof.tail!==`${le(quantity,8)}${le(amount,8)}`)throw Error('Gate 2 sell payout witness differs from curve terms');
  }else if(proof.tail!=='')throw Error('Gate 2 buy witness has an unexpected suffix');
  return {quantity,amount,owner:proof.owner,curve};
}

function verifyStageLineage(setup:Transaction,issuance:Transaction,initialization:Transaction,buy:Transaction,sell:Transaction,identity:ReturnType<typeof deriveMarketIdentity>){
  if(!issuance.inputs.some(input=>samePoint(input.previous_output,{tx_hash:PUDGE_GATE2_ANCHOR.txHash,index:PUDGE_GATE2_ANCHOR.index}))||!issuance.inputs.some(input=>samePoint(input.previous_output,expectedPoint(setup.hash,0))))throw Error('Gate 2 issuance lineage mismatch');
  if(!initialization.inputs.some(input=>samePoint(input.previous_output,expectedPoint(issuance.hash,0)))||!initialization.inputs.some(input=>samePoint(input.previous_output,expectedPoint(issuance.hash,1)))||!initialization.inputs.some(input=>samePoint(input.previous_output,expectedPoint(setup.hash,1))))throw Error('Gate 2 initialization lineage mismatch');
  verifyOutput(issuance.outputs[0],issuance.outputs_data[0],identity.market,identity.token);
  verifyOutput(issuance.outputs[1],issuance.outputs_data[1],identity.market,identity.marker);
  verifyOutput(initialization.outputs[0],initialization.outputs_data[0],identity.market,identity.token);
  verifyOutput(initialization.outputs[1],initialization.outputs_data[1],identity.market,identity.marker);
  verifyOutput(initialization.outputs[2],initialization.outputs_data[2],identity.custody,identity.token);
  verifyOutput(initialization.outputs[3],initialization.outputs_data[3],identity.custody,identity.custodyMarker);
  const initial=parseTransition(initialization.witnesses[3]||'');
  if(initial.operation!==0||initial.oldBalance!==0n||initial.newBalance!==7n||initial.owner.toLowerCase()!==PUDGE_GATE2_OWNER.toLowerCase())throw Error('Gate 2 initial issuance purchase differs from registered terms');
  const initialCurve=decodeCurve(issuance.outputs[0].lock.args,`0x${issuance.outputs_data[0].slice(2)}${identity.custodyMarker.hash().slice(2)}`);
  const initialAmount=quote(initialCurve,'buy',initial.newBalance);
  if(BigInt(initialization.outputs[0].capacity)!==BigInt(issuance.outputs[0].capacity)+initialAmount||initialization.outputs_data[1].toLowerCase()!==identity.markerData.toLowerCase()||initialization.outputs_data[3].toLowerCase()!==identity.custodyMarkerData.toLowerCase())throw Error('Gate 2 initial purchase accounting mismatch');
  const bought=transitionAmount(initialization,buy,identity,'buy',1);
  const sold=transitionAmount(buy,sell,identity,'sell',4);
  if(readLE(`0x${sell.outputs_data[0].slice(2,34)}`)!==1993n)throw Error('Recorded Pudge Sell inventory differs from expected 1,993 xUDT');
  const custody=readLE(`0x${sell.outputs_data[2].slice(2,34)}`);
  if(custody!==7n)throw Error('Recorded Pudge Sell custody differs from expected 7 xUDT');
  return {initial,bought,sold,initialAmount};
}

async function verifyCodeCells(client:Rpc=rpc){
  const expected=[PUDGE_GATE2_CODES.custody,PUDGE_GATE2_CODES.market,PUDGE_GATE2_CODES.custodyMarker,PUDGE_GATE2_CODES.marker,PUDGE_GATE2_CODES.ownerLock,PUDGE_GATE2_CODES.xudt];
  const points=[...expected.slice(0,5).map((_,index)=>expectedPoint(PUDGE_GATE2_STAGE_TXS.code,index)),{tx_hash:PUDGE_GATE2_XUDT_DEP.outPoint.txHash,index:PUDGE_GATE2_XUDT_DEP.outPoint.index}];
  await Promise.all(points.map(async(point,index)=>{
    const result=await client('get_live_cell',[{tx_hash:point.tx_hash,index:point.index},true]) as {status?:string;cell?:{data?:{content?:string}}};
    if(result.status!=='live'||!result.cell?.data?.content||ccc.hashCkb(result.cell.data.content as ccc.Hex).toLowerCase()!==expected[index].toLowerCase())throw Error(`Gate 2 code dependency is unavailable: ${expected[index]}`);
  }));
}

function event(hash:string,side:'buy'|'sell',owner:string,quantity:bigint,amount:bigint,blockNumber:bigint,timestampMs:bigint):TradeEvent{
  return {hash,side,owner,quantity:quantity.toString(),amountShannons:amount.toString(),blockNumber:blockNumber.toString(),timestampMs:timestampMs.toString(),status:'confirmed'};
}

function marketLiquidity(cellCapacity:string,floorCapacity:string){
  // The confirmed issuance output establishes structural capacity; later capacity is curve liquidity.
  return deriveMarketLiquidity(cellCapacity,floorCapacity);
}

async function getMarketDataFromManifest(rawManifest:string):Promise<MarketData>{
  let possibleId='';try{possibleId=ccc.Script.from(JSON.parse(rawManifest)?.scripts?.market).hash().toLowerCase();}catch{}
  if(possibleId){const cached=await cachedMarket(possibleId,rawManifest);if(cached)return cached;}
  const client=requestRpc(),manifest=await loadPudgeManifest(client,rawManifest,verifyPudgeInitialProof),identity=manifest.scripts;
  if(manifest.genesis.toLowerCase()!==PUDGE_GATE2_GENESIS)throw Error('Pudge network identity mismatch');
  const tip=await client('get_tip_header',[]) as {number:string;hash:string};
  const codeCells=[
    manifest.deps.custody_smt,manifest.deps.market_smt,manifest.deps.custody_marker,
    manifest.deps.marker_candidate,manifest.deps.owner_lineage_candidate,manifest.deps.xudt,
  ];
  const codeHashes=[identity.custody.codeHash,identity.market.codeHash,identity.custodyMarker.codeHash,identity.marker.codeHash,identity.owner.codeHash,identity.token.codeHash];
  await Promise.all(codeCells.map(async(dependency,index)=>{
    const point=ccc.OutPoint.from(dependency.outPoint),result=await client('get_live_cell',[{tx_hash:point.txHash,index:point.index},true]) as {status?:string;cell?:{data?:{content?:string}}};
    if(result.status!=='live'||!result.cell?.data?.content||ccc.hashCkb(result.cell.data.content as ccc.Hex).toLowerCase()!==codeHashes[index].toLowerCase())throw Error('Gate 2 launch dependency is unavailable');
  }));
  const initialPoints=manifest.initial as [Point,Point,Point,Point];
  const [initialized,issued]=await Promise.all([
    canonical(manifest.initializationTransactionHash,undefined,client),
    canonical(manifest.journal.entries[2].txHash,manifest.journal.entries[2].blockHash,client),
  ]);
  verifyOutput(issued.transaction.outputs[0],issued.transaction.outputs_data[0],identity.market,identity.token);
  const recovered=await recoverMarketHistory(client,[initialPoints[0],initialPoints[1]],{maxIndexedDepth:256});
  if(recovered.lineage[0]?.transaction.hash.toLowerCase()!==manifest.initializationTransactionHash.toLowerCase())throw Error('Market history does not begin at the registered launch');
  const current=await canonical(recovered.pair[0].tx_hash,undefined,client),custodyPair=await discoverCustodyPair(client,{tx_hash:recovered.pair[0].tx_hash,index:'0x2'});
  if(recovered.pair[0].tx_hash.toLowerCase()!==recovered.pair[1].tx_hash.toLowerCase()||custodyPair[1].tx_hash.toLowerCase()!==recovered.pair[0].tx_hash.toLowerCase())throw Error('Gate 2 market and custody successors are not paired');
  const [marketCell,markerCell,custodyCell,custodyMarkerCell]=await Promise.all([...recovered.pair,...custodyPair].map(point=>client('get_live_cell',[{tx_hash:point.tx_hash,index:point.index},true]) as Promise<{status?:string;cell?:{output:Output;data:{content:string}}}>));
  const cells=[marketCell,markerCell,custodyCell,custodyMarkerCell];
  if(cells.some(cell=>cell.status!=='live'||!cell.cell))throw Error('Gate 2 market singleton is not live');
  verifyOutput(cells[0].cell!.output,cells[0].cell!.data.content,identity.market,identity.token);
  verifyOutput(cells[1].cell!.output,cells[1].cell!.data.content,identity.market,identity.marker);
  verifyOutput(cells[2].cell!.output,cells[2].cell!.data.content,identity.custody,identity.token);
  verifyOutput(cells[3].cell!.output,cells[3].cell!.data.content,identity.custody,identity.custodyMarker);
  if(cells[1].cell!.data.content.toLowerCase()!==identity.markerData.toLowerCase()||cells[3].cell!.data.content.toLowerCase()!==identity.custodyMarkerData.toLowerCase())throw Error('Gate 2 marker data identity mismatch');
  const stable=await client('get_block_hash',[tip.number]);if(typeof stable!=='string'||stable.toLowerCase()!==tip.hash.toLowerCase())throw Error('Pudge chain changed during market recovery');
  const marketIndex=Number(BigInt(recovered.pair[0].index)),custodyIndex=Number(BigInt(custodyPair[0].index));
  const marketData=current.transaction.outputs_data[marketIndex],custodyData=current.transaction.outputs_data[custodyIndex];
  if(marketData.slice(34).toLowerCase()!==identity.custodyMarker.hash().slice(2).toLowerCase())throw Error('Gate 2 market inventory marker mismatch');
  const curve=decodeCurve(current.transaction.outputs[marketIndex].lock.args,marketData),supply=curve.supply,inventory=curve.inventory,custody=readLE(`0x${custodyData.slice(2,34)}`),root=`0x${custodyData.slice(34)}`;
  if(inventory+custody!==supply||!/^0x[0-9a-f]{64}$/i.test(root))throw Error('Gate 2 supply and custody totals do not reconcile');
  let historyState:MarketData['historyState']='verified',history:TradeEvent[]=[];
  try{
    const purchase=initialized.transaction,initial=parseTransition(purchase.witnesses[3]||''),initialQuantity=initial.newBalance-initial.oldBalance;
    const issuedData=issued.transaction.outputs_data[0],initialCurve=decodeCurve(issued.transaction.outputs[0].lock.args,`0x${issuedData.slice(2)}${identity.custodyMarker.hash().slice(2)}`);
    if(initial.operation!==0||initial.oldBalance!==0n||initialQuantity<=0n||initial.owner.toLowerCase()!==manifest.journal.owner.toLowerCase())throw Error('Launch purchase terms differ from the verified owner');
    const initialAmount=quote(initialCurve,'buy',initialQuantity);
    history=[event(purchase.hash,'buy',initial.owner,initialQuantity,initialAmount,initialized.blockNumber,initialized.timestampMs)];
    for(let index=1;index<recovered.lineage.length;index++){
      const previous=recovered.lineage[index-1].transaction as Transaction,next=recovered.lineage[index].transaction as Transaction,proof=parseTransition(next.witnesses[5]||''),side=proof.operation===1?'buy':proof.operation===4?'sell':null;
      if(!side)throw Error('Unrecognized Gate 2 market successor operation');
      const transition=transitionAmount(previous,next,identity,side,proof.operation),row=recovered.lineage[index];
      history.push(event(next.hash,side,transition.owner,transition.quantity,transition.amount,BigInt(row.blockNumber),BigInt(row.timestampMs)));
    }
    if(recovered.lineage.at(-1)?.transaction.hash.toLowerCase()!==current.transaction.hash.toLowerCase())throw Error('Current market is not the end of the verified history');
  }catch{history=[];historyState='unavailable';}
  const liquidity=marketLiquidity(current.transaction.outputs[marketIndex].capacity,issued.transaction.outputs[0].capacity);
  const token=resolvePudgeTokenMetadata({genesis:manifest.genesis,marketScriptHash:identity.market.hash(),tokenTypeHash:identity.token.hash(),initializationTransactionHash:manifest.initializationTransactionHash});
  const data:MarketData={
    id:identity.market.hash().toLowerCase(),identity:identity.market.hash(),genesis:PUDGE_GATE2_GENESIS,
    token:{...token,typeHash:identity.token.hash()},pair:`${token.symbol} / CKB`,supply:supply.toString(),inventory:inventory.toString(),circulating:(supply-inventory).toString(),custody:custody.toString(),custodyRoot:root,
    ...liquidity,
    buyOneShannons:quote(curve,'buy',1n).toString(),sellOneShannons:quote(curve,'sell',1n).toString(),curve:{base:curve.base.toString(),step:curve.step.toString(),supply:supply.toString(),sold:(supply-inventory).toString()},tip:{number:tip.number,hash:tip.hash},refreshedAt:Date.now(),history,historyState,manifest,
  };
  await checkpoint(data,[...recovered.pair,...custodyPair],cells.map(cell=>({output:cell.cell!.output,data:cell.cell!.data.content})),codeCells,codeHashes,rawManifest);
  return data;
}

export async function getPudgeMarketDataForManifest(rawManifest:string){
  return getMarketDataFromManifest(rawManifest);
}

export function getPudgeMarketData():Promise<MarketData>{
  registeredRefresh??=refreshRegisteredMarket().finally(()=>{registeredRefresh=undefined;});
  return registeredRefresh;
}

export async function getPudgeDisplaySnapshot(){
  const saved=checkpoints.get(PUDGE_GATE2_REGISTRY_ID)||await readMarketCheckpoint();
  if(!saved||!verifiedCheckpoints.has(saved))return null;
  const age=Date.now()-saved.data.refreshedAt;
  return age>=0&&age<=30_000?saved.data:null;
}

export async function getPudgeCustodyAnchor(){
  const market=await getPudgeMarketData();
  const saved=checkpoints.get(PUDGE_GATE2_REGISTRY_ID);
  if(!saved||saved.data.custodyRoot!==market.custodyRoot)throw Error('Pudge market recovery changed');
  return {point:saved.points[2],data:saved.cells[2].data,inventory:market.inventory,custody:market.custody,supply:market.supply};
}

async function refreshRegisteredMarket():Promise<MarketData>{
  const cached=await cachedMarket('pudge-xudt');if(cached)return cached;
  const client=requestRpc();
  const identity=gate2Identity();
  const journalBlocks=new Map(PUDGE_GATE2_JOURNAL.entries.map(entry=>[entry.txHash.toLowerCase(),entry.blockHash]));
  const hashes=[PUDGE_GATE2_STAGE_TXS.code,PUDGE_GATE2_STAGE_TXS.setup,PUDGE_GATE2_STAGE_TXS.issuance,PUDGE_GATE2_INITIALIZATION,PUDGE_GATE2_BUY,PUDGE_GATE2_SELL];
  const [genesis,tip,code,setup,issuance,initialization,buy,sell]=await Promise.all([
    rpc('get_block_hash',['0x0']) as Promise<string>,
    rpc('get_tip_header',[]) as Promise<{number:string;hash:string}>,
    ...hashes.map(hash=>canonical(hash,journalBlocks.get(hash.toLowerCase()),client)),
    verifyCodeCells(client),
  ]) as [string,{number:string;hash:string},Canonical,Canonical,Canonical,Canonical,Canonical,Canonical,void];
  if(genesis.toLowerCase()!==PUDGE_GATE2_GENESIS||!tip?.number||!tip.hash)throw Error('Pudge network identity mismatch');
  const verified=verifyStageLineage(setup.transaction,issuance.transaction,initialization.transaction,buy.transaction,sell.transaction,identity);
  const initPair=[expectedPoint(initialization.transaction.hash,0),expectedPoint(initialization.transaction.hash,1)] as [Point,Point];
  const registeredSellPoints=[expectedPoint(sell.transaction.hash,0),expectedPoint(sell.transaction.hash,1)] as [Point,Point];
  const registeredLive=await Promise.all([0,1,2,3].map(index=>client('get_live_cell',[{tx_hash:sell.transaction.hash,index:`0x${index.toString(16)}`},true]) as Promise<{status?:string}>));
  let recovered:Awaited<ReturnType<typeof recoverMarketHistory>>|null=null,marketPair:[Point,Point];
  if(registeredLive.every(cell=>cell.status==='live'))marketPair=registeredSellPoints;
  else{
    try{recovered=await recoverMarketHistory(client,initPair,{maxIndexedDepth:256});}catch{}
    marketPair=recovered?.pair||await discoverMarketPair(client,initPair,{indexedOnly:true,maxIndexedDepth:256});
  }
  const custodyPair=registeredLive.every(cell=>cell.status==='live')
    ?[expectedPoint(sell.transaction.hash,2),expectedPoint(sell.transaction.hash,3)] as [Point,Point]
    :await currentCustodyPair([expectedPoint(initialization.transaction.hash,2),expectedPoint(initialization.transaction.hash,3)],client);
  const current=await canonical(marketPair[0].tx_hash,undefined,client);
  const custodyTransaction=custodyPair[0].tx_hash===current.transaction.hash?current.transaction:(await canonical(custodyPair[0].tx_hash,undefined,client)).transaction;
  const [marketCell,markerCell,custodyCell,custodyMarkerCell]=await Promise.all([...marketPair,...custodyPair].map(point=>client('get_live_cell',[{tx_hash:point.tx_hash,index:point.index},true]) as Promise<{status?:string;cell?:{output:Output;data:{content:string}}}>));
  const cells=[marketCell,markerCell,custodyCell,custodyMarkerCell];if(cells.some(cell=>cell.status!=='live'||!cell.cell))throw Error('Gate 2 market singleton is not live');
  for(const [index,point] of [...marketPair,...custodyPair].entries()){
    const tx=index<2?current.transaction:custodyTransaction,slot=Number(BigInt(point.index));
    if(tx.hash!==point.tx_hash||!tx.outputs[slot]||!matchesLiveCell(cells[index],{output:tx.outputs[slot],data:tx.outputs_data[slot]}))throw Error('Gate 2 live output differs from its canonical transaction');
  }
  verifyOutput(cells[0].cell!.output,cells[0].cell!.data.content,identity.market,identity.token);
  verifyOutput(cells[1].cell!.output,cells[1].cell!.data.content,identity.market,identity.marker);
  verifyOutput(cells[2].cell!.output,cells[2].cell!.data.content,identity.custody,identity.token);
  verifyOutput(cells[3].cell!.output,cells[3].cell!.data.content,identity.custody,identity.custodyMarker);
  if(cells[1].cell!.data.content.toLowerCase()!==identity.markerData.toLowerCase()||cells[3].cell!.data.content.toLowerCase()!==identity.custodyMarkerData.toLowerCase())throw Error('Gate 2 marker data identity mismatch');
  const stable=await rpc('get_block_hash',[tip.number]);if(typeof stable!=='string'||stable.toLowerCase()!==tip.hash.toLowerCase())throw Error('Pudge chain changed during market recovery');
  const marketTransaction=current.transaction,marketIndex=Number(BigInt(marketPair[0].index)),custodyIndex=Number(BigInt(custodyPair[0].index));
  const marketData=marketTransaction.outputs_data[marketIndex],custodyData=custodyTransaction.outputs_data[custodyIndex];
  if(marketData.slice(34).toLowerCase()!==identity.custodyMarker.hash().slice(2).toLowerCase())throw Error('Gate 2 market inventory marker mismatch');
  const curve=decodeCurve(marketTransaction.outputs[marketIndex].lock.args,marketData),supply=curve.supply,inventory=curve.inventory,custody=readLE(`0x${custodyData.slice(2,34)}`),root=`0x${custodyData.slice(34)}`;
  if(inventory+custody>supply||!/^0x[0-9a-f]{64}$/i.test(root))throw Error('Gate 2 supply and custody totals do not reconcile');
  let historyState:MarketData['historyState']='unavailable',history:TradeEvent[]=[];
  if(current.transaction.hash.toLowerCase()===sell.transaction.hash.toLowerCase()){
    history=[event(initialization.transaction.hash,'buy',verified.initial.owner,7n,verified.initialAmount,initialization.blockNumber,initialization.timestampMs),event(buy.transaction.hash,'buy',verified.bought.owner,verified.bought.quantity,verified.bought.amount,buy.blockNumber,buy.timestampMs),event(sell.transaction.hash,'sell',verified.sold.owner,verified.sold.quantity,verified.sold.amount,sell.blockNumber,sell.timestampMs)];
    historyState='verified';
  }else if(recovered){
    try{
      const lineage=recovered.lineage;
      if(lineage.length<1||lineage[0].transaction.hash.toLowerCase()!==initialization.transaction.hash.toLowerCase()||lineage.at(-1)?.transaction.hash.toLowerCase()!==current.transaction.hash.toLowerCase())throw Error('Gate 2 history does not span the registered initializer and current market');
      if(lineage.filter(row=>row.transaction.hash.toLowerCase()===initialization.transaction.hash.toLowerCase()).length!==1)throw Error('Gate 2 initialization is duplicated in history');
      const initialRow=lineage[0];
      history=[event(initialization.transaction.hash,'buy',verified.initial.owner,7n,verified.initialAmount,BigInt(initialRow.blockNumber),BigInt(initialRow.timestampMs))];
      for(let index=1;index<lineage.length;index++){
        const previous=lineage[index-1].transaction as Transaction,next=lineage[index].transaction as Transaction,proof=parseTransition(next.witnesses[5]||'');
        const side=proof.operation===1?'buy':proof.operation===4?'sell':null;
        if(!side)throw Error('Unrecognized Gate 2 market successor operation');
        const transition=transitionAmount(previous,next,identity,side,proof.operation),row=lineage[index];
        history.push(event(next.hash,side,transition.owner,transition.quantity,transition.amount,BigInt(row.blockNumber),BigInt(row.timestampMs)));
      }
      historyState='verified';
    }catch{history=[];historyState='unavailable';}
  }
  const token=resolvePudgeTokenMetadata({genesis:PUDGE_GATE2_GENESIS,marketScriptHash:identity.market.hash(),tokenTypeHash:identity.token.hash(),initializationTransactionHash:PUDGE_GATE2_INITIALIZATION});
  const data:MarketData={
    id:'pudge-xudt',identity:identity.market.hash(),genesis:PUDGE_GATE2_GENESIS,
    token:{...token,typeHash:identity.token.hash()},pair:`${token.symbol} / CKB`,supply:supply.toString(),inventory:inventory.toString(),circulating:(supply-inventory).toString(),custody:custody.toString(),custodyRoot:root,
    ...marketLiquidity(marketTransaction.outputs[marketIndex].capacity,issuance.transaction.outputs[0].capacity),
    buyOneShannons:quote(curve,'buy',1n).toString(),sellOneShannons:quote(curve,'sell',1n).toString(),curve:{base:curve.base.toString(),step:curve.step.toString(),supply:supply.toString(),sold:(supply-inventory).toString()},tip:{number:tip.number,hash:tip.hash},refreshedAt:Date.now(),history,historyState,
    manifest:{format:'roveko-pudge-market-v1',genesis:PUDGE_GATE2_GENESIS,attempt:PUDGE_GATE2_ATTEMPT,journal:PUDGE_GATE2_JOURNAL,initializationTransactionHash:PUDGE_GATE2_INITIALIZATION,codeDeploymentTransactionHash:PUDGE_GATE2_STAGE_TXS.code,initial:[0,1,2,3].map(index=>expectedPoint(PUDGE_GATE2_INITIALIZATION,index)),funding:{txHash:PUDGE_GATE2_INITIALIZATION,index:'0x4'},scripts:identity,deps:{custody_smt:{outPoint:{txHash:PUDGE_GATE2_STAGE_TXS.code,index:'0x0'},depType:'code'},market_smt:{outPoint:{txHash:PUDGE_GATE2_STAGE_TXS.code,index:'0x1'},depType:'code'},custody_marker:{outPoint:{txHash:PUDGE_GATE2_STAGE_TXS.code,index:'0x2'},depType:'code'},marker_candidate:{outPoint:{txHash:PUDGE_GATE2_STAGE_TXS.code,index:'0x3'},depType:'code'},owner_lineage_candidate:{outPoint:{txHash:PUDGE_GATE2_STAGE_TXS.code,index:'0x4'},depType:'code'},xudt:PUDGE_GATE2_XUDT_DEP}},
  };
  const codeDeps=[...Array.from({length:5},(_,index)=>({outPoint:{txHash:PUDGE_GATE2_STAGE_TXS.code,index:`0x${index.toString(16)}`},depType:'code'})),PUDGE_GATE2_XUDT_DEP];
  await checkpoint(data,[...marketPair,...custodyPair],cells.map(cell=>({output:cell.cell!.output,data:cell.cell!.data.content})),codeDeps,[PUDGE_GATE2_CODES.custody,PUDGE_GATE2_CODES.market,PUDGE_GATE2_CODES.custodyMarker,PUDGE_GATE2_CODES.marker,PUDGE_GATE2_CODES.ownerLock,PUDGE_GATE2_CODES.xudt]);
  return data;
}

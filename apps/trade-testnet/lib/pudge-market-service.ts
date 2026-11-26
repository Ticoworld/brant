import {marketNetwork} from './v2-engine/market-network-server.ts';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {quote,decodeCurve} from './v2-engine/curve.ts';
import {discoverMarketPair,recoverMarketHistory,recoverMarketSuccessors,type Point} from './v2-engine/lineage.ts';
import {deriveMarketIdentity} from './v2-engine/initialization.ts';
import {loadPudgeManifest} from './v2-engine/pudge-manifest.ts';
import {resolvePudgeTokenMetadata} from './pudge-market-metadata.ts';
import {deriveMarketLiquidity} from './v2-engine/market-capacity.ts';
import {generatePudgeLaunchProof} from './v2-engine/pudge-launch-proof-server.ts';
import {PUDGE_GATE2_ANCHOR,PUDGE_GATE2_ATTEMPT,PUDGE_GATE2_BUY,PUDGE_GATE2_CODES,PUDGE_GATE2_GENESIS,PUDGE_GATE2_INITIALIZATION,PUDGE_GATE2_JOURNAL,PUDGE_GATE2_OWNER,PUDGE_GATE2_REGISTRY_ID,PUDGE_GATE2_SELL,PUDGE_GATE2_STAGE_TXS,PUDGE_GATE2_XUDT_DEP} from './v2-engine/pudge-public-registry.ts';
import type {MarketData,TradeEvent} from '../app/trader/types.ts';
import {openPudgeSnapshot,sealPudgeSnapshot} from './pudge-snapshot.ts';
import {getCatalogMarket} from './v2-engine/shared-market-catalog.ts';
import {sharedLaunchDependencies} from './v2-engine/shared-launch.ts';
import type {VerifiedMarketRecord} from './v2-engine/verified-market.ts';

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
const orphanedCheckpoints=new WeakSet<Checkpoint>();
const marketSnapshotScope='pudge-market-v2:'+PUDGE_GATE2_GENESIS+':'+PUDGE_GATE2_INITIALIZATION;
let registeredRefresh:Promise<MarketData>|undefined;

function requestRpc():Rpc{
  const cache=new Map<string,Promise<unknown>>(),cachedMethods=new Set(['get_transaction','get_header','get_block_by_number','get_cells']);
  return (method,params)=>{
    if(!cachedMethods.has(method))return rpc(method,params);
    const key=`${method}:${JSON.stringify(params)}`;
    let pending=cache.get(key);
    if(!pending){
      pending=rpc(method,params).catch(error=>{
        cache.delete(key);
        throw error;
      });
      cache.set(key,pending);
    }
    return pending;
  };
}

async function checkpoint(data:MarketData,points:Point[],cells:{output:Output;data:string}[],deps:unknown[],hashes:string[],manifestRaw?:string){
  const saved={data,points,cells,deps,hashes,...(manifestRaw?{manifestRaw}:{})};
  if(data.historyState!=='verified')return;
  checkpoints.set(data.id,saved);
  while(checkpoints.size>32)checkpoints.delete(checkpoints.keys().next().value!);
  verifiedCheckpoints.add(saved);
  await persistMarketCheckpoint(saved).catch(error=>console.warn('Market checkpoint publication failed',error));
}

function marketCheckpointPath(id:string){
  const directory=process.env.ROVEKO_PUDGE_PROOF_CACHE_DIR;
  if(!directory||(id!==PUDGE_GATE2_REGISTRY_ID&&!/^0x[0-9a-f]{64}$/.test(id)))return undefined;
  return path.join(path.resolve(directory),id+'-market.json');
}

async function persistMarketCheckpoint(saved:Checkpoint){
  const file=marketCheckpointPath(saved.data.id);if(!file)return;
  const directory=path.dirname(file),temporary=path.join(directory,`.pudge-xudt-market.${randomUUID()}.tmp`);
  const payload=sealPudgeSnapshot(checkpointScope(saved.data.id),saved);
  if(!payload||Buffer.byteLength(payload)>8*1024*1024)return;
  await mkdir(directory,{recursive:true,mode:0o700});
  try{await writeFile(temporary,payload,{flag:'wx',mode:0o600});await rename(temporary,file);}
  finally{await rm(temporary,{force:true}).catch(()=>{});}
}

function checkpointScope(id:string){
  return id===PUDGE_GATE2_REGISTRY_ID?marketSnapshotScope:marketSnapshotScope+':'+id;
}

async function readMarketCheckpoint(id=PUDGE_GATE2_REGISTRY_ID){
  const file=marketCheckpointPath(id);if(!file)return null;
  try{
    const info=await stat(file);if(!info.isFile()||info.size>8*1024*1024)return null;
    const saved=openPudgeSnapshot<Checkpoint>(checkpointScope(id),await readFile(file,'utf8'));
    if(saved?.data?.id!==id||saved.data.historyState!=='verified'||!saved.data.history?.length||!Array.isArray(saved.points)||saved.points.length!==4||!Array.isArray(saved.cells)||saved.cells.length!==4||!Array.isArray(saved.deps)||saved.deps.length!==6||!Array.isArray(saved.hashes)||saved.hashes.length!==6)return null;
    if(id!==PUDGE_GATE2_REGISTRY_ID){
      const manifest=saved.data.manifest as RecoveryManifest;
      for(const name of ['market','marker','custody','custodyMarker','owner','token'] as const){
        manifest.scripts[name]=ccc.Script.from(manifest.scripts[name]);
        if(manifest.verifiedMarket)manifest.verifiedMarket.scripts[name]=manifest.scripts[name];
      }
      if(manifest.scripts.market.hash().toLowerCase()!==id)return null;
    }
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
  if(!saved){
    saved=await readMarketCheckpoint(id)||undefined;
    if(saved&&saved.manifestRaw===manifestRaw){
      checkpoints.set(id,saved);
      while(checkpoints.size>32)checkpoints.delete(checkpoints.keys().next().value!);
    }
  }
  if(!saved||saved.manifestRaw!==manifestRaw)return null;
  try{
    if(!verifiedCheckpoints.has(saved))return null;
    const [genesis,tip,anchor,...results]=await rpcBatch([
      ['get_block_hash',['0x0']],
      ['get_tip_header',[]],
      ['get_block_hash',[saved.data.tip.number]],
      ...saved.points.map(point=>['get_live_cell',[point,true]] as [string,unknown[]]),
      ...saved.deps.map(dep=>['get_live_cell',[dependencyPoint(dep),false]] as [string,unknown[]]),
    ]);
    if(typeof anchor==='string'&&anchor!==saved.data.tip.hash)orphanedCheckpoints.add(saved);
    if(genesis!==marketNetwork().genesis||!tip?.number||!tip.hash||BigInt(tip.number)<BigInt(saved.data.tip.number))return null;
    if(anchor!==saved.data.tip.hash||results.slice(4).some(dep=>dep?.status!=='live'))return null;
    if(results.slice(0,4).some((cell,index)=>!matchesLiveCell(cell,saved.cells[index]))){
      const identity=id===PUDGE_GATE2_REGISTRY_ID&&!manifestRaw?gate2Identity():(saved.data.manifest as RecoveryManifest).scripts;
      return await recoverCachedMarketSuccessors(saved,identity);
    }
    if(await rpc('get_block_hash',[tip.number])!==tip.hash)return null;
    const data={...saved.data,tip:{number:tip.number,hash:tip.hash},refreshedAt:Date.now()};
    saved.data=data;
    return data;
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
  const [recovered,custodyPair]=await Promise.all([
    recoverMarketSuccessors(rpc,[saved.points[0],saved.points[1]],{maxIndexedDepth:256}),
    currentCustodyPair([saved.points[2],saved.points[3]],rpc),
  ]);
  const lineage=recovered.lineage;
  if(!lineage.length||lineage[0].transaction.hash.toLowerCase()!==saved.points[0].tx_hash.toLowerCase())throw Error('Successor history does not start at the cached market anchor');
  const history=[...previous.history];
  await appendMarketExecutions(history,lineage,identity,rpc);
  const marketPair=recovered.pair;
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
  if(curve.base!==BigInt(previous.curve.base)||curve.step!==BigInt(previous.curve.step)||supply!==BigInt(previous.curve.supply)||custodyData.length!==98||inventory+custody>supply||!/^0x[0-9a-f]{64}$/i.test(root))throw Error('Gate 2 successor supply and custody totals do not reconcile');
  const tip=await rpc('get_tip_header',[]) as {number:string;hash:string};
  if(!tip?.number||!tip.hash)throw Error('Pudge chain tip unavailable during successor recovery');
  const [stable,anchor]=await rpcBatch([
    ['get_block_hash',[tip.number]],
    ['get_block_hash',[previous.tip.number]],
  ]);
  if(stable!==tip.hash||anchor!==previous.tip.hash)throw Error('Pudge chain changed during successor recovery');
  const data:MarketData={...previous,supply:supply.toString(),inventory:inventory.toString(),circulating:(supply-inventory).toString(),custody:custody.toString(),custodyRoot:root,...marketLiquidity(current.outputs[marketIndex].capacity,previous.marketCapacityFloorShannons),buyOneShannons:quote(curve,'buy',1n).toString(),sellOneShannons:quote(curve,'sell',1n).toString(),curve:{base:curve.base.toString(),step:curve.step.toString(),supply:supply.toString(),sold:(supply-inventory).toString()},tip:{number:tip.number,hash:tip.hash},refreshedAt:Date.now(),history,historyState:'verified'};
  await checkpoint(data,points,cells.map(cell=>({output:cell.output,data:cell.data.content})),saved.deps,saved.hashes,saved.manifestRaw);
  return data;
}

async function currentCustodyPair(start:[Point,Point],client:Rpc):Promise<[Point,Point]>{
  const live=await Promise.all(start.map(point=>client('get_live_cell',[point,true])));
  if(live.every(cell=>cell?.status==='live'))return start;
  return (await recoverMarketSuccessors(client,start,{maxIndexedDepth:256})).pair;
}

async function rpcBatch(calls:[string,unknown[]][]):Promise<any[]>{
  const response=await fetch(marketNetwork().endpoint,{
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
    const response=await fetch(marketNetwork().endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store',signal:controller.signal});
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

async function resolveCustodyPredecessor(marketPrevious:Transaction,next:Transaction,client:Rpc){
  const point=next.inputs[2]?.previous_output;
  if(!point)throw Error('Gate 2 trade is missing its custody input');
  if(point.tx_hash.toLowerCase()===marketPrevious.hash.toLowerCase())return marketPrevious;
  return (await canonical(point.tx_hash,undefined,client)).transaction;
}

type ResolvedInput={output:Output;data:string};

export function verifyBatchBuy(previous:Transaction,custodyPrevious:Transaction,next:Transaction,identity:ReturnType<typeof deriveMarketIdentity>,funding:ResolvedInput[]){
  const count=next.inputs.length,buyers=count-4;
  if(buyers<2||buyers>16||next.outputs.length!==count||next.outputs_data.length!==count||funding.length!==buyers)throw Error('Invalid batch Buy layout');
  const witness=next.witnesses[count]||'',metadata=next.witnesses[count+1]||'';
  if(!/^0x544d53310102(?:[0-9a-f]{2})+$/i.test(witness)||readLE('0x'+witness.slice(14,18))!==BigInt(buyers))throw Error('Invalid batch Buy witness');
  const proofBytes=Number(readLE('0x'+witness.slice(18,26)));
  if(!proofBytes||witness.length!==2+2*(12+96*buyers+proofBytes))throw Error('Invalid batch Buy proof length');
  if(!new RegExp('^0x[0-9a-f]{'+48*buyers+'}$','i').test(metadata))throw Error('Invalid batch Buy metadata');
  const updates=new Map<string,{oldBalance:bigint;newBalance:bigint;oldRevision:bigint;newRevision:bigint}>();
  for(let index=0;index<buyers;index++){
    const entry=witness.slice(26+192*index,26+192*(index+1));
    const owner='0x'+entry.slice(0,64).toLowerCase();
    if(updates.has(owner))throw Error('Duplicate batch Buy witness owner');
    const field=(offset:number)=>readLE('0x'+entry.slice(offset,offset+16));
    updates.set(owner,{oldBalance:field(64),newBalance:field(128),oldRevision:field(80),newRevision:field(144)});
  }
  const locks=[identity.market,identity.market,identity.custody,identity.custody];
  const types=[identity.token,identity.marker,identity.token,identity.custodyMarker];
  const oldCells=next.inputs.slice(0,4).map(({previous_output:point},index)=>{
    const tx=index<2?previous:custodyPrevious;
    if(point.tx_hash.toLowerCase()!==tx.hash.toLowerCase()||(index<2&&!samePoint(point,expectedPoint(previous.hash,index))))throw Error('Batch Buy predecessor mismatch');
    const slot=Number(BigInt(point.index)),output=tx.outputs[slot],data=tx.outputs_data[slot];
    if(!output)throw Error('Batch Buy predecessor output missing');
    verifyOutput(output,data,locks[index],types[index]);
    verifyOutput(next.outputs[index],next.outputs_data[index],locks[index],types[index]);
    if(index>0&&BigInt(output.capacity)!==BigInt(next.outputs[index].capacity))throw Error('Batch Buy preserved capacity mismatch');
    return {output,data};
  });
  for(const [slot,data] of [[1,identity.markerData],[3,identity.custodyMarkerData]] as const){
    if(oldCells[slot].data.toLowerCase()!==data.toLowerCase()||next.outputs_data[slot].toLowerCase()!==data.toLowerCase())throw Error('Batch Buy marker data mismatch');
  }
  const curve=decodeCurve(oldCells[0].output.lock.args,oldCells[0].data);
  const successor=decodeCurve(next.outputs[0].lock.args,next.outputs_data[0]);
  const markerHash=identity.custodyMarker.hash().slice(2);
  if([oldCells[0].data,next.outputs_data[0]].some(data=>data.slice(34).toLowerCase()!==markerHash))throw Error('Batch Buy custody binding mismatch');
  if([oldCells[2].data,next.outputs_data[2]].some(data=>!/^0x[0-9a-f]{16}0{16}[0-9a-f]{64}$/i.test(data)))throw Error('Invalid batch Buy custody data');
  let allocated=0n,cost=0n,fees=0n;
  const executions=funding.map(({output,data},index)=>{
    const lock=output.lock,buyer=next.outputs[index+4],owner=scriptHash(lock),update=updates.get(owner);
    if(lock.code_hash.toLowerCase()!=='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'||lock.hash_type!=='type'||!/^0x[0-9a-f]{40}$/i.test(lock.args)||!sameScript(lock,buyer.lock)||output.type||buyer.type||data!=='0x'||next.outputs_data[index+4]!=='0x')throw Error('Batch Buy funding identity mismatch');
    const field=(offset:number)=>readLE('0x'+metadata.slice(2+48*index+offset,18+48*index+offset));
    const quantity=field(0),maximum=field(16),fee=field(32);
    if(!update||quantity<=0n||update.newBalance-update.oldBalance!==quantity||update.newRevision!==update.oldRevision+1n)throw Error('Batch Buy owner or entitlement mismatch');
    updates.delete(owner);
    const amount=quote({...curve,inventory:curve.inventory-allocated},'buy',quantity);
    if(amount>maximum||BigInt(buyer.capacity)+amount+fee!==BigInt(output.capacity))throw Error('Batch Buy buyer price or capacity mismatch');
    allocated+=quantity;
    cost+=amount;
    fees+=fee;
    return {side:'buy' as const,owner,quantity,amount,executionIndex:index};
  });
  const custodyAmount=(data:string)=>readLE(data.slice(0,34));
  if(allocated!==curve.inventory-successor.inventory||custodyAmount(oldCells[2].data)+allocated!==custodyAmount(next.outputs_data[2])||BigInt(oldCells[0].output.capacity)+cost!==BigInt(next.outputs[0].capacity))throw Error('Batch Buy inventory, custody or reserve mismatch');
  if(fees>1_000_000n||sum([...oldCells,...funding].map(cell=>BigInt(cell.output.capacity)))-sum(next.outputs.map(cell=>BigInt(cell.capacity)))!==fees)throw Error('Batch Buy aggregate fee mismatch');
  return executions;
}

async function replayTrade(previous:Transaction,next:Transaction,identity:ReturnType<typeof deriveMarketIdentity>,client:Rpc){
  const resolve=async ({previous_output:point}:Transaction['inputs'][number])=>{
    const {transaction}=await canonical(point.tx_hash,undefined,client);
    const index=Number(BigInt(point.index));
    if(!transaction.outputs[index])throw Error('Trade funding input is missing');
    return {output:transaction.outputs[index],data:transaction.outputs_data[index]};
  };
  if(next.inputs.length===4&&next.outputs.length===4){
    const [token,funding]=await Promise.all(next.inputs.slice(2).map(resolve));
    return [{side:'sell' as const,...verifyExternalSell(previous,next,identity,token,funding)}];
  }
  if(next.inputs.length>=6&&next.inputs.length<=20){
    const [custody,funding]=await Promise.all([
      resolveCustodyPredecessor(previous,next,client),
      Promise.all(next.inputs.slice(4).map(resolve)),
    ]);
    return verifyBatchBuy(previous,custody,next,identity,funding);
  }
  const proof=parseTransition(next.witnesses[5]||'');
  const side:'buy'|'sell'|null=proof.operation===1?'buy':proof.operation===4?'sell':null;
  if(!side)throw Error('Unrecognized Gate 2 market successor operation');
  return [{side,...transitionAmount(previous,await resolveCustodyPredecessor(previous,next,client),next,identity,side,proof.operation)}];
}

export function verifyExternalSell(previous:Transaction,next:Transaction,identity:ReturnType<typeof deriveMarketIdentity>,token:{output:Output;data:string},funding:{output:Output;data:string}){
  if(next.inputs.length!==4||next.outputs.length!==4||next.outputs_data.length!==4)throw Error('Invalid external Sell layout');
  const [inventory,marker,remaining,payout]=next.outputs;
  const [inventoryData,markerData,remainingData,payoutData]=next.outputs_data;
  for(const index of [0,1]){
    if(!samePoint(next.inputs[index].previous_output,expectedPoint(previous.hash,index)))throw Error('External Sell market predecessor mismatch');
  }
  verifyOutput(previous.outputs[0],previous.outputs_data[0],identity.market,identity.token);
  verifyOutput(previous.outputs[1],previous.outputs_data[1],identity.market,identity.marker);
  verifyOutput(inventory,inventoryData,identity.market,identity.token);
  verifyOutput(marker,markerData,identity.market,identity.marker);
  if(markerData.toLowerCase()!==identity.markerData.toLowerCase()||previous.outputs_data[1].toLowerCase()!==markerData.toLowerCase())throw Error('External Sell marker data mismatch');
  const seller=token.output.lock;
  if(seller.code_hash.toLowerCase()!=='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'||seller.hash_type!=='type'||!/^0x[0-9a-f]{40}$/i.test(seller.args))throw Error('External Sell seller must use the standard lock');
  if(![funding.output.lock,remaining.lock,payout.lock].every(lock=>sameScript(lock,seller))||funding.output.type||payout.type||funding.data!=='0x'||payoutData!=='0x')throw Error('External Sell seller or funding identity mismatch');
  if(scriptHash(token.output.type)!==identity.token.hash()||scriptHash(remaining.type)!==identity.token.hash())throw Error('External Sell token identity mismatch');
  const curve=decodeCurve(previous.outputs[0].lock.args,previous.outputs_data[0]);
  const successor=decodeCurve(inventory.lock.args,inventoryData);
  const quantity=successor.inventory-curve.inventory;
  const tokenAmount=(data:string)=>{
    if(!/^0x[0-9a-f]{16}0{16}$/i.test(data))throw Error('External Sell token amount encoding is invalid');
    return readLE(data);
  };
  if(quantity<=0n||tokenAmount(token.data)-tokenAmount(remainingData)!==quantity||inventoryData.slice(34).toLowerCase()!==previous.outputs_data[0].slice(34).toLowerCase())throw Error('External Sell quantity or inventory identity mismatch');
  const witness=next.witnesses[4]||'';
  if(!/^0x[0-9a-f]{32}$/i.test(witness)||readLE(witness.slice(0,18))!==quantity)throw Error('External Sell witness quantity or encoding mismatch');
  const amount=quote(curve,'sell',quantity);
  if(amount<readLE('0x'+witness.slice(18)))throw Error('External Sell minimum proceeds exceeded');
  const inputCapacities=[previous.outputs[0],previous.outputs[1],token.output,funding.output].map(output=>BigInt(output.capacity));
  const outputCapacities=next.outputs.map(output=>BigInt(output.capacity));
  if(inputCapacities[0]-outputCapacities[0]!==amount||inputCapacities[1]!==outputCapacities[1]||inputCapacities[2]!==outputCapacities[2])throw Error('External Sell reserve or preserved capacity mismatch');
  const fee=sum(inputCapacities)-sum(outputCapacities);
  if(fee<0n||fee>1_000_000n||BigInt(payout.capacity)+fee!==inputCapacities[3]+amount)throw Error('External Sell payout or fee mismatch');
  return {quantity,amount,owner:scriptHash(seller)};
}

function transitionAmount(previous:Transaction,custodyPrevious:Transaction,next:Transaction,identity:ReturnType<typeof deriveMarketIdentity>,side:'buy'|'sell',expectedOperation:number){
  if(previous.outputs.length<4||next.inputs.length!==5||next.outputs.length!==5||next.outputs_data.length!==5||next.witnesses.length<6)throw Error('Gate 2 trade shape is invalid');
  for(let index=0;index<2;index++){
    if(!samePoint(next.inputs[index].previous_output,expectedPoint(previous.hash,index)))throw Error('Gate 2 market lineage is discontinuous');
  }
  const custodyPoints=next.inputs.slice(2,4).map(input=>input.previous_output);
  const custodySlots=custodyPoints.map(point=>Number(BigInt(point.index)));
  if(custodySlots[0]===custodySlots[1])throw Error('Gate 2 custody inputs overlap');
  for(const point of custodyPoints){
    if(point.tx_hash.toLowerCase()!==custodyPrevious.hash.toLowerCase())throw Error('Gate 2 custody lineage is discontinuous');
  }
  const [custodySlot,markerSlot]=custodySlots;
  verifyOutput(custodyPrevious.outputs[custodySlot],custodyPrevious.outputs_data[custodySlot],identity.custody,identity.token);
  verifyOutput(custodyPrevious.outputs[markerSlot],custodyPrevious.outputs_data[markerSlot],identity.custody,identity.custodyMarker);
  if(custodyPrevious.outputs_data[custodySlot].length!==98||custodyPrevious.outputs_data[markerSlot].toLowerCase()!==identity.custodyMarkerData.toLowerCase())throw Error('Gate 2 predecessor custody data mismatch');
  verifyOutput(next.outputs[0],next.outputs_data[0],identity.market,identity.token);
  verifyOutput(next.outputs[1],next.outputs_data[1],identity.market,identity.marker);
  verifyOutput(next.outputs[2],next.outputs_data[2],identity.custody,identity.token);
  verifyOutput(next.outputs[3],next.outputs_data[3],identity.custody,identity.custodyMarker);
  if(next.outputs_data[1].toLowerCase()!==identity.markerData.toLowerCase()||next.outputs_data[3].toLowerCase()!==identity.custodyMarkerData.toLowerCase()||next.outputs[4].type||next.outputs_data[4].toLowerCase()!=='0x')throw Error('Gate 2 trade marker or wallet output changed');
  const proof=parseTransition(next.witnesses[5]);
  if(proof.operation!==expectedOperation||!/^0x[0-9a-f]{64}$/i.test(proof.owner)||scriptHash(next.outputs[4].lock)!==proof.owner.toLowerCase())throw Error('Gate 2 trade owner or operation mismatch');
  const quantity=side==='buy'?proof.newBalance-proof.oldBalance:proof.oldBalance-proof.newBalance;
  if(quantity<=0n)throw Error('Gate 2 transition quantity is invalid');
  const oldMarket=previous.outputs[0];
  const curve=decodeCurve(oldMarket.lock.args,previous.outputs_data[0]);
  const amount=quote(curve,side,quantity);
  const expectedInventory=curve.inventory+(side==='buy'?-quantity:quantity);
  const oldCustodyAmount=readLE(`0x${custodyPrevious.outputs_data[custodySlot].slice(2,34)}`),expectedCustody=oldCustodyAmount+(side==='buy'?quantity:-quantity);
  if(expectedCustody<0n||BigInt(next.outputs[0].capacity)!==BigInt(oldMarket.capacity)+(side==='buy'?amount:-amount)||readLE(`0x${next.outputs_data[0].slice(2,34)}`)!==expectedInventory||next.outputs_data[0].slice(34).toLowerCase()!==previous.outputs_data[0].slice(34).toLowerCase()||readLE(`0x${next.outputs_data[2].slice(2,34)}`)!==expectedCustody||next.outputs_data[2].length!==98)throw Error('Gate 2 curve or custody accounting differs from its witness');
  const preservedCapacities=[previous.outputs[1],custodyPrevious.outputs[custodySlot],custodyPrevious.outputs[markerSlot]];
  if(preservedCapacities.some((output,index)=>BigInt(output.capacity)!==BigInt(next.outputs[index+1].capacity)))throw Error('Gate 2 marker or custody capacity changed');
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
  const bought=transitionAmount(initialization,initialization,buy,identity,'buy',1);
  const sold=transitionAmount(buy,buy,sell,identity,'sell',4);
  if(readLE(`0x${sell.outputs_data[0].slice(2,34)}`)!==1993n)throw Error('Recorded Pudge Sell inventory differs from expected 1,993 xUDT');
  const custody=readLE(`0x${sell.outputs_data[2].slice(2,34)}`);
  if(custody!==7n)throw Error('Recorded Pudge Sell custody differs from expected 7 xUDT');
  return {initial,bought,sold,initialAmount};
}

async function verifyCodeCells(client:Rpc=rpc){
  const expected=[PUDGE_GATE2_CODES.custody,PUDGE_GATE2_CODES.market,PUDGE_GATE2_CODES.custodyMarker,PUDGE_GATE2_CODES.marker,PUDGE_GATE2_CODES.ownerLock,PUDGE_GATE2_CODES.xudt];
  const points=[...expected.slice(0,5).map((_,index)=>expectedPoint(PUDGE_GATE2_STAGE_TXS.code,index)),{tx_hash:PUDGE_GATE2_XUDT_DEP.outPoint.txHash,index:PUDGE_GATE2_XUDT_DEP.outPoint.index}];
  await Promise.all(points.map(async(point,index)=>{
    const result=await client('get_live_cell',[{tx_hash:point.tx_hash,index:'0x'+BigInt(point.index).toString(16)},true]) as {status?:string;cell?:{data?:{content?:string}}};
    if(result.status!=='live'||!result.cell?.data?.content||ccc.hashCkb(result.cell.data.content as ccc.Hex).toLowerCase()!==expected[index].toLowerCase())throw Error(`Gate 2 code dependency is unavailable: ${expected[index]}`);
  }));
}

// The caller authenticates the lineage and its starting boundary.
export async function appendMarketExecutions(history:TradeEvent[],lineage:readonly import('./v2-engine/lineage.ts').MarketHistoryTransaction[],identity:ReturnType<typeof deriveMarketIdentity>,client:Rpc){
  for(let index=1;index<lineage.length;index++){
    const previous=lineage[index-1].transaction;
    const {transaction,blockNumber,timestampMs}=lineage[index];
    const executions=await replayTrade(previous,transaction,identity,client);
    history.push(...executions.map((execution,executionIndex)=>({
      ...event(transaction.hash,execution.side,execution.owner,execution.quantity,execution.amount,BigInt(blockNumber),BigInt(timestampMs)),
      ...(executions.length>1?{executionIndex}:{}),
    })));
  }
}

function event(hash:string,side:'buy'|'sell',owner:string,quantity:bigint,amount:bigint,blockNumber:bigint,timestampMs:bigint):TradeEvent{
  return {hash,side,owner,quantity:quantity.toString(),amountShannons:amount.toString(),blockNumber:blockNumber.toString(),timestampMs:timestampMs.toString(),status:'confirmed'};
}

function marketLiquidity(cellCapacity:string,floorCapacity:string){
  // The confirmed issuance output establishes structural capacity; later capacity is curve liquidity.
  return deriveMarketLiquidity(cellCapacity,floorCapacity);
}

async function verifyPudgeInitialProof(anchor:{txHash:string;index:string},owner:string){
  return generatePudgeLaunchProof(anchor,owner);
}

async function getMarketDataFromManifest(rawManifest:string):Promise<MarketData>{
  let possibleId='';try{possibleId=ccc.Script.from(JSON.parse(rawManifest)?.scripts?.market).hash().toLowerCase();}catch{}
  if(possibleId){const cached=await cachedMarket(possibleId,rawManifest);if(cached)return cached;}
  const client=requestRpc(),manifest=await loadPudgeManifest(client,rawManifest,verifyPudgeInitialProof);
  return recoverVerifiedMarket(client,manifest,rawManifest);
}

export type RecoveryManifest=Pick<Awaited<ReturnType<typeof loadPudgeManifest>>,'genesis'|'scripts'|'initial'|'deps'> & {
  initializationTransactionHash:string;
  atomic?:boolean;
  format:string;
  journal:{owner:string;entries:{stage:string;txHash:string;state:string;blockHash?:string}[]};
  verifiedMarket?:VerifiedMarketRecord;
  secpDependency?:ccc.CellDepLike;
};

async function recoverVerifiedMarket(client:Rpc,manifest:RecoveryManifest,rawManifest?:string,display?:MarketData['token']):Promise<MarketData>{
  const identity=manifest.scripts;
  if(manifest.genesis.toLowerCase()!==marketNetwork().genesis)throw Error('Pudge network identity mismatch');
  const tip=await client('get_tip_header',[]) as {number:string;hash:string};
  const codeCells=[
    manifest.deps.custody_smt,manifest.deps.market_smt,manifest.deps.custody_marker,
    manifest.deps.marker_candidate,manifest.deps.owner_lineage_candidate,manifest.deps.xudt,
  ];
  const codeHashes=[identity.custody.codeHash,identity.market.codeHash,identity.custodyMarker.codeHash,identity.marker.codeHash,identity.owner.codeHash,identity.token.codeHash];
  await Promise.all(codeCells.map(async(dependency,index)=>{
    const point=ccc.OutPoint.from(dependency.outPoint),result=await client('get_live_cell',[{tx_hash:point.txHash,index:'0x'+BigInt(point.index).toString(16)},true]) as {status?:string;cell?:{data?:{content?:string}}};
    if(result.status!=='live'||!result.cell?.data?.content||ccc.hashCkb(result.cell.data.content as ccc.Hex).toLowerCase()!==codeHashes[index].toLowerCase())throw Error('Gate 2 launch dependency is unavailable');
  }));
  const initialPoints=manifest.initial as [Point,Point,Point,Point];
  const issuance=manifest.journal.entries.filter(entry=>entry.stage==='issuance');
  if(!manifest.atomic&&(issuance.length!==1||issuance[0].state!=='confirmed'))throw Error('Missing unique confirmed issuance');
  const [initialized,issued]=await Promise.all([
    canonical(manifest.initializationTransactionHash,undefined,client),
    manifest.atomic?Promise.resolve(null):canonical(issuance[0].txHash,issuance[0].blockHash,client),
  ]);
  if(issued)verifyOutput(issued.transaction.outputs[0],issued.transaction.outputs_data[0],identity.market,identity.token);
  const recovered=await recoverMarketHistory(client,[initialPoints[0],initialPoints[1]],{maxIndexedDepth:256});
  if(recovered.lineage[0]?.transaction.hash.toLowerCase()!==manifest.initializationTransactionHash.toLowerCase())throw Error('Market history does not begin at the registered launch');
  const current=await canonical(recovered.pair[0].tx_hash,undefined,client);
  const custodyPair=await currentCustodyPair([initialPoints[2],initialPoints[3]],client);
  const custodyTransaction=(await canonical(custodyPair[0].tx_hash,undefined,client)).transaction;
  const [marketCell,markerCell,custodyCell,custodyMarkerCell]=await Promise.all([...recovered.pair,...custodyPair].map(point=>client('get_live_cell',[{tx_hash:point.tx_hash,index:point.index},true]) as Promise<{status?:string;cell?:{output:Output;data:{content:string}}}>));
  const cells=[marketCell,markerCell,custodyCell,custodyMarkerCell];
  if(cells.some(cell=>cell.status!=='live'||!cell.cell))throw Error('Gate 2 market singleton is not live');
  for(const [index,point] of [...recovered.pair,...custodyPair].entries()){
    const tx=index<2?current.transaction:custodyTransaction;
    const slot=Number(BigInt(point.index));
    if(point.tx_hash.toLowerCase()!==tx.hash.toLowerCase()||!matchesLiveCell(cells[index],{output:tx.outputs[slot],data:tx.outputs_data[slot]}))throw Error('Gate 2 live output differs from canonical transaction');
  }
  verifyOutput(cells[0].cell!.output,cells[0].cell!.data.content,identity.market,identity.token);
  verifyOutput(cells[1].cell!.output,cells[1].cell!.data.content,identity.market,identity.marker);
  verifyOutput(cells[2].cell!.output,cells[2].cell!.data.content,identity.custody,identity.token);
  verifyOutput(cells[3].cell!.output,cells[3].cell!.data.content,identity.custody,identity.custodyMarker);
  if(cells[1].cell!.data.content.toLowerCase()!==identity.markerData.toLowerCase()||cells[3].cell!.data.content.toLowerCase()!==identity.custodyMarkerData.toLowerCase())throw Error('Gate 2 marker data identity mismatch');
  const stable=await client('get_block_hash',[tip.number]);if(typeof stable!=='string'||stable.toLowerCase()!==tip.hash.toLowerCase())throw Error('Pudge chain changed during market recovery');
  const marketIndex=Number(BigInt(recovered.pair[0].index)),custodyIndex=Number(BigInt(custodyPair[0].index));
  const marketData=current.transaction.outputs_data[marketIndex],custodyData=custodyTransaction.outputs_data[custodyIndex];
  if(marketData.slice(34).toLowerCase()!==identity.custodyMarker.hash().slice(2).toLowerCase())throw Error('Gate 2 market inventory marker mismatch');
  const curve=decodeCurve(current.transaction.outputs[marketIndex].lock.args,marketData),supply=curve.supply,inventory=curve.inventory,custody=readLE(`0x${custodyData.slice(2,34)}`),root=`0x${custodyData.slice(34)}`;
  if(inventory+custody>supply||!/^0x[0-9a-f]{64}$/i.test(root))throw Error('Gate 2 supply and custody totals do not reconcile');
  let historyState:MarketData['historyState']='verified',history:TradeEvent[]=[];
  try{
    const purchase=initialized.transaction,initial=parseTransition(purchase.witnesses[manifest.atomic?purchase.inputs.length:3]||''),initialQuantity=initial.newBalance-initial.oldBalance;
    const issuedData=issued?.transaction.outputs_data[0],initialCurve=issued?decodeCurve(issued.transaction.outputs[0].lock.args,`0x${issuedData!.slice(2)}${identity.custodyMarker.hash().slice(2)}`):{...decodeCurve(purchase.outputs[0].lock.args,purchase.outputs_data[0]),inventory:supply};
    if(initial.operation!==0||initial.oldBalance!==0n||initialQuantity<=0n||initial.owner.toLowerCase()!==manifest.journal.owner.toLowerCase())throw Error('Launch purchase terms differ from the verified owner');
    const initialAmount=quote(initialCurve,'buy',initialQuantity);
    history=[event(purchase.hash,'buy',initial.owner,initialQuantity,initialAmount,initialized.blockNumber,initialized.timestampMs)];
    await appendMarketExecutions(history,recovered.lineage,identity,client);
    if(recovered.lineage.at(-1)?.transaction.hash.toLowerCase()!==current.transaction.hash.toLowerCase())throw Error('Current market is not the end of the verified history');
  }catch(error){console.warn('Gate 2 market history replay failed',error);historyState='unavailable';}
  const liquidity=marketLiquidity(current.transaction.outputs[marketIndex].capacity,issued?issued.transaction.outputs[0].capacity:'30000000000');
  const token=display||resolvePudgeTokenMetadata({genesis:manifest.genesis,marketScriptHash:identity.market.hash(),tokenTypeHash:identity.token.hash(),initializationTransactionHash:manifest.initializationTransactionHash});
  const stages={} as VerifiedMarketRecord['stages'];
  for(const name of (manifest.atomic?['purchase']:['setup','issuance','purchase']) as ('setup'|'issuance'|'purchase')[]){
    const entries=manifest.journal.entries.filter(entry=>entry.stage===(manifest.atomic?'atomic':name));
    if(entries.length!==1||entries[0].state!=='confirmed'||!entries[0].blockHash)throw Error('Missing canonical market stage');
    stages[name]={txHash:entries[0].txHash,blockHash:entries[0].blockHash};
  }
  const secp=manifest.secpDependency||{outPoint:{txHash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:'0x0'},depType:'depGroup' as const};
  manifest={...manifest,verifiedMarket:{family:manifest.atomic?'atomic':undefined,genesis:manifest.genesis,marketScriptHash:identity.market.hash(),routeId:identity.market.hash().toLowerCase(),creatorLockHash:manifest.journal.owner,tokenTypeHash:identity.token.hash(),scripts:identity,dependencies:[...codeCells,secp],stages,initial:initialPoints,issuanceCapacityFloor:issued?BigInt(issued.transaction.outputs[0].capacity).toString():'30000000000',metadata:{...token,typeHash:identity.token.hash()}}};
  const data:MarketData={
    id:identity.market.hash().toLowerCase(),identity:identity.market.hash(),genesis:manifest.genesis,
    token:{...token,typeHash:identity.token.hash()},pair:`${token.symbol} / CKB`,supply:supply.toString(),inventory:inventory.toString(),circulating:(supply-inventory).toString(),custody:custody.toString(),custodyRoot:root,
    ...liquidity,
    buyOneShannons:quote(curve,'buy',1n).toString(),sellOneShannons:quote(curve,'sell',1n).toString(),curve:{base:curve.base.toString(),step:curve.step.toString(),supply:supply.toString(),sold:(supply-inventory).toString()},tip:{number:tip.number,hash:tip.hash},refreshedAt:Date.now(),history,historyState,manifest,
  };
  if(historyState==='verified')await checkpoint(data,[...recovered.pair,...custodyPair],cells.map(cell=>({output:cell.cell!.output,data:cell.cell!.data.content})),codeCells,codeHashes,rawManifest||JSON.stringify(manifest));
  return data;
}

const publishedRefreshes=new Map<string,Promise<MarketData>>();
export function getPublishedPudgeMarketData(id:string):Promise<MarketData>{
  if(!/^0x[0-9a-f]{64}$/.test(id))return Promise.reject(Error('Invalid market identity'));
  const pending=publishedRefreshes.get(id);if(pending)return pending;
  if(publishedRefreshes.size>=4)return Promise.reject(Error('Market recovery busy'));
  const refresh=refreshPublishedPudgeMarketData(id).finally(()=>publishedRefreshes.delete(id));
  publishedRefreshes.set(id,refresh);return refresh;
}

async function refreshPublishedPudgeMarketData(id:string):Promise<MarketData>{
  const catalog=await getCatalogMarket(id,true),record=catalog?.execution;
  if(!catalog||!record||record.marketScriptHash!==id||record.scripts.market.hash()!==id)throw Error('Verified published market not found');
  const pinned=record.codeDependencies;
  const dep=(name:keyof typeof pinned)=>({outPoint:{txHash:pinned[name].outPoint.txHash,index:ccc.numToHex(pinned[name].outPoint.index)},depType:'code' as const});
  const manifest:RecoveryManifest={
    atomic:'family' in record&&record.family==='atomic',format:'brant-shared-pudge-market-v1',genesis:record.genesis,scripts:record.scripts,
    initial:record.initial as RecoveryManifest['initial'],initializationTransactionHash:record.stages.purchase.txHash,
    journal:{owner:record.creatorLockHash,entries:catalog.receipts},
    secpDependency:{outPoint:pinned.secp.outPoint,depType:'depGroup'},
    deps:{custody_smt:dep('custody'),market_smt:dep('market'),custody_marker:dep('custodyMarker'),marker_candidate:dep('marker'),owner_lineage_candidate:dep('ownerLock'),xudt:dep('xudt')},
  };
  const provenance=JSON.stringify({manifest,metadata:record.metadata});
  const cached=await cachedMarket(id,provenance);if(cached)return cached;
  return recoverVerifiedMarket(requestRpc(),manifest,provenance,{
    name:record.metadata.name,symbol:record.metadata.ticker,description:record.metadata.description,
    ...(catalog.logo?{logo:catalog.logo}:{}),
    metadata:'Authenticated creator metadata',typeHash:record.tokenTypeHash,
  });
}

export async function getPudgeMarketDataForManifest(rawManifest:string){
  return getMarketDataFromManifest(rawManifest);
}

export function getPudgeMarketData():Promise<MarketData>{
  registeredRefresh??=refreshRegisteredMarket().then(data=>{
    const scripts=gate2Identity();
    if(data.identity!==scripts.market.hash()||data.token.typeHash!==scripts.token.hash())throw Error('Registered market identity mismatch');
    data.manifest.scripts=scripts;
    const stages={} as VerifiedMarketRecord['stages'];
    for(const name of ['setup','issuance','purchase'] as const){
      const entries=PUDGE_GATE2_JOURNAL.entries.filter(entry=>entry.stage===name);
      if(entries.length!==1||entries[0].state!=='confirmed'||!entries[0].blockHash)throw Error('Registered market stage identity missing');
      stages[name]={txHash:entries[0].txHash,blockHash:entries[0].blockHash};
    }
    const record:VerifiedMarketRecord={genesis:data.genesis,marketScriptHash:data.identity,routeId:data.id,creatorLockHash:PUDGE_GATE2_OWNER,tokenTypeHash:data.token.typeHash,scripts,dependencies:[...Object.values(data.manifest.deps) as ccc.CellDepLike[],{outPoint:{txHash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:'0x0'},depType:'depGroup'}],stages,initial:data.manifest.initial,issuanceCapacityFloor:data.marketCapacityFloorShannons,metadata:data.token};
    data.manifest.verifiedMarket=record;
    return data;
  }).finally(()=>{registeredRefresh=undefined;});
  return registeredRefresh;
}

export function getPublishedDisplaySnapshot(id:string){
  const saved=checkpoints.get(id);
  if(!saved||orphanedCheckpoints.has(saved)||!saved.manifestRaw||Date.now()-saved.data.refreshedAt>30_000)return null;
  return saved.data;
}

export async function getPudgeDisplaySnapshot(){
  const saved=checkpoints.get(PUDGE_GATE2_REGISTRY_ID)||await readMarketCheckpoint();
  if(!saved||!verifiedCheckpoints.has(saved)||orphanedCheckpoints.has(saved))return null;
  return {...saved.data,historyState:'unavailable' as const};
}

export async function getPudgeCustodyAnchor(id=PUDGE_GATE2_REGISTRY_ID){
  const market=await (id===PUDGE_GATE2_REGISTRY_ID?getPudgeMarketData():getPublishedPudgeMarketData(id));
  const saved=checkpoints.get(id);
  if(market.historyState!=='verified'||!saved||saved.data.custodyRoot!==market.custodyRoot)throw Error('Pudge market recovery changed');
  return {market,points:saved.points,cells:saved.cells,point:saved.points[2],data:saved.cells[2].data,inventory:market.inventory,custody:market.custody,supply:market.supply};
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
  if(genesis.toLowerCase()!==marketNetwork().genesis||!tip?.number||!tip.hash)throw Error('Pudge network identity mismatch');
  const verified=verifyStageLineage(setup.transaction,issuance.transaction,initialization.transaction,buy.transaction,sell.transaction,identity);
  const initPair=[expectedPoint(initialization.transaction.hash,0),expectedPoint(initialization.transaction.hash,1)] as [Point,Point];
  const registeredSellPoints=[expectedPoint(sell.transaction.hash,0),expectedPoint(sell.transaction.hash,1)] as [Point,Point];
  const registeredLive=await Promise.all([0,1,2,3].map(index=>client('get_live_cell',[{tx_hash:sell.transaction.hash,index:`0x${index.toString(16)}`},true]) as Promise<{status?:string}>));
  let recovered:Awaited<ReturnType<typeof recoverMarketHistory>>|null=null,marketPair:[Point,Point];
  if(registeredLive.every(cell=>cell.status==='live'))marketPair=registeredSellPoints;
  else{
    try{
      recovered=await recoverMarketHistory(client,initPair,{maxIndexedDepth:256});
    }catch(error){
      logRegisteredRecoveryFailure('lineage',error);
    }
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
      await appendMarketExecutions(history,lineage,identity,client);
      historyState='verified';
    }catch(error){
      logRegisteredRecoveryFailure('financial-replay',error);
      history=[];
    }
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
  if(historyState==='verified')await checkpoint(data,[...marketPair,...custodyPair],cells.map(cell=>({output:cell.cell!.output,data:cell.cell!.data.content})),codeDeps,[PUDGE_GATE2_CODES.custody,PUDGE_GATE2_CODES.market,PUDGE_GATE2_CODES.custodyMarker,PUDGE_GATE2_CODES.marker,PUDGE_GATE2_CODES.ownerLock,PUDGE_GATE2_CODES.xudt]);
  return data;
}

function logRegisteredRecoveryFailure(stage:'lineage'|'financial-replay',error:unknown){
  const message=error instanceof Error?error.message:'Unknown recovery error';
  const reason=message.replace(/[^\s]*:\/\/[^\s]+/g,'[url]').replace(/0x[\da-f]{65,}/gi,'[hex]').replace(/[\r\n\t]/g,' ').slice(0,240);
  console.warn('Pudge registered market recovery failed',JSON.stringify({stage,reason}));
}

import {marketNetwork} from '../../../../lib/v2-engine/market-network-server.ts';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {access,mkdir,mkdtemp,readdir,readFile,rename,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {isIP} from 'node:net';
import path from 'node:path';
import {promisify} from 'node:util';
import {ccc} from '@ckb-ccc/core';
import {loadPudgeManifest} from '../../../../lib/v2-engine/pudge-manifest.ts';
import {getPudgeCustodyAnchor,getPudgeMarketData,getPublishedPudgeMarketData,type RecoveryManifest} from '../../../../lib/pudge-market-service.ts';
import {after} from 'next/server.js';
import {openPudgeSnapshot,sealPudgeSnapshot} from '../../../../lib/pudge-snapshot.ts';
import {startPudgeProofWorker} from '../../../../lib/pudge-proof-worker.ts';
import {resolveGate2NativeTools} from '../../../../lib/v2-engine/native-tools.ts';
import {resolvePudgeTokenMetadata} from '../../../../lib/pudge-market-metadata.ts';
import {PUDGE_GATE2_GENESIS,PUDGE_GATE2_INITIALIZATION,PUDGE_GATE2_STAGE_TXS} from '../../../../lib/v2-engine/pudge-public-registry.ts';
import {generatePudgeLaunchProof} from '../../../../lib/v2-engine/pudge-launch-proof-server.ts';



const run=promisify(execFile);
const hash=/^0x[0-9a-f]{64}$/i;
const MAX_BODY_BYTES=65536;
const MAX_CACHE_BYTES=24*1024*1024;
const MAX_RECOVERY_MS=40000;
const MAX_RPC_CALLS=240;
const MAX_PARALLEL=2;
const RATE_WINDOW_MS=60_000;
const RATE_LIMIT=12;
const rates=new Map<string,{startedAt:number;count:number}>();
const memoryCheckpoints=new Map<string,{value:unknown;size:number}>();
let activeRequests=0;
let activeIncorporations=0;

type Script={code_hash:string;hash_type:string;args:string};
type RecoveryBundle={
  format:string;
  init_tx_hash:string;
  owner_lock_hash:string;
  custody_lock:Script;
  xudt_type_script:Script;
  collection:{canonical_block_checked?:boolean;live_outpoint_checked_with_get_live_cell?:boolean;end_tip?:{number?:string;hash?:string}};
  history:{tx_hash:string;transaction:{outputs:unknown[];outputs_data:string[]}}[];
  live:{tx_hash:string;index:string;capacity:string;data:string;output:{capacity:string;lock:Script;type?:Script|null}};
};
type VerifiedManifest=RecoveryManifest;
const verifiedManifests=new Map<string,{manifest:VerifiedManifest;verifiedAt:number}>();
type CustodyState={bundle:RecoveryBundle;snapshot:Record<string,unknown>};
const custodyStates=new Map<string,CustodyState>();
const custodyRefreshes=new Map<string,Promise<{state:CustodyState;live:Awaited<ReturnType<typeof getPudgeCustodyAnchor>>|null}>>();
type ProofWorker={state:CustodyState;native:ReturnType<typeof startPudgeProofWorker>;users:number;closing?:boolean;idle?:ReturnType<typeof setTimeout>};
const proofWorkers=new Map<CustodyState,ProofWorker>();

function rpcEndpoint(){
  if(process.env.BRANT_ISOLATED_CONFIG)return marketNetwork().endpoint;
  if(process.env.NODE_ENV!=='production'&&process.env.NEXT_PUBLIC_PUDGE_TEST_HOOK==='1'&&process.env.ROVEKO_PUDGE_TEST_RPC){
    const url=new URL(process.env.ROVEKO_PUDGE_TEST_RPC);
    if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password)throw Error('Test RPC must be local');
    return url.toString();
  }
  return 'https://testnet.ckb.dev/';
}

function toScript(script:ccc.Script):Script{return {code_hash:script.codeHash,hash_type:script.hashType,args:script.args};}
function sameScript(a:Script|undefined|null,b:Script|undefined|null){
  return !!a&&!!b&&a.code_hash.toLowerCase()===b.code_hash.toLowerCase()&&a.hash_type.toLowerCase()===b.hash_type.toLowerCase()&&a.args.toLowerCase()===b.args.toLowerCase();
}
function requestKey(manifest:{genesis:string;initializationTransactionHash:string;scripts:{market:ccc.Script}},endpoint:string){
  const identity=`${manifest.genesis.toLowerCase()}:${manifest.initializationTransactionHash.toLowerCase()}:${manifest.scripts.market.hash().toLowerCase()}:${endpoint}`;
  return createHash('sha256').update(identity).digest('hex');
}
function cacheFile(key:string){
  const configured=process.env.ROVEKO_PUDGE_PROOF_CACHE_DIR;
  return configured?path.join(path.resolve(configured),`${key}.json`):undefined;
}

async function readAuthenticated<T>(file:string|undefined,scope:string){
  try{
    if(!file)return null;
    const info=await stat(file);
    if(!info.isFile()||info.size>MAX_CACHE_BYTES)return null;
    return openPudgeSnapshot<T>(scope,await readFile(file,'utf8'));
  }catch{return null;}
}

async function writeAuthenticated(file:string|undefined,scope:string,value:unknown){
  if(!file)return;
  const content=sealPudgeSnapshot(scope,value);
  if(!content||Buffer.byteLength(content)>MAX_CACHE_BYTES)return;
  const temporary=`${file}.${randomUUID()}.tmp`;
  try{
    await mkdir(path.dirname(file),{recursive:true,mode:0o700});
    await writeFile(temporary,content,{flag:'wx',mode:0o600});
    await rename(temporary,file);
  }finally{await rm(temporary,{force:true}).catch(()=>{});}
}

function consumeRateLimit(request:Request,balanceOnly:boolean){
  // Railway's public edge supplies X-Real-IP. Direct requests share one bucket.
  const edgeIP=process.env.RAILWAY_PUBLIC_DOMAIN ? request.headers.get('x-real-ip')?.trim() : undefined;
  const address=edgeIP&&isIP(edgeIP) ? edgeIP : 'unknown';
  const now=Date.now(),key=(balanceOnly?"balance:":"proof:")+address,current=rates.get(key);
  if(!current&&rates.size>=2048){
    for(const [saved,value]of rates)if(now-value.startedAt>=RATE_WINDOW_MS)rates.delete(saved);
    if(rates.size>=2048)return false;
  }
  if(!current||now-current.startedAt>=RATE_WINDOW_MS){rates.set(key,{startedAt:now,count:1});}
  else if(current.count>=(balanceOnly?24:RATE_LIMIT))return false;
  else current.count++;
  if(rates.size>2048)for(const [key,value] of rates)if(now-value.startedAt>=RATE_WINDOW_MS)rates.delete(key);
  return true;
}

async function readBoundedBody(request:Request){
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new Error('Expected JSON');
  const length=request.headers.get('content-length');
  if(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX_BODY_BYTES))throw new Error('Request too large');
  if(!request.body)throw new Error('Missing request body');
  const reader=request.body.getReader(),decoder=new TextDecoder();
  let size=0,text='';
  while(true){
    const {done,value}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>MAX_BODY_BYTES){await reader.cancel();throw new Error('Request too large');}
    text+=decoder.decode(value,{stream:true});
  }
  return text+decoder.decode();
}

function validBundle(value:unknown,manifest:RecoveryManifest,owner:string):value is RecoveryBundle{
  const bundle=value as RecoveryBundle;
  return !!bundle&&bundle.format==='trade-v2-recovery-bundle-v1'&&bundle.init_tx_hash?.toLowerCase()===manifest.initializationTransactionHash.toLowerCase()&&bundle.owner_lock_hash?.toLowerCase()===owner.toLowerCase()&&sameScript(bundle.custody_lock,toScript(manifest.scripts.custody))&&sameScript(bundle.xudt_type_script,toScript(manifest.scripts.token))&&bundle.collection?.canonical_block_checked===true&&bundle.collection?.live_outpoint_checked_with_get_live_cell===true&&Array.isArray(bundle.history)&&bundle.history.length>0&&bundle.history.length<=512&&hash.test(bundle.live?.tx_hash||'')&&/^0x(?:[0-9a-f]{2})+$/i.test(bundle.live?.data||'')&&bundle.live.data.length===98&&bundle.live.index!==undefined&&bundle.live.output?.capacity!==undefined;
}

async function validateRegisteredManifest(manifest:VerifiedManifest,rpc:(method:string,params?:unknown[])=>Promise<any>){
  if(manifest.genesis.toLowerCase()!==PUDGE_GATE2_GENESIS||manifest.initializationTransactionHash.toLowerCase()!==PUDGE_GATE2_INITIALIZATION||manifest.deps.market_smt.outPoint.txHash.toLowerCase()!==PUDGE_GATE2_STAGE_TXS.code)throw Error('Market is not registered for proof requests');
  const dependencies=[manifest.deps.custody_smt,manifest.deps.market_smt,manifest.deps.custody_marker,manifest.deps.marker_candidate,manifest.deps.owner_lineage_candidate,manifest.deps.xudt];
  const hashes=[manifest.scripts.custody.codeHash,manifest.scripts.market.codeHash,manifest.scripts.custodyMarker.codeHash,manifest.scripts.marker.codeHash,manifest.scripts.owner.codeHash,manifest.scripts.token.codeHash];
  const canonicalTransaction=async(hashValue:string)=>{
    const row=await rpc('get_transaction',[hashValue]);
    if(row?.tx_status?.status!=='committed'||row.transaction?.hash?.toLowerCase()!==hashValue.toLowerCase()||!row.tx_status.block_number||!row.tx_status.block_hash)throw Error('Registered market transaction is unavailable');
    const blockHash=await rpc('get_block_hash',[row.tx_status.block_number]);
    if(typeof blockHash!=='string'||blockHash.toLowerCase()!==row.tx_status.block_hash.toLowerCase())throw Error('Registered market transaction is not canonical');
  };
  const [genesis,tip]=await Promise.all([rpc('get_block_hash',['0x0']),rpc('get_tip_header')]);
  if(typeof genesis!=='string'||genesis.toLowerCase()!==PUDGE_GATE2_GENESIS||!tip?.number||!hash.test(tip.hash||''))throw Error('Pudge network identity mismatch');
  await Promise.all([
    canonicalTransaction(PUDGE_GATE2_STAGE_TXS.code),
    canonicalTransaction(PUDGE_GATE2_INITIALIZATION),
    ...dependencies.map(async(dependency,index)=>{
      const outPoint=dependency.outPoint;
      const result=await rpc('get_live_cell',[{tx_hash:outPoint.txHash,index:outPoint.index},true]);
      if(result?.status!=='live'||!result.cell?.data?.content||ccc.hashCkb(result.cell.data.content as ccc.Hex).toLowerCase()!==hashes[index].toLowerCase())throw Error('Registered market dependency is unavailable');
    }),
  ]);
  const stable=await rpc('get_block_hash',[tip.number]);
  if(typeof stable!=='string'||stable.toLowerCase()!==tip.hash.toLowerCase())throw Error('Pudge chain changed during market validation');
}

function cachedManifestKey(raw:string){return createHash('sha256').update(raw).digest('hex');}
function rememberManifest(key:string,manifest:VerifiedManifest){
  verifiedManifests.delete(key);
  verifiedManifests.set(key,{manifest,verifiedAt:Date.now()});
  while(verifiedManifests.size>8){const oldest=verifiedManifests.keys().next().value;if(oldest)verifiedManifests.delete(oldest);else break;}
}

async function loadCheckpoint(key:string,file:string|undefined,manifest:RecoveryManifest,owner:string){
  const valid=(value:unknown)=>{
    const checkpoint=value as {format?:string;genesis?:string;marketScriptHash?:string;tokenTypeHash?:string;initializationTransactionHash?:string;owner?:string;chainAnchor?:{number?:string;hash?:string};bundle?:RecoveryBundle};
    return checkpoint?.format==='roveko-pudge-proof-checkpoint-v1'&&checkpoint.genesis?.toLowerCase()===manifest.genesis.toLowerCase()&&checkpoint.marketScriptHash?.toLowerCase()===manifest.scripts.market.hash().toLowerCase()&&checkpoint.tokenTypeHash?.toLowerCase()===manifest.scripts.token.hash().toLowerCase()&&checkpoint.initializationTransactionHash?.toLowerCase()===manifest.initializationTransactionHash.toLowerCase()&&checkpoint.owner?.toLowerCase()===owner.toLowerCase()&&checkpoint.chainAnchor?.number===checkpoint.bundle?.collection?.end_tip?.number&&checkpoint.chainAnchor?.hash?.toLowerCase()===checkpoint.bundle?.collection?.end_tip?.hash?.toLowerCase()&&hash.test(checkpoint.chainAnchor?.hash||'')&&validBundle(checkpoint.bundle,manifest,owner)?checkpoint.bundle:null;
  };
  if(file){
    try{
      const info=await stat(file);
      if(!info.isFile()||info.size>MAX_CACHE_BYTES)return null;
      return valid(JSON.parse(await readFile(file,'utf8')));
    }catch{return null;}
  }
  const saved=memoryCheckpoints.get(key);
  return saved?valid(saved.value):null;
}

async function saveCheckpoint(key:string,file:string|undefined,bundle:RecoveryBundle,manifest:RecoveryManifest,owner:string){
  const checkpoint={format:'roveko-pudge-proof-checkpoint-v1',genesis:manifest.genesis,marketScriptHash:manifest.scripts.market.hash(),tokenTypeHash:manifest.scripts.token.hash(),initializationTransactionHash:manifest.initializationTransactionHash,owner,chainAnchor:bundle.collection.end_tip,bundle};
  const content=JSON.stringify(checkpoint);
  if(Buffer.byteLength(content)>MAX_CACHE_BYTES)throw Error('Verified recovery checkpoint exceeds storage limit');
  if(file){
    const directory=path.dirname(file);
    await mkdir(directory,{recursive:true,mode:0o700});
    const temporary=path.join(directory,`.${key}.${randomUUID()}.tmp`);
    try{
      await writeFile(temporary,content,{flag:'wx',mode:0o600});
      await rename(temporary,file);
    }finally{await rm(temporary,{force:true}).catch(()=>{});}
    await pruneCheckpointCache(directory,file).catch(()=>{});
    return;
  }
  if(Buffer.byteLength(content)>2*1024*1024)return;
  memoryCheckpoints.delete(key);
  memoryCheckpoints.set(key,{value:checkpoint,size:Buffer.byteLength(content)});
  while(memoryCheckpoints.size>4){const oldest=memoryCheckpoints.keys().next().value;if(oldest)memoryCheckpoints.delete(oldest);else break;}
}

async function pruneCheckpointCache(directory:string,keepFile:string){
  const entries=await readdir(directory,{withFileTypes:true});
  const files=await Promise.all(entries.filter(entry=>entry.isFile()&&/^[0-9a-f]{64}\.json$/.test(entry.name)).map(async entry=>{
    const full=path.join(directory,entry.name),info=await stat(full);
    return {full,size:info.size,modified:info.mtimeMs};
  }));
  files.sort((a,b)=>a.modified-b.modified);
  let total=files.reduce((sum,file)=>sum+file.size,0),count=files.length;
  for(const file of files){
    if(count<=128&&total<=256*1024*1024)break;
    if(file.full===keepFile)continue;
    await rm(file.full,{force:true});total-=file.size;count--;
  }
}

async function validateLiveCheckpoint(bundle:RecoveryBundle,manifest:RecoveryManifest,rpc:(method:string,params?:unknown[])=>Promise<any>){
  const anchor=bundle.collection.end_tip;
  const storedAnchorHash=anchor?.hash;
  if(!anchor?.number||!storedAnchorHash||!hash.test(storedAnchorHash))return false;
  const point={tx_hash:bundle.live.tx_hash,index:bundle.live.index};
  const [tip,live,transaction]=await Promise.all([
    rpc('get_tip_header'),
    rpc('get_live_cell',[point,true]),
    rpc('get_transaction',[point.tx_hash]),
  ]);
  if(!tip?.number||!hash.test(tip.hash||'')||live?.status!=='live'||!live.cell?.output||!live.cell?.data?.content||transaction?.tx_status?.status!=='committed'||!transaction.transaction) return false;
  const index=Number(BigInt(point.index)),output=transaction.transaction.outputs?.[index],data=transaction.transaction.outputs_data?.[index];
  if(!output||output.capacity!==bundle.live.output.capacity||!sameScript(output.lock,bundle.live.output.lock)||!sameScript(output.type,bundle.live.output.type)||data?.toLowerCase()!==bundle.live.data.toLowerCase())return false;
  if(transaction.tx_status.block_number===undefined||transaction.tx_status.block_hash===undefined)return false;
  const canonicalHash=await rpc('get_block_hash',[transaction.tx_status.block_number]);
  if(typeof canonicalHash!=='string'||canonicalHash.toLowerCase()!==transaction.tx_status.block_hash.toLowerCase())return false;
  if(live.cell.output.capacity!==bundle.live.output.capacity||!sameScript(live.cell.output.lock,toScript(manifest.scripts.custody))||!sameScript(live.cell.output.type,toScript(manifest.scripts.token))||live.cell.data.content.toLowerCase()!==bundle.live.data.toLowerCase()||!/^0x[0-9a-f]{96}$/i.test(bundle.live.data))return false;
  const [stableTip,canonicalAnchorHash]=await Promise.all([rpc('get_block_hash',[tip.number]),rpc('get_block_hash',[anchor.number])]);
  return typeof stableTip==='string'&&stableTip.toLowerCase()===tip.hash.toLowerCase()&&typeof canonicalAnchorHash==='string'&&canonicalAnchorHash.toLowerCase()===storedAnchorHash.toLowerCase();
}

async function boundedRun(file:string,args:string[],deadline:number,env:NodeJS.ProcessEnv){
  const remaining=Math.min(MAX_RECOVERY_MS,deadline-Date.now());
  if(remaining<1000)throw Error('Proof request timed out');
  return run(process.execPath,[file,...args],{timeout:remaining,maxBuffer:2*1024*1024,env});
}

let synchronization:Promise<void>|undefined;
let readiness:'syncing'|'ready'|'updating'|'unavailable'='syncing';
let verifiedIdentity:string|undefined;
let checkedAt=0;
const sharedReadiness=new Map<string,{status:string;checkedAt:number;identity?:string;pending?:Promise<void>}>();

export async function getProofStatus(request:Request){
  const params=new URL(request.url).searchParams;
  const requested=params.get('market')||'pudge-xudt';
  if(requested!=='pudge-xudt'&&!/^0x[0-9a-f]{64}$/.test(requested))return new Response('Invalid market',{status:400});
  if(params.has('trade')){
    const trade=params.get('trade')||'',owner=params.get('owner')||'';
    const result=(incorporated:boolean)=>Response.json({incorporated,trade,owner,market:requested},{headers:{'Cache-Control':'no-store'}});
    if(!hash.test(trade)||!hash.test(owner)||!custodyStates.size)return result(false);
    try{
      const {market,point,data}=await getPudgeCustodyAnchor(requested);
      const marketScript=ccc.Script.from(market.manifest.scripts.market);
      const state=custodyStates.get(requestKey({...market.manifest,scripts:{market:marketScript}},rpcEndpoint()));
      const external=state?.snapshot.net_external;
      return result(!!state&&market.historyState==='verified'&&
        market.history.some(row=>row.hash===trade&&row.owner===owner)&&
        state.bundle.live.tx_hash===point.tx_hash&&BigInt(state.bundle.live.index)===BigInt(point.index)&&
        state.bundle.live.data===data&&state.snapshot.external_accounting_complete===true&&
        state.snapshot.custody_amount===market.custody&&typeof external==='string'&&
        BigInt(market.inventory)+BigInt(market.custody)+BigInt(external)===BigInt(market.supply)&&
        state.bundle.history.some(row=>row.tx_hash===trade));
    }catch{return result(false);}
  }
  if(requested!=='pudge-xudt'){
    let state=sharedReadiness.get(requested);
    if(!state){
      if(sharedReadiness.size>=16){const unused=[...sharedReadiness.entries()].find(([,value])=>!value.pending);if(!unused)return new Response('Market synchronization busy',{status:503});sharedReadiness.delete(unused[0]);}
      state={status:'syncing',checkedAt:0};sharedReadiness.set(requested,state);
    }
    const selected=state;
    if(!selected.pending&&Date.now()-selected.checkedAt>=20_000){
      selected.pending=(async()=>{
        const market=await getPublishedPudgeMarketData(requested);
        const response=await handleProof(new Request('http://127.0.0.1/api/v2/pudge-proof',{
          method:'POST',headers:{origin:'http://127.0.0.1','content-type':'application/json'},
          body:JSON.stringify({owner:market.manifest.journal.owner,manifest:market.manifest,side:'buy',quantity:'1'}),
        }),true);
        if(!response.ok)throw Error('Market synchronization failed');
        selected.identity=(await response.json()).identity;selected.status='ready';
      })().catch(()=>{selected.status='unavailable';}).finally(()=>{selected.checkedAt=Date.now();selected.pending=undefined;});
      const running=selected.pending;after(()=>running);
    }
    return Response.json({market:requested,status:selected.status,identity:selected.identity},{headers:{'Cache-Control':'no-store'}});
  }
  if(!synchronization&&Date.now()-checkedAt>=20_000){
    if(!verifiedIdentity)readiness='syncing';
    synchronization=(async()=>{
      const market=await getPudgeMarketData();
      const result=await handleProof(new Request('http://127.0.0.1/api/v2/pudge-proof',{
        method:'POST',headers:{origin:'http://127.0.0.1','content-type':'application/json'},
        body:JSON.stringify({owner:market.manifest.journal.owner,manifest:market.manifest,side:'buy',quantity:'1'}),
      }),true);
      if(!result.ok)throw Error('Custody synchronization failed');
      const state=await result.json();
      verifiedIdentity=state.identity;
      readiness='ready';
    })().catch(()=>{readiness='unavailable';}).finally(()=>{checkedAt=Date.now();synchronization=undefined;});
    const running=synchronization;
    after(()=>running);
  }
  return Response.json({status:readiness,identity:verifiedIdentity,
    persistence:!!process.env.ROVEKO_PUDGE_PROOF_CACHE_DIR&&/^[0-9a-f]{64}$/i.test(process.env.ROVEKO_PUDGE_SNAPSHOT_KEY||''),
  },{headers:{'Cache-Control':'no-store'}});
}

export async function prepareProof(request:Request){
  // The verified checkpoint refresh is shared with readiness and has its own
  // bounded RPC and collector budgets. Keep the request attached to that work.
  return handleProof(request);
}

async function handleProof(request:Request,synchronize=false, suppliedAnchor?:Awaited<ReturnType<typeof getPudgeCustodyAnchor>>){
  const proofStarted=performance.now(),proofTrace:string[]=[];
  let dir:string|undefined,entered=false;
  let leasedWorker:ProofWorker|undefined;
  try{
    const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
    try{
      const url=new URL(request.url),source=new URL(origin||'');
      const loopback=(host:string)=>['localhost','127.0.0.1','[::1]'].includes(host);
      const localAlias=site==='same-origin'&&loopback(url.hostname)&&loopback(source.hostname)&&
        source.protocol===url.protocol&&source.port===url.port&&source.host===request.headers.get('host');
      const railwayDomain=synchronize ? undefined : process.env.RAILWAY_PUBLIC_DOMAIN;
      const expectedOrigin=railwayDomain ? `https://${railwayDomain}` : url.origin;
      if((source.origin!==expectedOrigin&&(railwayDomain||!localAlias))||(site&&site!=='same-origin'))return new Response('Same-origin request required',{status:403});
    }catch{return new Response('Same-origin request required',{status:403});}

    if((suppliedAnchor?activeIncorporations:activeRequests)>=MAX_PARALLEL)return new Response('Proof service is busy; retry shortly',{status:429,headers:{'Retry-After':'5'}});
    if(suppliedAnchor)activeIncorporations++;else activeRequests++;
    entered=true;
    const text=await readBoundedBody(request);
    let body:{owner?:string;side?:string;quantity?:string;manifest?:any};
    try{body=JSON.parse(text);}catch{return new Response('Invalid JSON',{status:400});}
    const balanceOnly=body.side==='balance';
    if(!synchronize&&!consumeRateLimit(request,balanceOnly))return new Response('Proof request rate limit reached',{status:429,headers:{'Retry-After':'60'}});
    if(!hash.test(body.owner||'')||!body.manifest||(!balanceOnly&&(!['buy','sell','withdraw'].includes(body.side||'')||!/^[1-9][0-9]{0,19}$/.test(body.quantity||'')||BigInt(body.quantity!)>(1n<<64n)-1n)))return new Response('Invalid proof request',{status:400});
    const shared=body.manifest.format==='brant-shared-pudge-market-v1';
    if(!shared&&(body.manifest.genesis!==PUDGE_GATE2_GENESIS||body.manifest.initializationTransactionHash!==PUDGE_GATE2_INITIALIZATION||body.manifest.codeDeploymentTransactionHash!==PUDGE_GATE2_STAGE_TXS.code))return new Response('Market is not registered for proof requests',{status:403});
    const deadline=Date.now()+60_000;
    const tools=await resolveGate2NativeTools(),binary=tools.recovery;
    if(!binary||!tools.smt)return new Response('Proof tool unavailable',{status:503});
    const endpoint=rpcEndpoint();let rpcCalls=0;
    const readyOnly=!shared&&!synchronize&&!balanceOnly&&marketNetwork().genesis===PUDGE_GATE2_GENESIS;
    if(readyOnly&&readiness!=='ready')return new Response('Trading state is synchronizing. Your quote has been kept.',{status:503,headers:{'Retry-After':'3'}});
    const rpc=async(method:string,params:unknown[]=[] )=>{
      if(++rpcCalls>MAX_RPC_CALLS||Date.now()>=deadline)throw Error('Pudge RPC work limit exceeded');
      const timeout=Math.max(1000,Math.min(15000,deadline-Date.now()));
      const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store',signal:AbortSignal.timeout(timeout)});
      const raw=await response.text();if(raw.length>4*1024*1024)throw Error('Pudge RPC response exceeds limit');
      const row=JSON.parse(raw);if(!response.ok||row.error)throw Error('Pudge RPC failed');return row.result;
    };
    const proof=async(anchor:{txHash:string;index:string},owner:string)=>{
      return generatePudgeLaunchProof(anchor,owner);
    };
    const rawManifest=JSON.stringify(body.manifest),manifestKey=cachedManifestKey(endpoint+rawManifest),cachedManifest=verifiedManifests.get(manifestKey);
    const manifestScope='pudge-proof-manifest-v1:'+manifestKey,manifestFile=cacheFile(manifestScope.slice(-64));
    const savedManifest=await readAuthenticated<VerifiedManifest>(manifestFile,manifestScope);
    if(savedManifest){
      for(const name of ['market','marker','owner','token','custody','custodyMarker'] as const){
        savedManifest.scripts[name]=ccc.Script.from(savedManifest.scripts[name]);
      }
    }
    const requestedMarket=shared?ccc.Script.from(body.manifest.scripts.market).hash().toLowerCase():undefined;
    const anchor=suppliedAnchor??(shared?await getPudgeCustodyAnchor(requestedMarket!):null);
    const published=anchor?.market;
    const marketMs=Math.round(performance.now()-proofStarted);
    if(published){
      if(body.manifest.genesis!==published.genesis||body.manifest.initializationTransactionHash!==published.manifest.initializationTransactionHash)throw Error('Requested market provenance mismatch');
      for(const name of ['market','marker','owner','token','custody','custodyMarker'] as const)if(ccc.Script.from(body.manifest.scripts[name]).hash()!==ccc.Script.from(published.manifest.scripts[name]).hash())throw Error('Requested market script mismatch');
    }
    const manifest:VerifiedManifest=published?.manifest||(cachedManifest&&Date.now()-cachedManifest.verifiedAt<300_000?cachedManifest.manifest:
      savedManifest||await loadPudgeManifest(rpc,rawManifest,proof));
    if(!shared&&manifest!==cachedManifest?.manifest&&!savedManifest){
      await validateRegisteredManifest(manifest,rpc);
      await writeAuthenticated(manifestFile,manifestScope,manifest).catch(()=>{});
    }
    if(manifest!==cachedManifest?.manifest){
      rememberManifest(manifestKey,manifest);
    }
    const marketHash=manifest.scripts.market.hash().toLowerCase(),tokenHash=manifest.scripts.token.hash().toLowerCase();
    const metadata=resolvePudgeTokenMetadata({genesis:manifest.genesis,marketScriptHash:marketHash,tokenTypeHash:tokenHash,initializationTransactionHash:manifest.initializationTransactionHash});
    if(!shared&&metadata.metadata!=='off-chain-testnet-registry')return new Response('Market is not registered for proof requests',{status:403});
    dir=await mkdtemp(path.join(tmpdir(),'roveko-pudge-proof-'));
    const custody=path.join(dir,'custody.json'),token=path.join(dir,'token.json'),bundlePath=path.join(dir,'bundle.json'),checkpointPath=path.join(dir,'checkpoint.json');
    const custodyScript=toScript(manifest.scripts.custody),tokenScript=toScript(manifest.scripts.token),key=requestKey(manifest,endpoint),file=cacheFile(key);
    const replayOwner=manifest.journal.owner;
    const refresh=async()=>{
    const snapshotScope='pudge-custody-v2:'+key,snapshotFile=file&&file+'.snapshot';
    const current=custodyStates.get(key)||await readAuthenticated<CustodyState>(snapshotFile,snapshotScope);
    let market=anchor??await (marketNetwork().genesis===PUDGE_GATE2_GENESIS?getPudgeCustodyAnchor(requestedMarket):null);
    const matchesMarket=(bundle:RecoveryBundle)=>!market||
      (market.point.tx_hash===bundle.live.tx_hash&&BigInt(market.point.index)===BigInt(bundle.live.index)&&market.data===bundle.live.data);
    const reconcile=(snapshot:Record<string,unknown>)=>{
      if(!market)return;
      const external=snapshot.net_external;
      if(snapshot.external_accounting_complete!==true||typeof external!=='string'||!/^\d+$/.test(external)||
        snapshot.custody_amount!==market.custody||BigInt(market.inventory)+BigInt(market.custody)+BigInt(external)!==BigInt(market.supply)){
        throw Error('Pudge inventory, custody and net external movement do not reconcile');
      }
    };
    const isLive=async(bundle:RecoveryBundle)=>{
      if(!matchesMarket(bundle))return false;
      return validateLiveCheckpoint(bundle,manifest,rpc);
    };
    if(current&&matchesMarket(current.bundle)){
      // Reuse requires both the current custody state and the saved canonical
      // collection anchor, including when another market caused a reorg.
      if(await isLive(current.bundle)){
        proofTrace.push('verified-custody-reuse');
        reconcile(current.snapshot);
        while(custodyStates.size>=16)custodyStates.delete(custodyStates.keys().next().value!);
        custodyStates.set(key,current);
        return {state:current,live:market};
      }
    }
    custodyStates.delete(key);
    if(readyOnly){
      readiness='updating';
      checkedAt=0;
      throw Error('Executable custody state changed');
    }
    await Promise.all([writeFile(custody,JSON.stringify(custodyScript),{mode:0o600}),writeFile(token,JSON.stringify(tokenScript),{mode:0o600})]);
    const canonicalCollector=path.resolve(process.cwd(),'lib/v2-engine/pudge-recover.cjs'),collector=process.env.ROVEKO_RECOVERY_COLLECTOR||canonicalCollector;
    const [canonicalBytes,configuredBytes]=await Promise.all([readFile(canonicalCollector),readFile(collector),access(binary)]).then(([a,b])=>[a,b] as const);
    if(createHash('sha256').update(canonicalBytes).digest('hex')!==createHash('sha256').update(configuredBytes).digest('hex'))throw Error('Recovery collector differs from repository');
    const common=['--collection-only','true','--node',endpoint,'--indexer',endpoint,'--init',manifest.initializationTransactionHash,'--owner',replayOwner,'--custody-lock',custody,'--xudt-type',token,'--max-pages','32','--max-transactions','512'];
    const childEnv={...process.env,ROVEKO_PROOF_BINARY:binary,ROVEKO_RECOVERY_RPC_TIMEOUT_MS:'15000',ROVEKO_RECOVERY_MAX_RPC:'1100'};
    let checkpoint=current?.bundle||await loadCheckpoint(key,file,manifest,replayOwner);
    let canAdvance=false;
    let reusable=checkpoint?await isLive(checkpoint):false;
    if(checkpoint&&!reusable){
      proofTrace.push('incremental-collection');
      await writeFile(checkpointPath,JSON.stringify(checkpoint),{mode:0o600});
      try{
        await boundedRun(canonicalCollector,['collect-incremental',...common,'--checkpoint',checkpointPath,'--out',bundlePath],deadline,childEnv);
        checkpoint=JSON.parse(await readFile(bundlePath,'utf8'));
        if(!validBundle(checkpoint,manifest,replayOwner))throw Error('Incremental checkpoint identity mismatch');
        canAdvance=!!current?.snapshot.history_length;
      }catch{
        proofTrace.push('full-collection-fallback');
        await boundedRun(canonicalCollector,['collect',...common,'--out',bundlePath],deadline,childEnv);
        checkpoint=JSON.parse(await readFile(bundlePath,'utf8'));
        if(!validBundle(checkpoint,manifest,replayOwner))throw Error('Collected checkpoint identity mismatch');
      }
      reusable=false;
    }else if(!checkpoint){
      proofTrace.push('full-collection');
      await boundedRun(canonicalCollector,['collect',...common,'--out',bundlePath],deadline,childEnv);
      checkpoint=JSON.parse(await readFile(bundlePath,'utf8'));
      if(!validBundle(checkpoint,manifest,replayOwner))throw Error('Collected checkpoint identity mismatch');
      reusable=false;
    }
    const bundle=checkpoint as RecoveryBundle;
    const replay=async(selected:RecoveryBundle,advance=false)=>{
      const input=await cacheBundleForTransition(dir!,selected);
      const args=['replay',input];
      if(advance&&current){
        const snapshotPath=path.join(dir!,'previous-ownership.json');
        await writeFile(snapshotPath,JSON.stringify(current.snapshot),{flag:'wx',mode:0o600});
        args.splice(0,args.length,'advance',input,snapshotPath);
      }
      const result=await run(binary,args,{timeout:MAX_RECOVERY_MS,maxBuffer:2*1024*1024});
      return JSON.parse(result.stdout);
    };
    let selectedBundle=bundle,snapshot;
    try{snapshot=await replay(bundle,canAdvance);}catch(error){
      if(!reusable&&!current&&!proofTrace.includes('incremental-collection'))throw error;
      await boundedRun(canonicalCollector,['collect',...common,'--out',bundlePath],deadline,childEnv);
      selectedBundle=JSON.parse(await readFile(bundlePath,'utf8'));
      if(!validBundle(selectedBundle,manifest,replayOwner))throw Error('Rebuilt checkpoint identity mismatch');
      snapshot=await replay(selectedBundle);
    }
    if(market)market=await getPudgeCustodyAnchor(requestedMarket);
    if(!await isLive(selectedBundle))throw Error('Custody changed during recovery');
    const state={bundle:selectedBundle,snapshot:{custody_args:custodyScript.args,marker_outpoint:snapshot.marker_outpoint,history_length:snapshot.history_length,history_tail:snapshot.history_tail,ownership_root:snapshot.ownership_root,custody_amount:snapshot.custody_amount,net_external:snapshot.net_external,external_accounting_complete:snapshot.external_accounting_complete,tip_outpoint:snapshot.tip_outpoint,owners:snapshot.owners}};
    reconcile(state.snapshot);
    if(!reusable||selectedBundle!==bundle)await saveCheckpoint(key,file,selectedBundle,manifest,replayOwner);
    await writeAuthenticated(snapshotFile,snapshotScope,state).catch(()=>{});
    while(custodyStates.size>=16)custodyStates.delete(custodyStates.keys().next().value!);
    custodyStates.set(key,state);
    return {state,live:market};
    };
    const refreshStarted=performance.now();
    const refreshKey=key;
    let pending=custodyRefreshes.get(refreshKey);
    if(!pending){
      pending=refresh().finally(()=>custodyRefreshes.delete(refreshKey));
      custodyRefreshes.set(refreshKey,pending);
    }
    let recovered=await pending;
    // A request that joined recovery for older outpoints must refresh against
    // its own anchor after the earlier operation has released the market.
    if(anchor&&JSON.stringify(recovered.live?.points)!==JSON.stringify(anchor.points)){
      let successor=custodyRefreshes.get(refreshKey);
      if(!successor){
        successor=refresh().finally(()=>custodyRefreshes.delete(refreshKey));
        custodyRefreshes.set(refreshKey,successor);
      }
      recovered=await successor;
    }
    const {state,live}=recovered,selectedBundle=state.bundle;
    const custodyMs=Math.round(performance.now()-refreshStarted);
    if(anchor&&(JSON.stringify(live?.points)!==JSON.stringify(anchor.points)||selectedBundle.live.data!==anchor.data||selectedBundle.live.tx_hash!==anchor.point.tx_hash||BigInt(selectedBundle.live.index)!==BigInt(anchor.point.index)))throw Error('Custody changed during preparation');
    const nativeStarted=performance.now();
    request.signal.throwIfAborted();
    if(balanceOnly){
      const root='0x'+selectedBundle.live.data.slice(34);
      const owners=state.snapshot.owners as {owner_lock_hash:string;balance:string;active:boolean}[];
      if(!Array.isArray(owners)||state.snapshot.ownership_root!==root)throw Error('Verified balance snapshot root mismatch');
      const owner=body.owner!.toLowerCase();
      const leaf=owners.find(row=>row.owner_lock_hash===owner);
      const balance=leaf?.balance??'0';
      if(!/^\d+$/.test(balance))throw Error('Verified owner balance is invalid');
      return Response.json({owner,balance,root,genesis:manifest.genesis,market:marketHash,token:tokenHash,points:live?.points,custodyOutpoint:{tx_hash:selectedBundle.live.tx_hash,index:selectedBundle.live.index}},{headers:{'Cache-Control':'no-store'}});
    }
    if(synchronize&&suppliedAnchor)return Response.json({points:live?.points,identity:`${marketHash}:${selectedBundle.live.tx_hash}:${selectedBundle.live.index}:${selectedBundle.live.data.slice(34)}`});
    let worker=proofWorkers.get(state);
    if(worker?.closing){await worker.native.exited;worker=proofWorkers.get(state);}
    if(!worker){
      if(proofWorkers.size>=2){
        const unused=[...proofWorkers.values()].find(candidate=>candidate.users===0&&!candidate.closing);
        if(!unused)throw Error('Native proof workers busy');
        clearTimeout(unused.idle);unused.closing=true;unused.native.stop();
        await unused.native.exited;
      }
      const snapshotPath=path.join(dir,'snapshot.json');
      await writeFile(snapshotPath,JSON.stringify(state.snapshot),{flag:'wx',mode:0o600});
      worker=proofWorkers.get(state);
      if(!worker){
        if(proofWorkers.size>=2)throw Error('Native proof workers busy');
        proofTrace.push('native-worker-start');
        worker={state,native:startPudgeProofWorker(binary,snapshotPath),users:0};
        proofWorkers.set(state,worker);
        const created=worker;
        void worker.native.exited.then(()=>{if(proofWorkers.get(state)===created)proofWorkers.delete(state);});
      }
    }
    worker.users++;leasedWorker=worker;
    clearTimeout(worker.idle);
    await worker.native.ready;
    if(synchronize)return Response.json({points:live?.points,identity:`${marketHash}:${selectedBundle.live.tx_hash}:${selectedBundle.live.index}:${selectedBundle.live.data.slice(34)}`});
    const result=await worker.native.proof(body.owner!,body.side!,body.quantity!),expectedRoot=`0x${selectedBundle.live.data.slice(34)}`;
    const mismatches:string[]=[];
    if(result.old_root?.toLowerCase()!==expectedRoot.toLowerCase())mismatches.push('old-root');
    if(typeof result.witness!=='string'||!/^0x544d5331[0-9a-f]+$/i.test(result.witness)||`0x${result.witness.slice(26,90)}`.toLowerCase()!==body.owner!.toLowerCase())mismatches.push('owner-witness');
    if(result.quantity!==body.quantity)mismatches.push('quantity');
    if(result.side!==body.side)mismatches.push('side');
    if(result.tip_outpoint?.tx_hash?.toLowerCase()!==selectedBundle.live.tx_hash.toLowerCase())mismatches.push('tip-transaction');
    if(typeof result.tip_outpoint?.index!=='string'||BigInt(result.tip_outpoint.index)!==BigInt(selectedBundle.live.index))mismatches.push('tip-index');
    if(mismatches.length)throw Error(`Generated proof checkpoint mismatch: ${mismatches.join(',')}`);
    if(live&&(live.point.tx_hash.toLowerCase()!==selectedBundle.live.tx_hash.toLowerCase()||
      BigInt(live.point.index)!==BigInt(selectedBundle.live.index)||live.data.toLowerCase()!==selectedBundle.live.data.toLowerCase())){
      return new Response('Custody changed during preparation. Retry the quote.',{status:409});
    }
    console.info('Pudge proof timing',JSON.stringify({path:proofTrace,marketMs,custodyMs,nativeMs:Math.round(performance.now()-nativeStarted),ms:Math.round(performance.now()-proofStarted)}));
    return Response.json({proof:result,genesis:manifest.genesis,market:marketHash,token:tokenHash,manifest,points:live?.points,cells:live?.cells},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    if(error instanceof Error&&error.message==='Request too large')return new Response('Request too large',{status:400});
    if(error instanceof Error&&error.message==='Expected JSON')return new Response('Expected JSON',{status:415});
    console.info('Pudge proof failed',JSON.stringify({path:proofTrace,ms:Math.round(performance.now()-proofStarted)}));
    console.error('Pudge proof request failed:',error instanceof Error?error.message:'unknown error');
    return new Response('Pudge canonical history or proof unavailable',{status:503});
  }finally{
    if(leasedWorker){
      const worker=leasedWorker;worker.users--;
      if(worker.users===0){
        worker.idle=setTimeout(()=>{if(worker.users===0){worker.closing=true;worker.native.stop();}},30_000);
        worker.idle.unref();
      }
    }
    if(dir){const target=path.resolve(dir),parent=path.resolve(tmpdir());if(path.dirname(target)===parent&&path.basename(target).startsWith('roveko-pudge-proof-'))await rm(target,{recursive:true,force:true});}
    if(entered){if(suppliedAnchor)activeIncorporations--;else activeRequests--;}
  }
}

async function cacheBundleForTransition(directory:string,bundle:RecoveryBundle){
  const destination=path.join(directory,`bundle-${randomUUID()}.json`);
  await writeFile(destination,JSON.stringify(bundle),{flag:'wx',mode:0o600});
  return destination;
}

/** Advance the same custody state used by quote preparation before publishing a confirmation. */
export async function incorporateCommittedTrade(id:string,hash:string){
  const market=await getPublishedPudgeMarketData(id,hash);
  if(!market.history.some(event=>event.hash===hash))throw Error('Committed trade is not in verified market history');
  const anchor=await getPudgeCustodyAnchor(id,market);
  const response=await handleProof(new Request('http://127.0.0.1/api/v2/pudge-proof',{
    method:'POST',headers:{origin:'http://127.0.0.1','content-type':'application/json'},
    body:JSON.stringify({owner:market.manifest.journal.owner,manifest:market.manifest,side:'buy',quantity:'1'}),
  }),true,anchor);
  if(!response.ok)throw Error('Committed trade custody recovery failed (HTTP '+response.status+'): '+await response.text());
  const {points,identity}=await response.json();
  if(JSON.stringify(points)!==JSON.stringify(anchor.points))throw Error('Execution state advanced during incorporation');
  return {...market,incorporatedTrade:hash,executionVersion:JSON.stringify([points,identity])};
}

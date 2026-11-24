import {atomicV2Codes} from './atomic-launch-v2.ts';
import { ccc } from '@ckb-ccc/core';
import { readLiveSingletons } from './live.ts';
import { readFundingCell } from './funding.ts';
import { buildReviewedTransaction } from './review.ts';
import { quote } from './curve.ts';
import type { Cell } from './transaction.ts';
import { discoverMarketPair, discoverCustodyPair } from './lineage.ts';
import {selectTradeFunding,type FundingHint} from './multi-funding.ts';
import {cccA} from '@ckb-ccc/core/advanced';
import {PUDGE_TRADE_CHANGE_CAPACITY,PUDGE_TRADE_FEE} from './market-capacity.ts';

type Rpc = (method:string, params:unknown[]) => Promise<unknown>;
type Point = {tx_hash:string;index:string};
type Config = {genesis:string;initial:[Point,Point,Point,Point];funding:{txHash:string;index:string};deps:Record<string,ccc.CellDepLike>;format?:string;atomic?:boolean;initializationTransactionHash?:string;scripts?:{owner?:ccc.Script;market:ccc.Script;marker:ccc.Script;custody:ccc.Script;custodyMarker:ccc.Script;token:ccc.Script}};
const le64 = (n:bigint) => Array.from({length:8},(_,i)=>Number((n >> BigInt(i*8)) & 255n).toString(16).padStart(2,'0')).join('');
const pinned:Record<string,string> = {
  market_smt:'0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770',
  marker_candidate:'0xd09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2',
  custody_smt:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',
  custody_marker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',
  xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95',
};
export async function prepareLocalReview(rpc:Rpc, config:Config, owner:string, side:'buy'|'sell', quantity:bigint, ownerScript?:ccc.Script, timing?:(stage:string,ms:number)=>void, hint?:FundingHint, quotedAmount?:bigint, signal?:AbortSignal) {
  let started=performance.now();
  const mark=(stage:string)=>{const now=performance.now();timing?.(stage,now-started);started=now;};
  const pudge=(config.format==='roveko-pudge-market-v1'||config.format==='brant-shared-pudge-market-v1');
  if(pudge&&(!ownerScript||ownerScript.hash()!==owner))throw Error('Connected wallet changed');
  const minimum=(amount:bigint)=>(side==='buy'?amount:0n)+PUDGE_TRADE_CHANGE_CAPACITY+PUDGE_TRADE_FEE;
  const earlyFunding=pudge&&quotedAmount!==undefined?selectTradeFunding(rpc,ownerScript!,minimum(quotedAmount),hint):undefined;
  void earlyFunding?.catch(()=>{});
  const response = await fetch(pudge?'/api/v2/pudge-proof':'/api/v2/proof',{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(65_000)]):AbortSignal.timeout(65_000),method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({owner,side,quantity:quantity.toString(),...(pudge?{manifest:config}:config.format==='roveko-local-market-v1'?{initTxHash:config.initializationTransactionHash}:{})})});
  if (!response.ok) {
    const detail=response.headers.get('content-type')?.startsWith('text/plain')?await response.text():'';
    throw Error(detail&&detail.length<=200?detail:`Canonical proof unavailable (HTTP ${response.status})`);
  }
  const body = await response.json();
  mark('proofMs');
  signal?.throwIfAborted();
  const p = body.proof;
  if (body.genesis !== config.genesis || p.side !== side || p.quantity !== quantity.toString() || !p.tip_outpoint) throw Error('Proof identity mismatch');
  const verified=pudge&&body.manifest&&Array.isArray(body.points)&&body.points.length===4;
  if(pudge&&!verified)throw Error('Verified market proof required');
  if(verified){
    if(!config.scripts?.owner||body.token!==ccc.Script.from(config.scripts.token).hash()||body.market!==ccc.Script.from(config.scripts.market).hash())throw Error('Requested market differs from proof');
    for(const name of ['market','marker','owner','custody','custodyMarker','token'] as const)if(ccc.Script.from(config.scripts[name]!).hash()!==ccc.Script.from(body.manifest.scripts[name]).hash())throw Error('Proof script identity mismatch');
    const manifest=body.manifest;
    if(manifest.genesis!==config.genesis||manifest.initializationTransactionHash!==config.initializationTransactionHash||
      ccc.Script.from(manifest.scripts.market).hash()!==body.market||
      body.points[2].tx_hash!==p.tip_outpoint.tx_hash||BigInt(body.points[2].index)!==BigInt(p.tip_outpoint.index))throw Error('Verified market identity mismatch');
    config={...manifest,scripts:Object.fromEntries(['market','marker','owner','custody','custodyMarker','token'].map(name=>[name,ccc.Script.from(manifest.scripts[name])]))};
  }
  mark('manifestMs');
  const points:[Point,Point,Point,Point] = verified?body.points:
    (await Promise.all([discoverMarketPair(rpc,[config.initial[0],config.initial[1]]),discoverCustodyPair(rpc,p.tip_outpoint)])).flat() as [Point,Point,Point,Point];
  const live = await readLiveSingletons(rpc,points,config.genesis);
  mark('singletonsMs');
  if(pudge){
    if(!config.scripts)throw Error('Verified market scripts required');
    const script=(s:unknown)=>{const v=s as {code_hash:string;hash_type:ccc.HashType;args:string};return ccc.Script.from({codeHash:v.code_hash,hashType:v.hash_type,args:v.args}).hash();};
    const locks=[config.scripts.market,config.scripts.market,config.scripts.custody,config.scripts.custody],types=[config.scripts.token,config.scripts.marker,config.scripts.token,config.scripts.custodyMarker];
    if(live.cells.some((c,i)=>script(c.output.lock)!==locks[i].hash()||!c.output.type||script(c.output.type)!==types[i].hash()))throw Error('Market singleton identity mismatch');
  }
  const marketCode=verified&&config.atomic===true?atomicV2Codes.market:pinned.market_smt;
  if (live.cells[0].output.lock.code_hash.toLowerCase() !== marketCode || live.cells[0].output.lock.hash_type !== 'data1' || live.cells[2].output.lock.code_hash.toLowerCase() !== pinned.custody_smt || live.cells[2].output.lock.hash_type !== 'data1') throw Error('Market or custody script is not the pinned Gate 2 binary');
  if (live.custodyRoot.toLowerCase() !== p.old_root.toLowerCase()) throw Error('Stale custody proof');
  const cells = live.cells.map((cell,i) => {
    const transform = (s: {code_hash:string;hash_type:string;args:string}) => ({codeHash:s.code_hash,hashType:s.hash_type,args:s.args});
    return {outPoint:{txHash:points[i].tx_hash,index:points[i].index},capacity:BigInt(cell.output.capacity),lock:transform(cell.output.lock),type:cell.output.type ? transform(cell.output.type as {code_hash:string;hash_type:string;args:string}) : undefined,data:cell.data.content};
  });
  const amount = quote(live.curve,side,quantity);
  if(quotedAmount!==undefined&&amount!==quotedAmount)throw Error('The curve quote changed. Review the updated quote and try again.');
  const funding=pudge?await (earlyFunding||selectTradeFunding(rpc,ownerScript!,minimum(amount),hint)):await readFundingCell(rpc,config.funding,owner);
  mark('fundingMs');
  const witness=p.witness+(side==='sell'?le64(quantity)+le64(amount):'');
  // Pudge's genesis was checked by readLiveSingletons. Its secp dep group
  // is pinned and the trade hook checks dependency liveness before signing.
  let secpDepHash='0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37';
  if(!pudge||config.format==='brant-shared-pudge-market-v1'){
    const genesisBlock=await rpc('get_block_by_number',['0x0']) as {header:{hash:string};transactions:{hash:string}[]};
    if(genesisBlock?.header?.hash?.toLowerCase()!==config.genesis.toLowerCase()||!genesisBlock?.transactions?.[1]?.hash)throw Error('Wrong genesis or missing secp dependency');
    secpDepHash=genesisBlock.transactions[1].hash;
  }
  const deps:ccc.CellDepLike[] = [{outPoint:{txHash:secpDepHash,index:'0x0'},depType:'depGroup'},...['market_smt','marker_candidate','custody_smt','custody_marker','xudt'].map(n=>config.deps[n])];
  if (deps.some(x=>!x)) throw Error('Missing contract dependency');
  await Promise.all((verified?[]:Object.keys(pinned)).map(async name=>{
    const dep=ccc.CellDep.from(config.deps[name]);
    if (dep.depType !== 'code') throw Error('Invalid contract dependency type');
    const row=await rpc('get_live_cell',[{tx_hash:dep.outPoint.txHash,index:ccc.numToHex(dep.outPoint.index)},true]) as {status?:string;cell?:{data:{content:string}}};
    if(row.status !== 'live' || !row.cell || ccc.hashCkb(row.cell.data.content).toLowerCase() !== pinned[name]) throw Error(`Pinned ${name} deployment is unavailable`);
  }));
  mark('dependenciesMs');
  if (!/^(0|[1-9][0-9]*)$/.test(p.owner?.balance || '')) throw Error('Invalid recovered owner balance');
  const oldBalanceBytes = p.witness.slice(2 + 88, 2 + 104).match(/../g);
  if (!oldBalanceBytes || BigInt('0x' + oldBalanceBytes.reverse().join('')) !== BigInt(p.owner.balance)) throw Error('Proof owner balance mismatch');
  const fee=pudge?PUDGE_TRADE_FEE:100000n,inputs=[...cells,funding] as [Cell,Cell,Cell,Cell,Cell];
  const reviewed = buildReviewedTransaction({curve:live.curve,cells:inputs,custodyAmount:live.custodyAmount,newRoot:p.new_root,witness,fee,side,quantity},deps,config.genesis,owner);
  if(pudge){const placeholder=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(cccA.JsonRpcTransformers.transactionFrom(reviewed.transaction)));placeholder.witnesses[4]=ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex();const pool=await rpc('tx_pool_info',[]) as {min_fee_rate:string};const rate=BigInt(pool.min_fee_rate)*2n;if(rate<2000n||rate>200000n||placeholder.estimateFee(rate)>fee)throw Error('Trade fee is insufficient or outside review bounds');}
  mark('constructionAndFeesMs');
  return {...reviewed,inputs,live, ownerBalance:BigInt(p.owner.balance), nextOwnerBalance:BigInt(p.owner.balance)+(side === 'buy' ? quantity : -quantity)};
}

import { ccc } from '@ckb-ccc/core';
import { readLiveSingletons } from './live.ts';
import { readFundingCell } from './funding.ts';
import { buildReviewedTransaction } from './review.ts';
import { quote } from './curve.ts';
import type { Cell } from './transaction.ts';
import { discoverMarketPair, discoverCustodyPair } from './lineage.ts';

type Rpc = (method:string, params:unknown[]) => Promise<unknown>;
type Point = {tx_hash:string;index:string};
type Config = {genesis:string;initial:[Point,Point,Point,Point];funding:{txHash:string;index:string};deps:Record<string,ccc.CellDepLike>};
const le64 = (n:bigint) => Array.from({length:8},(_,i)=>Number((n >> BigInt(i*8)) & 255n).toString(16).padStart(2,'0')).join('');
const pinned:Record<string,string> = {
  market_smt:'0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770',
  marker_candidate:'0xd09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2',
  custody_smt:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',
  custody_marker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',
  xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95',
};
export async function prepareLocalReview(rpc:Rpc, config:Config, owner:string, side:'buy'|'sell', quantity:bigint) {
  const response = await fetch('/api/v2/proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({owner,side,quantity:quantity.toString()})});
  const body = await response.json();
  if (!response.ok) throw Error(body.error || 'Proof unavailable');
  const p = body.proof;
  if (body.genesis !== config.genesis || p.side !== side || p.quantity !== quantity.toString() || !p.tip_outpoint) throw Error('Proof identity mismatch');
  const [market, custody] = await Promise.all([discoverMarketPair(rpc,[config.initial[0],config.initial[1]]),discoverCustodyPair(rpc,p.tip_outpoint)]);
  const points:[Point,Point,Point,Point] = [...market,...custody];
  const live = await readLiveSingletons(rpc,points,config.genesis);
  if (live.cells[0].output.lock.code_hash.toLowerCase() !== pinned.market_smt || live.cells[0].output.lock.hash_type !== 'data1' || live.cells[2].output.lock.code_hash.toLowerCase() !== pinned.custody_smt || live.cells[2].output.lock.hash_type !== 'data1') throw Error('Market or custody script is not the pinned Gate 2 binary');
  if (live.custodyRoot.toLowerCase() !== p.old_root.toLowerCase()) throw Error('Stale custody proof');
  const funding = await readFundingCell(rpc,config.funding,owner);
  const cells = live.cells.map((cell,i) => {
    const transform = (s: {code_hash:string;hash_type:string;args:string}) => ({codeHash:s.code_hash,hashType:s.hash_type,args:s.args});
    return {outPoint:{txHash:points[i].tx_hash,index:points[i].index},capacity:BigInt(cell.output.capacity),lock:transform(cell.output.lock),type:cell.output.type ? transform(cell.output.type as {code_hash:string;hash_type:string;args:string}) : undefined,data:cell.data.content};
  });
  const amount = quote(live.curve,side,quantity);
  const witness = p.witness + (side === 'sell' ? le64(quantity)+le64(amount) : '');
  const genesisBlock = await rpc('get_block_by_number',['0x0']) as {header:{hash:string};transactions:{hash:string}[]};
  if (genesisBlock?.header?.hash?.toLowerCase() !== config.genesis.toLowerCase() || !genesisBlock?.transactions?.[1]?.hash) throw Error('Wrong genesis or missing secp dependency');
  const deps:ccc.CellDepLike[] = [{outPoint:{txHash:genesisBlock.transactions[1].hash,index:'0x0'},depType:'depGroup'},...['market_smt','marker_candidate','custody_smt','custody_marker','xudt'].map(n=>config.deps[n])];
  if (deps.some(x=>!x)) throw Error('Missing contract dependency');
  for (const name of Object.keys(pinned)) {
    const dep=ccc.CellDep.from(config.deps[name]);
    if (dep.depType !== 'code') throw Error('Invalid contract dependency type');
    const row=await rpc('get_live_cell',[{tx_hash:dep.outPoint.txHash,index:ccc.numToHex(dep.outPoint.index)},true]) as {status?:string;cell?:{data:{content:string}}};
    if(row.status !== 'live' || !row.cell || ccc.hashCkb(row.cell.data.content).toLowerCase() !== pinned[name]) throw Error(`Pinned ${name} deployment is unavailable`);
  }
  if (!/^(0|[1-9][0-9]*)$/.test(p.owner?.balance || '')) throw Error('Invalid recovered owner balance');
  const oldBalanceBytes = p.witness.slice(2 + 88, 2 + 104).match(/../g);
  if (!oldBalanceBytes || BigInt('0x' + oldBalanceBytes.reverse().join('')) !== BigInt(p.owner.balance)) throw Error('Proof owner balance mismatch');
  const reviewed = buildReviewedTransaction({curve:live.curve,cells:[...cells,funding] as [Cell,Cell,Cell,Cell,Cell],custodyAmount:live.custodyAmount,newRoot:p.new_root,witness,fee:100000n,side,quantity},deps,config.genesis,owner);
  return {...reviewed, ownerBalance:BigInt(p.owner.balance), nextOwnerBalance:BigInt(p.owner.balance)+(side === 'buy' ? quantity : -quantity)};
}

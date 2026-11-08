import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {verifyPudgeWitness} from './pudge-wallet-verify.ts';

// Dependencies are provided by trusted server code, never by a request.
export interface DeploymentDependencies {
 rpc(method:string, params:unknown[]):Promise<any>;
 genesis:string; network:string;
 owner:{codeHash:string;hashType:'type';args:string};
 funding:{txHash:string;index:number;capacity:bigint};
 dependency:{txHash:string;index:number};
 code:()=>Promise<Uint8Array>; codeHash:string; codeLength:number; codeCapacity:bigint;
 journal:{reserve(funding:string,hash:string):void; has(hash:string):boolean};
 manifest:{write(value:unknown):Promise<void>};
 broadcastAuthorized:()=>boolean;
}

export function createDeploymentService(d:DeploymentDependencies) {
 const input={tx_hash:d.funding.txHash,index:'0x'+d.funding.index.toString(16)};
 const dependency={tx_hash:d.dependency.txHash,index:'0x'+d.dependency.index.toString(16)};
 const fundingKey=`${d.funding.txHash}:${d.funding.index}`;
 async function review() {
  const [genesis,cell,dep,pool,code]=await Promise.all([d.rpc('get_block_by_number',['0x0']),d.rpc('get_live_cell',[input,true]),d.rpc('get_live_cell',[dependency,true]),d.rpc('tx_pool_info',[]),d.code()]);
  if(genesis?.header?.hash!==d.genesis||cell?.status!=='live'||dep?.status!=='live')throw Error('Wrong network or unavailable input/dependency');
  const o=cell.cell.output;
  if(o.lock.code_hash!==d.owner.codeHash||o.lock.hash_type!==d.owner.hashType||o.lock.args!==d.owner.args||o.type||cell.cell.data.content!=='0x'||BigInt(o.capacity)!==d.funding.capacity)throw Error('Funding cell differs from review');
  const data=ccc.hexFrom(code);if(code.length!==d.codeLength||ccc.hashCkb(data)!==d.codeHash)throw Error('R7 binary mismatch');
  const rate=BigInt(pool.min_fee_rate)*2n;if(rate<2000n||rate>200000n)throw Error('Fee rate outside review bounds');
  const make=(fee:bigint)=>ccc.Transaction.from({inputs:[{previousOutput:{txHash:d.funding.txHash,index:d.funding.index}}],outputs:[{capacity:d.codeCapacity,lock:d.owner},{capacity:d.funding.capacity-d.codeCapacity-fee,lock:d.owner}],outputsData:[data,'0x'],cellDeps:[{outPoint:d.dependency,depType:'depGroup'}],witnesses:[ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex()]});
  const size=BigInt(make(0n).toBytes().length),fee=(size*rate+999n)/1000n,change=d.funding.capacity-d.codeCapacity-fee;
  if(change<6100000000n)throw Error('Insufficient change');const tx=make(fee);
  return {genesis:genesis.header.hash,codeHash:d.codeHash,codeBytes:code.length,feeRate:rate.toString(),fee:fee.toString(),size:size.toString(),input:d.funding.capacity.toString(),capacity:d.codeCapacity.toString(),change:change.toString(),hash:tx.hash(),transaction:JSON.parse(JSON.stringify(tx,(_,v)=>typeof v==='bigint'?v.toString():v))};
 }
 async function broadcast(body:string) {
  if(!d.broadcastAuthorized())throw Error('Broadcast disabled');
  if(body.length>250000)throw Error('Request too large');const tx=ccc.Transaction.from(JSON.parse(body));
  const fresh=await review();if(tx.hash()!==fresh.hash)throw Error('Input, fee or transaction changed; review again');
  verifyPudgeWitness(tx,fresh.hash,d.owner.args);
  d.journal.reserve(fundingKey,fresh.hash);
  let result:unknown;try{result=await d.rpc('send_transaction',[cccA.JsonRpcTransformers.transactionFrom(tx),'passthrough'])}catch{throw Error('Submission outcome requires reconciliation for '+fresh.hash)}
  if(result!==fresh.hash)throw Error('Submission outcome requires reconciliation for '+fresh.hash);
  return {hash:fresh.hash,status:'submitted'};
 }
 async function verify(hash:string) {
  if(!/^0x[0-9a-f]{64}$/.test(hash))throw Error('Invalid hash');if(!d.journal.has(hash))throw Error('Not a recorded deployment attempt');
  const [genesis,t]=await Promise.all([d.rpc('get_block_by_number',['0x0']),d.rpc('get_transaction',[hash])]);
  if(genesis?.header?.hash!==d.genesis)throw Error('Wrong network');const status=t?.tx_status?.status||'unknown';if(status!=='committed')return {status};
  if(!t.transaction||ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(t.transaction)).hash()!==hash)throw Error('Committed transaction hash mismatch');
  const [live,code]=await Promise.all([d.rpc('get_live_cell',[{tx_hash:hash,index:'0x0'},true]),d.code()]);
  const o=live.cell?.output,data=live.cell?.data?.content;
  if(code.length!==d.codeLength||live.status!=='live'||data!==ccc.hexFrom(code)||ccc.hashCkb(data)!==d.codeHash||BigInt(o?.capacity||0)!==d.codeCapacity||o?.lock?.code_hash!==d.owner.codeHash||o.lock.hash_type!==d.owner.hashType||o.lock.args!==d.owner.args||o.type)throw Error('Committed output differs from reviewed R7 code cell');
  const change=t.transaction.outputs?.[1];if(t.transaction.outputs.length!==2||!change||JSON.stringify(change.lock)!==JSON.stringify(o.lock)||change.type||t.transaction.outputs_data?.[1]!=='0x'||BigInt(change.capacity)<6100000000n)throw Error('Committed change output mismatch');
  const manifest={network:d.network,genesis:genesis.header.hash,codeHash:d.codeHash,outPoint:{txHash:hash,index:'0x0'}};await d.manifest.write(manifest);return {status:'verified',manifest};
 }
 return {review,broadcast,verify};
}

import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {openAtomicLaunchDelivery} from './atomic-launch-delivery.ts';
import {atomicV2Codes} from './atomic-launch-v2.ts';
import {marketNetwork} from './market-network-server.ts';
type Rpc=Parameters<typeof openAtomicLaunchDelivery>[1];
export async function getAtomicCatalogMarket(rpc:Rpc,market:string){
 const file=process.env.BRANT_LAUNCH_SQLITE_PATH;if(!file)return null;
 const store=openAtomicLaunchDelivery(file,rpc);
 try{
  const hint=store.candidate(market);if(!hint||hint.genesis!==marketNetwork().genesis)return null;
  const publication=await store.readPublished(market,hint.owner);
  const tx=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(hint.signed as never));
  const w=ccc.bytesFrom(tx.getWitnessArgs(0)!.outputType!);const view=new DataView(w.buffer,w.byteOffset,w.byteLength);
  const owner=ccc.Script.fromBytes(w.slice(view.getUint32(4,true),view.getUint32(8,true)));
  const scripts={market:tx.outputs[0].lock,marker:tx.outputs[1].type!,owner,token:tx.outputs[0].type!,custody:tx.outputs[2].lock,custodyMarker:tx.outputs[3].type!,markerData:tx.outputsData[1],custodyMarkerData:tx.outputsData[3]};
  for(const name of ['market','marker','custody','custodyMarker','token','owner'] as const){const code=name==='token'?'xudt':name==='owner'?'initializer':name;if(scripts[name].codeHash!==atomicV2Codes[code])throw Error('Unqualified atomic catalog identity');}
  if(scripts.token.args!==owner.hash()||scripts.market.hash()!==market)throw Error('Atomic catalog binding differs');
  const byCode=(name:keyof typeof atomicV2Codes)=>{const dep=hint.dependencies.find(d=>d.dataHash===atomicV2Codes[name]);if(!dep)throw Error('Atomic dependency is missing');return dep;};
  const secpPoint=tx.cellDeps.find(d=>d.depType==='depGroup')?.outPoint;
  const secp=hint.dependencies.find(d=>secpPoint&&d.outPoint.txHash===secpPoint.txHash&&BigInt(d.outPoint.index)===secpPoint.index);if(!secp)throw Error('Atomic secp dependency is missing');
  const codeDependencies={market:byCode('market'),marker:byCode('marker'),ownerLock:byCode('initializer'),custody:byCode('custody'),custodyMarker:byCode('custodyMarker'),xudt:byCode('xudt'),secp};
  const receipt=publication.receipt;
  const receipts=[{stage:'atomic',state:'confirmed',txHash:receipt.txHash,blockHash:receipt.blockHash}];
  const execution={family:'atomic' as const,genesis:hint.genesis,marketScriptHash:market,routeId:market,creatorLockHash:hint.owner,tokenTypeHash:publication.token,scripts,stages:{purchase:{txHash:receipt.txHash,blockHash:receipt.blockHash}},dependencies:tx.cellDeps,codeDependencies,initial:[0,1,2,3].map(index=>({tx_hash:tx.hash(),index:'0x'+index.toString(16)})),issuanceCapacityFloor:'30000000000',metadata:publication.metadata};
  return {market,genesis:hint.genesis,token:publication.token,owner:hint.owner,metadata:publication.metadata,receipts,execution,logo:publication.metadata.logoHash?'/api/v2/launch/logo?market='+market:null};
 }finally{store.close();}
}
export async function listAtomicCatalog(rpc:Rpc,after:string){
 const file=process.env.BRANT_LAUNCH_SQLITE_PATH;if(!file)return {markets:[],next:null};
 const store=openAtomicLaunchDelivery(file,rpc);let rows:string[];
 try{rows=store.candidates(marketNetwork().genesis,after);}finally{store.close();}
 const results=await Promise.allSettled(rows.slice(0,4).map(m=>getAtomicCatalogMarket(rpc,m)));
 return {markets:results.flatMap(r=>{if(r.status!=='fulfilled'||!r.value)return [];const {execution,...publicMarket}=r.value;return [publicMarket];}),next:rows.length===5?rows[3]:null};
}

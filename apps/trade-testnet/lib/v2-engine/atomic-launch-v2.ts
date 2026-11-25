import {ccc} from '@ckb-ccc/core';
import {verifyInitializationLive} from './initialization-live.ts';
import {verifyInitializationSignature} from './initialization-signature.ts';
import {normalizeLaunchMetadata} from './launch-metadata.ts';
import {PUDGE_GATE2_GENESIS} from './pudge-public-registry.ts';

type Rpc = Parameters<typeof verifyInitializationLive>[0];
type Cell = Parameters<typeof verifyInitializationLive>[2][number];
type Dependency = Parameters<typeof verifyInitializationLive>[3][number] & {depType?: 'code' | 'depGroup'};
const unit = 100_000_000n;
// Qualified family. Public use additionally requires pinned operator configuration and restricted creator authorization.
export const atomicV2Codes = {
  market: '0xb5ca7369dba433a13801ccb23ca64d586897010afac1eff04aa691829edd59a9',
  marker: '0xd09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2',
  custody: '0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',
  custodyMarker: '0x2cb3516cf108c85e8f836bdf44d1c035c5bd9ff110bc5b0e8cd439d364cffd96',
  initializer: '0xaef09c5c6565ccc6bc4c1878fb97014df9f185fe1c84aa4093e8f216607ba4d7',
  xudt: '0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95',
} as const;
const le=(value:bigint,size=8)=>ccc.numLeToBytes(value,size);
const concat=(...parts:ccc.BytesLike[])=>ccc.bytesConcat(...parts);
const table=(fields:ccc.Hex[])=>{
  let offset=4*(fields.length+1);
  const offsets=fields.map(field=>{const at=offset;offset+=ccc.bytesFrom(field).length;return le(BigInt(at),4);});
  return ccc.hexFrom(concat(le(BigInt(offset),4),...offsets,...fields));
};
export async function planAtomicLaunchV2(rpc:Rpc,request:{
  isolatedDevelopment?:true; publicQualification?:true; metadata:unknown; genesis:string; anchor:Cell; funding:Cell[]; supply:bigint; base:bigint; step:bigint; quantity:bigint; fee:bigint;
  dependencies:Record<keyof typeof atomicV2Codes | 'secp',Dependency>;
  proof:(domain:{genesis_hash:string;market_script_hash:string;xudt_type_script_hash:string;custody_marker_type_hash:string},owner:string,quantity:bigint,price:bigint)=>Promise<{witness:string;newRoot:string}>;
}){
  const anchor={...request.anchor,lock:ccc.Script.from(request.anchor.lock).clone(),outPoint:{...request.anchor.outPoint}};
  const {genesis,quantity,fee,supply,base,step}=request;
  const inputs=[anchor,...request.funding.map(c=>({...c,lock:ccc.Script.from(c.lock).clone(),outPoint:{...c.outPoint}}))];
  if(!/^0x[0-9a-f]{64}$/.test(genesis)||
    (genesis===PUDGE_GATE2_GENESIS ? request.isolatedDevelopment===true||request.publicQualification!==true : request.isolatedDevelopment!==true||Boolean(request.publicQualification)))throw Error('Atomic qualification network/creator is not authorized');
  const owner=ccc.Script.from(anchor.lock);
  if(owner.codeHash!=='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'||owner.hashType!=='type'||!/^0x[0-9a-f]{40}$/.test(owner.args)||anchor.type||anchor.data!=='0x')throw Error('Unsupported atomic creator input');
  if(quantity<=0n||quantity>=supply||supply>0xffffffffn||base<=0n||step<=0n||base>0xffffffffffffffffn||step>0xffffffffffffffffn||fee<=0n||fee>1_000_000n)throw Error('Invalid atomic launch terms');
  if(inputs.length>64||inputs.some(c=>c.type||c.data!=='0x'||!owner.eq(c.lock))||new Set(inputs.map(c=>`${c.outPoint.txHash}:${BigInt(c.outPoint.index)}`)).size!==inputs.length)throw Error('Invalid atomic funding group');
  const dependencies=structuredClone(request.dependencies);
  for(const name of Object.keys(atomicV2Codes) as (keyof typeof atomicV2Codes)[]){if(dependencies[name]?.dataHash!==atomicV2Codes[name])throw Error('Unqualified atomic dependency');}
  const allDeps=Object.values(dependencies);
  if(new Set(allDeps.map(d=>`${d.outPoint.txHash}:${BigInt(d.outPoint.index)}`)).size!==allDeps.length||allDeps.some(d=>inputs.some(c=>d.outPoint.txHash===c.outPoint.txHash&&BigInt(d.outPoint.index)===BigInt(c.outPoint.index))))throw Error('Conflicting atomic inputs/dependencies');
  await verifyInitializationLive(rpc,genesis,inputs,allDeps);
  const script=(code:keyof typeof atomicV2Codes,args:ccc.BytesLike)=>ccc.Script.from({codeHash:atomicV2Codes[code],hashType:'data1',args:ccc.hexFrom(args)});
  const ab=concat(anchor.outPoint.txHash,le(BigInt(anchor.outPoint.index),4));
  const marker=script('marker',ccc.hashCkb(concat(le(0n),ab,le(1n))));
  const market=script('market',concat(ccc.hashCkb(ab),le(base),le(step),le(supply),marker.hash()));
  const issuer=script('initializer',concat(ab,market.hash(),le(supply),le(300n*unit)));
  const token=script('xudt',issuer.hash()),custodyMarker=script('custodyMarker',market.hash());
  const custody=script('custody',concat(market.hash(),token.hash(),genesis,custodyMarker.hash()));
  const price=base*quantity+step*quantity*(quantity-1n)/2n;
  if(price>0xffffffffffffffffn-300n*unit)throw Error('Atomic price exceeds capacity range');
  const proof=await request.proof({genesis_hash:genesis,market_script_hash:market.hash(),xudt_type_script_hash:token.hash(),custody_marker_type_hash:custodyMarker.hash()},owner.hash(),quantity,price);
  if(!/^0x[0-9a-f]{64}$/.test(proof.newRoot))throw Error('Invalid atomic proof root');
  const change=inputs.reduce((n,c)=>n+c.capacity,0n)-1300n*unit-price-fee;
  const outputs=[{capacity:300n*unit+price,lock:market,type:token},{capacity:300n*unit,lock:market,type:marker},{capacity:350n*unit,lock:custody,type:token},{capacity:350n*unit,lock:custody,type:custodyMarker},{capacity:change,lock:owner}];
  const outputsData=[ccc.hexFrom(concat(le(supply-quantity,16),custodyMarker.hash())),ccc.hexFrom(concat(market.hash(),token.hash())),ccc.hexFrom(concat(le(quantity,16),proof.newRoot)),ccc.hexFrom(concat(custody.hash(),token.hash())),'0x'];
  for(let i=0;i<outputs.length;i++)if(outputs[i].capacity<BigInt(ccc.CellOutput.from(outputs[i]).occupiedSize+ccc.bytesFrom(outputsData[i]).length)*unit)throw Error('Insufficient atomic funding');
  const metadata=normalizeLaunchMetadata(request.metadata);
  const authorization={version:1,kind:'brant-atomic-metadata',genesis,market:market.hash(),owner:owner.hash(),metadata};
  const metadataWitness=ccc.hexFrom(new TextEncoder().encode(JSON.stringify(authorization)));
  const transaction=ccc.Transaction.from({inputs:inputs.map(c=>({previousOutput:c.outPoint,since:0n})),outputs,outputsData,headerDeps:[genesis],cellDeps:allDeps.map(d=>({outPoint:d.outPoint,depType:d.depType||'code'})),witnesses:[ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65),outputType:table([issuer.toHex(),'0x','0x','0x04000000'])}).toHex(),...inputs.slice(1).map(()=>'0x'),proof.witness,metadataWitness]});
  return {
    transaction:transaction.clone(),authorization,scripts:{market,marker,issuer,token,custody,custodyMarker},
    accounting:{supply,base,step,inventory:supply-quantity,custody:quantity,reserve:price,marketFloor:300n*unit,fee,change},
    async prepare(){await verifyInitializationLive(rpc,genesis,inputs,allDeps);return transaction.clone();},
    async verifySigned(signed:ccc.Transaction){verifyInitializationSignature(transaction,signed,inputs,0,owner.hash());await verifyInitializationLive(rpc,genesis,inputs,allDeps);return signed.clone();},
  };
}

/** The original standard-secp transaction signature authorizes this exact
 * metadata witness. Call only with canonically recovered creator inputs. */
export function verifyAtomicMetadataAuthorization(signed:ccc.Transaction,inputs:Cell[],scope:{genesis:string;market:string;owner:string}){
  const raw=signed.witnesses.at(-1);
  if(!raw||ccc.bytesFrom(raw).length>8192)throw Error('Missing atomic metadata authorization');
  const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(ccc.bytesFrom(raw)));
  const metadata=normalizeLaunchMetadata(payload.metadata);
  const expected={version:1,kind:'brant-atomic-metadata',genesis:scope.genesis,market:scope.market,owner:scope.owner,metadata};
  if(JSON.stringify(payload)!==JSON.stringify(expected)||signed.headerDeps[0]!==scope.genesis||signed.outputs[0].lock.hash()!==scope.market||inputs.some(c=>ccc.Script.from(c.lock).hash()!==scope.owner))throw Error('Atomic publication identity differs');
  const reviewed=signed.clone(),w=reviewed.getWitnessArgs(0);
  reviewed.setWitnessArgsAt(0,{...w,lock:'0x'+'00'.repeat(65)});
  verifyInitializationSignature(reviewed,signed,inputs,0,scope.owner);
  return metadata;
}

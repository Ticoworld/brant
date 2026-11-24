import {atomicV2Codes} from './atomic-launch-v2.ts';
import {sharedLaunchDependencies} from './shared-launch.ts';
import {PUDGE_GATE2_GENESIS} from './pudge-public-registry.ts';

type Base=NonNullable<Parameters<typeof sharedLaunchDependencies>[1]>;
type Dependencies={[K in keyof Base]:Base[K]&{depType:'code'|'depGroup'}};
const hash=/^0x[0-9a-f]{64}$/;
/** Operator-owned configuration, never request input. Draft/null identities fail closed. */
export function parseAtomicPudgeConfig(text:string,approvedCreator:string|undefined) {
 const value=JSON.parse(text);
 if(value.version!==1||value.genesis!==PUDGE_GATE2_GENESIS||!approvedCreator||!hash.test(approvedCreator)||value.creator!==approvedCreator||
    !hash.test(value.deployment?.txHash)||!hash.test(value.deployment?.blockHash))throw Error('Atomic Pudge qualification identity unavailable');
 const deps=value.dependencies as Dependencies;
 const legacy=sharedLaunchDependencies(PUDGE_GATE2_GENESIS);
 const expected={...atomicV2Codes,ownerLock:atomicV2Codes.initializer};
 const names=['market','marker','custody','custodyMarker','ownerLock','xudt','secp'] as const;
 if(!deps||names.some(name=>!hash.test(deps[name]?.outPoint?.txHash)||!/^0x[0-9a-f]+$/.test(deps[name]?.outPoint?.index)||
   deps[name].dataHash!==(name==='secp'?legacy.secp.dataHash:expected[name])||deps[name].depType!==(name==='secp'?'depGroup':'code'))||
   new Set(names.map(name=>`${deps[name].outPoint.txHash}:${BigInt(deps[name].outPoint.index)}`)).size!==7)throw Error('Unqualified atomic Pudge dependencies');
 for(const name of ['secp','xudt','custody','marker'] as const){if(JSON.stringify(deps[name].outPoint)!==JSON.stringify(legacy[name].outPoint))throw Error('Atomic Pudge shared dependency differs');}
 for(const [name,index] of [['market',0],['custodyMarker',1],['ownerLock',2]] as const){
  if(deps[name].outPoint.txHash!==value.deployment.txHash||BigInt(deps[name].outPoint.index)!==BigInt(index))throw Error('Atomic deployment output differs');
 }
 return {dependencies:structuredClone(deps),deployment:{txHash:String(value.deployment.txHash),blockHash:String(value.deployment.blockHash)}};
}

export async function verifyAtomicPudgeDeployment(rpc:(method:string,params:unknown[])=>Promise<unknown>,receipt:{txHash:string;blockHash:string}){
 const tx=await rpc('get_transaction',[receipt.txHash]) as {tx_status?:{status:string;block_hash:string;block_number:string}};
 if(tx?.tx_status?.status!=='committed'||tx.tx_status.block_hash!==receipt.blockHash||await rpc('get_block_hash',[tx.tx_status.block_number])!==receipt.blockHash)throw Error('Atomic Pudge deployment is not canonical');
}

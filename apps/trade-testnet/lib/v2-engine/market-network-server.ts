import {parseAtomicPudgeConfig} from './atomic-pudge-config.ts';
import {readFileSync} from 'node:fs';
import {PUDGE_GATE2_GENESIS} from './pudge-public-registry.ts';
import {sharedLaunchDependencies} from './shared-launch.ts';

type Fixture=NonNullable<Parameters<typeof sharedLaunchDependencies>[1]>;
/** Trusted process configuration only. Never accept network overrides in HTTP input. */
export function marketNetwork(){
  const file=process.env.BRANT_ISOLATED_CONFIG;
  if(!file){
    const enabled=process.env.BRANT_ATOMIC_PUDGE_QUALIFICATION==='1';
    const manifest=process.env.BRANT_ATOMIC_PUDGE_MANIFEST;
    if(enabled&&!manifest)throw Error('Atomic Pudge manifest unavailable');
    const parsed=manifest?parseAtomicPudgeConfig(readFileSync(manifest!,'utf8'),process.env.BRANT_LAUNCH_APPROVED_CREATOR):undefined;
    return {genesis:PUDGE_GATE2_GENESIS,endpoint:'https://testnet.ckb.dev/',fixture:undefined as Fixture|undefined,atomic:parsed?.dependencies,atomicReceipt:parsed?.deployment};
  }
  if(process.env.NODE_ENV==='production'||process.env.BRANT_ISOLATED_TEST!=='1')throw Error('Isolated network overrides are disabled');
  const value=JSON.parse(readFileSync(file,'utf8')) as {genesis:string;endpoint:string;fixture:Fixture};
  const url=new URL(value.endpoint);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||
    !/^0x[0-9a-f]{64}$/.test(value.genesis)||value.genesis===PUDGE_GATE2_GENESIS)throw Error('Invalid isolated network configuration');
  const fixture=sharedLaunchDependencies(value.genesis,value.fixture);
  if(process.env.BRANT_ATOMIC_PUDGE_QUALIFICATION==='1')throw Error('Conflicting atomic network configuration');
  return {genesis:value.genesis,endpoint:url.toString(),fixture,atomic:undefined as Fixture|undefined,atomicReceipt:undefined as {txHash:string;blockHash:string}|undefined};
}

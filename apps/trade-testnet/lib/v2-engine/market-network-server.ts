import {readFileSync} from 'node:fs';
import {PUDGE_GATE2_GENESIS} from './pudge-public-registry.ts';
import {sharedLaunchDependencies} from './shared-launch.ts';

type Fixture=NonNullable<Parameters<typeof sharedLaunchDependencies>[1]>;
/** Trusted process configuration only. Never accept network overrides in HTTP input. */
export function marketNetwork(){
  const file=process.env.BRANT_ISOLATED_CONFIG;
  if(!file)return {genesis:PUDGE_GATE2_GENESIS,endpoint:'https://testnet.ckb.dev/',fixture:undefined as Fixture|undefined};
  if(process.env.NODE_ENV==='production'||process.env.BRANT_ISOLATED_TEST!=='1')throw Error('Isolated network overrides are disabled');
  const value=JSON.parse(readFileSync(file,'utf8')) as {genesis:string;endpoint:string;fixture:Fixture};
  const url=new URL(value.endpoint);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash||
    !/^0x[0-9a-f]{64}$/.test(value.genesis)||value.genesis===PUDGE_GATE2_GENESIS)throw Error('Invalid isolated network configuration');
  const fixture=sharedLaunchDependencies(value.genesis,value.fixture);
  return {genesis:value.genesis,endpoint:url.toString(),fixture};
}

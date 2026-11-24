const isolatedGenesis=process.env.NEXT_PUBLIC_BRANT_ISOLATED_GENESIS;
if(isolatedGenesis&&(process.env.NODE_ENV==='production'||process.env.NEXT_PUBLIC_BRANT_ISOLATED_TEST!=='1'||!/^0x[0-9a-f]{64}$/.test(isolatedGenesis)))throw Error('Isolated client configuration is disabled');
const publicGenesis='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
export const PUDGE_GENESIS=isolatedGenesis||publicGenesis;
const SECP_CODE='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8';

export type RpcScript={code_hash:string;hash_type:string;args:string};
export type RpcCell={out_point:{tx_hash:string;index:string};output:{capacity:string;lock:RpcScript;type?:RpcScript|null};output_data?:string};
export type PudgeRead={method:string;params:unknown[]};

export async function pudgeReadBatch(calls:PudgeRead[]){
  const response=await fetch('/api/v2/pudge-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(calls),cache:'no-store',signal:AbortSignal.timeout(17000)});
  const body=await response.json();
  if(!response.ok||!Array.isArray(body.result)||body.result.length!==calls.length)throw Error(body.error||'Pudge RPC batch unavailable');
  return body.result as unknown[];
}

export async function pudgeRpc<T=any>(method:string,params:unknown[]=[]):Promise<T>{
  const response=await fetch('/api/v2/pudge-rpc',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method,params}),cache:'no-store'});
  const body=await response.json();if(!response.ok)throw Error(body.error||'Pudge RPC unavailable');return body.result as T;
}

export function supportedLock(script:{codeHash:string;hashType:string;args:string}){
  return script.codeHash.toLowerCase()===SECP_CODE&&script.hashType==='type'&&/^0x[0-9a-f]{40}$/i.test(script.args);
}

export function formatCkb(shannons:bigint|string,maximumFractionDigits=8){
  const value=BigInt(shannons),negative=value<0n,absolute=negative?-value:value;
  const whole=absolute/100_000_000n,fraction=(absolute%100_000_000n).toString().padStart(8,'0').slice(0,maximumFractionDigits).replace(/0+$/,'');
  return `${negative?'-':''}${whole.toLocaleString('en-US')}${fraction?`.${fraction}`:''}`;
}

export function parseCkb(value:string){
  if(!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{0,8})?$/.test(value))throw Error('Enter a CKB amount with up to 8 decimal places');
  const [whole,fraction='']=value.split('.');return BigInt(whole)*100_000_000n+BigInt(fraction.padEnd(8,'0'));
}

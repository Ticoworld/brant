import {atomicLaunchOperations} from '../../../../../lib/v2-engine/atomic-launch-operations';
import {atomicV2Codes} from '../../../../../lib/v2-engine/atomic-launch-v2';
import {cccA} from '@ckb-ccc/core/advanced';
import {launchOperations} from '../../../../../lib/v2-engine/launch-operations-server';
import {generatePudgeLaunchProof} from '../../../../../lib/v2-engine/pudge-launch-proof-server';
import {openConfiguredSharedLaunchStore} from '../../../../../lib/v2-engine/shared-launch-store';
import {PUDGE_GATE2_ANCHOR, PUDGE_GATE2_GENESIS} from '../../../../../lib/v2-engine/pudge-public-registry';
import {marketNetwork} from '../../../../../lib/v2-engine/market-network-server';
import {LaunchPublicationError,publicationRecovery} from '../../../../../lib/v2-engine/launch-publication-errors';

export const runtime = 'nodejs';

const rpc = async (method: string, params: unknown[]) => {
  const response = await fetch(marketNetwork().endpoint, {method: 'POST', cache: 'no-store',
    headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
  const data = await response.json();
  if (!response.ok || data.error || !Object.hasOwn(data, 'result')) throw Error('Pudge RPC failed');
  return data.result;
};
const approvedCreator = process.env.BRANT_LAUNCH_APPROVED_CREATOR;
const launchWritesEnabled = process.env.BRANT_LAUNCH_WRITES === '1' &&
  typeof approvedCreator === 'string' && /^0x[0-9a-f]{64}$/.test(approvedCreator);
const network=marketNetwork();
const legacyOperate = launchOperations({rpc, genesis: network.genesis, fixture:network.fixture, excludedAnchor: network.fixture?undefined:PUDGE_GATE2_ANCHOR,
  quantity: 7n, proof: generatePudgeLaunchProof, openStore: openConfiguredSharedLaunchStore,
  authorizeCreator: owner => owner === approvedCreator,
  send: launchWritesEnabled ? async transaction => {
    if (await rpc('get_block_hash', ['0x0']) !== network.genesis) throw Error('Wrong launch genesis');
    return rpc('send_transaction', [cccA.JsonRpcTransformers.transactionFrom(transaction)]);
  } : undefined,
});
const atomicOperate=network.fixture?.market.dataHash===atomicV2Codes.market?atomicLaunchOperations(rpc,network,launchWritesEnabled?async transaction=>rpc('send_transaction',[cccA.JsonRpcTransformers.transactionFrom(transaction),'passthrough']):undefined,owner=>owner===approvedCreator):undefined;
const operate=async(action:string,input:Record<string,unknown>,timing?:(name:string,ms:number)=>void):Promise<unknown>=>{
 if(!atomicOperate||action==='normalize-logo')return legacyOperate(action,input,timing);
 if(action==='sessions'){const [atomic,legacy]=await Promise.all([atomicOperate(action,input,timing),legacyOperate(action,input,timing)]);return [...atomic as unknown[],...legacy as unknown[]];}
 const result=await atomicOperate(action,input,timing);return result===null?legacyOperate(action,input,timing):result;
};
let active = 0;
const preparing = new Map<string, Promise<{result: unknown; serverTiming: string}>>();

async function measuredOperation(action: string, input: Record<string, unknown>) {
  const samples = new Map<string, {count: number; ms: number}>();
  const result = await operate(action, input, (name, ms) => {
    const sample = samples.get(name) ?? {count: 0, ms: 0};
    sample.count++;
    sample.ms += ms;
    samples.set(name, sample);
  });
  const serverTiming = Array.from(samples, ([name, {count, ms}]) =>
    `${name};dur=${ms.toFixed(1)};desc="${count}"`).join(', ');
  return {result, serverTiming};
}

function runOperation(action: string, input: Record<string, unknown>) {
  if (action !== 'prepare') return measuredOperation(action, input);
  const lock = input.creator as {codeHash?: string; hashType?: string; args?: string} | undefined;
  if (typeof lock?.codeHash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(lock.codeHash) ||
      lock.hashType !== 'type' || typeof lock.args !== 'string' || !/^0x[0-9a-f]{40}$/i.test(lock.args)) {
    return measuredOperation(action, input);
  }
  const key = JSON.stringify(input);
  const existing = preparing.get(key);
  if (existing) return existing;
  const pending = measuredOperation(action, input).finally(() => preparing.delete(key));
  preparing.set(key, pending);
  return pending;
}

export async function POST(request: Request, context: {params: Promise<{action: string}>}) {
  const diagnosticId=crypto.randomUUID();
  const origin = process.env.BRANT_LAUNCH_PROOF_ORIGIN;
  if (!origin || request.headers.get('origin') !== origin || request.headers.get('host') !== new URL(origin).host ||
      (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) {
    return new Response(null, {status: 403});
  }
  const {action} = await context.params;
  if (!['prepare','submit','resubmit','pending-review','session','sessions','publish','retry-publication','normalize-logo','next-stage','reconcile'].includes(action)) return new Response(null, {status: 404});
  if (['submit','resubmit'].includes(action) && !launchWritesEnabled) return Response.json({error: 'Launch execution is disabled'}, {status: 403});
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return new Response(null, {status: 415});
  if (active >= 2) return new Response(null, {status: 429});
  active++;
  const reader = request.body?.getReader();
  const timer = setTimeout(() => { void reader?.cancel().catch(() => {}); }, 3000);
  try {
    if (!reader) return new Response(null, {status: 400});
    let body = '';
    let size = 0;
    const decoder = new TextDecoder('utf-8', {fatal: true});
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) return new Response(null, {status: 413});
      body += decoder.decode(value, {stream: true});
    }
    clearTimeout(timer);
    const input = JSON.parse(body + decoder.decode());
    if (!input || typeof input !== 'object' || Array.isArray(input)) return new Response(null, {status: 400});
    if (action === 'submit' && input.owner !== approvedCreator) {
      return Response.json({error: 'Creator is not approved for launch'}, {status: 403});
    }
    const {result, serverTiming} = await runOperation(action, input);
    return Response.json(result, {headers: {'Cache-Control': 'no-store', 'Server-Timing': serverTiming}});
  } catch(error) {
    if(error instanceof LaunchPublicationError){
      console.warn('Brant publication rejected',{code:error.code,diagnosticId,action});
      return Response.json({error:error.message,code:error.code,diagnosticId,recovery:publicationRecovery[error.code]},{status:409,headers:{'Cache-Control':'no-store'}});
    }
    return Response.json({error: 'Launch could not be verified'}, {status: 409, headers: {'Cache-Control': 'no-store'}});
  } finally {
    clearTimeout(timer);
    void reader?.cancel().catch(() => {});
    active--;
  }
}

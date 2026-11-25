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
const atomicWritesEnabled = process.env.BRANT_LAUNCH_WRITES === '1' && Boolean(network.fixture || process.env.BRANT_ATOMIC_PUDGE_QUALIFICATION==='1');
const atomicOperate=(network.atomic||network.fixture?.market.dataHash===atomicV2Codes.market)?atomicLaunchOperations(rpc,network,atomicWritesEnabled?async transaction=>rpc('send_transaction',[cccA.JsonRpcTransformers.transactionFrom(transaction),'passthrough']):undefined,owner=>/^0x[0-9a-f]{64}$/.test(owner)):undefined;
const operate=async(action:string,input:Record<string,unknown>,timing?:(name:string,ms:number)=>void):Promise<unknown>=>{
 if(action==='prepare'){
  if(!atomicWritesEnabled)throw Error('New atomic creation is disabled');
  if(!atomicOperate||(!network.fixture&&process.env.BRANT_ATOMIC_PUDGE_QUALIFICATION!=='1'))throw Error('New atomic creation is disabled');
  return atomicOperate(action,input,timing);
 }
 if(action==='submit'&&input.stage==='setup')throw Error('New legacy setup is disabled');
 if(!atomicOperate||action==='normalize-logo')return legacyOperate(action,input,timing);
 if(action==='sessions'){const [atomic,legacy]=await Promise.all([atomicOperate(action,input,timing),legacyOperate(action,input,timing)]);return [...atomic as unknown[],...legacy as unknown[]];}
 const result=await atomicOperate(action,input,timing);
 if(result===null&&action==='submit'&&input.stage==='atomic')throw Error('Atomic review expired or unavailable');
 return result===null?legacyOperate(action,input,timing):result;
};
export async function GET(_request: Request, context: {params: Promise<{action:string}>}) {
 if((await context.params).action!=='availability')return new Response(null,{status:404});
 return Response.json({enabled:Boolean(atomicOperate&&atomicWritesEnabled&&process.env.BRANT_LAUNCH_SQLITE_PATH)},{headers:{'Cache-Control':'no-store'}});
}
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
  if (!['status','cancel','prepare','submit','resubmit','pending-review','session','sessions','publish','retry-publication','normalize-logo','next-stage','reconcile'].includes(action)) return new Response(null, {status: 404});
  if (['submit','resubmit'].includes(action) && !launchWritesEnabled && !atomicWritesEnabled) return Response.json({error: 'Launch execution is disabled'}, {status: 403});
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
    if (action === 'submit' && input.stage !== 'atomic' && input.owner !== approvedCreator) {
      return Response.json({error: 'Creator is not approved for launch'}, {status: 403});
    }
    const {result, serverTiming} = await runOperation(action, input);
    return Response.json(result, {headers: {'Cache-Control': 'no-store', 'Server-Timing': serverTiming}});
  } catch(error) {
    if(error instanceof LaunchPublicationError){
      console.warn('Brant publication rejected',{code:error.code,diagnosticId,action});
      return Response.json({error:error.message,code:error.code,diagnosticId,recovery:publicationRecovery[error.code]},{status:409,headers:{'Cache-Control':'no-store'}});
    }
    const message=error instanceof Error?error.message:'';
    const failures:[RegExp,string,string][]=[
      [/disabled/,'creation_disabled','Creation is disabled. Existing sessions remain available.'],
      [/not approved/,'creator_not_approved','This creator is not approved for launch.'],
      [/Insufficient|No eligible/,'insufficient_funding','Eligible funding is insufficient for the reviewed launch.'],
      [/index|RPC|fetch failed|timeout/i,'network_unavailable','The indexer or RPC is unavailable. Retry shortly.'],
      [/^Initial purchase requires|^Enter an initial purchase|^Enter a CKB amount/,'invalid_economics',message],
      [/deployment is not canonical/,'deployment_unavailable','The configured Pudge deployment is not canonical. Contact the operator.'],
      [/standard.*secp/i,'unsupported_wallet','Connect a standard CKB secp wallet on Pudge.'],
      [/terms|economic/i,'invalid_economics','Economic parameters are outside the supported bounds.'],
      [/expired|superseded|immutable review/,'review_expired','This review expired or changed. Prepare a new review.'],
      [/Funding|funding.*changed|input.*live/i,'funding_changed','Funding changed. Prepare a new review.'],
      [/acknowledgement|reconciled|pending transaction/i,'submission_uncertain','Submission status is uncertain. Recover the saved transaction before launching again.'],
    ];
    const failure=failures.find(([pattern])=>pattern.test(message));
    return Response.json({error:failure?.[2]??'Launch could not be verified',code:failure?.[1]??'verification_failed',diagnosticId},{status:409,headers:{'Cache-Control':'no-store'}});
  } finally {
    clearTimeout(timer);
    void reader?.cancel().catch(() => {});
    active--;
  }
}

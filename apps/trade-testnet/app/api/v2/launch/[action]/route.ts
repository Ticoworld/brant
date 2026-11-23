import {launchOperations} from '../../../../../lib/v2-engine/launch-operations-server';
import {generatePudgeLaunchProof} from '../../../../../lib/v2-engine/pudge-launch-proof-server';
import {openConfiguredSharedLaunchStore} from '../../../../../lib/v2-engine/shared-launch-store';
import {PUDGE_GATE2_ANCHOR, PUDGE_GATE2_GENESIS} from '../../../../../lib/v2-engine/pudge-public-registry';

export const runtime = 'nodejs';

const rpc = async (method: string, params: unknown[]) => {
  const response = await fetch('https://testnet.ckb.dev/', {method: 'POST', cache: 'no-store',
    headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(8000),
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params})});
  const data = await response.json();
  if (!response.ok || data.error || !Object.hasOwn(data, 'result')) throw Error('Pudge RPC failed');
  return data.result;
};
const operate = launchOperations({rpc, genesis: PUDGE_GATE2_GENESIS, excludedAnchor: PUDGE_GATE2_ANCHOR,
  quantity: 7n, proof: generatePudgeLaunchProof, openStore: openConfiguredSharedLaunchStore});
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
  const key = (lock.codeHash + lock.args).toLowerCase();
  const existing = preparing.get(key);
  if (existing) return existing;
  const pending = measuredOperation(action, input).finally(() => preparing.delete(key));
  preparing.set(key, pending);
  return pending;
}

export async function POST(request: Request, context: {params: Promise<{action: string}>}) {
  const origin = process.env.BRANT_LAUNCH_PROOF_ORIGIN;
  if (!origin || request.headers.get('origin') !== origin || request.headers.get('host') !== new URL(origin).host ||
      (request.headers.has('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) {
    return new Response(null, {status: 403});
  }
  const {action} = await context.params;
  if (!['prepare','submit','session','next-stage','reconcile'].includes(action)) return new Response(null, {status: 404});
  if (action === 'submit') return Response.json({error: 'Launch execution is disabled'}, {status: 403});
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
    const {result, serverTiming} = await runOperation(action, input);
    return Response.json(result, {headers: {'Cache-Control': 'no-store', 'Server-Timing': serverTiming}});
  } catch {
    return Response.json({error: 'Launch could not be verified'}, {status: 409, headers: {'Cache-Control': 'no-store'}});
  } finally {
    clearTimeout(timer);
    void reader?.cancel().catch(() => {});
    active--;
  }
}

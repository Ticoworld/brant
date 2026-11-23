import {execFile} from 'node:child_process';
import {deriveMarketIdentity} from '../../../../lib/v2-engine/initialization.ts';
import {resolveGate2NativeTools} from '../../../../lib/v2-engine/native-tools.ts';
import {PUDGE_GATE2_CODES, PUDGE_GATE2_GENESIS} from '../../../../lib/v2-engine/pudge-public-registry.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodyLimit = 2048;
const maxConcurrent = 2;
const burst = 8;
const refillMs = 3000;
const hash = /^0x[0-9a-f]{64}$/i;
let active = 0;
let tokens = burst;
let lastRefill = performance.now();

function allowedOrigin(request: Request) {
  const configured = process.env.BRANT_LAUNCH_PROOF_ORIGIN;
  if (!configured || request.headers.get('origin') !== configured) return false;
  try {
    const url = new URL(configured);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const site = request.headers.get('sec-fetch-site');
    return url.origin === configured && (url.protocol === 'https:' || (loopback && url.protocol === 'http:')) &&
      request.headers.get('host') === url.host && (!site || site === 'same-origin');
  } catch {
    return false;
  }
}

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error('Missing body');
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    void reader.cancel().catch(() => {});
  }, 3000);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > bodyLimit) throw Error('Body too large');
      chunks.push(value);
    }
    if (expired) throw Error('Body read timed out');
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks)));
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
  }
}

function runNative(binary: string, args: string[], payload: object) {
  return new Promise<string>((resolve, reject) => {
    const child = execFile(binary, args, {
      encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024, killSignal: 'SIGKILL', windowsHide: true,
    }, (error, stdout) => error ? reject(error) : resolve(stdout));
    child.stdin?.on('error', () => {});
    child.stdin?.end(JSON.stringify(payload));
  });
}

function reply(message: string, status: number, retry?: string) {
  const headers = new Headers({'Cache-Control': 'no-store'});
  if (retry) headers.set('Retry-After', retry);
  return new Response(message, {status, headers});
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return reply('Launch proof origin is not configured or allowed', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return reply('Expected application/json', 415);
  }
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > bodyLimit)) {
    return reply('Request too large', 413);
  }
  if (active >= maxConcurrent) return reply('Proof service busy', 503, '3');

  const now = performance.now();
  tokens = Math.min(burst, tokens + (now - lastRefill) / refillMs);
  lastRefill = now;
  if (tokens < 1) return reply('Proof request rate exceeded', 429, '3');
  tokens -= 1;
  active += 1;
  try {
    const body = await readBody(request).catch(() => null);
    const {anchor, owner} = body ?? {};
    if (typeof owner !== 'string' || !hash.test(owner) || typeof anchor?.txHash !== 'string' ||
        !hash.test(anchor.txHash) || typeof anchor.index !== 'string' || !/^0x[0-9a-f]{1,8}$/i.test(anchor.index)) {
      return reply('Invalid proof identity', 400);
    }
    const {smt, recovery} = await resolveGate2NativeTools();
    if (!smt || !recovery) return reply('Proof tools unavailable', 503);

    const genesis = PUDGE_GATE2_GENESIS;
    const id = deriveMarketIdentity({
      anchor, genesis, base: 1_000_000_000n, step: 100_000_000n, supply: 2000n,
      codes: {...PUDGE_GATE2_CODES, owner: PUDGE_GATE2_CODES.ownerLock},
    });
    const market = id.market.hash();
    const custody = id.custody.hash();
    const domain = {market_script_hash: market, xudt_type_script_hash: id.token.hash(),
      genesis_hash: genesis, custody_marker_type_hash: id.custodyMarker.hash()};
    const quantity = '7';
    const price = 9_100_000_000n;
    const proof = JSON.parse(await runNative(smt, ['proof', '-', '-'], {
      domain, op: 0, owners: [], updates: [{owner_lock_hash: owner, balance: quantity, revision: '0', active: true}],
    }));
    const limit = Buffer.alloc(8);
    limit.writeBigUInt64LE(price);
    const newRoot = proof.new_root;
    const proofWitness = proof.contract_witness?.hex;
    if (typeof newRoot !== 'string' || !hash.test(newRoot) ||
        typeof proofWitness !== 'string' || !/^0x(?:[0-9a-f]{2})+$/i.test(proofWitness)) {
      return reply('Invalid generated proof', 503);
    }
    const witness = proofWitness + limit.toString('hex');
    const check = JSON.parse(await runNative(recovery, ['verify-init', '-'], {
      domain: id.custody.args, owner, new_root: newRoot, witness, quantity, price: price.toString(),
    }));
    if (check.verified !== true || check.new_root !== newRoot) return reply('Proof verification failed', 503);

    return Response.json({owner, newRoot, witness, genesis, market, custody}, {headers: {'Cache-Control': 'no-store'}});
  } catch {
    return reply('Proof preparation failed', 503);
  } finally {
    active -= 1;
  }
}

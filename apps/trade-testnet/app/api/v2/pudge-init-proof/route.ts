import {generatePudgeLaunchProof} from '../../../../lib/v2-engine/pudge-launch-proof-server.ts';
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
    return Response.json(await generatePudgeLaunchProof(anchor, owner), {headers: {'Cache-Control': 'no-store'}});
  } catch {
    return reply('Proof preparation failed', 503);
  } finally {
    active -= 1;
  }
}

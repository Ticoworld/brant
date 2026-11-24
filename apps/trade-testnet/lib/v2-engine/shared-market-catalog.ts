import {verifyLaunchMetadata} from './launch-metadata.ts';
import {PUDGE_GATE2_GENESIS} from './pudge-public-registry.ts';
import {verifyCompletedSharedLaunch} from './shared-launch-controller.ts';
import {openConfiguredSharedLaunchStore} from './shared-launch-store.ts';

const genesis = PUDGE_GATE2_GENESIS;
export const marketHash = /^0x[0-9a-f]{64}$/;

async function readRpc(method: string, params: unknown[]) {
  const response = await fetch('https://testnet.ckb.dev/', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, cache: 'no-store',
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
    signal: AbortSignal.timeout(4000),
  });
  const body = await response.json();
  if (!response.ok || body.error || !Object.hasOwn(body, 'result')) throw Error('Pudge RPC unavailable');
  return body.result;
}

async function verifyCandidate(store: ReturnType<typeof openConfiguredSharedLaunchStore>, market: string, encoded: string) {
  if (!marketHash.test(market) || encoded.length > 100_000) return null;
  const publication = JSON.parse(encoded);
  if (publication?.genesis !== genesis || publication.market !== market ||
      typeof publication.owner !== 'string' || !marketHash.test(publication.owner)) return null;
  const session = store.find(genesis, market, publication.owner);
  if (!session) return null;
  const metadata = verifyLaunchMetadata(session.scope, publication.metadata, publication.signature);
  if (JSON.stringify(publication.receipts) !== JSON.stringify(session.journal.entries)) return null;
  const plan = await verifyCompletedSharedLaunch(readRpc, store, session);
  const token = plan.identity.token.hash();
  if (token !== publication.token) return null;
  return {market, genesis, token, owner: session.scope.owner, metadata, receipts: session.journal.entries,
    logo: metadata.logoHash ? '/api/v2/launch/logo?market=' + market : null};
}

export async function getCatalogMarket(market: string) {
  if (!marketHash.test(market) || !process.env.BRANT_LAUNCH_SQLITE_PATH) return null;
  const store = openConfiguredSharedLaunchStore();
  try {
    const encoded = store.publicationCandidate(genesis, market);
    return encoded ? await verifyCandidate(store, market, encoded) : null;
  } catch {
    return null;
  } finally {
    store.close();
  }
}

let listing: Promise<Awaited<ReturnType<typeof loadCatalog>>> | undefined;
async function loadCatalog(after: string) {
  if (!process.env.BRANT_LAUNCH_SQLITE_PATH) return {markets: [], next: null};
  const store = openConfiguredSharedLaunchStore();
  try {
    const rows = store.publicationCandidates(genesis, after, 5);
    const results = await Promise.allSettled(rows.slice(0, 4).map(({market, encoded}) => verifyCandidate(store, market, encoded)));
    return {
      markets: results.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []),
      next: rows.length === 5 ? rows[3].market : null,
    };
  } finally {
    store.close();
  }
}

export function listCatalog(after: string) {
  if (after) return loadCatalog(after);
  listing ??= loadCatalog('').finally(() => { listing = undefined; });
  return listing;
}

import {getAtomicCatalogMarket,listAtomicCatalog} from './atomic-market-catalog.ts';
import {marketNetwork} from './market-network-server.ts';
import {verifyLaunchMetadata} from './launch-metadata.ts';
import {PUDGE_GATE2_GENESIS} from './pudge-public-registry.ts';
import {verifyCompletedSharedLaunch} from './shared-launch-controller.ts';
import {openConfiguredSharedLaunchStore} from './shared-launch-store.ts';

const genesis = marketNetwork().genesis;
export const marketHash = /^0x[0-9a-f]{64}$/;

async function readRpc(method: string, params: unknown[]) {
  const response = await fetch(marketNetwork().endpoint, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, cache: 'no-store',
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params}),
    signal: AbortSignal.timeout(4000),
  });
  const body = await response.json();
  if (!response.ok || body.error || !Object.hasOwn(body, 'result')) throw Error('Pudge RPC unavailable');
  return body.result;
}

async function verifyCandidate(store: ReturnType<typeof openConfiguredSharedLaunchStore>, market: string, encoded: string, includeExecution = false) {
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
  const stages = Object.fromEntries(['setup', 'issuance', 'purchase'].map(stage => {
    const entries = session.journal.entries.filter(entry => entry.stage === stage);
    if (entries.length !== 1 || entries[0].state !== 'confirmed' || !entries[0].blockHash) throw Error('Invalid canonical launch stage');
    return [stage, {txHash: entries[0].txHash, blockHash: entries[0].blockHash}];
  }));
  const execution = includeExecution ? {
    genesis, marketScriptHash: market, routeId: market, creatorLockHash: session.scope.owner,
    tokenTypeHash: token, scripts: plan.identity, stages,
    dependencies: plan.projected.purchase.cellDeps,codeDependencies:plan.dependencies,
    initial: [0, 1, 2, 3].map(index => ({tx_hash: plan.stageHashes.purchase, index: '0x' + index.toString(16)})),
    issuanceCapacityFloor: plan.projected.issuance.outputs[0].capacity.toString(),
    metadata,
  } : undefined;
  return {market, genesis, token, owner: session.scope.owner, metadata, receipts: session.journal.entries,
    ...(execution ? {execution} : {}),
    logo: metadata.logoHash ? '/api/v2/launch/logo?market=' + market : null};
}

export async function getCatalogMarket(market: string, includeExecution = false) {
  if (!marketHash.test(market) || !process.env.BRANT_LAUNCH_SQLITE_PATH) return null;
  const store = openConfiguredSharedLaunchStore();
  try {
    const encoded = store.publicationCandidate(genesis, market);
    if(encoded)return await verifyCandidate(store,market,encoded,includeExecution);
    const atomic=await getAtomicCatalogMarket(readRpc,market);return atomic&&includeExecution?atomic:atomic?{...atomic,execution:undefined}:null;
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
    const atomic=await listAtomicCatalog(readRpc,after);
    const merged=[...atomic.markets,...results.flatMap(result=>result.status==='fulfilled'&&result.value?[result.value]:[])].sort((a,b)=>a.market.localeCompare(b.market));
    const markets=merged.slice(0,4);
    return {markets,next:merged.length>4||rows.length===5||atomic.next?markets.at(-1)?.market||atomic.next||rows[3]?.market||null:null};
  } finally {
    store.close();
  }
}

export function listCatalog(after: string) {
  if (after) return loadCatalog(after);
  listing ??= loadCatalog('').finally(() => { listing = undefined; });
  return listing;
}

// Store only public transaction identities. An ambiguous submission must be
// reconciled against the canonical chain before a replacement is considered.
export type DeploymentAttempt = { version: 1; genesis: string; owner: string; txHash: string; codeHashes: string[]; state: 'prepared' | 'submitted' | 'confirmed'; blockHash?: string };
const h = /^0x[0-9a-f]{64}$/i;
export function parseDeploymentAttempt(raw: string): DeploymentAttempt {
  const v = JSON.parse(raw) as DeploymentAttempt;
  if (!v || v.version !== 1 || !h.test(v.genesis) || !h.test(v.owner) || !h.test(v.txHash) || !Array.isArray(v.codeHashes) || !v.codeHashes.length || v.codeHashes.some(x => !h.test(x)) || new Set(v.codeHashes.map(x => x.toLowerCase())).size !== v.codeHashes.length || !['prepared','submitted','confirmed'].includes(v.state) || (v.blockHash !== undefined && !h.test(v.blockHash)) || (v.state === 'confirmed' && !v.blockHash)) throw Error('Invalid deployment journal');
  // Construct a public-only record even if imported JSON contains extra fields.
  return {version:1,genesis:v.genesis,owner:v.owner,txHash:v.txHash,codeHashes:[...v.codeHashes],state:v.state,...(v.blockHash ? {blockHash:v.blockHash} : {})};
}
export function advanceDeploymentAttempt(attempt: DeploymentAttempt, state: DeploymentAttempt['state'], blockHash?: string): DeploymentAttempt {
  const current = parseDeploymentAttempt(JSON.stringify(attempt));
  if (!((current.state === 'prepared' && state === 'submitted') || (current.state === 'submitted' && state === 'confirmed'))) throw Error('Invalid deployment journal transition');
  return parseDeploymentAttempt(JSON.stringify({...current, state, ...(blockHash ? {blockHash} : {})}));
}

export const JOURNAL_KEY = 'roveko-v2-code-deployment-v1';
/** Import is a claim, not chain evidence; confirmation always needs rechecking. */
export function importDeploymentAttempt(storage: Pick<Storage,'getItem'|'setItem'>, raw: string, genesis: string, expectedCodeHashes: string[]) {
  if (raw.length > 8192) throw Error('Deployment backup is too large');
  if (storage.getItem(JOURNAL_KEY) !== null) throw Error('Existing deployment attempt requires reconciliation');
  const v = parseDeploymentAttempt(raw);
  const expected = new Set(expectedCodeHashes.map(hash=>hash.toLowerCase()));
  if (v.genesis.toLowerCase() !== genesis.toLowerCase() || expected.size!==expectedCodeHashes.length || v.codeHashes.length !== expected.size || v.codeHashes.some(hash=>!expected.has(hash.toLowerCase()))) throw Error('Backup does not match this network and deployment');
  if(v.state==='prepared') throw Error('Prepared transaction has no submission to recover');
  // An imported record can never by itself establish current canonical status.
  const pending:DeploymentAttempt={version:1,genesis:v.genesis,owner:v.owner,txHash:v.txHash,codeHashes:v.codeHashes,state:'submitted',...(v.blockHash?{blockHash:v.blockHash}:{})};
  reserveDeploymentAttempt(storage,pending);
  return pending;
}
/** Call only while holding the origin-wide exclusive deployment lock. */
export function reserveDeploymentAttempt(storage: Pick<Storage,'getItem'|'setItem'>, attempt: DeploymentAttempt) {
  if (storage.getItem(JOURNAL_KEY) !== null) throw Error('Existing deployment attempt requires reconciliation');
  const next = parseDeploymentAttempt(JSON.stringify(attempt));
  if (next.state !== 'submitted') throw Error('A reserved attempt must have submitted state');
  storage.setItem(JOURNAL_KEY, JSON.stringify(next));
}
/** Never clear an attempt on a missing RPC result: it may have been accepted. */
export function saveDeploymentAttempt(storage: Pick<Storage,'getItem'|'setItem'>, attempt: DeploymentAttempt) {
  const previous = storage.getItem(JOURNAL_KEY);
  const next = parseDeploymentAttempt(JSON.stringify(attempt));
  if (previous) {
    const old = parseDeploymentAttempt(previous);
    if (old.txHash.toLowerCase() !== next.txHash.toLowerCase() || old.genesis.toLowerCase() !== next.genesis.toLowerCase() || old.owner.toLowerCase() !== next.owner.toLowerCase() || old.codeHashes.join(',').toLowerCase() !== next.codeHashes.join(',').toLowerCase()) throw Error('Existing deployment attempt requires reconciliation');
    const order = {prepared:0,submitted:1,confirmed:2};
    if (order[next.state] < order[old.state]) throw Error('Cannot roll back deployment journal');
  }
  storage.setItem(JOURNAL_KEY, JSON.stringify(next));
}

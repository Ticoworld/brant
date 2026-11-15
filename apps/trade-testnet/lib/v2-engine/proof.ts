// Validate output from the pinned Gate 2 SMT tool against a freshly replayed
// canonical custody root. This does not itself authenticate RPC history.
export function validateTransitionProof(value: unknown, expectedRoot: string, expectedOperation: 1 | 4) {
  const p = value as { format?: string; operation?: number; old_root?: string; new_root?: string; contract_witness?: {hex?: string}; proof?: {csmt_old_root_verified?: boolean; csmt_new_root_verified?: boolean} };
  const hash = /^0x[0-9a-f]{64}$/i;
  if (!hash.test(expectedRoot) || p?.format !== 'trade-v2-smt-transition-v1' || p.operation !== expectedOperation || !p.old_root || p.old_root.toLowerCase() !== expectedRoot.toLowerCase() || !p.new_root || !hash.test(p.new_root) || !p.proof?.csmt_old_root_verified || !p.proof.csmt_new_root_verified || !/^0x544d5331(?:[0-9a-f]{2})+$/i.test(p.contract_witness?.hex ?? '')) throw Error('Invalid or stale Gate 2 transition proof');
  return { root: p.new_root, witness: p.contract_witness!.hex! };
}

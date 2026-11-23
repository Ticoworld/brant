import {planSharedLaunch} from '../../lib/v2-engine/shared-launch';
import {discoverFunding} from '../../lib/v2-engine/multi-funding';
import {PUDGE_GATE2_ANCHOR} from '../../lib/v2-engine/pudge-public-registry';
import {verifyPudgeInitialProof} from '../../lib/v2-engine/pudge-proof-client';
import {PUDGE_GENESIS, pudgeRpc} from './rpc';

export const firstPurchaseQuantity = 7n;

export class LaunchPreflightError extends Error {
  constructor(readonly reason: 'funding' | 'network' | 'local-proof' | 'proof', readonly usable?: bigint) {
    super(reason);
  }
}

export async function previewLaunch(lock: Parameters<typeof discoverFunding>[2]) {
  if (await pudgeRpc('get_block_hash', ['0x0']) !== PUDGE_GENESIS) throw new LaunchPreflightError('network');
  const cells = await discoverFunding(pudgeRpc, pudgeRpc, lock);
  const sorted = cells.filter(cell => !cell.type && cell.data === '0x' &&
    !(cell.outPoint.txHash === PUDGE_GATE2_ANCHOR.txHash && BigInt(cell.outPoint.index) === BigInt(PUDGE_GATE2_ANCHOR.index)))
    .map(cell => ({...cell, type: undefined}))
    .sort((a,b) => a.capacity > b.capacity ? -1 : a.capacity < b.capacity ? 1 : 0);
  const usable = sorted.reduce((sum, cell) => sum + cell.capacity, 0n);
  if (sorted.length < 2) throw new LaunchPreflightError('funding', usable);
  const pool = await pudgeRpc<{min_fee_rate: string}>('tx_pool_info');
  const feeRate = BigInt(pool.min_fee_rate) * 2n;
  if (feeRate < 2000n || feeRate > 200000n) throw Error('Launch fee rate outside review bounds');
  for (const anchor of sorted.slice(0, 2)) {
    try {
      const plan = await planSharedLaunch(pudgeRpc, {
        creator: lock, genesis: PUDGE_GENESIS, anchor, funding: sorted.filter(cell => cell !== anchor),
        reservedAnchors: [], quantity: firstPurchaseQuantity, feeRate,
        verifyProof: async (owner, quantity, price) => {
          if (quantity !== firstPurchaseQuantity || price !== 9_100_000_000n) throw Error('Unsupported launch proof terms');
          if (!['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
            throw new LaunchPreflightError('local-proof', usable);
          }
          try {
            return await verifyPudgeInitialProof(anchor.outPoint, owner);
          } catch {
            throw new LaunchPreflightError('proof', usable);
          }
        },
      });
      return {usable, accounting: plan.accounting, market: plan.scope.market, token: plan.identity.token.hash()};
    } catch (error) {
      if (!(error instanceof Error) || !/^(Insufficient (setup|issuance) funding|Output capacity below occupied capacity)$/.test(error.message)) throw error;
    }
  }
  throw new LaunchPreflightError('funding', usable);
}

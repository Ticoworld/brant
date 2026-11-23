import {verifyLaunchMetadata} from './launch-metadata.ts';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {discoverFunding} from './multi-funding.ts';
import {readFundingCell} from './funding.ts';
import {planSharedLaunch, sharedLaunchStages} from './shared-launch.ts';
import {authorizeSharedLaunchSetup, recoverSharedLaunch, reconcileSharedLaunchStage, submitSharedLaunchStage} from './shared-launch-controller.ts';
import type {openSharedLaunchStore} from './shared-launch-store.ts';

type PlanRequest = Parameters<typeof planSharedLaunch>[1];
type Store = ReturnType<typeof openSharedLaunchStore>;
type Rpc = Parameters<typeof planSharedLaunch>[0];
type Point = PlanRequest['anchor']['outPoint'];
const hash = /^0x[0-9a-f]{64}$/;
function point(value: Point) {
  if (!value || !hash.test(value.txHash) || !/^0x(?:0|[1-9a-f][0-9a-f]{0,7})$/.test(value.index)) throw Error('Invalid outpoint');
  return {txHash: value.txHash, index: value.index};
}
function creator(value: ccc.ScriptLike) {
  const lock = ccc.Script.from(value);
  if (lock.codeHash !== '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8' ||
      lock.hashType !== 'type' || !/^0x[0-9a-f]{40}$/.test(lock.args)) throw Error('Unsupported creator lock');
  return lock;
}

export function launchOperations({rpc, genesis, fixture, excludedAnchor, quantity, proof, openStore, send, authorizeCreator = () => true}: {
  authorizeCreator?: (owner: string) => boolean;
  rpc: Rpc; genesis: string; fixture?: PlanRequest['fixture']; excludedAnchor?: Point; quantity: bigint;
  proof: (anchor: Point, owner: string) => ReturnType<PlanRequest['verifyProof']>;
  openStore: () => Store; send?: (transaction: ccc.Transaction) => Promise<string>;
}) {
  function request(lock: ccc.Script, anchor: PlanRequest['anchor'], funding: PlanRequest['funding'], feeRate: bigint): PlanRequest {
    return {genesis, fixture, creator: lock, anchor, funding, feeRate, quantity, reservedAnchors: [],
      verifyProof: owner => proof(anchor.outPoint, owner)};
  }
  const accounting = (plan: Awaited<ReturnType<typeof planSharedLaunch>>) =>
    JSON.parse(JSON.stringify(plan.accounting, (_, item) => typeof item === 'bigint' ? String(item) : item));
  return async function operate(action: string, input: Record<string, unknown>, timing?: (name: string, ms: number) => void) {
    if (action === 'prepare') {
      const started = performance.now();
      const measured = async <T,>(name: string, work: () => Promise<T>) => {
        const start = performance.now();
        try { return await work(); }
        finally { timing?.(name, performance.now() - start); }
      };
      const counted: Rpc = (method, params) => measured('rpc_' + method, () => rpc(method, params));
      const lock = creator(input.creator as ccc.ScriptLike);
      if (await counted('get_block_hash', ['0x0']) !== genesis) throw Error('Wrong genesis');
      const cells = (await measured('funding', () => discoverFunding(counted, counted, lock))).filter(cell => !cell.type && cell.data === '0x' &&
        !(excludedAnchor && cell.outPoint.txHash === excludedAnchor.txHash && BigInt(cell.outPoint.index) === BigInt(excludedAnchor.index)))
        .map(cell => ({...cell, type: undefined}))
        .sort((a,b) => a.capacity > b.capacity ? -1 : a.capacity < b.capacity ? 1 :
          JSON.stringify(a.outPoint).localeCompare(JSON.stringify(b.outPoint)));
      if (cells.length < 2 || cells.length > 64) throw Error('Unsupported funding Cell count');
      const pool = await counted('tx_pool_info', []) as {min_fee_rate: string};
      const feeRate = BigInt(pool.min_fee_rate) * 2n;
      if (feeRate < 2000n || feeRate > 200000n) throw Error('Unsupported fee rate');
      for (const anchor of cells.slice(0, 2)) {
        const funding = cells.filter(cell => cell !== anchor);
        try {
          const config = request(lock, anchor, funding, feeRate);
          const plan = await measured('planner', () => planSharedLaunch(counted, {
            ...config, verifyProof: (...args) => measured('proof', () => config.verifyProof(...args)),
            timing,
          }));
          timing?.('total', performance.now() - started);
          return {descriptor: {creator: lock, anchor: anchor.outPoint, funding: funding.map(cell => cell.outPoint),
            feeRate: String(feeRate), market: plan.scope.market, hashes: plan.stageHashes},
            transaction: cccA.JsonRpcTransformers.transactionFrom(plan.projected.setup),
            accounting: accounting(plan), market: plan.scope.market, token: plan.identity.token.hash(), enabled: Boolean(send && authorizeCreator(plan.scope.owner))};
        } catch (error) {
          if (!(error instanceof Error) || !/^(Insufficient (setup|issuance) funding|Output capacity below occupied capacity)$/.test(error.message)) throw error;
        }
      }
      throw Error('Insufficient launch funding');
    }
    const {owner, market} = input;
    if (typeof owner !== 'string' || !hash.test(owner) || typeof market !== 'string' || !hash.test(market)) throw Error('Invalid session identity');
    if (action === 'submit' && (!send || !authorizeCreator(owner))) throw Error('Launch execution is disabled');
    const store = openStore();
    try {
      const session = store.find(genesis, market, owner);
      if (action === 'submit' && input.stage === 'setup') {
        if (session) throw Error('Setup already recorded');
        const descriptor = input.descriptor as {creator: ccc.ScriptLike; anchor: Point; funding: Point[]; feeRate: string; market: string; hashes: Record<string, string>};
        const lock = creator(descriptor.creator);
        if (lock.hash() !== owner || descriptor.market !== market || !Array.isArray(descriptor.funding) ||
            descriptor.funding.length < 1 || descriptor.funding.length > 63 || !/^\d{4,6}$/.test(descriptor.feeRate)) throw Error('Invalid Setup descriptor');
        const feeRate = BigInt(descriptor.feeRate);
        const pool = await rpc('tx_pool_info', []) as {min_fee_rate: string};
        if (feeRate < 2000n || feeRate > 200000n || feeRate !== BigInt(pool.min_fee_rate) * 2n) throw Error('Launch fee rate changed');
        const [anchor, ...funding] = await Promise.all([descriptor.anchor, ...descriptor.funding].map(async value => {
          const cell = await readFundingCell(rpc, point(value), owner);
          return {outPoint: cell.outPoint, capacity: cell.capacity, lock, data: cell.data};
        }));
        const config = request(lock, anchor, funding, feeRate);
        const plan = await planSharedLaunch(rpc, config);
        if (plan.scope.market !== market || sharedLaunchStages.some(stage => plan.stageHashes[stage] !== descriptor.hashes?.[stage])) throw Error('Launch plan changed');
        await authorizeSharedLaunchSetup(rpc, store, config, ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(input.signed as never)), send!);
        return {submitted: plan.stageHashes.setup};
      }
      if (!session) return null;
      const {scope, hashes, journal} = session;
      const entries = journal.entries.map(({stage, state, txHash, blockHash}) => ({stage, state, txHash, blockHash}));
      if (action === 'session') return {entries, hashes, enabled: Boolean(send && authorizeCreator(scope.owner))};
      const plan = await recoverSharedLaunch(rpc, store, scope, hashes);
      if (action === 'publish') {
        const metadata = verifyLaunchMetadata(scope, input.metadata, input.signature);
        if (journal.entries.length !== sharedLaunchStages.length || journal.entries.some(entry => entry.state !== 'confirmed')) {
          throw Error('Launch is not confirmed');
        }
        for (const entry of journal.entries) {
          const receipt = await plan.verifyReceipt(entry.stage);
          if (receipt.blockHash !== entry.blockHash) throw Error('Launch receipt changed');
        }
        return store.publish(scope, hashes, plan.identity.token.hash(), metadata);
      }
      if (action === 'reconcile') return await reconcileSharedLaunchStage(store, plan);
      const stage = sharedLaunchStages[journal.entries.length];
      if (!stage) throw Error('Launch is complete');
      if (action === 'next-stage') {
        const transaction = await plan.prepareStage(stage, store.read(scope, hashes));
        return {stage, transaction: cccA.JsonRpcTransformers.transactionFrom(transaction)};
      }
      if (action !== 'submit' || input.stage !== stage) throw Error('Unexpected launch stage');
      await submitSharedLaunchStage(store, plan, stage, ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(input.signed as never)), send!);
      return {submitted: hashes[stage]};
    } finally {
      store.close();
    }
  };
}

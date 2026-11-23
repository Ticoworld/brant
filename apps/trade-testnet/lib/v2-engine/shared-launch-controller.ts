import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {planSharedLaunch, readSharedLaunchJournal, sharedLaunchStages} from './shared-launch.ts';
import type {openSharedLaunchStore} from './shared-launch-store.ts';

type Store = ReturnType<typeof openSharedLaunchStore>;
type Rpc = Parameters<typeof planSharedLaunch>[0];
type Request = Parameters<typeof planSharedLaunch>[1];
type Plan = Awaited<ReturnType<typeof planSharedLaunch>>;
type Stage = typeof sharedLaunchStages[number];

/** Retain the original inputs and independently verified proof for replay after
 * Setup spends the original funding. Only server-created snapshots are used. */
export async function reserveSharedLaunch(rpc: Rpc, store: Store, request: Request) {
  let proof: Awaited<ReturnType<Request['verifyProof']>> | undefined;
  const plan = await planSharedLaunch(rpc, {...request, resumeJournal: undefined,
    verifyProof: async (...args) => (proof = await request.verifyProof(...args)),
  });
  const {genesis, creator, anchor, funding, reservedAnchors, fixture, quantity, feeRate} = request;
  const snapshot = {version: 1, genesis, creator, anchor, funding, reservedAnchors, fixture, quantity, feeRate, proof,
    accounting: plan.accounting,
    transactions: sharedLaunchStages.map(stage => cccA.JsonRpcTransformers.transactionFrom(plan.projected[stage])),
  };
  store.reserve(plan.scope, plan.stageHashes, serialize(snapshot));
  return plan;
}

function serialize(value: unknown) {
  return JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item);
}

export async function recoverSharedLaunch(rpc: Rpc, store: Store, scope: Plan['scope'], hashes: Plan['stageHashes']) {
  const snapshot = JSON.parse(store.readSnapshot(scope, hashes));
  if (snapshot.version !== 1 || !snapshot.proof) throw Error('Invalid launch snapshot');
  const journal = store.read(scope, hashes);
  const restoreCell = (cell: Request['anchor']) => ({...cell, capacity: BigInt(cell.capacity)});
  const plan = await planSharedLaunch(rpc, {
    ...snapshot, anchor: restoreCell(snapshot.anchor), funding: snapshot.funding.map(restoreCell),
    quantity: BigInt(snapshot.quantity), feeRate: BigInt(snapshot.feeRate), resumeJournal: journal,
    verifyProof: async () => snapshot.proof,
  });
  const transactions = sharedLaunchStages.map(stage => cccA.JsonRpcTransformers.transactionFrom(plan.projected[stage]));
  if (serialize(transactions) !== serialize(snapshot.transactions) ||
      serialize(plan.accounting) !== serialize(snapshot.accounting)) throw Error('Launch snapshot differs from the immutable plan');
  return plan;
}

export async function submitSharedLaunchStage(
  store: Store, plan: Plan, stage: Stage, signed: ccc.Transaction,
  send: (signed: ccc.Transaction) => Promise<string>,
) {
  const {scope, stageHashes} = plan;
  const candidate = signed.clone();
  const reviewed = await plan.prepareStage(stage, store.read(scope, stageHashes));
  if (candidate.hash() !== reviewed.hash()) throw Error('Signed launch transaction differs from review');
  plan.verifySignature(stage, candidate);
  store.recordSubmission(scope, stageHashes, stage);
  if (await send(candidate) !== stageHashes[stage]) throw Error('Launch submission acknowledgement differs from review');
}

export async function reconcileSharedLaunchStage(store: Store, plan: Plan) {
  const {scope, stageHashes} = plan;
  const journal = readSharedLaunchJournal(store.read(scope, stageHashes), scope, stageHashes);
  const pending = journal.entries.at(-1);
  if (pending?.state !== 'submitted') throw Error('No pending launch stage');
  const receipt = await plan.verifyReceipt(pending.stage);
  store.confirm(scope, stageHashes, receipt);
  return receipt;
}

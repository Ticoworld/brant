import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openSharedLaunchStore} from '../lib/v2-engine/shared-launch-store.ts';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {planSharedLaunch, readSharedLaunchJournal, sharedLaunchDependencies, sharedLaunchJournalKey} from '../lib/v2-engine/shared-launch.ts';
import {PUDGE_GATE2_GENESIS, PUDGE_GATE2_JOURNAL} from '../lib/v2-engine/pudge-public-registry.ts';
import {parseWizard} from '../lib/v2-engine/wizard-journal.ts';

const hex = (byte: string) => '0x' + byte.repeat(32);
const genesis = hex('ab');
const unit = 100_000_000n;
const names = ['custody', 'market', 'custodyMarker', 'marker', 'ownerLock', 'xudt', 'secp'] as const;
const fixture = Object.fromEntries(names.map((name, index) => [name, {
  outPoint: {txHash: hex('12'), index: ccc.numToHex(index)},
  dataHash: ccc.hashCkb(ccc.numToHex(index + 16)),
}])) as NonNullable<Parameters<typeof sharedLaunchDependencies>[1]>;
const live = new Map<string, unknown>();
const put = (hash: string, index: string, cell: unknown) => live.set(hash + ':' + index, {status: 'live', cell});
for (const [index, name] of names.entries()) {
  put(fixture[name].outPoint.txHash, fixture[name].outPoint.index, {data: {content: ccc.numToHex(index + 16)}});
}
const blockHash = hex('ee');
const committed = new Map<string, unknown>();
const rpc = async (method: string, params: unknown[]) => {
  if (method === 'get_block_hash') return params[0] === '0x0' ? genesis : blockHash;
  if (method === 'get_header') return {number: '0x1', hash: blockHash};
  if (method === 'get_transaction') return committed.get(String(params[0]));
  assert.equal(method, 'get_live_cell');
  const point = params[0] as {tx_hash: string; index: string};
  return live.get(point.tx_hash + ':' + point.index);
};
function creator(seed: string) {
  const lock = ccc.Script.from({codeHash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
    hashType: 'type', args: '0x' + seed.repeat(20)});
  const cell = (index: string, capacity: bigint) => {
    const outPoint = {txHash: hex(seed), index};
    put(outPoint.txHash, index, {output: {capacity: ccc.numToHex(capacity), lock: cccA.JsonRpcTransformers.scriptFrom(lock)}, data: {content: '0x'}});
    return {outPoint, capacity, lock, data: '0x'};
  };
  return {genesis, fixture, creator: lock, anchor: cell('0x0', 500n * unit), funding: [cell('0x1', 1100n * unit)],
    reservedAnchors: [], quantity: 1n, feeRate: 1000n,
    verifyProof: async (owner: string) => ({
      owner, newRoot: hex('42'),
      // Shape fixture only. Native proof authentication is supplied by the caller.
      witness: '0x544d53310100010000000000' + owner.slice(2) + '00'.repeat(32) +
        '0100000000000000' + '00'.repeat(8) + '01' + '00'.repeat(15) + '00ca9a3b00000000',
    }),
  };
}
const a = creator('a1'), b = creator('b2');
const first = await planSharedLaunch(rpc, a), second = await planSharedLaunch(rpc, b);
for (const name of ['market', 'token', 'custody', 'marker', 'custodyMarker', 'owner'] as const) {
  assert.notEqual(first.identity[name].hash(), second.identity[name].hash());
  assert.equal(first.identity[name].codeHash, second.identity[name].codeHash);
}
for (const stage of ['setup', 'issuance', 'purchase'] as const) {
  assert.deepEqual(first.projected[stage].cellDeps, second.projected[stage].cellDeps);
}
assert.deepEqual(first.projected.issuance.cellDeps.map(d=>d.outPoint.index), [6n,4n,5n,3n]);
assert.deepEqual(first.projected.purchase.cellDeps.map(d=>d.outPoint.index), [6n,1n,3n,0n,2n,5n]);
assert.equal(first.projected.setup.outputs.length, 3);
assert.equal(first.accounting.eligibleFunding, 1600n * unit);
assert.equal(first.accounting.locked, 1310n * unit);
assert.equal(first.accounting.curveReserve, 10n * unit);
assert.equal(first.accounting.change + first.accounting.locked + first.accounting.fees, first.accounting.eligibleFunding);
const journal = (plan: typeof first, entries: unknown[] = []) => JSON.stringify({version: 2, ...plan.scope, entries});
const storePath = join(mkdtempSync(join(tmpdir(), 'brant-launch-')), 'launch.sqlite');
let store = openSharedLaunchStore(storePath);
store.reserve(first.scope, first.stageHashes);
store.reserve(second.scope, second.stageHashes);
assert.throws(() => store.reserve({...first.scope, market: hex('ff')}, first.stageHashes), /already reserved/);
store.recordSubmission(first.scope, first.stageHashes, 'setup');
store.close();
store = openSharedLaunchStore(storePath);
assert.throws(() => store.recordSubmission(first.scope, first.stageHashes, 'setup'), /requires reconciliation/);
assert.throws(() => store.read(first.scope, {...first.stageHashes, setup: hex('ff')}), /immutable plan differs/);
assert.equal(store.read(second.scope, second.stageHashes), journal(second));
await first.prepareStage('setup', journal(first));
assert.notEqual(sharedLaunchJournalKey(first.scope), sharedLaunchJournalKey(second.scope));
assert.throws(() => readSharedLaunchJournal(journal(second), first.scope, first.stageHashes), /identity mismatch/);
await assert.rejects(first.prepareStage('issuance', journal(first)), /requires reconciliation/);
const setup = first.projected.setup;
const setupReceipt = {stage: 'setup', state: 'confirmed', txHash: setup.hash(), blockHash} as const;
const resumed = journal(first, [setupReceipt]);
const commit = (transaction: ccc.Transaction, outputs: number[]) => {
  const raw = cccA.JsonRpcTransformers.transactionFrom(transaction);
  committed.set(transaction.hash(), {transaction: raw, tx_status: {status: 'committed', block_hash: blockHash}});
  for (const index of outputs) put(transaction.hash(), ccc.numToHex(index), {output: raw.outputs[index], data: {content: raw.outputs_data[index]}});
};
commit(setup, [0,1]);
store.confirm(first.scope, first.stageHashes, setupReceipt);
assert.equal(store.read(first.scope, first.stageHashes), resumed);
store.close();
live.delete(a.funding[0].outPoint.txHash + ':0x1');
const restart = await planSharedLaunch(rpc, {...a, resumeJournal: resumed});
assert.equal((await restart.prepareStage('issuance', resumed)).hash(), first.stageHashes.issuance);
await assert.rejects(restart.prepareStage('issuance', journal(first,[{...setupReceipt,blockHash:hex('ff')}])), /receipt changed/);
const issuance = first.projected.issuance;
commit(issuance, [0,1]);
live.delete(a.anchor.outPoint.txHash + ':0x0');
const purchaseJournal = journal(first, [setupReceipt, {stage:'issuance', state:'confirmed',txHash:issuance.hash(),blockHash}]);
assert.equal((await restart.prepareStage('purchase', purchaseJournal)).hash(), first.stageHashes.purchase);
await assert.rejects(planSharedLaunch(rpc, {...b, creator:a.creator}), /owned by the creator/);
await assert.rejects(planSharedLaunch(rpc, {...b, reservedAnchors:[b.anchor.outPoint]}), /Reserved launch anchor/);
await assert.rejects(planSharedLaunch(rpc, {...b, funding:[b.anchor]}), /Duplicate input/);
await assert.rejects(planSharedLaunch(rpc, {...b, verifyProof:a.verifyProof.bind(null,a.creator.hash())}), /another creator/);
const publicDeps = sharedLaunchDependencies(PUDGE_GATE2_GENESIS);
assert.throws(() => sharedLaunchDependencies(genesis, publicDeps), /fixture dependencies/);
assert.throws(() => sharedLaunchDependencies(PUDGE_GATE2_GENESIS, fixture), /pinned/);
const key = fixture.market.outPoint.txHash + ':' + fixture.market.outPoint.index;
for (const bad of [undefined, {status:'dead'}, {status:'live',cell:{data:{content:'0xff'}}}]) {
  live.set(key, bad);
  await assert.rejects(planSharedLaunch(rpc, b), /dependency unavailable or changed/);
  await assert.rejects(restart.prepareStage('purchase', purchaseJournal), /dependency unavailable or changed/);
}
assert.deepEqual(parseWizard(JSON.stringify(PUDGE_GATE2_JOURNAL)), PUDGE_GATE2_JOURNAL);
console.log(JSON.stringify({creators:[first,second].map(plan=>({
  market:plan.scope.market, token:plan.identity.token.hash(), custody:plan.identity.custody.hash(),
})), accounting:first.accounting}, (_, value) => typeof value === 'bigint' ? value.toString() : value));

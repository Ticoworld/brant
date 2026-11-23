import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {planSharedLaunch, sharedLaunchStages} from '../lib/v2-engine/shared-launch.ts';
import {authorizeSharedLaunchSetup, recoverSharedLaunch, reconcileSharedLaunchStage, submitSharedLaunchStage} from '../lib/v2-engine/shared-launch-controller.ts';
import {openSharedLaunchStore} from '../lib/v2-engine/shared-launch-store.ts';
import {buildTransition} from '../lib/v2-engine/transaction.ts';
import {decodeCurve} from '../lib/v2-engine/curve.ts';
import {discoverCustodyPair, recoverMarketHistory} from '../lib/v2-engine/lineage.ts';

async function canonicalReceipt(rpc, hash) {
  const {transaction, tx_status: status} = await rpc('get_transaction', [hash]);
  assert.equal(status.status, 'committed');
  assert.equal(transaction.hash, hash);
  const block = await rpc('get_block_by_number', [status.block_number]);
  assert.equal(block.header.hash, status.block_hash);
  assert(block.transactions.some(transaction => transaction.hash === hash));
  return {hash, blockHash: status.block_hash, blockNumber: status.block_number};
}

async function waitForIndexer(rpc) {
  const tip = await rpc('get_tip_header', [], AbortSignal.timeout(1000));
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const indexed = await rpc('get_indexer_tip', [], AbortSignal.timeout(1000));
    if (indexed?.block_hash === tip.hash) return;
    await delay(100);
  }
  throw Error(`Indexer did not reach canonical tip ${tip.hash}`);
}

export async function runSharedLaunch({rpc, genesis, hashes, deps, secp, wallets, locks, cell, tx, sign, commit, makeProof, le, out, camel, restartNode}) {
  const unit = 100_000_000n;
  const fundingFee = 100_000n;
  const funded = await commit('wo3b-fund-creators', sign(tx([wallets[2]], [
    cell(500n * unit, locks[0]), cell(1100n * unit, locks[0]),
    cell(500n * unit, locks[1]), cell(1100n * unit, locks[1]),
    cell(wallets[2].capacity - 3200n * unit - fundingFee, locks[2]),
  ]), [wallets[2]], [2]));
  const names = {market:'market_smt', marker:'marker_candidate', ownerLock:'owner_lineage_candidate',
    custody:'custody_smt', custodyMarker:'custody_marker', xudt:'xudt'};
  const fixture = Object.fromEntries(Object.entries(names).map(([name, source]) =>
    [name, {...deps[source], dataHash:hashes[source]}]));
  const point = ({txHash,index}) => ({tx_hash:txHash,index});
  const legacy = transaction => {
    const converted = camel(cccA.JsonRpcTransformers.transactionFrom(transaction));
    for (const dep of converted.cellDeps) {
      if (dep.depType === 'dep_group') dep.depType = 'depGroup';
    }
    return converted;
  };
  const secpRow = await rpc('get_live_cell', [point(secp.outPoint), true]);
  fixture.secp = {...secp, dataHash:ccc.hashCkb(secpRow.cell.data.content)};
  const dbPath = join(out, 'launch.sqlite');
  let store = openSharedLaunchStore(dbPath);
  const results = [];
  const restart = {errors: []};
  try {
    for (const role of [0,1]) {
      const creator = ccc.Script.from(locks[role]);
      const anchor = funded[2*role];
      const identity = (await import('../lib/v2-engine/initialization.ts')).deriveMarketIdentity({
        anchor:anchor.outPoint, genesis, base:10n*unit, step:unit, supply:2000n,
        codes:{market:fixture.market.dataHash, marker:fixture.marker.dataHash, owner:fixture.ownerLock.dataHash,
          custody:fixture.custody.dataHash, custodyMarker:fixture.custodyMarker.dataHash, xudt:fixture.xudt.dataHash},
      });
      const domain = {genesis_hash:genesis, market_script_hash:identity.market.hash(),
        xudt_type_script_hash:identity.token.hash(), custody_marker_type_hash:identity.custodyMarker.hash()};
      const leaf = {owner:creator.hash(), balance:1n, revision:0n};
      const config = {genesis, fixture, creator, anchor, funding:[funded[2*role+1]], reservedAnchors:[], quantity:1n,
        feeRate:1000n, verifyProof:async (owner, quantity, price) => {
          assert.equal(owner, leaf.owner);
          assert.equal(quantity, leaf.balance);
          assert.equal(price, 10n*unit);
          const proof = makeProof(domain, 0, [], [leaf], le(price));
          return {owner, witness:proof.witness, newRoot:proof.root};
        }};
      let plan = await planSharedLaunch(rpc, config);
      const {scope, stageHashes} = plan;
      let setup, issuance, purchase;
      for (const stage of sharedLaunchStages) {
        const review = stage === 'setup' ? plan.projected.setup : await plan.prepareStage(stage, store.read(scope, stageHashes));
        const inputs = stage === 'setup' ? config.funding : stage === 'issuance' ? [anchor, setup[0]] : [...issuance.slice(0,2), setup[1]];
        const unsigned = legacy(review);
        const signed = ccc.Transaction.from(sign(unsigned, inputs, [role]));
        let outputs;
        const restartHere = role === 1 && stage === 'purchase';
        const send = async candidate => {
          outputs = await commit(`wo3b-creator-${role}-${stage}`, legacy(candidate));
          if (restartHere) throw Error('Simulated lost acknowledgement');
          return outputs[0].outPoint.txHash;
        };
        if (stage === 'setup') {
          await assert.rejects(authorizeSharedLaunchSetup(rpc, store, config, review, send), /signature witness/);
          assert.throws(() => store.read(scope, stageHashes), /reservation/);
        }
        const submit = () => stage === 'setup'
          ? authorizeSharedLaunchSetup(rpc, store, config, signed, send)
          : submitSharedLaunchStage(store, plan, stage, signed, send);
        if (restartHere) await assert.rejects(submit(), /lost acknowledgement/);
        else await submit();
        store.close();
        store = openSharedLaunchStore(dbPath);
        assert.throws(() => store.recordSubmission(scope, stageHashes, stage), /requires reconciliation/);
        if (restartHere) {
          const purchaseHash = outputs[0].outPoint.txHash;
          restart.transactionsBefore = await Promise.all([results[0].trade, purchaseHash].map(hash => canonicalReceipt(rpc, hash)));
          const pending = store.read(scope, stageHashes);
          await restartNode(restart);
          assert.equal(restart.after.genesis, genesis);
          restart.transactionsAfter = await Promise.all([results[0].trade, purchaseHash].map(hash => canonicalReceipt(rpc, hash)));
          assert.deepEqual(restart.transactionsAfter, restart.transactionsBefore);
          assert.equal(store.read(scope, stageHashes), pending);
          restart.pending = JSON.parse(pending).entries.at(-1);
          assert.deepEqual(restart.pending, {stage, txHash: purchaseHash, state: 'submitted'});
          assert.throws(() => store.reserve(scope, stageHashes), /already reserved/);
          assert.throws(() => store.recordSubmission(scope, stageHashes, stage), /requires reconciliation/);
        }
        plan = await recoverSharedLaunch(rpc, store, scope, stageHashes);
        const receipt = await reconcileSharedLaunchStage(store, plan);
        if (restartHere) {
          restart.confirmed = JSON.parse(store.read(scope, stageHashes)).entries.at(-1);
          assert.equal(restart.confirmed.state, 'confirmed');
          assert.equal(restart.confirmed.txHash, restart.pending.txHash);
          assert.equal(restart.confirmed.blockHash, restart.transactionsAfter[1].blockHash);
          assert.throws(() => store.confirm(scope, stageHashes, receipt), /pending launch stage/);
          restart.duplicateConfirmationRejected = true;
        }
        if (stage === 'setup') {
          setup = outputs;
        } else if (stage === 'issuance') issuance = outputs;
        else purchase = outputs;
      }
      const continuation = makeProof(domain, 1, [leaf], [{...leaf, balance:2n, revision:1n}]);
      const inputs = [...purchase.slice(0,4), setup[2]];
      const {amount, ...trade} = buildTransition({curve:decodeCurve(identity.market.args,purchase[0].data), cells:inputs,
        custodyAmount:1n, newRoot:continuation.root, witness:continuation.witness, fee:fundingFee, side:'buy', quantity:1n});
      const next = await commit(`wo3b-creator-${role}-buy`, sign({
        ...trade, version:'0x0', cellDeps:legacy(plan.projected.purchase).cellDeps, headerDeps:[genesis],
      }, inputs, [role]));
      assert.equal(next[0].capacity - purchase[0].capacity, amount);
      const initial = [issuance[0].outPoint, issuance[1].outPoint].map(point);
      results.push({scope, stageHashes, initial, trade:next[0].outPoint.txHash, root:continuation.root,
        custodyLock:identity.custody.hash(), token:identity.token.hash(), accounting:plan.accounting});
      await waitForIndexer(rpc);
      const recoveredMarkets = [];
      for (const result of results) {
        const recovered = await recoverMarketHistory(rpc, result.initial, {maxIndexedDepth:16});
        assert(recovered.pair.every(output => output.tx_hash === result.trade));
        assert.equal(recovered.lineage.length, 3);
        const final = recovered.lineage.at(-1).transaction;
        assert.equal(final.hash, result.trade);
        assert.equal(ccc.Script.from(camel(final.outputs[0].lock)).hash(), result.scope.market);
        const custody = await discoverCustodyPair(rpc, {tx_hash: result.trade, index: '0x2'});
        assert.deepEqual(custody, ['0x2', '0x3'].map(index => ({tx_hash: result.trade, index})));
        const live = await rpc('get_live_cell', [custody[0], true]);
        assert.equal(live.status, 'live');
        assert.equal(live.cell.data.content, final.outputs_data[2]);
        assert.equal(ccc.Script.from(camel(live.cell.output.lock)).hash(), result.custodyLock);
        assert.equal(ccc.Script.from(camel(live.cell.output.type)).hash(), result.token);
        const root = '0x' + live.cell.data.content.slice(34);
        assert.equal(root, result.root);
        recoveredMarkets.push({market: result.scope.market, trade: result.trade, pair: recovered.pair, custody, root});
      }
      if (role === 1) restart.recoveredMarkets = recoveredMarkets;
    }
    assert.notEqual(results[0].scope.market, results[1].scope.market);
    assert.notEqual(results[0].token, results[1].token);
    assert.notEqual(results[0].custodyLock, results[1].custodyLock);
    assert.notEqual(results[0].root, results[1].root);
    writeFileSync(join(out,'shared-launch-summary.json'), JSON.stringify({genesis,fixture,results},
      (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    console.log('Shared launch evidence', out);
  } catch (error) {
    restart.errors.push(error.stack, ...(error.cause ? [String(error.cause)] : []));
    throw error;
  } finally {
    writeFileSync(join(out, 'shared-launch-restart.json'), JSON.stringify(restart, null, 2));
    store.close();
  }
}

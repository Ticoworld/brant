import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {planSharedLaunch, sharedLaunchStages} from '../lib/v2-engine/shared-launch.ts';
import {openSharedLaunchStore} from '../lib/v2-engine/shared-launch-store.ts';
import {verifyInitializationStage} from '../lib/v2-engine/initialization-lifecycle.ts';
import {buildTransition} from '../lib/v2-engine/transaction.ts';
import {decodeCurve} from '../lib/v2-engine/curve.ts';
import {recoverMarketHistory} from '../lib/v2-engine/lineage.ts';

export async function runSharedLaunch({rpc, genesis, hashes, deps, secp, wallets, locks, cell, tx, sign, commit, makeProof, le, out, camel}) {
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
      store.reserve(scope, stageHashes);
      assert.throws(() => store.reserve(scope, stageHashes), /already reserved/);
      let setup, issuance, purchase;
      for (const stage of sharedLaunchStages) {
        const review = await plan.prepareStage(stage, store.read(scope, stageHashes));
        const inputs = stage === 'setup' ? config.funding : stage === 'issuance' ? [anchor, setup[0]] : [...issuance.slice(0,2), setup[1]];
        store.recordSubmission(scope, stageHashes, stage);
        const unsigned = legacy(review);
        const outputs = await commit(`wo3b-creator-${role}-${stage}`, sign(unsigned, inputs, [role]));
        store.close();
        store = openSharedLaunchStore(dbPath);
        assert.throws(() => store.recordSubmission(scope, stageHashes, stage), /requires reconciliation/);
        const receipt = await verifyInitializationStage(rpc, genesis, stage, review, inputs.map(input => input.outPoint),
          stage === 'purchase' ? [0,1,2,3] : [0,1]);
        store.confirm(scope, stageHashes, receipt);
        if (stage === 'setup') {
          setup = outputs;
          plan = await planSharedLaunch(rpc, {...config, resumeJournal:store.read(scope, stageHashes)});
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
      results.push({scope, stageHashes, initial, trade:next[0].outPoint.txHash, root:continuation.root, accounting:plan.accounting});
      for (const result of results) {
        const recovered = await recoverMarketHistory(rpc, result.initial, {maxIndexedDepth:16});
        assert.equal(recovered.pair[0].tx_hash, result.trade);
        assert.equal(recovered.lineage.length, 3);
      }
    }
    assert.notEqual(results[0].scope.market, results[1].scope.market);
    assert.notEqual(results[0].root, results[1].root);
    writeFileSync(join(out,'shared-launch-summary.json'), JSON.stringify({genesis,fixture,results},
      (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    console.log('Shared launch evidence', out);
  } finally {
    store.close();
  }
}

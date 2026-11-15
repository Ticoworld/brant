// Check the independently captured multi-checkpoint devnet evidence without rerunning CKB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.resolve(process.argv[2] || '');
assert(dir && fs.existsSync(path.join(dir, 'events.json')), 'usage: node verify-liquid-cells-history-evidence.cjs <evidence-dir>');
const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
const life = read('history-lifecycle.json');
const events = read('events.json');
const cases = read('cases.json');
const replay = read('history-reconstruction/history-reconstruction.json');
const labels = events.map((event) => event.label);
assert.deepEqual(labels, [
  'deploy_anchor', 'deploy_permissionless_anchor_lock',
  'create_permissionless_anchor_and_user_deposit',
  'commit_genesis_published_checkpoint', 'commit_seq/cp2_published_checkpoint',
  'commit_seq/cp3_published_checkpoint', 'commit_seq/cp4_published_checkpoint',
  'independent_user_exits_after_four_checkpoint_history',
]);
assert.equal(events.length, 8);
assert(events.every((event) => event.committed.tx_status.status === 'committed'));
assert.equal(life.checkpoints.length, 4);
assert.equal(replay.checkpoint_count, 4);
assert.equal(replay.snapshot_balance_total_shannons, replay.latest_anchor.total_shannons);
assert.equal(replay.latest_anchor.sequence, '4');
assert.equal(replay.latest_anchor.transaction, life.checkpoints[3]);
assert.deepEqual(replay.checkpoint_transactions.map((entry) => entry.hash), life.checkpoints);
assert.equal(replay.proofs.length, 2);
assert.equal(replay.proofs[0].root, replay.latest_anchor.root);
assert.equal(replay.proofs[1].root, replay.latest_anchor.root);
assert.equal(replay.proofs[1].balance_shannons, '1000');
assert.equal(life.owner_exit.hash, events.at(-1).hash);
assert.equal(life.owner_exit.maturity_epoch, '183');
assert.equal(life.residual_accounted_total_shannons, '4000');
assert.equal(life.successor_anchor_capacity_shannons, '50000004000');
assert.equal(cases.length, 4);
const byLabel = Object.fromEntries(cases.map((testCase) => [testCase.label, testCase]));
assert.match(byLabel.stale_cp1_proof_rejected_against_cp4_live_anchor.error, /error code 62/);
assert.equal(byLabel['1000_shannon_owner_exit_rejected_by_real_node_or_contract'].method, 'send_transaction');
assert.match(byLabel['1000_shannon_owner_exit_rejected_by_real_node_or_contract'].error, /InsufficientCellCapacity/);
assert.match(byLabel.sponsored_standard_cell_rejected_by_exact_balance_payout_rule.error, /error code 67/);
assert.match(byLabel.second_exit_conflicts_on_already_spent_shared_anchor.error, /Unknown\(OutPoint/);
const report = {
  result: 'PASS',
  committed_transactions: events.length,
  sequential_checkpoints: replay.checkpoint_count,
  latest_sequence: replay.latest_anchor.sequence,
  state_total_matches_anchor: true,
  native_rejections: {
    stale_proof: 'type-script error 62',
    '1000_shannon_output': 'CKB node InsufficientCellCapacity on send_transaction',
    sponsored_standard_output: 'type-script error 67 (exact-balance payout)',
    spent_anchor_reuse: 'Unknown OutPoint after prior exit committed',
  },
  operatorless_user_exit_committed: life.owner_exit.hash,
  caveat: 'The permissionless anchor lock is an always-success test lock; the anchor type script constrains the tested transition. This is a research fixture, not a deployable security design.',
};
fs.writeFileSync(path.join(dir, 'evidence-verification.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

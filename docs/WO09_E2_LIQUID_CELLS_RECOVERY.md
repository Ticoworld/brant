# WO09-E2 Liquid Cells recovery and exit findings

## Scope and source pin

This checkpoint tests the published Liquid Cells implementation at upstream commit
`47492b51673c94635ab23de2c55477625e94ccbf`. It does not resume the quarantined WO09-E1
beneficiary validation or A2 LO-01 work. The native fixture used the repository's isolated
single-hart anchor binary, SHA-256
`04a31bf62a4aff38a2e51c0aace5f2b253828424127336f64e55d29c015ce817`, on CKB 0.210.0.
That compatibility binary is experimental and is not production-qualified.

## OBSERVE → ASK WHY → IF / ELSE / WHAT IF

Inspection of `crates/ckb-contract/src/escape.rs::force_exit` confirms that a force exit
subtracts the proven account balance from both the anchor capacity and pool total, while carrying
forward sequence, fee accumulator and `last_epoch`. The anchor-lock continuity check in
`crates/ckb-contract/src/cells.rs::bind` requires the successor to retain the same lock. Only a
checkpoint updates `last_epoch`; a force exit does not. Therefore force exits do not restart the
180-epoch timeout for later claimants. No frozen-exit mode is justified by the inspected code or
these tests.

The contract requires an absolute epoch `since >= last_epoch + 180`; it has no upper expiry.
The upstream `redteam_drain.rs` test passed on the pinned source and the isolated single-hart
artifact under CKB testtool. It demonstrates that full drain preserves genesis slack (`capacity −
total`) and leaves the anchor above the test's conservative occupied-capacity bound. This is a
testtool proof, not a full-drain transaction on the private CKB node.

The more consequential fixture assumption was anchor authorization. A realistic role split was
tested on a disposable CKB 0.210.0 chain: a distinct claimant controls the paying fee cell, the
owner controls the redeemed account and payout lock, and no operator key signs the exit. With a
permissionless anchor lock, the valid exit committed. With the operator's secp lock, a claimant-only
attempt was rejected by the lock script; the equivalent operator-signed attempt passed in the
previous checkpoint. A timeout does not override an anchor lock's authorization rule.

The permissionless experiment used an always-success lock. Its result shows that the anchor type
script can authorize a proof-bound exit without an operator signature; it does not establish a
safe permissionless production lock. Any replacement must constrain anchor continuity, avoid
unintended transitions, and support checkpoint operation as well as exits.

## Four-checkpoint recovery and concurrency

The raw evidence in
`labs/wo09-e2-capacity/evidence/liquid-cells-multicheckpoint-operatorless-recovery-1793624376320/`
contains eight committed transactions: two code deployments, permissionless anchor plus deposit,
four published Groth16 checkpoints, and one mature claimant exit. The anchor history advances
sequentially from sequence 1 through 4. Each transition committed on CKB 0.210.0.

A fresh Node child process retrieved the committed transactions through live CKB RPC. It parsed
each checkpoint's WitnessArgs, public values and DA records, checked the previous root/sequence,
successor root/sequence/total/epoch, rebuilt a full account snapshot, checked that its summed
balances equal the latest anchor total, then generated proofs for two keys without fixture files,
indexer state or sequencer database state. The latest state total is `9,999,600,000` shannons.
The owner proof covers `9,999,596,000` shannons; the second published fixture record covers
1,000 shannons. A stale proof reconstructed from checkpoint 1 was rejected against checkpoint 4
with anchor type-script error 62.

After the actual chain reached epoch 183 (1,800 generated blocks from the latest fixture state),
the claimant-signed-fee, operatorless exit committed as
`0x2b17d775d1531b41f5907214f0c6a01bc554da1324d6a31e888f5d67dc9f0a4c`. Its output pays the exact
proven account balance to the owner lock; the successor anchor keeps 50,000,004,000 shannons and
accounts for the remaining 4,000. A second transaction trying to spend the same prior anchor was
rejected as an unknown spent outpoint. The experiment demonstrates conflict on one shared anchor;
it does not demonstrate two different successful owner exits from one same-anchor state.

## Small-claim boundary and costs

The 1,000-shannon direct payout was submitted to the real node and rejected with
`InsufficientCellCapacity(Outputs[1])`: the requested 1,000 shannons are below the occupied
capacity of the ordinary secp Cell. A 61 CKB sponsored output was then checked with
`estimate_cycles` and rejected by Liquid Cells error 67 because `force_exit` requires the payout
Cell capacity to equal the proven balance. This establishes the current exit API's exact-payout
constraint. It does not test ACP, aggregation, a solver or Fiber because this fixture supplied no
valid ACP output arrangement, external settlement route or relevant claimant consent.

Separate live-node transactions attempting ordinary secp Cells of 0.1 CKB and 1 CKB were also
rejected as `InsufficientCellCapacity`; see
`labs/wo09-e2-capacity/evidence/ckb-small-cell-floor-1793624676771/`. Those two transactions
measure CKB's output floor only: they do not carry authenticated Liquid Cells proofs and are not
claimed as valid 0.1 or 1 CKB account exits. Upstream source inspection shows why the current
contract cannot use a larger pre-existing recipient Cell or ACP output to evade that floor:
`has_exit_output` specifically requires a canonical secp lock and an output whose capacity equals
the account balance. A merged output or non-secp ACP output fails that predicate. Consequently,
the obvious sponsor/ACP/aggregation variants need a different authenticated payout representation
or a separate settlement mechanism; they are not fixes that can be enabled by transaction
construction alone.

Committed transaction measurements are preserved in `events.json`. The four checkpoints consumed
about 86.8 million cycles apiece and were 1,233 bytes each after genesis; the successful exit used
about 10.0 million cycles and was 9,077 bytes, including its proof witness. The genesis anchor
started at 500 CKB, while the 100 CKB deposit was represented in the accounting state; 50,000 CKB
remained as anchor capacity after the large exit. These figures describe this fixture and are not
generalized cost guarantees.

## Preservation and limits

Run `node labs/wo09-e2-capacity/src/verify-liquid-cells-history-evidence.cjs <evidence-dir>` to
validate the saved event history, fresh-RPC reconstruction and rejection causes. The evidence
directory also retains earlier failed runs, including the first attempt where a tiny payout was
tested before maturity and the initial run where `estimate_cycles` accepted a transaction that the
real send path later rejected for occupied capacity. Those were harness/validation-order failures,
not protocol findings.

Still untested: two distinct sufficiently funded owners exiting sequentially; fresh recovery after
operator/database destruction and restart; reorg handling; same-anchor competing owner transactions
submitted concurrently; a production-suitable permissionless anchor lock; real-chain full drain;
0.1 and 1 CKB claim variants; ACP, aggregated custody, buyer/solver sponsorship, Fiber/channel
settlement and bonded sponsorship; and Rust `-C passes=lower-atomic` against CKB 0.210.0. The test
lock and single-hart binary remain research artifacts. No claim is made that small-value self-custody,
commercial competitiveness or production security has been solved.

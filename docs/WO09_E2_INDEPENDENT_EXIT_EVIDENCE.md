# Independent exit evidence

## Demonstrated

The completed wallet swap leaves each participant's new xUDT and native CKB in normal owner-controlled replacement Cells. No exchange order or balance Cell is created. A missing buyer signature and a changed signed receipt fail; replaying consumed inputs is rejected. Evidence is in state-free-wallet-swap-1793612217172.

This is a signed complete-fill spot exchange. It is not a pooled liability, small standalone withdrawal, data-availability proof, or lost-operator recovery mechanism. The assets were locally issued fixture xUDT and CKB on an isolated dev chain.

## Not demonstrated

Merkle/CoTA proof reconstruction, root updates, bitmap exits, operator/database loss, owner proof without private indexer, 16+ concurrent exits, same-root retries, reorgs, ACP or a missing-cell entrant were not executed. Perun/Fiber/Myelin exit procedures were source-reviewed only. General authenticated owner recovery and A2 LO-01 remain unresolved. E1 beneficiary-specific validation remains quarantined and was not resumed.

## Required next proof

Build the pinned Liquid Cells revision and run its CKB-VM force-exit and withdrawal tests. If they pass, independently replay deposit and unilateral exit on disposable private devnet, reconstructing the exit witness from chain-published DA without sequencer/indexer state. Then test operator data loss, two concurrent claimants, last exit, duplicate spend, sub-floor balance, sponsor absence, and reorg. Do not infer those properties from source alone.


## Pinned pooled-claim comparator source review

Trade reviewed Liquid Cells at `47492b51673c94635ab23de2c55477625e94ccbf`, including its force-exit contract source, CKB-VM test source, DA and threat-model documents. The source specifies an inclusion proof against the anchor root, same-path leaf nullification, exact pool-total/capacity deltas, a 180-epoch operator-silence gate, and a payout lock derived from the leaf public key. Its published test source has a positive case and six force-exit negatives; these upstream tests were **not run** in this environment. This is source review, not a Trade execution or security PASS.

The upstream mechanism removes individual balance Cells while requiring a shared pool anchor and durable checkpoint DA. Users reconstruct proofs from checkpoint history and must compare the rebuilt root to the live anchor; cold reconstruction is O(history) without a verified snapshot path. The documented direct exit remains limited by the roughly 61 CKB standalone payout Cell. Below that threshold the proposed atomic-swap/Fiber path depends on another participant and available liquidity, so it is not unilateral exit during operator failure. All exits touch the shared anchor; sharding can reduce cross-shard conflicts but leaves within-shard contention. Full evidence and pinned hashes are in [`WO09_E2_LIQUID_CELLS_SOURCE_REVIEW.md`](WO09_E2_LIQUID_CELLS_SOURCE_REVIEW.md).

The current environment has neither `cargo` nor `rustc`; source tests and private-devnet reproduction were therefore not run. The next decisive permitted step is to use a pinned Rust/CKB build toolchain to run the upstream CKB-VM cases, then independently replay the contract on disposable private devnet and reconstruct an exit from chain-published DA alone. Neither that work nor any quarantined WO09-E1 beneficiary test has been performed.

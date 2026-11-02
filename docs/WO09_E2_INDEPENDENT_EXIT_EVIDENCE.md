# Independent exit evidence

## Demonstrated

The completed wallet swap leaves each participant's new xUDT and native CKB in normal owner-controlled replacement Cells. No exchange order or balance Cell is created. A missing buyer signature and a changed signed receipt fail; replaying consumed inputs is rejected. Evidence is in state-free-wallet-swap-1793612217172.

This is a signed complete-fill spot exchange. It is not a pooled liability, small standalone withdrawal, data-availability proof, or lost-operator recovery mechanism. The assets were locally issued fixture xUDT and CKB on an isolated dev chain.

## Not demonstrated

The pinned Liquid Cells upstream host suite and CKB-VM force-exit tests now execute, but Trade has not independently reconstructed a user's proof from chain-published checkpoint history or submitted the exit to a private devnet. Bitmap exits, operator/database loss, owner proof without private indexer, 16+ concurrent exits, same-root retries, reorgs, ACP or a missing-cell entrant were not executed. Perun/Fiber/Myelin exit procedures were source-reviewed only. General authenticated owner recovery and A2 LO-01 remain unresolved. E1 beneficiary-specific validation remains quarantined and was not resumed.

## Required next proof

Build the pinned Liquid Cells revision and run its CKB-VM force-exit and withdrawal tests. If they pass, independently replay deposit and unilateral exit on disposable private devnet, reconstructing the exit witness from chain-published DA without sequencer/indexer state. Then test operator data loss, two concurrent claimants, last exit, duplicate spend, sub-floor balance, sponsor absence, and reorg. Do not infer those properties from source alone.


## Pinned pooled-claim comparator source review

Trade reviewed Liquid Cells at `47492b51673c94635ab23de2c55477625e94ccbf`, including its force-exit contract source, CKB-VM test source, DA and threat-model documents. The source specifies an inclusion proof against the anchor root, same-path leaf nullification, exact pool-total/capacity deltas, a 180-epoch operator-silence gate, and a payout lock derived from the leaf public key. Its upstream CKB-VM suites ran against the locally built RISC-V contract and passed 24/24: 7 force-exit, 4 withdrawal-binding, and 13 anchor/checkpoint/DA cases. The compiler adapter differs from upstream CI clang and no private devnet exit was run. This is bounded CKB-VM evidence, not a Trade security or production PASS.

The upstream mechanism removes individual balance Cells while requiring a shared pool anchor and durable checkpoint DA. Users reconstruct proofs from checkpoint history and must compare the rebuilt root to the live anchor; cold reconstruction is O(history) without a verified snapshot path. The documented direct exit remains limited by the roughly 61 CKB standalone payout Cell. Below that threshold the proposed atomic-swap/Fiber path depends on another participant and available liquidity, so it is not unilateral exit during operator failure. All exits touch the shared anchor; sharding can reduce cross-shard conflicts but leaves within-shard contention. Full evidence and pinned hashes are in [`WO09_E2_LIQUID_CELLS_SOURCE_REVIEW.md`](WO09_E2_LIQUID_CELLS_SOURCE_REVIEW.md).

The upstream host-side STF suite passed 49 default-feature tests. The pinned anchor contract, built from unchanged source with a checksum-pinned Zig RISC-V adapter (not upstream CI's clang), then passed 24 CKB-testtool/CKB-VM tests: 7 force-exit, 4 withdrawal-binding, and 13 checkpoint/DA cases. Raw logs, exit codes, compiler pin and binary hash are preserved. These are upstream CKB-VM tests, not committed private-devnet transactions. The decisive next permitted step is a private-devnet deposit and real-epoch unilateral exit reconstructed from chain-published DA. No WO09-E1 beneficiary test has been performed.

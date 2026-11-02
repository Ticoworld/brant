# Independent exit evidence

## Demonstrated

The completed wallet swap leaves each participant's new xUDT and native CKB in normal owner-controlled replacement Cells. No exchange order or balance Cell is created. A missing buyer signature and a changed signed receipt fail; replaying consumed inputs is rejected. Evidence is in `labs/wo09-e2-capacity/evidence/state-free-wallet-swap-1793612217172`.

The pinned Liquid Cells `fixtures/genesis` flow now has actual private-devnet transactions: contract deployment, empty anchor plus 100 CKB deposit, Groth16 checkpoint with DA, and a mature owner force exit after 180 real private-chain epochs. A fresh child process fetched the committed checkpoint transaction from live local CKB RPC, rebuilt an inclusion proof from its published DA, and matched the proof root to the checkpoint anchor. The anchor rejected tampered DA, an early exit, and an incorrect payout (codes 59, 66, 67). Exact transactions and raw RPC evidence are in `docs/WO09_E2_PRIVATE_DEVNET_LIFECYCLE.md` and `labs/wo09-e2-capacity/evidence/liquid-cells-pinned-genesis-checkpoint-force-exit-1793616517454`.

The exact single-hart build used for that chain run also passes the upstream force-exit (7), withdrawal (4), and anchor/checkpoint/DA (13) CKB-testtool suites. The unmodified upstream contract binary failed on the actual CKB 0.210 node with `InvalidInstruction` for an A-extension instruction. The private-chain pass depends on an isolated bytes 1.11.1 single-hart compatibility build; it is not an upstream fix. See the lifecycle report.

## Not demonstrated

The proof was rebuilt by a fresh child process using DA and public values fetched from the committed checkpoint transaction through the live local CKB RPC; no fixture, indexer, or sequencer files were reconstruction inputs. This does not prove archival retrieval, sequencer/database-loss recovery, complete history replay, simultaneous exits, same-root retry behavior, last-exiter behavior, reorgs, ACP, or a missing-cell entrant. The tested balance was 99.99899 CKB, above the roughly 61 CKB standalone payout floor; sub-floor unilateral exit remains unavailable. Perun/Fiber/Myelin exit procedures remain source-reviewed only. General authenticated owner recovery and A2 LO-01 remain unresolved. E1 beneficiary-specific validation remains quarantined.

## Next proof

Test archival retrieval and full multi-checkpoint history replay in a fresh process, then exercise two exits and a last-exiter case on an isolated chain. Preserve the dependency-build limitation and compare exact capital/fees with the existing alternatives. Do not infer liveness beyond the tested path.


## Pinned pooled-claim comparator source review

Trade reviewed Liquid Cells at `47492b51673c94635ab23de2c55477625e94ccbf`, including its force-exit contract source, CKB-VM test source, DA and threat-model documents. The source specifies an inclusion proof against the anchor root, same-path leaf nullification, exact pool-total/capacity deltas, a 180-epoch operator-silence gate, and a payout lock derived from the leaf public key. Its CKB-VM suites passed 24/24 on the disclosed single-hart compatibility build, and a separate bounded owner exit committed on private devnet. The initial unmodified build failed actual-node ISA validation. This evidence is not a general Trade security or production PASS.

The upstream mechanism removes individual balance Cells while requiring a shared pool anchor and durable checkpoint DA. Users reconstruct proofs from checkpoint history and must compare the rebuilt root to the live anchor; cold reconstruction is O(history) without a verified snapshot path. The documented direct exit remains limited by the roughly 61 CKB standalone payout Cell. Below that threshold the proposed atomic-swap/Fiber path depends on another participant and available liquidity, so it is not unilateral exit during operator failure. All exits touch the shared anchor; sharding can reduce cross-shard conflicts but leaves within-shard contention. Full evidence and pinned hashes are in [`WO09_E2_LIQUID_CELLS_SOURCE_REVIEW.md`](WO09_E2_LIQUID_CELLS_SOURCE_REVIEW.md).

The upstream host-side STF suite passed 49 default-feature tests. The pinned anchor contract's single-hart variant passed 24 CKB-testtool/CKB-VM tests: 7 force-exit, 4 withdrawal-binding, and 13 checkpoint/DA cases. It also committed a fixture deposit, checkpoint and mature owner exit on a local CKB 0.210.0 devnet. The proof came from DA fetched in a fresh process through live local CKB RPC, not from fixture files; archival RPC retrieval, RPC loss, and complete history replay remain untested. Raw logs, exit codes, compiler pin and binary hash are preserved. No WO09-E1 beneficiary test has been performed.

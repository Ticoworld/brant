# WO09-E2: Liquid Cells pinned source review

## Scope and provenance

This is an independent source review and bounded execution reproduction of `LusoCryptoLabs/Liquid-Cells` at commit `47492b51673c94635ab23de2c55477625e94ccbf`. The tracked upstream source remains unchanged. The pinned repository identifies an MIT license, copyright Tecmeup 2026. This work does not certify the architecture, and it does not touch the quarantined WO09-E1 beneficiary experiment.

The upstream files reviewed are:

| File at pinned commit | SHA-256 |
|---|---|
| `docs/FORCE-EXIT.md` | `c970de780d25d0b8d352b4057fae3f7c5b577dc65591fba3e8f959c6e3ac384c` |
| `docs/DA.md` | `acb100fd1ebd3ac0a82df1c0fdca9bd5ac34e9996a61c070cfbf8ec0b848b48f` |
| `docs/THREAT-MODEL.md` | `f7f06f652397c3772e8bab903b53129004a8e69c0e8c7175e790447e3630af6c` |
| `crates/ckb-contract/src/escape.rs` | `9a2aa15bde4263cdc2f658b0c9f43515b5a2bf9b20a1d199edebbdf2ca7f02a5` |
| `crates/ckb-contract-tests/tests/forceexit.rs` | `afd9b27634ccb4cc50cb26e74b3a8a9546a82a83c28f5c657f2e67f2290954ad` |
| `crates/ckb-contract-tests/tests/withdrawal.rs` | `44f48f5b7f6e39dfef3f6598c9b4c121c3547fe4b5c21dbcbda08eef94ea3024` |

The structured record is `labs/wo09-e2-capacity/research/liquid-cells-source-review.json`.

## What the pinned implementation claims to enforce

`escape.rs::force_exit` checks an inclusion path for `{balance, nonce}` against the consumed anchor root, checks a same-sibling path for the nullified `{0, nonce}` leaf against the output root, decreases pool total and anchor capacity by the exact balance, preserves sequence/fee/last-epoch fields, checks an absolute-epoch `since` at least 180 epochs after the anchor's last checkpoint, and requires a payout output with exact capacity and a canonical secp256k1 lock whose args are derived from the leaf pubkey. This is materially stronger than the “root alone proves exit” shorthand: it combines an authenticated leaf, replay-state nullification, owner-derived destination, value conservation and a timeout gate.

The source's `forceexit.rs` CKB-VM test suite constructs a real sparse-Merkle tree and inclusion proof, then tests one positive exit and negatives for before-timeout, wrong balance, wrong payout lock, missing payout, unnullified root and inconsistent total. All seven cases passed against the locally built RISC-V contract. The withdrawal-binding suite passed its valid deposit/withdrawal and three binding negatives. The anchor/checkpoint suite passed all thirteen cases, including DA binding and a valid proof. These are CKB-testtool executions of upstream test sources; the local compiler adapter is disclosed above.

## Capacity and recovery boundary

This design moves user balances into an authenticated shared state anchored by a pool Cell. Its DA design places a post-state record of 56 bytes per touched leaf in each checkpoint witness; users are expected to reconstruct the tree from all published checkpoint blobs, verify the reconstructed root against the live anchor, and derive their own sibling path. The full-depth exit witness is 8,249 bytes in the deployed format. The upstream DA guide says the history is read from an archival CKB node and acknowledges genesis replay is O(history); snapshots are advisory until compaction.

A successful unilateral force exit produces a standalone CKB payout Cell. The upstream force-exit and threat-model docs identify the roughly 61-CKB occupied-capacity boundary: below it, a user does not get that unilateral L1 exit. The proposed small-balance path is an atomic swap / Fiber egress against in-pool value. That needs a willing counterparty and liquidity; the source's own C1 classification marks sub-61-CKB trustless exit as bounded, not solved. A live pool therefore reduces per-user persistent state but does not make a 0.01-CKB balance independently withdrawable as a standard L1 Cell.

Every force exit consumes and replaces the shared anchor. Unrelated user exits therefore conflict on the same live anchor outpoint until the operator-silence path is open. The pinned spec describes anchor sharding and batched exits as throughput mitigations. Shards reduce cross-shard conflicts, not contention within a shard, and increase pool/coordination state.

## Evidence grade and unresolved questions

**Grade: pinned source review, 49 host STF tests, 24 CKB-testtool cases on the single-hart build, and actual private-devnet baseline, operator-lock, and permissionless-lock lifecycles.** The private-chain evidence is in `docs/WO09_E2_PRIVATE_DEVNET_LIFECYCLE.md` and `labs/wo09-e2-capacity/evidence/liquid-cells-pinned-genesis-checkpoint-force-exit-1793616517454`.

The initial CKB-testtool binary SHA-256 `dcc6bf2708fef85c0f529ff62c5f745b399d08ec81b0b08ee9c34b13973c8925`, built from unmodified source through the earlier wrapper, failed when deployed to CKB 0.210.0: the node rejected an A-extension `lr.d` instruction (`0x140b35af`). This establishes that the earlier 24/24 testtool result was not equivalent to actual-node compatibility. The exact failed native run is retained at `labs/wo09-e2-capacity/evidence/liquid-cells-pinned-genesis-checkpoint-force-exit-1793615089534`.

The working private-chain binary was rebuilt from a temporary archive of the same pinned source. It removes `+forced-atomics` and patches the pinned `bytes 1.11.1` dependency to use volatile single-hart refcounts, without `Send` or `Sync`. The build is isolated in `labs/wo09-e2-capacity/scripts/build-liquid-cells-single-hart.sh`; the patch source is `labs/wo09-e2-capacity/scripts/ckbvm-single-hart/single_threaded_atomic.rs`. SHA-256 is `04a31bf62a4aff38a2e51c0aace5f2b253828424127336f64e55d29c015ce817`. This variant passed the 7 force-exit, 4 withdrawal-binding, and 13 checkpoint/DA CKB-testtool tests, then executed the private-chain flow. It is a local single-threaded compatibility build, not an upstream code correction or suitable host dependency.

A fresh child process fetched the committed checkpoint transaction through live local CKB RPC and independently generated an SMT inclusion path from its published DA; the proof root matched the anchor output in that transaction. It did not test archival retrieval, RPC loss, or complete history replay in a cold environment. The owner balance exited was 99.99899 CKB, above the standalone output floor. Chain-only cold reconstruction, archive retrieval under sequencer/database loss, simultaneous/last exits, reorgs, sub-floor egress and economic competitiveness remain unresolved.

## Reproduction

The original source-review CKB-testtool runner remains at `labs/wo09-e2-capacity/scripts/run-liquid-cells-ckbvm.sh`. The single-hart private-chain build uses `labs/wo09-e2-capacity/scripts/build-liquid-cells-single-hart.sh` followed by `labs/wo09-e2-capacity/src/run-liquid-cells-private-devnet.cjs`; exact environment variables and commands are in the lifecycle report. A standalone deposit-floor script is `labs/wo09-e2-capacity/src/run-liquid-cells-fixture-deposit.cjs`.

No conclusion here addresses general arbitrary-history recovery safety or upstream A2 LO-01. The WO09-E1 beneficiary-address validation remains quarantined and unresolved.


## Anchor-lock and timer result

The source review and two new CKB 0.210.0 chain runs distinguish the type-script timeout from the anchor Cell lock. `force_exit` carries `last_epoch` unchanged; a restrictive operator secp lock still rejects a mature user-only exit at the lock group (error -2), while an operator-authorized mature exit succeeds. A separately deployed `always_success` anchor lock permits a distinct fee-paying user to submit the mature proof-backed exit without an operator or owner lock signature; the type script still checks the proof, nullified root, exact amount, timeout and owner-derived payout. See [`WO09_E2_ANCHOR_LOCK_RECOVERY.md`](WO09_E2_ANCHOR_LOCK_RECOVERY.md) and its raw private-devnet evidence. The permissionless run exits one account, leaving the fixture's separate 1,000-shannon account; it does not prove full pool drain or two-owner exit.

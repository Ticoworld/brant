# WO09-E2: Liquid Cells pinned source review

## Scope and provenance

This is an independent source review of `LusoCryptoLabs/Liquid-Cells` at commit `47492b51673c94635ab23de2c55477625e94ccbf`. The checkout was temporary under `/tmp`; no upstream source was copied into Trade. The pinned repository identifies an MIT license, copyright Tecmeup 2026. This review does not execute or independently validate Liquid Cells, does not certify its security, and does not touch the quarantined WO09-E1 beneficiary experiment.

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

The source's `forceexit.rs` CKB-VM test suite constructs a real sparse-Merkle tree and inclusion proof, then tests one positive exit and negatives for before-timeout, wrong balance, wrong payout lock, missing payout, unnullified root and inconsistent total. The withdrawal-binding suite likewise describes a real deposit and withdrawal commitment and rejects a changed lock, changed amount or omitted output. These are upstream-published test cases; they were **not run by Trade in this checkpoint**.

## Capacity and recovery boundary

This design moves user balances into an authenticated shared state anchored by a pool Cell. Its DA design places a post-state record of 56 bytes per touched leaf in each checkpoint witness; users are expected to reconstruct the tree from all published checkpoint blobs, verify the reconstructed root against the live anchor, and derive their own sibling path. The full-depth exit witness is 8,249 bytes in the deployed format. The upstream DA guide says the history is read from an archival CKB node and acknowledges genesis replay is O(history); snapshots are advisory until compaction.

A successful unilateral force exit produces a standalone CKB payout Cell. The upstream force-exit and threat-model docs identify the roughly 61-CKB occupied-capacity boundary: below it, a user does not get that unilateral L1 exit. The proposed small-balance path is an atomic swap / Fiber egress against in-pool value. That needs a willing counterparty and liquidity; the source's own C1 classification marks sub-61-CKB trustless exit as bounded, not solved. A live pool therefore reduces per-user persistent state but does not make a 0.01-CKB balance independently withdrawable as a standard L1 Cell.

Every force exit consumes and replaces the shared anchor. Unrelated user exits therefore conflict on the same live anchor outpoint until the operator-silence path is open. The pinned spec describes anchor sharding and batched exits as throughput mitigations. Shards reduce cross-shard conflicts, not contention within a shard, and increase pool/coordination state.

## Evidence grade and unresolved questions

**Grade: pinned source and test-code review only.** Cargo and rustc are not installed in this execution environment (`command -v cargo` and `command -v rustc` returned no executable), so neither upstream contract tests nor a native private-chain reproduction could be run. We also did not independently inspect a deployed testnet pool, replay its checkpoint history, build an exit witness, or submit an exit transaction.

The source review narrows the decisive next reproduction: build the pinned contract and test suite with its required Rust/CKB toolchain; run the CKB-VM force-exit and withdrawal tests; then, if that passes, reproduce against a disposable private devnet from published contract binaries and reconstruct an exit from chain data without sequencer/indexer state. Separately measure a balance below the L1 output floor and document the exact liquidity/route dependency of the alternative egress. Do not describe these steps as complete until performed.

No conclusion here addresses general arbitrary-history recovery safety or upstream A2 LO-01. The WO09-E1 beneficiary-address validation remains quarantined and unresolved.

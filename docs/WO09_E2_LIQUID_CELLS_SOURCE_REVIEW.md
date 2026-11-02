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

The source's `forceexit.rs` CKB-VM test suite constructs a real sparse-Merkle tree and inclusion proof, then tests one positive exit and negatives for before-timeout, wrong balance, wrong payout lock, missing payout, unnullified root and inconsistent total. All seven cases passed against the locally built RISC-V contract. The withdrawal-binding suite passed its valid deposit/withdrawal and three binding negatives. The anchor/checkpoint suite passed all thirteen cases, including DA binding and a valid proof. These are CKB-testtool executions of upstream test sources; the local compiler adapter is disclosed above.

## Capacity and recovery boundary

This design moves user balances into an authenticated shared state anchored by a pool Cell. Its DA design places a post-state record of 56 bytes per touched leaf in each checkpoint witness; users are expected to reconstruct the tree from all published checkpoint blobs, verify the reconstructed root against the live anchor, and derive their own sibling path. The full-depth exit witness is 8,249 bytes in the deployed format. The upstream DA guide says the history is read from an archival CKB node and acknowledges genesis replay is O(history); snapshots are advisory until compaction.

A successful unilateral force exit produces a standalone CKB payout Cell. The upstream force-exit and threat-model docs identify the roughly 61-CKB occupied-capacity boundary: below it, a user does not get that unilateral L1 exit. The proposed small-balance path is an atomic swap / Fiber egress against in-pool value. That needs a willing counterparty and liquidity; the source's own C1 classification marks sub-61-CKB trustless exit as bounded, not solved. A live pool therefore reduces per-user persistent state but does not make a 0.01-CKB balance independently withdrawable as a standard L1 Cell.

Every force exit consumes and replaces the shared anchor. Unrelated user exits therefore conflict on the same live anchor outpoint until the operator-silence path is open. The pinned spec describes anchor sharding and batched exits as throughput mitigations. Shards reduce cross-shard conflicts, not contention within a shard, and increase pool/coordination state.

## Evidence grade and unresolved questions

**Grade: pinned source review plus host-side STF and CKB-VM execution; no private-chain reproduction.** An isolated stable Rust/Cargo 1.99.1 toolchain was installed under `/tmp`. `cargo test -p liquid-cells-stf` at the pinned commit passed 49 default-feature tests across DA reconstruction/tamper, fuzz, genesis, HTLC, properties, red-team and witness suites. The anchor binary was built from unmodified pinned source for `riscv64imac-unknown-none-elf` using Zig 0.14.1 (official archive SHA-256 `24aeeec8af16c381934a6cd7d95c807a8cb2cf7df9fa40d359aa884195c4716c`) through a temporary compatibility wrapper. No contract/test source or feature set changed. Its binary is a RISC-V soft-float ELF with SHA-256 `dcc6bf2708fef85c0f529ff62c5f745b399d08ec81b0b08ee9c34b13973c8925`.

Against that compiled binary, the pinned CKB-testtool suites passed 24 tests: 7 force-exit (one valid and six rejection cases), 4 withdrawal binding, and 13 anchor/checkpoint/DA cases. This is real contract execution in CKB-VM using upstream test sources, but the compiler adapter differs from upstream CI's clang toolchain. The full test logs and exit codes are under `labs/wo09-e2-capacity/evidence/`.

Initial host-target and cross-compiler builds failed and remain preserved. Host-target compilation reported a missing `#[panic_handler]` because the contract is `no_std`; the correct RISC-V target first failed due to the absent GCC cross compiler. A checksum-pinned Zig adapter then built the unchanged source for RISC-V. The failed attempts are retained so the correction and its exact boundary remain auditable.

The decisive next reproduction is a disposable private devnet using an upstream-published deployment binary or a separately reviewed canonical build, with a deposit, an elapsed real CKB epoch timeout, and a unilateral force exit whose witness is reconstructed from chain-published DA without sequencer/indexer state. The CKB-VM result does not establish live deployment identity or private-chain transaction behavior. Separately measure a balance below the L1 output floor and document the exact liquidity/route dependency of the alternative egress. Do not describe those steps as complete until performed.

## Reproduction

The checked-in runner is `labs/wo09-e2-capacity/scripts/run-liquid-cells-ckbvm.sh`. It refuses any modified or differently pinned upstream checkout and requires Zig 0.14.1, cargo, and the corresponding Rustup home explicitly. With a pinned checkout and checksum-verified Zig installed, set `LIQUID_CELLS_DIR`, `TRADE_ZIG_BIN`, `TRADE_CARGO_BIN`, and `TRADE_RUSTUP_HOME`, then run the script. The complete successful rerun is preserved in `liquid-cells-ckbvm-reproduction.log`. The first invocation failed because the isolated `RUSTUP_HOME` was not passed through; the script now requires and exports it, and the rerun passed all three suites. Both outcomes are preserved.

No conclusion here addresses general arbitrary-history recovery safety or upstream A2 LO-01. The WO09-E1 beneficiary-address validation remains quarantined and unresolved.

# WO09-E2: private-devnet Liquid Cells lifecycle

## Result

**PASS, bounded to the published `fixtures/genesis` case and a local CKB dev chain.** On CKB 0.210.0, the reproduction committed four transactions: the anchor code cell, a canonical empty pool plus real 100 CKB deposit cell, the pinned Groth16 checkpoint publishing its DA blob, and the account owner's force exit after 180 actual private-chain epochs. A separate fresh child process fetched the committed checkpoint transaction through the live local CKB RPC, extracted its published DA and public values, rebuilt the depth-256 inclusion proof, and checked the proof root against the anchor output in that same committed transaction before the mature exit was constructed.

The successful chain evidence is `labs/wo09-e2-capacity/evidence/liquid-cells-pinned-genesis-checkpoint-force-exit-1793616517454/`. It contains the raw JSON-RPC stream, transaction bodies and receipts, node/genesis configuration, structured rejection cases, and transaction hashes. The four committed transaction hashes are `0x93983d69…afb918b29` (contract deployment), `0x481eab63…90692399` (anchor and deposit), `0xb65deb47…1c0f3041` (checkpoint), and `0x715be137…e4edb8e4` (force exit). The resulting owner payout is `0x715be137ae5302020d547afa976a6ca744c906441751511eace8acdee4edb8e4:0x1`, for `9,999,899,000` shannons (99.99899 CKB). The run generated 1,800 blocks and reached epoch `0xb6` before the mature exit.

The pinned upstream is `LusoCryptoLabs/Liquid-Cells@47492b51673c94635ab23de2c55477625e94ccbf`. Trade did not alter its tracked source. The plain pinned binary built during the earlier CKB-VM run contains an A-extension instruction (`lr.d`, `0x140b35af`) that the actual CKB 0.210.0 chain rejected as `InvalidInstruction`. This is preserved in `.../liquid-cells-pinned-genesis-checkpoint-force-exit-1793615089534/`. The earlier CKB-testtool pass therefore did not establish compatibility with the actual node VM.

The successful reproduction uses a separately built, isolated single-hart variant. It removes Cargo's `forced-atomics` build flag and patches the pinned `bytes 1.11.1` dependency in a temporary source archive to use volatile, single-hart refcount operations. The replacement types deliberately do not implement `Send` or `Sync`; this build is only valid for single-threaded CKB-VM execution and must not be reused by host software. The exact builder is `labs/wo09-e2-capacity/scripts/build-liquid-cells-single-hart.sh`, and the small dependency patch is `labs/wo09-e2-capacity/scripts/ckbvm-single-hart/single_threaded_atomic.rs`. The resulting binary SHA-256 is `04a31bf62a4aff38a2e51c0aace5f2b253828424127336f64e55d29c015ce817`.

That exact no-`Send`/`Sync` binary also passed the pinned upstream CKB-testtool suites: force exit 7/7, withdrawal binding 4/4, and anchor/checkpoint/DA 13/13. The saved log is `labs/wo09-e2-capacity/evidence/liquid-cells-single-hart-ckbvm.txt`. These VM tests and the local-node transactions are separate evidence: the latter is the stronger result for the path actually exercised.

The private-chain run rejected three adversarial cases at the anchor script: tampered published DA (59), force exit before the silence window (66), and an incorrect payout amount at maturity (67). The source-level codes are linked in `crates/ckb-contract/src/main.rs` at the pinned source. These are executed contract rejections, not a general audit.

## Reproduction

With the pinned clean checkout and isolated Zig/Rust toolchains already described in `WO09_E2_LIQUID_CELLS_SOURCE_REVIEW.md`:

```sh
LIQUID_CELLS_SOURCE=/path/to/clean/liquid-cells \
TRADE_ZIG_BIN=/path/to/zig-0.14.1 \
TRADE_CARGO_BIN=/path/to/cargo \
TRADE_RUSTUP_HOME=/path/to/rustup-home \
CARGO_HOME=/path/to/cargo-home \
labs/wo09-e2-capacity/scripts/build-liquid-cells-single-hart.sh

LIQUID_CELLS_SOURCE=/path/to/clean/liquid-cells \
LIQUID_CELLS_ANCHOR_BIN="$PWD/labs/wo09-e2-capacity/build/liquid-cells-anchor-single-hart" \
CARGO_BIN=/path/to/cargo \
RUSTUP_HOME=/path/to/rustup-home CARGO_HOME=/path/to/cargo-home \
node labs/wo09-e2-capacity/src/run-liquid-cells-private-devnet.cjs
```

The second script bootstraps a disposable local dev chain, deploys the contract binary, creates the anchor and fixture deposit, submits an invalid-DA draft and a valid proof, mines until the chain's epoch reaches the real `since` maturity, checks the early/wrong-payout drafts, and submits the valid owner exit. At checkpoint time it starts `reconstruct-liquid-cells-proof-from-rpc.cjs` as a fresh child process; that child receives only the committed checkpoint hash, owner public key, and evidence directory, and fetches proof material from live CKB RPC. The verifier checks that the fetched DA appears in the committed witness and that the independently reconstructed root equals the on-chain anchor root.

Verify the saved raw evidence without starting a node:

```sh
node labs/wo09-e2-capacity/src/verify-liquid-cells-private-devnet.cjs \
  labs/wo09-e2-capacity/evidence/liquid-cells-pinned-genesis-checkpoint-force-exit-1793616517454
```

## Limits and next decisive work

This run proves one valid owner's deposit, checkpoint, proof reconstruction from the DA published in the committed checkpoint transaction, real chain timeout, and payout. It does not prove archival RPC availability, recovery when RPC is unavailable, sequencer/database-loss recovery, or reconstruction and replay of complete multi-checkpoint history. It uses a single funded account, no competing exits, no reorg, no lost signing index, and no sub-61-CKB payout. The anchor lock is the owner's secp lock; therefore the test does not show recovery if that key is lost, nor does it establish an operator-independent pool across all failure modes. The fixture balance is comfortably above the output floor.

The build adapter itself remains a material limitation: the pinned upstream binary did not execute on the actual CKB node until the dependency's atomics were adapted for the single-hart VM. The compatibility patch is isolated and tested, but upstream has not adopted or reviewed it. Preserve it as an experimental build variant, not an upstream security correction.

The next decision-changing test is archival retrieval and complete multi-checkpoint history replay in a fresh environment, followed by two independent owners attempting exits from the same anchor and a last-exiter case. Keep the sub-floor egress limitation explicit. E1 beneficiary validation and A2 LO-01 remain quarantined and unresolved.

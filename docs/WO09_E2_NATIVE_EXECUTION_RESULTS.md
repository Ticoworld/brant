# E2 native execution results — checkpoint 1

Trace directory: labs/wo09-e2-capacity/evidence/state-free-wallet-swap-1793612217172. It contains raw RPC JSONL, full transactions/receipts, cases, environment/genesis and deployed code hashes.

Two native xUDT issue transactions and one four-input/four-output owner swap committed on the fresh local CKB dev chain. Existing inputs were two secp wallet cells and two issuer-created xUDT cells. Outputs replaced all four one for one; the two parties exchanged 5 CKB and xUDT quantities10000/20000. This is a fixture price, not market evidence.

Missing buyer authorization, altered recipient output and replay of spent inputs rejected. CCC/SDK and raw RPC verifier reports3 committed transactions/3 expected rejection cases. Actual scripts were published dev-genesis xUDT and secp lock; exact outpoints/binaries are in environment.json/events.json. Harness did not record transaction fees (null); VM cycles and serialized byte lengths are included in events.

The result proves one whole-body fully signed complete-fill swap can add zero persistent cells given compatible pre-funded wallets/assets. It says nothing about ordinary order Cells being always unnecessary for resting/partial orders, CoBuild range-signed fragments, entrants without assets, independent claim vaults or concurrent matching.

## Pinned Liquid Cells upstream host tests (not a CKB transaction)

Using an isolated Rust/Cargo 1.99.1 toolchain, Trade ran `cargo test -p liquid-cells-stf` at upstream commit `47492b51673c94635ab23de2c55477625e94ccbf`. **49 default-feature host tests passed**, including 2 DA tests (tree reconstruction/proof and tamper rejection), 4 fuzz tests, 1 genesis test, 7 HTLC tests, 13 property tests, 13 red-team tests and 9 witness tests. Feature-gated suites with zero selected tests were not enabled. The full stdout log and exit code are in `labs/wo09-e2-capacity/evidence/liquid-cells-stf-cargo-test.log` and `.exit`; structured metadata is in `liquid-cells-upstream-test-results.json`.

The CKB contract was not executed: host compilation failed because the `no_std` contract needs RISC-V; the correct RISC-V build then failed because `riscv64-unknown-elf-gcc` is missing (`clang`/`clang-18` are also absent). These failure logs and exit codes are preserved. No substitution or feature weakening was made. Thus, the host tests substantiate STF/data-availability logic only; force-exit script behavior remains source-reviewed, not CKB-VM or chain-validated.

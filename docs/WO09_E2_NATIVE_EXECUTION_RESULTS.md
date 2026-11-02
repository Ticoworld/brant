# E2 native execution results — checkpoint 1

Trace directory: labs/wo09-e2-capacity/evidence/state-free-wallet-swap-1793612217172. It contains raw RPC JSONL, full transactions/receipts, cases, environment/genesis and deployed code hashes.

Two native xUDT issue transactions and one four-input/four-output owner swap committed on the fresh local CKB dev chain. Existing inputs were two secp wallet cells and two issuer-created xUDT cells. Outputs replaced all four one for one; the two parties exchanged 5 CKB and xUDT quantities10000/20000. This is a fixture price, not market evidence.

Missing buyer authorization, altered recipient output and replay of spent inputs rejected. CCC/SDK and raw RPC verifier reports3 committed transactions/3 expected rejection cases. Actual scripts were published dev-genesis xUDT and secp lock; exact outpoints/binaries are in environment.json/events.json. Harness did not record transaction fees (null); VM cycles and serialized byte lengths are included in events.

The result proves one whole-body fully signed complete-fill swap can add zero persistent cells given compatible pre-funded wallets/assets. It says nothing about ordinary order Cells being always unnecessary for resting/partial orders, CoBuild range-signed fragments, entrants without assets, independent claim vaults or concurrent matching.

## Pinned Liquid Cells upstream host tests (not a CKB transaction)

Using an isolated Rust/Cargo 1.99.1 toolchain, Trade ran `cargo test -p liquid-cells-stf` at upstream commit `47492b51673c94635ab23de2c55477625e94ccbf`. **49 default-feature host tests passed**, including 2 DA tests (tree reconstruction/proof and tamper rejection), 4 fuzz tests, 1 genesis test, 7 HTLC tests, 13 property tests, 13 red-team tests and 9 witness tests. Feature-gated suites with zero selected tests were not enabled. The full stdout log and exit code are in `labs/wo09-e2-capacity/evidence/liquid-cells-stf-cargo-test.log` and `.exit`; structured metadata is in `liquid-cells-upstream-test-results.json`.

The CKB contract was executed in CKB-VM after a checksum-pinned Zig 0.14.1 adapter built the unchanged source for RISC-V. The adapter resolves a toolchain gap and differs from the upstream CI clang build; no source, test, or contract feature was changed. The anchor binary is a soft-float RISC-V ELF with hash `dcc6bf2708fef85c0f529ff62c5f745b399d08ec81b0b08ee9c34b13973c8925`. The force-exit, withdrawal and anchor suites passed 24/24 tests. Earlier failed host/GCC builds are preserved. These are VM executions of upstream test transactions, not committed transactions on a private devnet. No actual epoch wait, chain-published DA reconstruction, deployment identity check, or operator-loss chain recovery is demonstrated.

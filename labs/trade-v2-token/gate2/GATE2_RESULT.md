# Gate 2 Result

**Classification: GATE 2 PARTIAL, EXACT BLOCKERS**

This checkpoint resumes the local `wo18-v2-merkle-custody` worktree at Gate 1 baseline `4cc26403affcf80aa7ab5776af8a2d5dfc60f7a1`. It uses private disposable CKB dev chains, test-only keys, CKB 0.210.0, and freshly built scripts. No mainnet, public testnet, real assets, or deployment was used.

## Verified

- Fixed-supply xUDT issuance, native curve purchases, existing-owner additional purchase, new-owner enrollment, multiple authorized buyers in atomic batches, owner-authorized external withdrawal, and xUDT redemption all committed on CKB 0.210.0.
- The 128-owner journey completed offline-order fill after unrelated owner-root changes, owner cancellation, consumed and canceled order replay rejection, external withdrawal/redemption, complete owner sell-down, exact restoration of the initial 30,000,000,000-shannon market reserve, and rebuy/sell on the same lineage. Evidence: `evidence/native-1794396507246/`.
- The 1,024-owner journey committed 64 batches (63 batches of 16 and one of 14), with each batch owner matched to a standard-lock input. It also committed an offline order fill after batch root changes, cancellation, replay rejects, and an owner-authorized withdrawal. Evidence: `evidence/native-1794396785318/`.
- `measure.cjs` independently replays TMS1 old/new leaves in transaction order and checks the reconstructed entitlement sum against the actual 48-byte custody xUDT data on every custody transition. It checked 144 transitions for the 128-owner journey and 70 for the 1,024-owner journey; every old leaf matched prior reconstructed state and every new entitlement total matched actual custody amount.
- Every recorded transaction hash matched its raw transaction and committed status. Parent output capacities reconstructed every fee as 1,000,000 shannons. All 3,310 output cells across the two scale runs met occupied capacity. Batch signer inputs, proof/witness sizes, and serialized transaction sizes are independently measured by `measure.cjs`.
- Fresh-ELF standalone order fixture committed a fill after an unrelated root update with no seller input and unchanged custody quantity. Native rejects: payout redirection and minimum underpayment at custody error 34; tampered signature, consumed-order replay, and canceled-order replay at custody error 38. Evidence: `orders/evidence/native-1794396855738/`.
- Chain-only recovery scanned canonical full blocks without an indexer, reconstructed a four-owner custody root, generated and signed a real withdrawal, committed xUDT quantity 7, and replayed the post-withdrawal history to `entitlement_total == custody_amount == 3`. Evidence is preserved outside the repository at `C:\Users\timot\Desktop\2026\CKB\trade-v2-recovery-demo-20261111\`.
- Host verification: `smt-tools` 7 tests passed; recovery 4 tests passed; recovery Node test 1 passed. Preserved Gate 1 latest, continuation, and legacy verifiers passed in the original Gate 1 worktree.

## Benchmarks

| Run | Owners | Transactions | Owner batch updates | Batch cycles | Batch tx bytes | Max proof / TMS witness | Max tx bytes | Fee |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 128 | 128 | 148 | 126 | 31,354,288–35,478,695 | 7,971–9,831 | 2,478 / 3,834 bytes | 14,085 | 1,000,000 shannons each |
| 1,024 | 1,024 | 73 | 1,022 | 32,216,709–38,071,672 | 7,977–12,275 | 4,509 / 6,057 bytes | 111,749 | 1,000,000 shannons each |

The 111,749-byte maximum is the owner-wallet funding transaction with 1,023 outputs; owner batch transactions remain at or below 12,275 bytes. The 128-owner full sell-down ended with internal entitlement 0, custody amount 0, inventory 2,000, and the original reserve capacity.

## Hashes

Final external build directory: `C:\Users\timot\Desktop\2026\CKB\trade-gate2-order-build-final\`.

- `custody_smt` ELF SHA-256: `7db957901242d6c9243f585b393c55d42faad3c7ddd16f1672c1a19ad14d4601`
- `market_smt` ELF SHA-256: `b33d7396778340c3d6e66c62897a1dbd1561b32848715106a94d8a077bb7cd1f`
- `custody_smt.c` SHA-256: `cac3356341e5197809a03909a7684e9971796fe1e7305c51572cfe5e07734eea`
- `run.cjs` SHA-256: `5b00d461bdcf752a5add3592f3bed68890d7104b8785419c8b4e5153ba223e0b`
- `custody_marker.c` SHA-256: `307204c02868d9544c7bbddf4aeb2b27764d9444b840f711d7e24db9cd83e086`

## Exact Blockers

- **UNIMPLEMENTED:** Order expiry. The signed message explicitly says `Expiry: none`; orders remain valid until fill or a seller revision change.
- **UNIMPLEMENTED:** Gate 2 native attacks for forged membership/non-membership proofs, tampered multiproofs, duplicate owner allocation, inflated/unbacked entitlement, unauthorized xUDT owner-mode activation, duplicate redemption, competing singleton histories, maximum arithmetic boundaries, and reserve underflow.
- **UNIMPLEMENTED:** State-history rollback resistance. Revision checks prevent replay against a later canonical root, but no native reorganization test or finality/checkpoint mechanism establishes resistance to a rollback that restores an earlier root.
- **PARTIAL:** Independent recovery is verified on a four-owner chain, not on the 1,024-owner run or from an independently provisioned user's own environment with independently supplied credentials. No public proof publisher exists; recovery requires a full node retaining canonical blocks and witnesses.
- **PARTIAL:** Cross-market substitution and one 1-CKB reserve extraction rejection were verified only with preserved Gate 1 binaries. They do not establish those attack categories against Gate 2 binaries. Gate 1 maximum arithmetic, reserve underflow, and same-identity competing singleton histories remain unproved.
- **UNIMPLEMENTED:** Final independent replay of every 1,024-owner raw transaction from canonical block history, and a clean environment recovery/withdrawal for that scale run.

These blockers prevent Gate 2 PASS. The 1,024-owner count is total authenticated positions; at most 16 owners are modified in any batch transaction.

## Reproduction

Run from the repository in WSL with the pinned Gate 1 Zig and secp sources:

```sh
ZIG_BIN=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/rebuild/mechanisms/tools/python/ziglang/zig-x86_64-linux-0.14.1/zig \
TRADE_SECP_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/wo17c-offline/tools/ckb-system-scripts \
TRADE_GATE2_BUILD_DIR=/mnt/c/Users/timot/Desktop/2026/CKB/trade-gate2-rebuild \
bash labs/trade-v2-token/gate2/build.sh

TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/rebuild/native \
CKB_BIN=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/rebuild/native/tools/ckb \
TRADE_GATE2_BUILD_DIR=/mnt/c/Users/timot/Desktop/2026/CKB/trade-gate2-rebuild \
TRADE_GATE2_OWNER_TARGET=128 TRADE_GATE2_FULL_SELLDOWN=1 \
node labs/trade-v2-token/gate2/run.cjs

TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/rebuild/native \
node labs/trade-v2-token/gate2/measure.cjs labs/trade-v2-token/gate2/evidence/<run-directory>

TRADE_GATE2_BUILD_DIR=/mnt/c/Users/timot/Desktop/2026/CKB/trade-gate2-rebuild \
TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/rebuild/native \
node labs/trade-v2-token/gate2/orders/fixture.cjs
```

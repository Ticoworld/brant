# Gate 2 Result

**Classification: GATE 2 PARTIAL, EXACT BLOCKERS**

This continuation starts at local and remote checkpoint `3af1f1cd29135d45532e79c9021596cdbb14df6a` on `wo18-v2-merkle-custody`. All new native runs used private disposable CKB 0.210.0 chains and test credentials. No mainnet, public testnet, real assets, or deployment was used. The final implementation/evidence commit is recorded in the publication metadata update following this report's validation commit.

## Verified Results

- Preserved the 128-owner lifecycle evidence in `evidence/native-1794396507246/`, including full sell-down, exact restoration of the original reserve, and same-lineage rebuy. Its original report records 144 custody transitions.
- Independently fetched and replayed the original 1,024-owner run from canonical CKB full blocks, scanning 280 blocks through height `0x13a`, starting at initialization transaction `0x693cfac1ec415d227f679291ab7fa2ca302f6d98bede93c1feae742d46a41c3e`. The verifier checked committed transaction identity and canonical block location, parsed each committed TMS1 witness, verified compiled multiproofs against each old root, applied authenticated leaf changes, verified each new root, rebuilt the entire owner map, checked owner revisions and entitlement deltas, and reconciled the full owner sum against actual custody xUDT data for all 70 transitions. At block `0x13a`, the replayed custody amount and entitlement total were both `1031`. Raw bundle and verifier result are `recovery/evidence/scale-1024-original/history.json` and `.result.json`.
- Independently recovered a fresh full 1,024-owner market on a private CKB 0.210.0 chain using freshly rebuilt current Gate 2 ELFs. Recovery received the public initialization identity, fetched transactions and witnesses over direct full-block RPC, used no indexer, Trade service, database, solver, runner memory, or saved proof. It reconstructed 70 transitions, generated a new 399-byte membership proof for an owner with balance `1`, revision `1`, found that owner's fee input from canonical block history, and submitted a native withdrawal. Transaction `0x161131587f2fcc84791e18d744e510f90b5d7276b31bdacb9a31bfd76d023da3` committed in block `0x12f`; CKB-VM estimated `2,263,866` cycles (`0x228b3a`), and output 2 contains one genuine xUDT to the owner's standard lock. A second full-block replay checked 71 transitions and reached owner inactive, balance `0`, revision `2`, custody amount `1030`, and entitlement total `1030`. Raw RPC calls/responses and acceptance data are in `evidence/native-1794410154147/`. The coordinator generated a new disposable key in process and passed it only through environment variables to the owner simulator and separate recovery CLI; it was never written to source or evidence.
- Re-ran the independent `measure.cjs` on that fresh native run: 1,024 positions, 73 committed transactions, 64 owner batches (63 x 16 and one x 14), 1,022 batch owner updates, 73,000,000 shannons total fees, batch cycles `32,951,441`–`38,476,490`, batch transaction size `7,973`–`12,481` bytes, largest compiled proof `4,715` bytes, largest TMS witness payload `6,263` bytes, largest whole transaction `111,749` bytes, and 2,336 output occupied-capacity checks. All custody transitions reconciled to authenticated entitlements.
- A fresh native positive control committed an authorized additional owner purchase (`0x71558332ede4dad76152139a001c9bd14805b05c717ecfe50466ed035aa59682`). From that state, two independently signed, fee/capacity-balanced attacks were rejected by the current `custody_smt` script hash `0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000`, `Inputs[0].Lock`, error `8`: tampered compiled multiproof transaction `0x79553fb911e20b0f4b83764b68788710873f4716a308f35bb3ee0c7d6d2b4909`, and a valid enrollment proof with custody quantity inflated by one unbacked unit, transaction `0x250ecfcef0dd8c0a3ec37c6093c522e0635d9ed9f2d524050cc06befea1296c3`. The evidence includes complete raw transactions, positive control, RPC errors, script hash, and altered condition in `security/evidence/native-smt-1794411243401/`.
- Preserved fresh-ELF offline-order evidence in `orders/evidence/native-1794396855738/`: unrelated root changes did not invalidate the seller signature; valid fill committed; payout redirect and minimum underpayment rejected at custody error `34`; tampered signature and canceled/consumed revision replays rejected at custody error `38`.
- Existing Rust recovery tests passed 4/4; the independent recovery Node RPC test passed 1/1, including fail-closed history-gap behavior. Both command outputs were obtained after the 16-owner replay limit fix.

## Native Measurements

| Run | Owners | Transactions | Owner updates | Batch cycles | Batch bytes | Max proof / TMS payload | Max transaction | Total fees |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Preserved 128-owner lifecycle | 128 | 148 | 126 | 31,354,288–35,478,695 | 7,971–9,831 | 2,478 / 3,834 bytes | 14,085 bytes | 148,000,000 shannons |
| Preserved 1,024-owner run | 1,024 | 73 | 1,022 | 32,216,709–38,071,672 | 7,977–12,275 | 4,509 / 6,057 bytes | 111,749 bytes | 73,000,000 shannons |
| Fresh 1,024-owner recovery run | 1,024 | 73 | 1,022 | 32,951,441–38,476,490 | 7,973–12,481 | 4,715 / 6,263 bytes | 111,749 bytes | 73,000,000 shannons |

The largest serialized transaction is wallet funding with 1,023 outputs; owner batch transactions remain bounded near 12.5 KB. The fresh recovery withdrawal itself committed at a 1,000,000-shannon fee. The 128-owner lifecycle is still the only recorded full sell-down and rebuy; no 1,024-owner sell-down/rebuy is claimed.

## Economic Stress

`economics/stress.cjs` uses exact integer shannons and the implemented curve equation. This is derived scenario arithmetic, not four additional native market launches. The 1,000 CKB fixed singleton capacity is separate from spendable curve reserve and must remain locked. The measured fee is 0.01 CKB per transaction; the 100-token lots below exclude other wallet-specific funding needs beyond the separately stated plain change cell and fee.

| Configuration (2,000 units) | First / last unit price | 100-unit launch buy | 100-unit buy after 1,500 sold | 100-unit sell payout at 1,900 sold | Full curve reserve | Market cell at sellout | Fixed singleton + curve capacity |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Low capital (`0.1`, step `0.0001` CKB) | 0.1 / 0.2999 CKB | 10.495 CKB | 25.495 CKB | 28.495 CKB | 399.9 CKB | 699.9 CKB | 1,699.9 CKB |
| Moderate creator (`1`, step `0.001` CKB) | 1 / 2.999 CKB | 104.95 CKB | 254.95 CKB | 284.95 CKB | 3,999 CKB | 4,299 CKB | 5,299 CKB |
| High demand (`5`, step `0.01` CKB) | 5 / 24.99 CKB | 549.5 CKB | 2,049.5 CKB | 2,349.5 CKB | 29,990 CKB | 30,290 CKB | 31,290 CKB |
| Existing synthetic fixture (`10`, step `1` CKB) | 10 / 2,009 CKB | 5,950 CKB | 155,950 CKB | 185,950 CKB | 2,019,000 CKB | 2,019,300 CKB | 2,020,300 CKB |

At 1,032 units sold, the synthetic fixture has 542,316 CKB of curve reserve plus 300 CKB market-cell capacity, consistent with its measured 542,616 CKB market cell. This is synthetic reserve capital committed by test transactions, not third-party market liquidity or normal creator onboarding cost. An external xUDT output needs 142 CKB occupied capacity in the tested data/lock layout; a recovery withdrawal also needed a 61 CKB plain change output and 0.01 CKB fee (203.01 CKB input funding total). These capacities and fees are layout-specific to this experiment.

The 80% individual purchase-price protection is not implemented. An integer solvency counterexample is included in the stress JSON: with two units, base price 1 CKB and step 99 CKB, buyer A pays 1 CKB and buyer B pays 100 CKB; the 101 CKB reserve pays A 100 CKB first, leaving 1 CKB for B against an 80 CKB floor. That is a 79 CKB shortfall. A true floor needs separately enforced funding/rights accounting for all simultaneous obligations, transfers, partial redemptions, external holders, and creator withdrawals; no protection mechanism is claimed.

## Identity, Replay, Expiry, and Finality Boundaries

- Market, xUDT, custody, and marker script hashes bind each asset lineage. Their arguments bind the relevant market, asset, genesis, and marker identities. The native two-market test establishes separate valid identities and rejection of the tested cross-market substitution.
- Custody witnesses and the current custody script enforce the tested authenticated roots, leaf changes, and exact owner-entitlement/custody quantity. The independent recovery verifier checks actual old/new roots and the full reconstructed map across recorded scale history.
- Singleton lineage is advanced by spending the prior market/custody and marker outpoints and checking the exact successor. A covenant cannot prevent two transactions from competing to spend the same outpoint. The canonical node accepts at most one spend in a chain; a conflicting spend is a node double-spend outcome, not proof of a separate contract replay rule. No competing-successor race or node reorganization injection was run in this continuation.
- An actual chain reorganization can change canonical history and is not preventable by the contract. Recovery verifies canonical block inclusion and live output identity, snapshots/rechecks the tip, and fails closed on an incomplete transition history. After a reorg, collection must restart from the initialization transaction. The 1,024-owner recovery used an unpruned private full-history node; a pruned/history-incomplete RPC source is insufficient.
- Signed offline orders still encode `Expiry: none`. CKB transaction `since` is a not-before condition, and this implementation has no authenticated covenant-enforced not-after deadline. Operational relay expiry only controls order availability; an already signed authorization can remain enforceable until the owner changes the relevant revision. Owner-controlled cancellation and revision-based replay rejection are verified.

## Rebuild and Evidence Identities

A fresh pinned-source build was produced outside the worktree at `C:\Users\timot\Desktop\2026\CKB\trade-gate2-rebuild-closure-20261111\`. It used Zig 0.14.1 and `ckb-system-scripts` commit `72eb92fca090700dcb398cd8cad8fbd8bad40355` with secp256k1 submodule commit `3ffde18a060aaf4df5b81e7d88355f1e99874650`. The rebuilt ELFs match the Gate 2 binaries used in the fresh native recovery run:

| Artifact | SHA-256 |
| --- | --- |
| `custody_smt.c` | `cac3356341e5197809a03909a7684e9971796fe1e7305c51572cfe5e07734eea` |
| `market_smt.c` | `fa0f0db4f1eb545468deacc2d81e0ebc9a56983e616e3e0727ba6591700b4cfa` |
| `custody_marker.c` | `307204c02868d9544c7bbddf4aeb2b27764d9444b840f711d7e24db9cd83e086` |
| rebuilt `custody_smt` ELF | `7db957901242d6c9243f585b393c55d42faad3c7ddd16f1672c1a19ad14d4601` |
| rebuilt `market_smt` ELF | `b33d7396778340c3d6e66c62897a1dbd1561b32848715106a94d8a077bb7cd1f` |
| rebuilt `custody_marker` ELF | `cca4552516f372d97377b4e27ebffe1655d4bdeea3535544f36da44ff15aba07` |
| `run.cjs` | `27dad833b808c6dc6a5147b751629357e480c80410f5cc72d5a33ee39bb164b0` |
| recovery verifier `src/main.rs` | `3fd8ac3a1f352f45bafae0a380b8ccb6a0718f70e204609c9d78dbef13dc8972` |
| recovery client `recover.cjs` | `9ff96ea12d193b1b8887aa197728f2b8e5aec7ed18a4882fc9c446e8ce904891` |

Evidence hashes: original 1,024-owner history bundle `385e7cde1af08ae973d56403dac30c9a3d6ecc073451a2eb4e1498c96a4a67f8`; original replay result `2b8d1fad5aa076a0d6c7324146484c0ce5b3444f3278ab22a568e28701f9851b`; fresh recovery acceptance `7030a4411bd144397520d231c9f861da0710aa6ce846f6f51591089a2c112314`; raw recovery RPC log `8cab41eee61bded0b51f05ae0ca2c03377023c6ff439f6a7810d6a6b4a1c8389`; SMT attack records `aedc5e08226a753ce9fd033d9d9c574ded2eb7bf83e3b754cbbaa0d73ed5d87e`; economic stress output `f662637fb57172bf7e914c81dab1f7e3dcf9b200bc9b05953d5e0fce8a1409d5`.

## Exact Remaining Blockers

- **PARTIAL:** Native adversarial security is materially advanced but not complete. Still untested against current Gate 2 scripts are forged membership and non-membership, duplicate owner allocation, invalid old/new leaf, revision overflow, tombstone re-enrollment, unrelated-owner mutation, unauthorized xUDT owner-mode issuance, secondary initialization, cross-market offline-order replay, exact custody-root substitution, counterfeit xUDT and unexpected xUDT inputs/outputs, duplicate redemption, and competing singleton successors. The preserved two-market/reserve fixture uses Gate 1 binaries and does not count as Gate 2 identity evidence.
- **UNIMPLEMENTED:** Native arithmetic boundary suite for maximum supported supply/quantity, 64-bit/128-bit limits, truncation, exact occupied-capacity boundary, reserve extraction to under-capacity, payout above reserve, incorrect seller payout/fee accounting, and 1,024-owner full sell-down/restoration/rebuy. The 128-owner sell-down remains preserved evidence.
- **PARTIAL:** A separate recovery CLI commits a real 1,024-owner native withdrawal with a newly generated non-fixture credential and chain-only replay. The orchestration process passed the key transiently to both the owner simulator and recovery CLI. This used a fresh chain on the same host; it does not establish a separately provisioned recovery machine or a key delivered independently by an owner outside the coordinator. A pruned-node fallback, conflicting RPC provider reconciliation, forced reorganization recovery, concurrent owner-state change, and already-withdrawn retry test are also open. This replay verifies custody roots and entitlements; a combined independent replay of market inventory, reserve movements, supply and final market singleton identity remains open.
- **UNIMPLEMENTED:** Absolute on-chain order expiry. The current signed order explicitly contains `Expiry: none`; only owner cancellation/revision invalidation and relay-side availability expiry are supported.
- **UNIMPLEMENTED:** An 80% purchase-cost protection guarantee. The stress counterexample shows the reversible curve is insufficient.
- **PARTIAL:** Historical Gate 1 verifiers were recorded as passing in the earlier Gate 2 checkpoint; they were not rerun in this continuation. They do not close current Gate 2 attack gaps.

The Gate 2 result therefore remains **PARTIAL**. This is an experimental engineering verdict, not production approval. At least 1,024 authenticated positions, fresh native recovery at that scale, and the tested Gate 2 proof/conservation attacks are demonstrated, but the listed critical native attack and economics tests still prevent PASS.

## Reproduction

From the repository root in WSL, rebuild into a new directory while using the pinned inputs:

```sh
ZIG_BIN=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/rebuild/mechanisms/tools/python/ziglang/zig-x86_64-linux-0.14.1/zig \
TRADE_SECP_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/wo17c-offline/tools/ckb-system-scripts \
TRADE_GATE2_BUILD_DIR=/mnt/c/Users/timot/Desktop/2026/CKB/trade-gate2-rebuild-closure-20261111 \
bash labs/trade-v2-token/gate2/build.sh

TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/rebuild/native \
CKB_BIN=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/rebuild/native/tools/ckb \
TRADE_GATE2_BUILD_DIR=/mnt/c/Users/timot/Desktop/2026/CKB/trade-gate2-rebuild-closure-20261111 \
node labs/trade-v2-token/gate2/recovery/run-scale-recovery.cjs

TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/rebuild/native \
node labs/trade-v2-token/gate2/measure.cjs labs/trade-v2-token/gate2/evidence/<run-directory>

node labs/trade-v2-token/gate2/economics/stress.cjs --out labs/trade-v2-token/gate2/economics/evidence/stress-20261111.json

cargo test --locked --offline --manifest-path labs/trade-v2-token/gate2/recovery/Cargo.toml
node --test labs/trade-v2-token/gate2/recovery/recover.test.cjs
node labs/trade-v2-token/gate2/security/verify-two-market-cross-lineage.cjs labs/trade-v2-token/gate2/security/evidence/cross-lineage-1794388569759
```

The native scale coordinator generates a disposable owner key in memory, starts a fresh private node, runs the 1,024-owner workload, then invokes the independent recovery CLI against that node. Never place a real key in command history or repository files. The previously failed native harness attempts are preserved: an earlier SMT attempt used the wrong RPC port and never reached the intended VM, and an earlier recovery attempt selected a fee cell too small for its output layout. They are fixture/setup failures, not successful attack evidence.

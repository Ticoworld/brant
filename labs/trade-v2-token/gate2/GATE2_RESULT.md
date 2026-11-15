# Gate 2 Result

**Classification: GATE 2 PARTIAL, EXACT BLOCKERS**

The earlier Gate 2 continuation began at `3af1f1cd29135d45532e79c9021596cdbb14df6a`; its validated implementation commit is `f95d7363632c9e557443adb39860640d3596d6a5`. This corrects the prior report's mistyped implementation ID `f95d7361942aac30505be496443ba020e87d5564`. This closure starts from verified local and remote HEAD `ab9d46588359e76e7f1754cfbc2d363dfae30618` and its final validated implementation/evidence commit is `cd12260cc831ed2cf02633f72f490a887d3a39ab`. The report publication follows as a documentation-only commit. All new native runs used private disposable CKB 0.210.0 chains and test credentials. No mainnet, public testnet, real assets, or deployment was used.

## Verified Results

- Preserved the 128-owner lifecycle evidence in `evidence/native-1794396507246/`, including full sell-down, exact restoration of the original reserve, and same-lineage rebuy. Its original report records 144 custody transitions.
- Replayed the recorded 1,024-owner full lifecycle from `evidence/native-1794418766907/` onto a fresh private CKB 0.210.0 chain. The replay committed all 1,100 signed transactions, including 64 bounded owner batches, all 1,024 sequential owner sell-backs, external redemption, complete sell-down, same-lineage rebuy, and a subsequent sale. It ended with all 2,000 fixed-supply units back in market inventory, zero internal entitlement, zero external xUDT, and the original spendable reserve restored. The fresh-chain genesis hash was reconstructed from the preserved genesis RPC message and matched exactly; this is canonical chain execution, not a host-only fixture replay.
- Independently fetched and replayed the original 1,024-owner run from canonical CKB full blocks, scanning 280 blocks through height `0x13a`, starting at initialization transaction `0x693cfac1ec415d227f679291ab7fa2ca302f6d98bede93c1feae742d46a41c3e`. The verifier checked committed transaction identity and canonical block location, parsed each committed TMS1 witness, verified compiled multiproofs against each old root, applied authenticated leaf changes, verified each new root, rebuilt the entire owner map, checked owner revisions and entitlement deltas, and reconciled the full owner sum against actual custody xUDT data for all 70 transitions. At block `0x13a`, the replayed custody amount and entitlement total were both `1031`. Raw bundle and verifier result are `recovery/evidence/scale-1024-original/history.json` and `.result.json`.
- Independently replayed the full 1,024-owner sell-down/rebuy journey from canonical blocks on the fresh replay chain. The full-history RPC collector scanned 4,355 blocks and captured 1,096 committed TMS1 custody transitions. The independent Rust Merkle verifier and the separate combined accounting verifier checked canonical transaction bodies and witnesses, roots, owner revisions, custody totals, external xUDT balances, fixed supply, curve inventory, reserve movements, fees, and output occupied capacity at every transition. All 1,024 owner identities were reconstructed. The chain ended at tip `0xd49b1a3d6d534eb40320c94ca8ac89a98528e5ed9e66c15f713b9e59175a8621`; its four live market/custody singleton cells were fetched directly through `get_live_cell` and matched the final committed transaction outputs. Bundle and raw RPC evidence are in `recovery/evidence/scale-1024-selldown-20261111/`; full native replay evidence is in `evidence/native-replay-1024-selldown-20261111b/`.
- Independently recovered a fresh full 1,024-owner market on a private CKB 0.210.0 chain using freshly rebuilt current Gate 2 ELFs. Recovery received the public initialization identity, fetched transactions and witnesses over direct full-block RPC, used no indexer, Trade service, database, solver, runner memory, or saved proof. It reconstructed 70 transitions, generated a new 399-byte membership proof for an owner with balance `1`, revision `1`, found that owner's fee input from canonical block history, and submitted a native withdrawal. Transaction `0x161131587f2fcc84791e18d744e510f90b5d7276b31bdacb9a31bfd76d023da3` committed in block `0x12f`; CKB-VM estimated `2,263,866` cycles (`0x228b3a`), and output 2 contains one genuine xUDT to the owner's standard lock. A second full-block replay checked 71 transitions and reached owner inactive, balance `0`, revision `2`, custody amount `1030`, and entitlement total `1030`. Raw RPC calls/responses and acceptance data are in `evidence/native-1794410154147/`. The coordinator generated a new disposable key in process and passed it only through environment variables to the owner simulator and separate recovery CLI; it was never written to source or evidence.
- Re-ran the independent `measure.cjs` on that fresh native run: 1,024 positions, 73 committed transactions, 64 owner batches (63 x 16 and one x 14), 1,022 batch owner updates, 73,000,000 shannons total fees, batch cycles `32,951,441`–`38,476,490`, batch transaction size `7,973`–`12,481` bytes, largest compiled proof `4,715` bytes, largest TMS witness payload `6,263` bytes, largest whole transaction `111,749` bytes, and 2,336 output occupied-capacity checks. All custody transitions reconciled to authenticated entitlements.
- A fresh native positive control committed an authorized additional owner purchase (`0x71558332ede4dad76152139a001c9bd14805b05c717ecfe50466ed035aa59682`). From that state, two independently signed, fee/capacity-balanced attacks were rejected by the current `custody_smt` script hash `0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000`, `Inputs[0].Lock`, error `8`: tampered compiled multiproof transaction `0x79553fb911e20b0f4b83764b68788710873f4716a308f35bb3ee0c7d6d2b4909`, and a valid enrollment proof with custody quantity inflated by one unbacked unit, transaction `0x250ecfcef0dd8c0a3ec37c6093c522e0635d9ed9f2d524050cc06befea1296c3`. The evidence includes complete raw transactions, positive control, RPC errors, script hash, and altered condition in `security/evidence/native-smt-1794411243401/`.
- Preserved fresh-ELF offline-order evidence in `orders/evidence/native-1794396855738/`: unrelated root changes did not invalidate the seller signature; valid fill committed; payout redirect and minimum underpayment rejected at custody error `34`; tampered signature and canceled/consumed revision replays rejected at custody error `38`.
- A new native adversarial run against freshly rebuilt Gate 2 ELFs is preserved in `security/evidence/native-smt-1794427785208/`. It includes valid Gate 2 positive controls and 18 signed attacks: forged membership and non-membership claims, tampered multiproof, invalid leaf tag, revision skip, unauthorized owner allocation, duplicate owner identity, unbacked entitlement, substituted custody root, forged market successor, reserve extraction, payout redirect, seller underpayment, payout inflation, cross-market offline-order replay, cross-market xUDT redemption, cross-market custody substitution, and cross-market inventory substitution. Each record contains the full serialized transaction and witnesses, raw transaction hash, full signed-transaction and witness hashes, exact mutation, VM error, source and rejecting script hash. Gate 2 `custody_smt` rejected custody attacks with errors 7, 8, 9, 21, and 38; Gate 2 `market_smt` rejected market attacks with errors 21, 22, 25, 28, and 41. The underpayment case hit Market error 28. The positive controls include an actual purchase, curve sale, tombstone rebuy, two independent markets and valid operations on Market B.
- Gate 2 now has a native two-valid-market test. Market A and B were independently initialized from distinct genesis anchors with distinct market, xUDT, custody and marker script hashes. Market B positive controls committed initialization, buyer enrollment, a valid offline fill, withdrawal and external redemption. An A order replay against B was rejected by `custody_smt` error 38; genuine A xUDT submitted to B's external sale was rejected by `market_smt` error 41; A custody paired with B market state and A xUDT placed under B's market lock as inventory were rejected by `market_smt` error 22. The serialized attacks and both-lineage identities are in `security/evidence/native-smt-1794427785208/`. The older `security/evidence/cross-lineage-1794388569759/` fixture uses Gate 1 binaries; its separate passing replay is historical Gate 1 evidence only.
- Recovery fault tests passed 1/1 and recorded their individual cases in `recovery/evidence/rpc-faults-1794423412176/fault-results.json`: local cache/indexer absence, incomplete history, conflicting provider position, missing transaction body, tip change during collection, concurrent custody successor, stale proof, and already-withdrawn retry all fail closed in the mocked RPC harness. These are recovery-client fault tests, not native VM or actual consensus-reorganization tests.
- Rust recovery tests passed 4/4; sparse Merkle tooling tests passed 7/7. The Gate 1 two-market verifier was rerun and passed its six committed transaction replay. Gate 1 results remain distinct from Gate 2 execution.

## Native Measurements

| Run | Owners | Transactions | Owner updates | Batch cycles | Batch bytes | Max proof / TMS payload | Max transaction | Total fees |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Preserved 128-owner lifecycle | 128 | 148 | 126 | 31,354,288–35,478,695 | 7,971–9,831 | 2,478 / 3,834 bytes | 14,085 bytes | 148,000,000 shannons |
| Preserved 1,024-owner run | 1,024 | 73 | 1,022 | 32,216,709–38,071,672 | 7,977–12,275 | 4,509 / 6,057 bytes | 111,749 bytes | 73,000,000 shannons |
| Fresh 1,024-owner recovery run | 1,024 | 73 | 1,022 | 32,951,441–38,476,490 | 7,973–12,481 | 4,715 / 6,263 bytes | 111,749 bytes | 73,000,000 shannons |
| 1,024-owner full sell-down/rebuy canonical replay | 1,024 | 1,100 | 1,022 across 64 batches | 32,726,089–38,098,443 | 7,965–12,337 | 4,571 / 6,119 bytes | 111,749 bytes | 1,100,000,000 shannons |

The largest serialized transaction is wallet funding with 1,023 outputs; owner batch transactions remain bounded near 12.5 KB. The fresh recovery withdrawal itself committed at a 1,000,000-shannon fee. The 1,024-owner lifecycle used 1,096 TMS1 transitions, 1,024 distinct owners, 3,539,687 serialized transaction bytes, 4,837,501,910 estimated CKB-VM cycles, and 7,470 occupied-capacity checks. Cumulative curve purchases and sell payouts were each `54,232,600,000,000` shannons (542,326 CKB). Spendable reserve started and ended at `29,999,998,064` shannons; peak market Cell capacity was `54,261,600,000,000` shannons (542,616 CKB). This synthetic high-reserve fixture proves full-scale accounting and reversibility, not affordable onboarding or third-party liquidity. The preserved event data does not include a reliable wall-clock execution benchmark; local block generation time would not establish production confirmation throughput.

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

- Market, xUDT, custody, and marker script hashes bind each asset lineage. Their arguments bind market, asset, genesis and marker identities. The Gate 2 two-market execution tested asset, custody, inventory and order substitution against current Gate 2 ELFs. Market and custody singleton uniqueness in canonical history comes from consuming the prior outpoint; the node chooses one spend, while the scripts validate the successor. A competing successor rejected by the node is not a contract-level replay proof.
- Custody witnesses and the current custody script enforce the tested authenticated roots, leaf changes, and exact owner-entitlement/custody quantity. The independent recovery verifier checks actual old/new roots and the full reconstructed map across recorded scale history.
- Singleton lineage is advanced by spending the prior market/custody and marker outpoints and checking the exact successor. A covenant cannot prevent two transactions from competing to spend the same outpoint. The canonical node accepts at most one spend in a chain; a conflicting spend is a node double-spend outcome, not proof of a separate contract replay rule. No competing-successor race or node reorganization injection was run in this continuation.
- An actual chain reorganization can change canonical history and is not preventable by the contract. Recovery verifies canonical block inclusion and live output identity, snapshots/rechecks the tip, and fails closed on incomplete history. The mocked recovery test changes the reported tip during scanning and confirms fail-closed behavior; no actual private-node reorganization or conflicting canonical branch was induced. After a reorg, collection must restart from initialization and orders/transitions must be revalidated. Recovery requires an unpruned full-history CKB node; it does not require a Trade-operated backend. A pruned/history-incomplete RPC source is insufficient.
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

- **PARTIAL: Native attack coverage.** Eighteen signed, capacity-balanced Gate 2 attacks now reach the intended current Gate 2 scripts and reject with VM errors. Positive controls include successful A/B market initialization and operations, purchases, sales, valid offline fill, owner withdrawal, external redemption, and tombstone rebuy. Full serialized transactions, altered fields, raw transaction IDs, full signed-transaction and witness hashes, script-group source, script code hash, and VM code are stored per case in `security/evidence/native-smt-1794427785208/`. The matrix is:

| Attack | Native result |
| --- | --- |
| Tampered compiled multiproof; forged membership; forged non-membership; invalid new leaf state; skipped owner revision; unauthorized owner allocation; duplicate owner identity; unbacked entitlement increase; custody-root substitution | `custody_smt` (`0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000`), errors 7, 8, 9, or 21 as recorded per transaction |
| Forged market singleton successor; one-CKB reserve extraction; seller payout redirect; seller underpayment beyond the signed fee limit; payout inflation | `market_smt` (`0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770`), errors 21, 25, or 28 as recorded per transaction |
| Market A offline order replayed on B; A xUDT used for B external sale; A custody substituted into B; A xUDT placed under B inventory lock | `custody_smt` error 38, `market_smt` error 41, and `market_smt` error 22 for the two state/inventory substitutions |

These tests establish the specific encoded proof, lineage, payout, and reserve checks exercised by those transactions. They do not establish untested arithmetic bounds or xUDT owner-mode policy. The prior Gate 1 two-market fixture remains historical Gate 1 evidence only; the new independent A/B execution above is Gate 2 native evidence.
- **UNTESTED: Native arithmetic/capacity boundaries.** No targeted current-Gate-2 VM matrix yet covers maximum supported supply and quantity, 64-bit/128-bit intermediate overflow or truncation, exact occupied-capacity boundaries, under-capacity output rejection, or payout at/above the absolute available-reserve limit. The tested one-CKB reserve diversion and payout inflation reject at `market_smt` error 28, but they do not substitute for those boundary controls.
- **UNTESTED: Token authority and alternate claims.** Unauthorized xUDT owner-mode issuance, counterfeit xUDT input, unexpected extra xUDT inputs/outputs, and a second otherwise-valid redemption constructed from an alternate canonical state have not been exercised. The cross-market xUDT cases only establish the tested lineage-binding rejection. Owner revision overflow, tombstone re-enrollment with attempted old-order revival, and an unrelated-owner mutation with an otherwise-valid proof also remain open. A skipped revision and duplicate identity attack did reject, but they do not cover these distinct cases.
- **PARTIAL: Singleton conflict semantics.** A forged successor rejected by `market_smt` error 21 is covered. Two competing valid transactions consuming the same prior singleton, mempool conflict behavior, and the node's double-spend result were not run as a separate race. Canonical singleton uniqueness comes from consuming the old outpoint and node chain selection; the covenant cannot prevent a consensus reorganization or guarantee which competing transaction becomes canonical.
- **PARTIAL: Recovery independence/faults.** A fresh 1,024-owner recovery withdrawal committed using direct full-block RPC, a newly generated disposable test key, and current Gate 2 binaries. The test ran on the same host as the chain provisioner; a separately provisioned recovery machine and owner-supplied credential across that boundary remain unproven. `recovery/evidence/rpc-faults-1794429476044/fault-results.json` records mocked-RPC fail-closed tests for recovery without local proof cache/indexer, incomplete/conflicting history, missing tx body, tip change, concurrent custody successor (stale proof), and already-withdrawn retry. No actual node reorganization was induced. Recovery requires an unpruned full-history CKB RPC source; it does not require a Trade-operated backend. A history-incomplete/pruned source cannot establish recovery state.
- **PARTIAL: Combined replay scope.** The independent canonical replay now checks transaction inclusion/order, committed transaction bodies and TMS1 witnesses, each Merkle root/leaf transition, all 1,024 owner identities, actual custody xUDT quantity, external xUDT balances, market inventory, reserve movement, transaction fees, output occupied capacity, and final live singleton identities. This is verified for the 1,100-transaction full sell-down/rebuy replay, not a universal proof for all Gate 2 parameter values or every adversarial case.
- **UNIMPLEMENTED:** Absolute on-chain order expiry. The current signed order explicitly contains `Expiry: none`; only owner cancellation/revision invalidation and relay-side availability expiry are supported.
- **UNIMPLEMENTED:** An 80% purchase-cost protection guarantee. The stress counterexample shows the reversible curve is insufficient.
- **VERIFIED: Historical Gate 1 regression.** The six-transaction Gate 1 two-market verifier was rerun and passed. Gate 1 binary results remain labeled separately from the Gate 2 native evidence.

The Gate 2 result therefore remains **PARTIAL**. The completed 1,024-owner sell-down/rebuy journey and combined accounting replay close the prior full-scale lifecycle/replay blockers. The remaining untested native arithmetic, token authority, owner-revision, alternate redemption, singleton-race, and separately provisioned recovery cases prevent PASS. The documented expiry and buyer-protection limits also remain. This is an experimental engineering verdict, not production approval.

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

The Gate 1 verifier above is historical Gate 1 evidence. The current Gate 2 native attack fixture is run separately against the pinned fresh Gate 2 ELFs:

```sh
TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/rebuild/native \
TRADE_GATE2_BUILD_DIR=/mnt/c/Users/timot/Desktop/2026/CKB/trade-gate2-rebuild-closure-20261111 \
CKB_BIN=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/rebuild/native/tools/ckb \
node labs/trade-v2-token/gate2/security/smt-witness-attacks.cjs
```

The canonical 1,024-owner sell-down/rebuy replay and independent accounting replay were produced with:

```sh
TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/rebuild/native \
CKB_BIN=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/rebuild/native/tools/ckb \
TRADE_GATE2_BUILD_DIR=/mnt/c/Users/timot/Desktop/2026/CKB/trade-gate2-rebuild-closure-20261111 \
TRADE_GATE2_CHAIN_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-gate2-chain-replay-20261111 \
node labs/trade-v2-token/gate2/security/replay-native-events.cjs \
  labs/trade-v2-token/gate2/evidence/native-1794418766907 \
  labs/trade-v2-token/gate2/evidence/native-replay-1024-selldown-20261111b

node labs/trade-v2-token/gate2/security/collect-run-history.cjs \
  labs/trade-v2-token/gate2/evidence/native-replay-1024-selldown-20261111b \
  http://127.0.0.1:19224 \
  labs/trade-v2-token/gate2/recovery/evidence/scale-1024-selldown-20261111

TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/rebuild/native \
TRADE_GATE2_BUILD_DIR=/mnt/c/Users/timot/Desktop/2026/CKB/trade-gate2-rebuild-closure-20261111 \
node labs/trade-v2-token/gate2/security/verify-combined-1024-accounting.cjs \
  labs/trade-v2-token/gate2/evidence/native-replay-1024-selldown-20261111b \
  labs/trade-v2-token/gate2/recovery/evidence/scale-1024-selldown-20261111/history.json

node labs/trade-v2-token/gate2/security/verify-final-live-singletons.cjs \
  labs/trade-v2-token/gate2/evidence/native-replay-1024-selldown-20261111b \
  http://127.0.0.1:19224 \
  labs/trade-v2-token/gate2/recovery/evidence/scale-1024-selldown-20261111/final-live-singletons.json
```

`collect-run-history.cjs` requires the replay node still running at `127.0.0.1:19224`. The preserved `recovery-rpc.jsonl` and `history.json` are the raw RPC transcript and canonical history bundle used by the completed verifier. The matching fresh source and ELF hashes are recorded in `build-manifest-closure-20261111.json` and the native attack `fixture-provenance.json`.

The native scale coordinator generates a disposable owner key in memory, starts a fresh private node, runs the 1,024-owner workload, then invokes the independent recovery CLI against that node. Never place a real key in command history or repository files. The previously failed native harness attempts are preserved: an earlier SMT attempt used the wrong RPC port and never reached the intended VM, and an earlier recovery attempt selected a fee cell too small for its output layout. They are fixture/setup failures, not successful attack evidence.

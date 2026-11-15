# Ticoworld/trade: WO05–WO08 recovery evidence manifest

**Purpose:** Reconstruction reference for a *new* Codex Cloud workspace. These are descriptions and checkpoint reports supplied by the user, **not** original Git source objects, binaries or proof that reconstruction has passed. The former Cloud workspace holding the original local commits and a Git bundle is inaccessible. The earlier artifact download reports `Could not download artifact`. Do **not** invent the missing original commits, pretend to import the inaccessible Git bundle, or substitute assertion checks for CKB execution.

**Starting point in new workspace:** screenshot reported `main`/remote at `ce7f27e` with a WO04-era repository. Verify exact repository and objects before writing. Preserve main and old material. Frozen earlier WO04 E2 research was reported as commit `645cd3816b94346823ab3964f382d368591b6128`; it may not exist in the new checkout and must not be fabricated.

**Overall mission:** Recover testable capabilities, source provenance, adversarial properties, research conclusions and independent reproduction from WO05 through WO08-E2, without slavishly reproducing historical implementation choices. Distinguish (a) original user-reported historic evidence, (b) independently reproduced new evidence, (c) new corrections and improvements, and (d) currently missing evidence. Do not infer a viable commercial product from technical tests.

## Historical checkpoints to reproduce or honestly qualify

### WO05-E1: Native clearing and strongest A2 comparison
- Former branch `wo05-native-clearing`, commit `da7b70d` (original not expected in new workspace).
- User-reported old result: 321 committed native transactions, 32 expected rejections, 7 positive cases; candidate C settled 1,024 full-fill orders atomically, while optimized upstream MIT iCKB A2 with adjusted 2-MiB heap settled 1,536 in comparable testing.
- Custom compact direct payout and CKB capacity results did **not** demonstrate improved maker-inventory efficiency compared with A2 upstream netting. Old verdict `REVISE` for custom clearing; reuse upstream when stronger.
- Reconstruct baseline authorization, full/partial and invalid cases, capacity/bytes/cycles and strongest equivalent upstream comparison before claiming any improvement. The reported 1,024/1,536 values are historic targets, not mandatory fixture answers if resource or version differences are documented.

### WO05-E2: Hybrid and genuine native asset execution
- Former branch `wo05-e2-hybrid-productive`, commits `e559a10` and `3812d5c`.
- Historic report: 68 committed native transactions, 25 expected rejections, 14 positive checks, demonstrated bounded composition of compact C orders with A2, authentic master/successor lineage and CKB/xUDT/iCKB routing; technical but not commercially superior to A2/CCC.
- Rebuild only the smallest reliable native route, partial fill, binding, and recovery properties needed for later stages; do not make a new generic exchange.

### WO06-E1: Fair launch hypothesis and counterexamples
- Former branch `wo06-fair-launch-e1`, commit `e7183c3`.
- Six original problem classes: selective solver admission, sequential ordering/price games, creator cross-batch roundtrip, split-allocation manipulation, creator artificial demand, revocable post-graduation liquidity.
- Prior models produced counterexamples; do **not** label the launch protocol as safely solved or treat these negative results as passing proofs.
- Preserve runnable minimal counterexamples in models/fixtures; avoid reimplementing the entire rejected curve.

### WO06-E2: Autonomous discovery and bounded maker commitment
- Former branch `wo06-e2-adaptive-discovery`, commits `1786a14`, `d0993a8`.
- Historic verified bounded native run: 9 committed private-devnet transactions, 15 expected rejections, 2 recovery checks; 35 model groups and 4,950 split cases were reported.
- Existing A2 master under owner multisig plus absolute `since` prevented early maker withdrawal in tested configuration at about **+8 occupied CKB** relative to ordinary master; not true hard quote expiry. Example historic state 289 CKB ordinary vs 297 CKB committed pair in its particular fixture. Deadline block 96, later valid fill block 101, maker exit block 105; late fills can still win. Don't confuse lower-bound timelock with upper expiry.
- Reproduce bounded no-early-withdrawal, valid late fill, rightful owner exit, authentic state/lineage and recovery with ordinary A2 before moving on.

### WO07-E1: Native quote validity analysis and deterministic market tool
- Former branch `wo07-trade-adaptive-execution`, commits `ab42b20`, `9ad2ea7`.
- 68 offline tests; no new CKB transactions. Reviewed CKB 0.210.0 consensus source and rejected passive upper quote expiry using `since` plus transaction-selected historic headers/witness observations.
- Made exact market snapshot/depth/fee/route import tooling, with explicit UNKNOWN values and synthetics separated from observations.
- Reconstruct only the tools and adverse cases necessary for subsequent economics. Do not invent real executable prices.

### WO07-E2: Exact-outpoint gate cancellation
- Former branch `wo07-e2-native-revocation`, commits `6a892ae`, `91b9981`.
- Historic actual private-devnet run: 33 committed transactions, 18 expected rejections, 4 positive checks; independently repeated; adapted A2 requires exact 36-byte live gate outpoint dep in mint/match, rejects omission/substitution/rebinding; after owner spends gate, later fills fail; owner melt/recovery can succeed; an earlier valid fill can beat revocation.
- Unmodified A2 does **not** enforce this right. Adapter is a separate code hash/script, not a client-only setting.
- Historic comparable two-order lifecycle: ordinary A2 7 tx, 6,088 accounted bytes, 12,119,195 cycles, 578 occupied CKB; gated profile 9 tx, 7,627 bytes, 15,650,428 cycles, 807 occupied CKB; fixed test fees 0.07 vs 0.09 CKB. Adapted code was 42,848 bytes and its independent code cell occupied about 42,889 CKB in the tested layout. This is not cheaper ordinary cancellation.
- Reconstruct this only as a minimal isolated optional right if it matters to the recovery/economic tests; do not build out generalized revocation protocols just to match counts. Strong security claims require new validation.

### WO08-E1: Market-making economics
- Former branch `wo08-maker-economics-e1`, commits `819c85e`, `02c5c3f`.
- Old checkpoint: 95 offline tests (68 inherited, 27 new), 18 synthetic scenarios, 108 strategy runs, 40 book depth calculations, **0 observed external market snapshots**, 0 native transactions. Public depth request received HTTP 403; no retries.
- Distinguished native CKB, CEX CKB, CEX USDT, destination USDT, in-transit amounts, hedging vs delivery inventory, actual fees vs UNKNOWN, cost basis, realized vs MTM, price vs deliverable asset, sufficient depth vs missing depth, first-party customer quotes vs synthetic.
- Economic conclusions: hedging price risk does not replenish delivery inventory; fixed/stale directional quotes can lose; baseline professional RFQ can use same hedging strategies. No proven superior trading product. Recreate minimal faithful accounting and meaningful negative scenarios without invented data.

### WO08-E2: Native iCKB liquidity and actual DAO maturity
- Former branch `wo08-e2-native-liquidity`, commits `499c4aa`, `c3fff27`.
- Published A2 data hash `0x49dfb6afee5cc8ac4225aeea8cb8928b150caf3cd92fea33750683c74b13254a`, published binary 34,200 bytes; SHA256 `baf689bea596f8206d8c80e914ef36f828c9f95dad72049d2595c824df90da3a`. Historical iCKB Logic `0x2a8100ab5990fa055ab1b50891702e1e895c7bd1df6322cd725c1a6115873bd3`, xUDT `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95`, Owned Owner `0xacc79e07d107831feef4c70c9e683dac5644d5993b9cb106dca6e74baa381bd0`; verify these independently from pin/source before reusing.
- Historic complete private-devnet life cycle with published scripts: 7 committed transactions, 4 expected rejections, 3 explicit positive checks, 5,955 serialized bytes, 12,288,741 VM cycles, 0.07 CKB *fixed fixture fees*, not mainnet pricing. The seven stages: authentic DAO deposit+receipt; receipt→authentic iCKB; maker funds A2 bid; holder fills and receives actual CKB; maker independently recovers authentic successor; burn exact iCKB/request DAO withdrawal; mature completion into spendable CKB.
- Historic fixture: deposit 100,082 CKB, minted 99,997.59353177 iCKB under actual AR; 99,000 CKB maker payout; maturity test deposit epoch 1.6, request epoch 3.6, minimum claim 181.6, completed at 182.2 after mining 1,780 additional blocks in a **short-epoch private chain**. Interest froze at request header; mature DAO return 100,085.00783081 CKB (owner-marker capacity returned separately). Do NOT infer real network waiting times from integration-mined epochs.
- Total 24 new committed transaction *instances* across disposable run histories, not 24 unique trades. Prior economic scenarios: 41 new tests, 25 synthetic cases, 100 strategy runs. No mainnet depth, fee, maker profit or demand observations. Prior bot already supports core iCKB liquidity and maturity management. No proven competitive business.

## Reproduction hierarchy and stop gates
1. Verify remote base and assets; inspect what is **actually present** rather than assuming complete history.
2. Recreate primitive published contract/script setup and source/license hashes, native signatures and owner recovery; reproducible scripts first.
3. WO05 settlement/candidate C vs strongest upstream A2; reproduce a meaningful equivalent-workload comparison and record any failure.
4. WO06 negative launch counterexamples and no-early-withdrawal lower-bound time proof.
5. WO07 quote/expiry model, optional gate proof as relevant, honest cost comparison.
6. WO08 reproducible economic ledgers and published-A2 DAO mature withdrawal, including an actual early-rejection and complete spendable CKB outcome.
7. Independently clone a **new** verified repository or full bundle and run reproducibility checks. A bundle path only inside Cloud is **not a durable backup**. Capture external download or, with explicit owner approval, push a private `recovery/...` branch to GitHub, never force-push or modify `main`.
8. Mark phases `REPRODUCED`, `IMPROVED`, `PARTIAL`, or `MISSING`, with exact supporting code and receipts. Do not recreate old commit hashes, old bundle hashes or assert original code is bit-for-bit restored.
9. WO09 research after substantive restoration and durable backup. WO09 independently evaluates CKB launchpad/floor claims, bounded protection/leverage, OTX asset clearing and funded liquidity commitments, possible combinations, plus Remit/Sluice overlap. No hypothesis automatically wins.

## Commercial status
All prior completed work through WO08-E2 was **technical REVISE / commercial UNPROVED**. Models and native transactions are valuable; no independently verified mainnet quote/depth, real user demand, profitable maker portfolio or unique commercial advantage was proved. Preserve this distinction throughout reconstruction.

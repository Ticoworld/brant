# Trade V2 Gate 1 result

**GATE 1 PARTIAL, EXACT BLOCKERS**

This is a security-closure continuation of the existing experimental Trade V2 implementation. It does not restart the product or replace the previously working market, custody, batch, and sell-back paths. No UI, mainnet, public funded testnet, or real funds were used.

## Exact recovered state

- Repository: `Ticoworld/trade`; local branch: `wo16-launch-v2`.
- Starting local `HEAD`: `dc05ae51828e349f3ab55e6aac7c57b209a6eb44` (`Document Gate 1 binary reproducibility blocker`). Remote `origin/wo16-launch-v2-wip` was also at this commit. Parent checkpoints include `69742ff` and fallback `e337ac491a1f53777b6e1fab1c406afb5d877b58`.
- The previous checkpoint’s market/custody implementation was already committed by `dc05ae5`; no local edits to `market.c`, `custody.c`, `custody_marker.c`, or `owner_lineage_candidate.c` were found at recovery.
- At recovery, two tracked files were modified and uncommitted: `build.sh` and `run.cjs`; build outputs, temporary scripts, and several evidence folders were untracked. Nothing was reset, cleaned, or overwritten. A recovery snapshot is at `C:\Users\timot\Desktop\2026\CKB\trade-wo16-launch-v2-recovery-20261111\gate1-closure-recovery`.
- This closure adds a native initial-overissuance attack and verifier checks, and updates the report. Existing evidence, including `evidence/native-1794379012195` and the `e337ac4` fallback, was preserved.

## Fresh source-to-binary reproduction

A fresh isolated rebuild was made under `build-gate1-closed/` using the current sources; the full journey used those newly compiled binaries on a new disposable CKB chain. No prebuilt Trade binaries were used for this run. The new CKB script hashes match the recovered deployment hashes, so the evidence uses the same experimental deployment identity.

- CKB: `0.210.0 (2592ddf 2026-09-17)`; binary SHA-256 `d687e478aa4a395ba9ce839473fe43684cacd4ad7a38096af1e331b8a1ddd178`.
- Zig: `0.14.1`; executable SHA-256 `9df4f1d2eaa7c6ee7649d0e13853ad40deed5d94e643e9ff2a2bab52ffd9feee`; official release archive SHA-256 `24aeeec8af16c381934a6cd7d95c807a8cb2cf7df9fa40d359aa884195c4716c`.
- Build command: `bash labs/trade-v2-token/build.sh` with `TRADE_BUILD_DIR=.../labs/trade-v2-token/build-gate1-closed` and `TRADE_NATIVE_ROOT=.../labs/rebuild/native`. Script compiler flags: `-target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -nostdlib -fno-builtin -fdata-sections -ffunction-sections`, pinned CKB C stdlib include paths, `--gc-sections`, `_start`, stripped ELF, image base `0x10000`.
- Build dependencies: `ckb-system-scripts` `72eb92fca090700dcb398cd8cad8fbd8bad40355`; nested `secp256k1` `3ffde18a060aaf4df5b81e7d88355f1e99874650`; xUDT ELF SHA-256 `e9b92e5783f692f6ee99ca20eeda5f3da282e0f4010eb4fbd3db4e3058239349`.
- Source SHA-256: `custody.c` `a01e11468fb31759a1c65ee7a75958c53ffd1c4b8b8d04cd631c686c9ef8f838`; `custody_marker.c` `f8a56fe1b5308e57efe4bcda22b5b5060b76da64d35d0ef4230a6c37da8f104f`; `market.c` `1d12c7b3cc9744d214644ed08eee308e862bc9fe8fed0b0b4cc46e9ed730c142`; `owner_lineage_candidate.c` `a10fb1968054c3ad96b5ed4475fb008b27b51a60547394e1f980585c4891cb3e`.
- Fresh ELF SHA-256: `custody` `65c26c5a33e9675b725e072e4bcfa83f3dd613ae14981d65f61769ba6d16c251`; `custody_marker` `c60b7202e46fedd2741952a399d16da761517908dbde0dd9d8f4a96e2cc3fe3b`; `market` `84a08aea1ed5d614895711fa3359edd9669f4af67def9ef70916c02f3d076b66`; `marker_candidate` `5941ccbc5ebd47e59811c4c8d8c8ae8d8f19431770fe771cf12b0e88d7bb5f4f`; `owner_lineage_candidate` `661820b1d9ce5b384762e5e67389335c04bb2c34aac7bbcb7cb684e9ea13671b`; generated `codes.h` `82e6af0e1fa76dd93da7ef4633988a1eb6cdab268702feba095dabfddfdd1e6e`.

## Native journey and independent replay

Fresh evidence: `evidence/native-1794381676238`. It contains raw transaction bytes, node log, RPC requests/responses, committed receipts, cycles, summaries, attack transactions, and rejections. The native run committed 27 transactions. The verifier replays their inputs/outputs, capacity minima, fees, supply, reserve equations, custody records, lineages and attack source/error codes. Result: **PASS**, 42 attributed script rejections. Every transaction paid `1,000,000` shannons (0.01 CKB). These are private-chain VM results, not production deployment claims.

| Transaction | Hash | Estimated cycles |
| --- | --- | ---: |
| `fund` | `0xdb830287434c860e111ff7bd3f58f055d67edfda80e5599bf930c2b88de4542a` | 1639167 |
| `issue` | `0x49aa60b56a48627b1fab0b6576f16ab72ec18386b105ba2a63656bbc5b99d2ca` | 1709527 |
| `purchase_to_custody` | `0xa40b6e1d3522381582f0428756d19b6e260acd6ee8458a3af1d0a8abacaddb9d` | 1856039 |
| `fund_fake_untyped_marker` | `0x520f82ff4ac14a584fbbf80b02a5310ee5ec0156becebceaf5333e6f13e3d28d` | 1621656 |
| `continuation_purchase` | `0x947e19df5c5114ee38069925efb2beec535799d6d3b73f5d81874a5964b64aba` | 2052214 |
| `batch_purchase` | `0x14bec5125c9e1757065fad01afcfa52856aac711b9e8116f040028850075141d` | 5472194 |
| `unrelated_dave_withdraw` | `0x01df69f8abbf4c99c140de486a68fa799665780c414197a5a7e4e13a4563a801` | 1965559 |
| `alice_open_sale_after_unrelated` | `0x1330a578b2f0c9d02ff7c6337b7c1c3226cedee96cbf5c2451c0dbf93ffb6c17` | 3561423 |
| `alice_revoke` | `0x7f5b26b1bff1393eb77d611039a13af4df0da5c9f93c5dde41d3e406d657fd25` | 1956576 |
| `carol_open_sale_after_unrelated` | `0xd39527daf258d4653fecb2ab926384c6e71dac095d74c50652d6d012035b2c00` | 3552920 |
| `ben_withdraw` | `0x06f4af585a36d38897b989677073a836e8d93acdcb0cdef198b7d332b26e80c0` | 1957236 |
| `alice_withdraw` | `0xbbc0fabc1afbaf9f028c3dfe9fee901e3135d202425918a53ab613bdc908f88a` | 1922745 |
| `alice_deposit_after_zero` | `0x3a6a57b815ce74efae51d0ba7469c11b5b2e06079dc1762d3e0405f237fc3dec` | 1950814 |
| `alice_rewithdraw` | `0xe5d25f1d5e75548a54cd20523d14d183ab6c66af6b15321bc31a7dab30a197ed` | 1957306 |
| `curve_sell_4_4` | `0xcba8628d4097fdfd862e583deba01a620ca74b2c543207a206dde9b90ad48c39` | 2071416 |
| `curve_sell_0_1` | `0x6e82dd44db73bf8ac9a4504edb0367d3b50fe459f2c148d9c7279079acafe93f` | 2070866 |
| `curve_sell_3_2` | `0x2f730d287e6674e25556ceeb63e21bf35aa756aa4d5a39773ed9629cca669514` | 2062329 |
| `curve_sell_5_5` | `0x8b4840bcb1abfddd15f6758b594d4c6c89c3118e10cdb561d5979369a6a8af50` | 2037518 |
| `curve_sell_6_6` | `0x97bd4c952c129dc37fde49229610a221932cb930906080e6d1612e38eeefcf4b` | 2064529 |
| `external_sell_dave` | `0xf5a4923d26908cdac3b1b125b80be29ca3ac0cb0830217a5c23c85b4dc104094` | 1734788 |
| `external_sell_ben` | `0x79093cf78f1e44557f706c924f54365372cbc8b3286ba66b9b3a21aa014a786c` | 1714705 |
| `external_sell_alice_remainder` | `0xb9fefa48037e2b232a6196e70372e67d121c202791e337f197d98bd4ca1b8e3d` | 1729885 |
| `external_sell_alice_last` | `0x1a5808a30c8e880e76d044cd80ab7b27afbeaabdd127918934a1ab9cf75d3a97` | 1717916 |
| `roundtrip_buy_1` | `0xbda497a4f12cc81e53289562209fc05609920c55990b4d10b2688eae5c963365` | 2034033 |
| `curve_sell_roundtrip_1` | `0x80e513f598a70d7ced58c9d4f7fe025941573421fc146d92dd6b19f5ab9f519a` | 2064720 |
| `roundtrip_buy_2` | `0xc06614643cdb85c67989598ecd9b2eaa33c93b59786e22579b6bf74470b60c18` | 2055632 |
| `curve_sell_roundtrip_2` | `0x43a515cf45672f6b9ed8e78ad24ddf3326011c588dab3a2dd8802a498a51154f` | 2059249 |

The positive journey covers fixed-supply issuance, an initial purchase, a new buyer joining existing custody, a three-signer batch, Alice’s offline order surviving an unrelated root update and being filled, owner-revision invalidation, internal holder sales, genuine external xUDT redemption, full sell-down, and two complete buy/sell round trips. The marker lineage remains linked through sell-down and repurchase.

Independent conservation checkpoints from committed transactions:

| Checkpoint | Market inventory | Market cell capacity |
| --- | ---: | ---: |
| After issue | 1,000 | 300 CKB |
| After initial purchase | 993 | 391 CKB |
| After new-buyer enrollment | 992 | 408 CKB |
| After three-buyer batch | 989 | 465 CKB |
| After internal plus external full sell-down | 1,000 | 300 CKB |
| After each of two round trips | 1,000 | 300 CKB |

Live xUDT supply remained exactly 1,000 in each independently replayed committed state. At the end all tokens were in the market cell; custody and external holder balances were zero. The market returned exactly to its original 300 CKB capacity. Custody and marker cells remained at their allocated 350 CKB each; final occupied minima were 282 and 298 CKB. Market token cell minimum was 210 CKB; external xUDT cells were 142 CKB. Fees came from separate inputs, not reserve.

A newly added initial issue attack changed only the xUDT quantity from 1,000 to 1,001, preserved the genuine anchor/owner inputs, market and marker outputs, token Type Script, capacities and fee. It rejected on `Inputs[1].Lock`, the actual `owner_lineage_candidate` hash, with error `7`. Thus the real issuance lock executed and rejected altered fixed supply. Its raw transaction is in `rejections.jsonl` as `initial_overissuance`.

## xUDT owner-mode boundary

The pinned xUDT source is `labs/rebuild/reference/xudt/xudt_rce.c`. Trade’s token args are exactly `scriptToHash(owner)` with no flags suffix; xUDT therefore uses default owner mode by matching an input lock hash. The Trade owner candidate is the executable input lock and its `main` checks the original anchor, fixed output supply, market identity and marker output. The valid issue transaction and the `initial_overissuance` rejection exercise this input-lock path.

The source also supports enhanced owner mode from a witness `owner_script`, hashes it against xUDT args, dynamically loads its code and invokes exported `validate(is_owner_mode, extension_index, args, args_len)`. Trade’s owner ELF exports `main`, not `validate`; therefore a witness carrying that Script does not invoke Trade authorization. Pinned xUDT deliberately ignores enhanced-owner loading/validation errors and falls back to ordinary `simple_udt` conservation. The Trade witness inflation probe’s conserved control passes, while its +1 mutation rejects at xUDT `Inputs[0].Type`, error `-52`. This is evidence of fallback conservation, not Trade `validate` execution.

A fresh, separate native owner-control fixture compiled a disposable `validate` library and proved the dynamic interface itself: authorized output-witness mint committed as `0x89bab6ae7b88a1fa64dca98e27cf413ae68e248b132e262ba639ebf542f25e37`; authorized input-witness mint committed as `0x29911bfd50825d92d867ef6a4a458006caaf79800a43301563872d3b406ba4ea`. Invalid authorization, malformed witness and missing-library controls rejected for both directions. Evidence: `labs/wo16-launch-v2/evidence/owner-control-1794381897478`. This test library is explicitly disposable and is not Trade authorization. The reproducible command is `bash labs/wo16-launch-v2/owner-control/build.sh`, followed by `TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" node labs/wo16-launch-v2/owner-control/run.cjs`. The validation source SHA-256 is `217c05bcc282855222e1c5288c356c0de3140fd0e6fa044f1633c757049db1d4`; its freshly built shared-object SHA-256 is `da8321097f522b9f7f241f5b10aaf723f5e403875a7ebb637205924acfce1ed2`.

**Assessment:** no unauthorized mint was observed in the tested Trade input-lock or witness fallback paths. The fixed-supply issue path has a direct native overissuance rejection. The dynamic witness control prevents misreading xUDT behavior. Remaining owner-mode proof is the targeted boundary matrix of alternate activation/lock/type arrangements against Trade’s actual owner script and all xUDT flags; it is not claimed complete.

## Adversarial results

The table gives the actual rejecting script group and CKB VM code from the 42 recorded cases. These are native estimate-cycle rejections of fully serialized, signed or capacity-balanced fixtures; “PASS” means that exact attempted mutation was rejected at the named script, not that all adjacent attack forms are closed.

| Attack | Rejecting group | Code |
| --- | --- | ---: |
| `initial_overissuance` | `Inputs[1].Lock` | `7` |
| `duplicate_custody_lineage` | `Inputs[0].Lock` | `8` |
| `incorrect_curve_price` | `Inputs[0].Lock` | `28` |
| `purchase_overcredit` | `Inputs[2].Lock` | `23` |
| `purchase_wrong_asset` | `Inputs[2].Lock` | `20` |
| `purchase_unauthorized_revision` | `Inputs[2].Lock` | `25` |
| `purchase_stale_root` | `Inputs[2].Lock` | `23` |
| `purchase_invalid_marker` | `Inputs[2].Lock` | `21` |
| `batch_exceeds_max` | `Inputs[0].Lock` | `43` |
| `batch_duplicate_slot` | `Inputs[2].Lock` | `29` |
| `batch_redirect_change` | `Inputs[2].Lock` | `29` |
| `batch_quantity_mismatch` | `Inputs[2].Lock` | `30` |
| `batch_unauthorized_transfer` | `Inputs[2].Lock` | `31` |
| `batch_duplicate_owner_record` | `Inputs[2].Lock` | `28` |
| `enhanced_owner_witness_inflation` | `Inputs[0].Type` | `-52` |
| `stale_seller_proof` | `Inputs[0].Lock` | `6` |
| `underpaid_seller` | `Inputs[0].Lock` | `17` |
| `invalid_signature` | `Inputs[0].Lock` | `19` |
| `wrong_seller_signer` | `Inputs[0].Lock` | `19` |
| `wrong_chain_signature` | `Inputs[0].Lock` | `19` |
| `wrong_custody_asset` | `Inputs[0].Lock` | `2` |
| `seller_payment_redirect` | `Inputs[0].Lock` | `17` |
| `altered_signed_quantity` | `Inputs[0].Lock` | `19` |
| `altered_order_id` | `Inputs[0].Lock` | `19` |
| `wrong_singleton_marker` | `Inputs[0].Lock` | `2` |
| `fulfilled_order_replay` | `Inputs[0].Lock` | `19` |
| `revoked_order` | `Inputs[0].Lock` | `19` |
| `duplicate_buyer_position` | `Inputs[0].Lock` | `6` |
| `replace_ben_tombstone` | `Inputs[0].Lock` | `18` |
| `old_order_after_balance_returns` | `Inputs[0].Lock` | `19` |
| `sell_excess_payout` | `Inputs[0].Lock` | `28` |
| `sell_underpaid` | `Inputs[0].Lock` | `28` |
| `sell_zero_quantity` | `Inputs[2].Lock` | `23` |
| `sell_minimum_exceeds_price` | `Inputs[0].Lock` | `31` |
| `sell_redirect` | `Inputs[2].Lock` | `24` |
| `external_excess_payout` | `Inputs[0].Lock` | `47` |
| `external_underpaid_seller` | `Inputs[0].Lock` | `47` |
| `external_payout_redirect` | `Inputs[0].Lock` | `42` |
| `external_token_change_redirect` | `Inputs[0].Lock` | `42` |
| `external_minimum_not_met` | `Inputs[0].Lock` | `46` |
| `external_wrong_xudt_type` | `Inputs[0].Lock` | `41` |
| `order_replay_after_curve_sale` | `Inputs[0].Lock` | `19` |

Still **NOT TESTED to the requested standard**: cross-market inventory substitution between closely related market IDs; forged/duplicated/competing market singleton lineage beyond a duplicate custody-lineage probe; second initialization after complete sell-down; replay of the exact already committed external sell-back; curve arithmetic overflow; quantity/supply overflow/underflow; reserve capacity underflow or extraction through otherwise valid construction; extra xUDT input/output shape variants; and a direct incorrect external-token-return matrix. Existing reserve and payout mutations cover price conservation, redirects, over/underpayment and wrong xUDT Type Script, but do not substitute for those targeted cases. Existing stale-root, revision, tombstone, fulfilled/revoked order and old-order-after-balance-return rejections cover important stale-order cases; direct adversarial state replacement designed specifically to revive invalidated orders remains untested. Do not infer these gaps are safe from malformed-fixture rejections.

## Historical replay and limitations

- `verify.cjs evidence/native-1794381676238`: passed, 27 committed transactions, 42 attributed rejections.
- `verify-continuation.cjs evidence/native-1794299129358`: passed, 22 attributed rejections.
- `verify-legacy.cjs evidence/native-1794295325247`: passed, 16 attributed rejections.
- Earlier evidence, including `native-1794379012195`, was not overwritten.

This bounded finite linear curve is reversible and solvent for the fixture; it does **not** establish an independently funded 80% individual purchase-price floor. That guarantee is **NOT IMPLEMENTED**. Eight permanent holder records and serialized hot-cell contention remain. A three-buyer batch does not solve those limits. The contracts remain experimental and unaudited; no real trading, maker economics, demand, deployment cost, or production security is established.

Gate 2 remains the R6/R7 Merkle ownership and offline-intent adaptation to genuine xUDT custody: exceed eight holders, preserve supply, and support independent proof reconstruction and withdrawal. Gate 3 must address batching, competing buys, durable orders, relay fault tolerance, solver recovery and measured contention. Keep funded downside protection visible as a separate design objective, without representing an 80% floor as implemented. Gate 4 (minimal browser journey with owner-controlled testnet wallets) and Gate 5 (demand, executable liquidity, market-maker participation, costs and independent recovery) remain later gates.

## Reproduction

From repository root in WSL, with the pinned local dependencies and isolated fixture keys:

```sh
TRADE_BUILD_DIR="$PWD/labs/trade-v2-token/build-gate1-closed" \
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" \
  bash labs/trade-v2-token/build.sh
TRADE_BUILD_DIR="$PWD/labs/trade-v2-token/build-gate1-closed" \
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" \
  node labs/trade-v2-token/run.cjs
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" \
  node labs/trade-v2-token/verify.cjs labs/trade-v2-token/evidence/native-<timestamp>
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" \
  node labs/trade-v2-token/verify-continuation.cjs labs/trade-v2-token/evidence/native-1794299129358
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" \
  node labs/trade-v2-token/verify-legacy.cjs labs/trade-v2-token/evidence/native-1794295325247
```

The CKB process is started by the runner as a fresh local node with a disposable chain directory. The fresh build and evidence directory must be retained together. Baseline fallback remains commit `e337ac491a1f53777b6e1fab1c406afb5d877b58`.
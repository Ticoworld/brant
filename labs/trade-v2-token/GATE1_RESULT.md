# Trade V2 Gate 1 result

**GATE 1 PARTIAL, EXACT BLOCKERS**

This is a continuation of the interrupted local work, not a restart. The recovered local branch was `wo16-launch-v2`, at `e337ac491a1f53777b6e1fab1c406afb5d877b58`; the corresponding remote branch `origin/wo16-launch-v2-wip` also pointed to that commit. The five tracked implementation files below were locally modified and uncommitted. The native build, runners, and evidence were untracked. A non-destructive recovery snapshot was written outside the repository to `C:\Users\timot\Desktop\2026\CKB\trade-wo16-launch-v2-recovery-20261111` before further edits.

## Recovered and updated

Recovered changes in `market.c`, `custody.c`, `custody_marker.c`, `run.cjs`, and `verify.cjs`. The recovered implementation adds reverse-curve sales, persistent market/custody singleton binding, existing-market buyer enrollment, three separately signed buyers in one batch, external xUDT redemption, revision changes on buy/sell, and round trips. The market and custody scripts enforce linked inventory, supply, reserve, and owner-record accounting. I added a signed xUDT enhanced-owner witness inflation probe and independent checks for its recorded positive and negative controls. Existing build scripts and generated code headers were preserved; no prior evidence was replaced.

The private CKB executable and recovered contract build were Linux binaries in this Windows environment. Running under WSL resolved execution without changing their bytes. This rerun used the recovered build outputs; a fresh source-to-binary rebuild was not performed. The fresh run reports CKB `0.210.0 (2592ddf 2026-09-17)`.

## Native verification

Fresh run: `evidence/native-1794379012195`. The full committed transactions, raw RPC requests/responses, node log, event sequence, rejection fixtures, and summary are preserved there. The independent verifier passed all 27 committed transactions and 41 attributed rejection results, including fee, occupied-capacity, state-root, singleton-link, signature, balance, reserve, and supply checks. Private node consensus/VM execution remains the trust boundary. Historical replay also passed for `native-1794299129358` with 22 rejections and `native-1794295325247` with 16 rejections.

Every committed transaction paid `1,000,000` shannons (0.01 CKB). The table gives transaction hash and CKB-VM estimated cycles from the fresh run. Raw serialized transaction bytes and RPC receipts are in `events.jsonl` and `rpc.jsonl`.

| Transaction | Hash | Estimated cycles |
| --- | --- | ---: |
| fund | `0x5f631a435c68172246df59b4e7d0a9198afe33e9d8ddb0f74c1fd519fb7e5a30` | 1,619,451 |
| issue | `0x331ade38968267129134e2c4d5f32904dbbcb7c35bd5d80011dd2b0e58e99ab4` | 1,719,982 |
| purchase_to_custody | `0x42d49538129cf062ea02a624dae7e74b490db58f67b18325fef83467d0f6c374` | 1,885,460 |
| fund_fake_untyped_marker | `0x874f798852fd276108b125e3021bf1a467409eb1d842147e16b439bf68392970` | 1,645,456 |
| continuation_purchase | `0xe9f7a3283dd5e7d98c72031bbe7f3b58a88076b6c8e3a62ceab0cf79f987f0fe` | 2,049,923 |
| batch_purchase (three signers) | `0x0ce5ab759e93fc314c0a07a0308e08cf1105e78473c890ebc8b144ff7f215874` | 5,516,176 |
| unrelated_dave_withdraw | `0x8ab9d6875d2652305e80bd18652b0d2289634b2ca3c0415f5113b0d7302c6b60` | 1,943,117 |
| alice_open_sale_after_unrelated | `0x4f8f52f6721f55062d6f762038f2b0b612163ff2c1d5ae0e9bbf2f92384345eb` | 3,576,425 |
| alice_revoke | `0xb0fc32c31dcee41c8eec9250d1b55efc6aa1a280b8dbe3ca251990dc9c972787` | 1,957,554 |
| carol_open_sale_after_unrelated | `0xe4335639be2687d267c5d229ddd70f80400ef3e3108ae89310a57a012f69b24f` | 3,545,941 |
| ben_withdraw | `0x5af1fe5f631a1f31ac0792506f2de06bd75902e23f47ecc7c33c95fde590e60e` | 1,962,318 |
| alice_withdraw | `0x2ec4e518697b66783446e1a655fe52420fd685064943c08eaa26abd6d926ea7b` | 1,936,291 |
| alice_deposit_after_zero | `0xd2bceb590cbcd684c937cf767cad05db5631da8a66270850a1439201b4642b1e` | 1,939,321 |
| alice_rewithdraw | `0x9fffc69835c447e1e25137ee6a9fba414c639ea4b0c56739f6b2579d77f26a37` | 1,943,896 |
| curve_sell_4_4 | `0x0b04cf9e972e57dabda2d74662eb2d78512cdfe3bb932fc096f2d3a40c8c95fb` | 2,047,275 |
| curve_sell_0_1 | `0x204f1feca503a3be454fd5991eb0e5ab6d13189cf066816c1a7d359962cd27e3` | 2,046,091 |
| curve_sell_3_2 | `0xf630ae28e626c77fcfbdba12e4758b3bfdffa90c35a4e12e83e829047e1a9e1f` | 2,075,999 |
| curve_sell_5_5 | `0xcbf14bab7b9ad6b0d311c523895f5da07626615fc140144ee6d2f2ef65cf73f9` | 2,047,014 |
| curve_sell_6_6 | `0xbdd4302f3df683f432342cb3ad93f4037a2d2fed558027eccd74429f285286a4` | 2,047,580 |
| external_sell_dave | `0xfd4d880388e66bd3a08b73876fcf9cfa54cbb6e8c8cd9e5f7f1b15f97b8d4790` | 1,722,913 |
| external_sell_ben | `0xa35b8558e5b5f886692392a2b448fdbed7b7340375fac23103066af34b514e2a` | 1,749,242 |
| external_sell_alice_remainder | `0xc5665f1563ab085d03e786a5426ea074262434168e76941136612e701597135f` | 1,721,030 |
| external_sell_alice_last | `0x677d9394ea204c70cb0ababb40cdc394f8d848a74e56da24856ad1b35c6a90b9` | 1,732,330 |
| roundtrip_buy_1 | `0x0429e1768b18e78b7a7107128475976d96862c69b574a3c51d3c6f9f12d4793f` | 2,056,139 |
| curve_sell_roundtrip_1 | `0xbdf2a359068fa601381ee0b223a6d29ed4efdb9a7a607e7e05726db889f147c3` | 2,040,726 |
| roundtrip_buy_2 | `0x54fe15fc147179064c0469e59f63a1678beba5b74f4f5c4342df094b5bcbc2e3` | 2,043,234 |
| curve_sell_roundtrip_2 | `0x66d877ea33b58a9e3b3f49b6a22cf42809431c12025e3d08393eed1641ae5677` | 2,059,609 |

## Verified journey and accounting

**VERIFIED in this bounded disposable chain:** a fresh buyer enrolled into existing custody; a batch with three different buyer signatures committed atomically; an original offline Alice order survived an unrelated root update and was filled; old signatures failed after relevant revisions changed; multiple internal holders sold directly back to the curve; Dave, Ben, and Alice each redeemed genuine external xUDT; the market sold down completely; and two buy/sell round trips succeeded without replacing the singleton lineage.

At every committed transaction the independent replay checked total live xUDT supply at exactly 1,000 units and checked custody records against custody token balance. Market inventory/reserve checkpoints were:

| Step | Market inventory | Market cell capacity |
| --- | ---: | ---: |
| Initial issuance | 1,000 | 300 CKB |
| First purchase | 993 | 391 CKB |
| Existing-market enrollment | 992 | 408 CKB |
| Three-buyer batch | 989 | 465 CKB |
| After all curve and external sales | 1,000 | 300 CKB |
| After round trip 1 sell-back | 1,000 | 300 CKB |
| After round trip 2 sell-back | 1,000 | 300 CKB |

The ending custody and external-holder token amounts are both zero; all 1,000 units are back in the market inventory. The market capacity returned exactly to the issued cell's 300 CKB starting capacity. Custody and marker cells retained their allocated capacities of 350 CKB each; their final occupied minima were 282 CKB and 298 CKB respectively. The market token cell's occupied minimum was 210 CKB. External xUDT holder cells required at least 142 CKB. Transaction fees were paid from separate inputs, so they did not reduce market reserve.

## xUDT enhanced-owner witness result

**VERIFIED:** `enhanced_owner_witness_inflation` uses the actual owner Script in `WitnessArgs.input_type`, signed by the actual holder, on the real external xUDT output. A same-input, same-witness-shape control with conserved token quantity passed `estimate_cycles`; an otherwise matching transaction that added one token was rejected by the pinned xUDT Type Script with `ERROR_AMOUNT (-52)`. The raw transactions and RPC outcome are preserved in the fresh evidence, and the verifier checks the owner Script bytes, token identity, one-unit inflation, successful control, and rejection source/code.

**NOT PROVEN:** that the Trade owner script ran or authorized/rejected this witness path. The source `xudt_rce.c` intentionally ignores the error returned from `check_enhanced_owner_mode`; `-52` can be the ordinary balance-conservation fallback. The Trade owner candidate exports an executable `main`, not the dynamic `validate` symbol required by xUDT enhanced owner mode. A separate known-valid dynamic `validate` control exists in the WO16 owner-control lab, but it does not prove this Trade owner execution. Therefore this result does not establish a general owner-mode supply-inflation defense. Gate 1 remains partial until a Trade-specific, dynamically valid owner control and matching authorization/rejection tests are run or owner witness mode is eliminated by construction.

## Adversarial coverage and exact blockers

The fresh chain records 40 attributed rejections, including stale seller roots, wrong signer/chain, changed signatures and order IDs, underpayment/redirected seller payouts, wrong custody asset, duplicate buyer positions, wrong singleton marker, wrong external xUDT Type Script, duplicate lineage attempt, bad curve pricing, reserve overpayment/underpayment, zero/over-limit sell, external payout and token-change redirection, minimum proceeds, invalid batch slots/participants/change/quantity/owner transfer, and stale conflicting batch execution. Each submitted attack is signed or capacity-balanced where appropriate and the verifier attributes the observed contract source and code. `-52` is recorded for the enhanced-owner inflation case with the limitation above.

Still **UNVERIFIED** for Gate 1: fresh source-to-binary reproduction of the recovered C scripts (the native run used the preserved prebuilt binaries and Zig was unavailable); cross-market inventory substitution, fully forged/duplicated singleton lineage beyond the recorded duplicate attempt, replay of an already committed external sell-back, full sell-down followed by a second initialization attempt, and targeted arithmetic overflow and capacity-underflow cases. The owner-mode activation/authorization path is also unverified as described above. These gaps prevent a pass verdict.

## Economics and architecture limits

The curve is solvent and reversible for this finite linear-curve fixture. An 80% purchase-price guarantee is **NOT IMPLEMENTED**: there is no independently funded 80% floor or proof that it holds. The test does not establish a profitable exchange business, real fee adequacy, deployment costs, demand, or maker economics. The holder-record design is capped at eight permanent slots; three buyers settling in one batch does not solve slot exhaustion, hot-cell write contention, or scaling. State updates remain serialized. The scripts are experimental and unaudited; no real assets, external funded testnet, mainnet, UI, or public deployment was used.

## Reproduction

From the repository root in WSL with the recovered local dependencies and private fixture keys:

```sh
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" node labs/trade-v2-token/run.cjs
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" node labs/trade-v2-token/verify.cjs labs/trade-v2-token/evidence/native-<timestamp>
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" node labs/trade-v2-token/verify-continuation.cjs labs/trade-v2-token/evidence/native-1794299129358
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" node labs/trade-v2-token/verify-legacy.cjs labs/trade-v2-token/evidence/native-1794295325247
```

Historical evidence remains unchanged. The baseline fallback is the preserved `e337ac4` commit. The current report is **partial**, pending the targeted adversarial gaps listed above.

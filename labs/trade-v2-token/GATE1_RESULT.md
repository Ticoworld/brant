# Trade V2 Gate 1 security result

**GATE 1 PARTIAL**

This is the current authoritative result for the Gate 1 security closure. It preserves the working experimental trading journey and reports only private CKB 0.210.0 results. It is not an audit, production approval, deployment identity for other binaries, or authorization for public funds. No UI, mainnet, public testnet, or real funds were used.

## Recovered starting state and changes

- Repository: `Ticoworld/trade`; worktree: `C:\Users\timot\Desktop\2026\CKB\trade-wo16-launch-v2`; local branch `wo16-launch-v2`; remote branch `origin/wo16-launch-v2-wip`.
- Starting HEAD: `d7ed83325cbeec06641f192fb40a3ee5dcde96e7`, the verified Gate 1 partial checkpoint. At inspection, remote `origin/wo16-launch-v2-wip` also pointed to `d7ed833`. Prior history includes `dc05ae51828e349f3ab55e6aac7c57b209a6eb44` and fallback `e337ac491a1f53777b6e1fab1c406afb5d877b58`.
- The resumed worktree had uncommitted modifications to `labs/trade-v2-token/run.cjs` and `verify.cjs`, plus preserved untracked build/evidence/temp artifacts. No contract source was modified in this closure. The original recovery snapshot remains at `C:\Users\timot\Desktop\2026\CKB\trade-wo16-launch-v2-recovery-20261111\gate1-closure-recovery`; the recovery snapshot was extended at `C:\Users\timot\Desktop\2026\CKB\trade-wo16-launch-v2-recovery-20261111\gate1-closure-recovery\final-checkpoint` with this report, handoff, runner/verifier sources, and the complete final evidence directory.
- The two modified scripts add nine native rejection fixtures and replay checks: duplicate market marker, market identity substitution mutation, forged matching-owner lock mint, unexpected extra xUDT output, unexpected extra xUDT input, incorrect external token return, inventory above supply, redemption above seller balance, and initialization after full sell-down. The verifier now accepts both the old 42-case evidence and new 51-case evidence without changing their assertions.

## Fresh binary and private-chain evidence

Current evidence: `labs/trade-v2-token/evidence/native-1794384051038`. It contains a fresh disposable CKB chain run using the pinned current-build artifacts, 27 committed transactions, raw serialized transaction objects, RPC/node logs, estimated cycle results, attack transactions and an independent replay result. The final verifier passed with all 51 recorded native script rejections and the external redemption replay failing spent-input resolution.

- CKB: `0.210.0 (2592ddf 2026-09-17)`; binary SHA-256 `d687e478aa4a395ba9ce839473fe43684cacd4ad7a38096af1e331b8a1ddd178`.
- Zig: `0.14.1`; executable SHA-256 `9df4f1d2eaa7c6ee7649d0e13853ad40deed5d94e643e9ff2a2bab52ffd9feee`; release archive SHA-256 `24aeeec8af16c381934a6cd7d95c807a8cb2cf7df9fa40d359aa884195c4716c`.
- Build command: `TRADE_BUILD_DIR="$PWD/labs/trade-v2-token/build-gate1-closed" TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" bash labs/trade-v2-token/build.sh`. Compiler flags are `-target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -nostdlib -fno-builtin -fdata-sections -ffunction-sections`, pinned CKB C stdlib include paths, `--gc-sections`, `_start`, stripped ELF, image base `0x10000`; pinned dependencies are listed here and in `build-provenance.json`. Dependency commits: `ckb-system-scripts 72eb92fca090700dcb398cd8cad8fbd8bad40355`; nested secp256k1 `3ffde18a060aaf4df5b81e7d88355f1e99874650`; xUDT ELF SHA-256 `e9b92e5783f692f6ee99ca20eeda5f3da282e0f4010eb4fbd3db4e3058239349`.
- Source SHA-256: custody `a01e11468fb31759a1c65ee7a75958c53ffd1c4b8b8d04cd631c686c9ef8f838`; custody marker `f8a56fe1b5308e57efe4bcda22b5b5060b76da64d35d0ef4230a6c37da8f104f`; market `1d12c7b3cc9744d214644ed08eee308e862bc9fe8fed0b0b4cc46e9ed730c142`; owner lineage candidate `a10fb1968054c3ad96b5ed4475fb008b27b51a60547394e1f980585c4891cb3e`.
- Fresh ELF SHA-256: custody `65c26c5a33e9675b725e072e4bcfa83f3dd613ae14981d65f61769ba6d16c251`; custody marker `c60b7202e46fedd2741952a399d16da761517908dbde0dd9d8f4a96e2cc3fe3b`; market `84a08aea1ed5d614895711fa3359edd9669f4af67def9ef70916c02f3d076b66`; marker candidate `5941ccbc5ebd47e59811c4c8d8c8ae8d8f19431770fe771cf12b0e88d7bb5f4f`; owner lineage candidate `661820b1d9ce5b384762e5e67389335c04bb2c34aac7bbcb7cb684e9ea13671b`; generated `codes.h` `82e6af0e1fa76dd93da7ef4633988a1eb6cdab268702feba095dabfddfdd1e6e`. These match the experimental script identities used by this evidence.

### Committed journey transaction hashes, cycles and fees

| Label | Transaction hash | Estimated cycles | Fee (shannons) |
| --- | --- | ---: | ---: |
| `fund` | `0x53b91017c9fd29bdaba2ac161155a36d24491f818a232ce50f31073957f53e9f` | 1637991 | 1000000 |
| `issue` | `0x70521ad2d8bc4161f2f429febe3925cc5572342f9210bc8e0d97d1cf806ac418` | 1707091 | 1000000 |
| `purchase_to_custody` | `0x0d1d29cf1860acfe20d3f01e44bd53dc9a1fdb52bb34bdf4eb2a5ae81160930d` | 1895724 | 1000000 |
| `fund_fake_untyped_marker` | `0xab99f30f7cf1466ed36e493859f7d3c8d2a437633044c93fe2d769f96a5402ea` | 1621558 | 1000000 |
| `continuation_purchase` | `0x674d9b9e67add7fb41ae7bc3aef109a9b1778ba109ad7a18dd8424a5b92ad5e5` | 2027205 | 1000000 |
| `batch_purchase` | `0x40f62be5373ba901e9fbc2726cc15401d179d9f558302d3cb8806ba10fbe611f` | 5497713 | 1000000 |
| `unrelated_dave_withdraw` | `0x155a38cc03c94e494a0375b188b146906863ed5764e89abf7c5b7c13b2ba1c11` | 1969174 | 1000000 |
| `alice_open_sale_after_unrelated` | `0xd6adb7f041a76139ffe07c9338ed873d48615d782bac9a88b764987a029389b6` | 3557496 | 1000000 |
| `alice_revoke` | `0x49435ba74971df8ab9ee6ee30eed4157e74dfb70ff252aa94f5b727fbfbb75a7` | 1962074 | 1000000 |
| `carol_open_sale_after_unrelated` | `0xbd65831dfd98b6297af3d7545af49fb2be916093d9cf26aac177ca42918943eb` | 3550452 | 1000000 |
| `ben_withdraw` | `0x21a5ef48f1ab6cd9ca7885487f8b15bcf407c60787fa057a716b75fc800a9082` | 1942796 | 1000000 |
| `alice_withdraw` | `0x5943b41c0283564bb108708d558c05cd3a71a574518404cb850f29931e399bd5` | 1940172 | 1000000 |
| `alice_deposit_after_zero` | `0x1a292fd129ca3429a9b15f08572f9f5b78faf29186be559ef99a82c80a2892ff` | 1950882 | 1000000 |
| `alice_rewithdraw` | `0xde32683afe6aeb9785fb02608425ee9f92626b798419890dfcf34e39dc4b6a2e` | 1969621 | 1000000 |
| `curve_sell_4_4` | `0x4fa9cc798037f0bac16ddf091946b6c2446f50721571f0214e5b77c45b808cb3` | 2046209 | 1000000 |
| `curve_sell_0_1` | `0x5e017e95c07be3df69f2ee3fc7f94f9136cac28977251496b79f2483153fe478` | 2038783 | 1000000 |
| `curve_sell_3_2` | `0xe6e6027485e67838a0eeb7f19679bdde2a0da25130d277cff3e5e8eb22ebeda8` | 2037235 | 1000000 |
| `curve_sell_5_5` | `0x71a369e7cfe7b7c67e4c6e02ef628125259d1a13f120bfc3ebf533c188bb9879` | 2070967 | 1000000 |
| `curve_sell_6_6` | `0xf2ed2506b4e4e5b8c8c66582d8504b66560a3b4cb2cf5b084d8ded987b1daf7f` | 2053025 | 1000000 |
| `external_sell_dave` | `0x642bece0bc609e68b65c2212483e8cf0da49c9ef933af277abe276769f1d6066` | 1730320 | 1000000 |
| `external_sell_ben` | `0xb199ccc8bc1c465d6f30d15e0874fa63d5278887449c33340893f31432210ad6` | 1712407 | 1000000 |
| `external_sell_alice_remainder` | `0xca8da441bb71795e8410f64b93c1f8d1935d8ee8f9aa6fb2ab5ec03bc9a923b4` | 1708420 | 1000000 |
| `external_sell_alice_last` | `0xa54d5485eebc6e8970eab45c76d847fbc9f4902b00fb2ee7dd64afae85fbe482` | 1729009 | 1000000 |
| `roundtrip_buy_1` | `0xdaff1d65b94fe4963d456f7553c7bc7b8482e072fd14899dd31fd54717aaa9a0` | 2033755 | 1000000 |
| `curve_sell_roundtrip_1` | `0xedac013c968c3336f9c0fc4d7bea8542b9e7ee44a4716adceb67a5f68a6652ac` | 2058420 | 1000000 |
| `roundtrip_buy_2` | `0xd6c42285929829897fd6d3da7a23f8714430878043d673f6d2be7b7c54664e67` | 2046860 | 1000000 |
| `curve_sell_roundtrip_2` | `0x5b0e704fdc79acb74428b7511075d82ba8d9c27e57ccaebec4509f9c485d5aee` | 2025445 | 1000000 |

### Independent replay and economics

The replay independently checked transaction ids and committed receipts, spent-input lineage, input/output capacities, occupied minima, fees, xUDT Type Script, total live supply, singleton links, custody records and curve reserve equation at committed states. Each committed transaction paid 1,000,000 shannons (0.01 CKB), funded separately from curve reserve.

| State | Market inventory | Market capacity |
| --- | ---: | ---: |
| Issuance | 1,000 | 300 CKB |
| Initial purchase (7 units) | 993 | 391 CKB |
| New-buyer enrollment (1 unit) | 992 | 408 CKB |
| Three independently authorized buyers in one batch (3 units) | 989 | 465 CKB |
| Complete sell-down | 1,000 | 300 CKB |
| After each of two further buy/sell round trips | 1,000 | 300 CKB |

Live xUDT supply remained 1,000 throughout the committed states. Full sell-down returned all external/custodied balances to zero and inventory to the market. The custody and marker cells remained at 350 CKB each (final occupied minima 282 and 298 CKB); market-token minimum was 210 CKB; external xUDT-token minimum was 142 CKB. The journey also verifies an offline Alice order survives an unrelated Dave withdrawal/root change and fills; old signatures are rejected after relevant revisions change. The persistent market/custody marker survives full sell-down and repurchase.

Genuine external redemption by Dave committed once as `0x642bece0bc609e68b65c2212483e8cf0da49c9ef933af277abe276769f1d6066`, block `0xb26be54baa8b6ac2f850d71f8adf79be599eb3ee4af927bf4f719d511a0afa8e`. Replaying the same transaction failed at node resolution with `TransactionFailedToResolve: Unknown(OutPoint(...))`; it was rejected because the input had been spent, before script execution. This proves double submission cannot recommit the same cell, not a separate on-chain replay branch.

## xUDT owner-mode boundary

Source inspected: pinned `labs/rebuild/reference/xudt/xudt_rce.c`, specifically args flag parsing, `check_owner_mode`, `get_owner_script`, `enhanced_owner`, and exported entrypoints; Trade’s compiled `owner_lineage_candidate` source/ELF and xUDT args were also inspected.

Trade’s xUDT args are exactly the 32-byte hash of the Trade owner script; there is no four-byte trailing flag word. In pinned xUDT, the extra input-type, output-type, and input-lock-disable flags are therefore absent. The reachable normal issuance path is default owner mode: an input lock hash matches the owner hash and invokes the executable Trade owner lock’s `main`. A valid issue control commits; changing only supply 1,000 to 1,001 with the same genuine anchor/owner input, market/marker outputs, Type Script, capacity and fee rejects at `Inputs[1].Lock`, owner ELF error 7. A post-issuance fake matching owner lock plus genuine token input attempting +1 rejects at the actual Trade owner lock error 4. This establishes the intended Trade authorization lock executes for these controls.

Input-type and output-type owner authorization require flags not present in the current deployed asset args, so they are disabled/unreachable for this asset identity. No output-lock authorization mode exists in the pinned source. The witness dynamic-owner path reads `owner_script` from the xUDT witness, hashes it to the owner args and attempts a dynamic `validate(int,size_t,const uint8_t*,size_t)` export. Trade’s owner ELF exports `main`, not `validate`; this path cannot call the existing Trade lock as an owner validator. Pinned xUDT ignores enhanced-owner loading/validation failure and falls back to ordinary conservation. Its witness inflation attempt (+1) rejects at xUDT `Inputs[0].Type`, error -52; that is conservation fallback, not Trade authorization. A separate freshly compiled positive/negative control established xUDT’s dynamic `validate` interface with a disposable control library: authorized input and output witness mint controls committed as `0x29911bfd50825d92d867ef6a4a458006caaf79800a43301563872d3b406ba4ea` and `0x89bab6ae7b88a1fa64dca98e27cf413ae68e248b132e262ba639ebf542f25e37`; invalid auth, malformed witness and missing library rejected. Evidence: `labs/wo16-launch-v2/evidence/owner-control-1794381897478`. It is not Trade authorization.

**Owner-mode conclusion:** no unauthorized mint was observed through reachable default input-lock mode; direct overissuance and forged-lock controls reach Trade’s authorization script and reject. Enhanced witness mode does not execute the current Trade lock; for these 32-byte args xUDT falls back to conservation. Type-flag paths are disabled by the actual args. This is source plus native-control evidence, not a proof against every possible deployment/args variant or a formal proof of all owner-script assumptions.

## Native adversarial results

Every row below is a genuine serialized transaction fixture passed to native `estimate_cycles`; the independent verifier confirms intended input/output structure, capacity minima, fee balance, rejecting source, code, and script hash. For a few alternatives the VM error includes more than one failing script candidate; the actual recorded primary source/code is shown. Full raw fixtures and exact node errors remain in `rejections.jsonl`.

| Attack | Rejecting source | VM code | Script hash |
| --- | --- | ---: | --- |
| `duplicate_market_singleton` | `Outputs[1].Type` | 3 | `d09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2` |
| `initial_overissuance` | `Inputs[1].Lock` | 7 | `f8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53` |
| `duplicate_custody_lineage` | `Inputs[0].Lock` | 8 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `cross_market_inventory_substitution` | `Inputs[0].Lock` | 21 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `incorrect_curve_price` | `Inputs[0].Lock` | 28 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `purchase_overcredit` | `Inputs[0].Lock` | 27 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `purchase_wrong_asset` | `Inputs[0].Lock` | 22 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `purchase_unauthorized_revision` | `Inputs[2].Lock` | 25 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `purchase_stale_root` | `Inputs[2].Lock` | 23 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `purchase_invalid_marker` | `Inputs[0].Lock` | 23 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `batch_exceeds_max` | `Inputs[0].Lock` | 43 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `batch_duplicate_slot` | `Inputs[0].Lock` | 42 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `batch_redirect_change` | `Inputs[0].Lock` | 42 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `batch_quantity_mismatch` | `Inputs[0].Lock` | 43 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `batch_unauthorized_transfer` | `Inputs[2].Lock` | 31 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `batch_duplicate_owner_record` | `Inputs[2].Lock` | 28 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `owner_mode_forged_matching_lock_mint` | `Inputs[1].Lock` | 4 | `f8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53` |
| `enhanced_owner_witness_inflation` | `Inputs[0].Type` | -52 | `50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95` |
| `stale_seller_proof` | `Inputs[0].Lock` | 6 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `underpaid_seller` | `Inputs[0].Lock` | 17 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `invalid_signature` | `Inputs[0].Lock` | 19 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `wrong_seller_signer` | `Inputs[0].Lock` | 19 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `wrong_chain_signature` | `Inputs[0].Lock` | 19 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `wrong_custody_asset` | `Inputs[0].Lock` | 2 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `seller_payment_redirect` | `Inputs[0].Lock` | 17 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `altered_signed_quantity` | `Inputs[0].Lock` | 19 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `altered_order_id` | `Inputs[0].Lock` | 19 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `wrong_singleton_marker` | `Inputs[0].Lock` | 2 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `fulfilled_order_replay` | `Inputs[0].Lock` | 19 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `revoked_order` | `Inputs[0].Lock` | 19 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `duplicate_buyer_position` | `Inputs[0].Lock` | 6 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `replace_ben_tombstone` | `Inputs[0].Lock` | 18 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `old_order_after_balance_returns` | `Inputs[0].Lock` | 19 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |
| `sell_excess_payout` | `Inputs[0].Lock` | 28 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `sell_underpaid` | `Inputs[0].Lock` | 28 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `sell_zero_quantity` | `Inputs[0].Lock` | 31 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `sell_minimum_exceeds_price` | `Inputs[0].Lock` | 31 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `sell_redirect` | `Inputs[0].Lock` | 25 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_excess_payout` | `Inputs[0].Lock` | 47 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_underpaid_seller` | `Inputs[0].Lock` | 47 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_payout_redirect` | `Inputs[0].Lock` | 42 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_token_change_redirect` | `Inputs[0].Lock` | 42 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_minimum_not_met` | `Inputs[0].Lock` | 46 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_wrong_xudt_type` | `Inputs[0].Lock` | 41 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_inventory_above_supply` | `Inputs[0].Lock` | 43 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_quantity_exceeds_holder` | `Inputs[0].Lock` | 44 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_extra_xudt_output` | `Inputs[0].Lock` | 4 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_extra_xudt_input` | `Inputs[0].Lock` | 23 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `external_incorrect_token_return` | `Inputs[0].Lock` | 44 | `d797b672806e016bb90c82bef5b2c75f1c9fccd7ce5358a981d98bd0f464c1f1` |
| `second_initialization_after_full_sell_down` | `Inputs[1].Lock` | 4 | `f8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53` |
| `order_replay_after_curve_sale` | `Inputs[0].Lock` | 19 | `2dbf13680775cfa18b70017a2cc32f54fb55e0622cf9add46f33f56a7937b80e` |

### Scope of newly closed tests and material gaps

The new positive-control-backed native cases prove duplicate marker Type Script rejection (marker candidate output error 3), one related-identity substitution mutation rejected by Market error 21, fake matching-owner inflation rejected by Trade owner error 4, extra xUDT output/input rejected by Market errors 4/23, incorrect external token return rejected by Market error 44, inventory above supply rejected by Market error 43 (with xUDT -52 also present), redemption above seller balance rejected by Market error 44 (with xUDT -52 also present), and second initialization after full sell-down rejected by the original owner lineage lock error 4. The malformed/adversarial shapes were balanced with valid capacities and fees and exercised the specified script.

These tests do **not** close the following exact proof gaps:

1. The cross-market fixture mutates the output market identity of one otherwise valid market continuation. It is not a transaction involving two independently valid, closely related market lineages and does not prove cross-market inventory substitution is impossible across that full scenario. Cross-market replay of a previously signed offline order is also not separately tested.
2. Duplicate marker output in one transaction and second initialization after sell-down are tested. Two competing, independently valid market singleton lineages / forged lineage construction are not fully tested. No global registry exists; the design depends on script identity and marker lineage.
3. The maximum-parameter curve arithmetic boundary was not constructed on the native VM. **DERIVED:** for uint32 supply (Sle2^{32}-1), quantity (qle S), and uint64 base/step, the polynomial factor (q(2S-q-1)/2le S(S-1)/2<2^{63}); multiplying by step stays below (2^{127}), and the base term below (2^{96}), so their sum fits uint128. Market rejects prices that exceed uint64. The bound still needs native max-boundary fixtures for actual parse/branch execution and truncation assumptions.
4. A direct otherwise-valid market/custody capacity underflow and occupied-reserve extraction pair was not tested. Existing payout, price, and reserve movement attacks do not substitute for a tailored capacity extraction fixture.
5. A direct rollback/state replacement constructed to restore a prior custody root/revision and revive an invalidated signature was not tested. Existing stale root, revision, revocation, tombstone, fulfillment, balance-return, and old-order attacks reject, but do not prove arbitrary state history cannot be recreated under competing lineages.
6. External replay fails because the referenced input is already spent at node resolution; there is no script-level replay rejection for an alternate valid transaction attempting to redeem the same entitlement. That requires a valid state-continuation replay fixture.

Because these cases include core market-identity and state-history security claims, Gate 1 remains **PARTIAL**. No critical exploit was reproduced, but missing proofs are not interpreted as safe.

## Historical verification and preserved results

- Latest complete evidence `native-1794384051038`: 27 committed transactions; independent current verifier PASS; 51 attributed native rejections; external replay fails spent-input resolution.
- Earlier fresh full evidence `native-1794381676238`: replayed by the updated verifier; PASS, 27 committed transactions, 42 attributed rejections.
- Historical continuation `native-1794299129358`: `verify-continuation.cjs` PASS, 22 attributed rejections.
- Historical legacy `native-1794295325247`: `verify-legacy.cjs` PASS, 16 attributed rejections.
- Preserved evidence `native-1794379012195`, earlier evidence directories, and fallback commit `e337ac491a1f53777b6e1fab1c406afb5d877b58` were not overwritten.

## Economics and architecture limitations

The tested bounded linear curve is reversible and solvent for the tested states. It does not guarantee an individual purchaser can recover 80% of their purchase price. The 80% protection is **NOT IMPLEMENTED** absent an independently funded and mathematically proven reserve. The eight-holder state limit and single hot market/custody cell remain; a three-buyer atomic batch is not a scaling or contention solution. Contracts remain experimental and unaudited.

Gate 2 should adapt the actual WO15 R6/R7 ownership/offline-intent source to real xUDT custody. R7’s fixed-index leaves and hash-only siblings do not prove that xUDT entitlements sum to held xUDT. The implementation handoff specifies owner-keyed sparse leaves, tombstones/revisions, authenticated transition deltas, singleton total equality to actual input/output custody amount, canonical multiproofs, independent witness reconstruction, and native acceptance tests. Gate 3 remains responsible for relay/solver resilience, hot-cell contention, competing execution, and measured throughput. Gate 4 follows native safety/scaling and uses owner-controlled testnet wallets; Gate 5 proves demand, executable liquidity and costs.

## Reproduction commands

From repository root in WSL/Linux with pinned dependencies:

```sh
TRADE_BUILD_DIR="$PWD/labs/trade-v2-token/build-gate1-closed" TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" bash labs/trade-v2-token/build.sh
TRADE_BUILD_DIR="$PWD/labs/trade-v2-token/build-gate1-closed" TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" node labs/trade-v2-token/run.cjs
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" node labs/trade-v2-token/verify.cjs labs/trade-v2-token/evidence/native-1794384051038
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" node labs/trade-v2-token/verify.cjs labs/trade-v2-token/evidence/native-1794381676238
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" node labs/trade-v2-token/verify-continuation.cjs labs/trade-v2-token/evidence/native-1794299129358
TRADE_NATIVE_ROOT="$PWD/labs/rebuild/native" node labs/trade-v2-token/verify-legacy.cjs labs/trade-v2-token/evidence/native-1794295325247
```

The runner creates a fresh disposable local chain. Preserve each evidence directory together with the exact build artifacts and source/dependency manifest. Native CKB VM acceptance is required; the replay verifier is an independent evidence audit, not a replacement for VM execution.

## Gate 2 handoff

See [GATE2_HANDOFF.md](GATE2_HANDOFF.md) for the implementation plan and acceptance criteria. It is a proposal, not proof that the scalable state is implemented.

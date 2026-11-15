# WO11 wallet compatibility decision

**B. PARTIAL WALLET SUPPORT, KEEP ORIGINAL FALLBACK.** 3 November2026. Baseline/fetched WO10 commit `e443fe6745d81f3653fb66effacdca00fe8fc223`; new branch `wo11-pudge-pilot`.

No market candidate binary was created. The qualified ordinary-secp subset is the smallest defensible pilot policy. Genuine external-wallet acceptance remains unperformed; this is not a multi-wallet deployment-ready verdict. Do not expand the covenant merely to make wallet connection pass. OmniLock normal modes are plausible future profiles, not demonstrated unsafe wallets, but their authentic native and browser signing paths have not been qualified here. JoyID is also unverified. A claim of generic multi-wallet security would be unsupported.

Original WO09/WO10 source, binary and tracked evidence remain unchanged. New browser overlay: `apps/trade-pilot`; investigation/native/Pudge evidence: `labs/wo11-pudge-pilot`. No royalties, financial flags, market redesign, protected-branch edit or public deployment was performed.

## Exact authorization trace

Original `labs/wo09-open-markets/contracts/common.h`:

- `standard_owner(i,s)` matches the full serialized script shape73bytes, exact code hash9bd7…cce8, hash_type=type and exactly20argument bytes. This is the genesis ordinary secp profile, not every script using secp cryptography.
- `lock_is` compares32bytes of full serialized lock hash; it does not inspect a witness or prove consent.
- `pure` in the Merkle covenant combines plain/no-type, standard_owner and zero data. `wallet` adds exact full owner-lock-hash matching. Input lock execution by CKB supplies the actual signature check. Output locks do not execute at creation.
- `minted_id` independently requires standard_owner on funding input0, hashes its complete44-byte CellInput (since plus outpoint) and8-byte output index, and compares the32-byte market args. Creation additionally binds the funding input's full lock hash to the immutable funder. ID uniqueness is not a substitute for funding-owner consent. Do not delete this check or forget it when changing another predicate.

Original `merkle_market.c`, configured through `merkle_market_configured.c`:

| Operation | Participant authorization and economic boundary |
|---|---|
|Create0|Standard funding input0 via minted_id; full funder hash; empty root/counters; valid immutable config/capacity.|
|Contribute1|Wallet input/output at j+1 use the new leaf's full owner hash; pure+standard; correct80% backing, minimum, input/output counts, distinct per-batch groups and exact deltas.|
|Activate2|Creator's exact wallet input/output; every slot and goal funded; only P−B released.|
|Redeem3|Current authenticated owner input/output; actual since/maturity; one update, unchanged owner/original contribution, bounded gross reduction and valid residual/deltas.|
|Assign4|Seller input/output match old owner; buyer input/output match new owner; both locks execute; seller consideration positive; full liabilities unchanged unless separately configured optional features. App keeps features0.|
|Refund6|Pre-activation owner's exact input/output; empty successor leaf and returned contribution net allowed fee.|
|Close7|Funder's standard wallet and no outstanding phase-relevant liabilities/count; only cushion returns.|

Configured limits, empty wallet type/data, capacities, immutable terms, fee ceiling1000000shannons, root transitions and all count constraints remain intact. Full owner hashes are preserved everywhere. Source terms and pure predicates must be reviewed together; merely accepting every matching hash is not equivalent.

## Why arbitrary hashes are insufficient

Actual disposable native controls used the **published Pudge ACP bytes**, relocated as a data1 code dependency, and an explicitly labelled existing always-success fixture. ACP accepted a payment increase with witness0 empty and only a different sponsor signing. ACP also accepted an owner-signed decreasing spend. Always-success accepted an entirely unsigned spend. These are genuine VM executions, not mock locks purporting to be OmniLock or JoyID.

They show the precise assumption that fails: successful execution of an arbitrary input lock does not prove the financial owner authorized creation, sale or redemption of a separate claim. A wallet may be protected against asset loss within that Cell while allowing a no-signature payment path. A financial operation can change rights elsewhere. The unchanged covenant rejected even genuinely signed ACP funding at creation(error20) and enrollment(error50). No permissive market derivative was deployed to demonstrate an artificial PASS.

## Deployed identity, mode and signing review

Live read-only Pudge resolution used official CCC core1.23.0 deployment configuration. `preflight-1793740498584/analysis.json` records every type identity, resolved live code data hash, code size and code-cell lock. Matching source/rebuilding deployed binaries was not performed; source review and binary observations are separate.

| Profile | Current Pudge identity / client path | Decision |
|---|---|---|
|Ordinary CKB secp|type9bd7…cce8, args20; actual live data hash709f…8649. CCC prepares65-byte sighash witness. UTXO Global CKB integration source calls provider.signTransaction and standard secp preparation.|Native-qualified original profile. External UTXO Global/browser/device acceptance still required; a brand name alone does not approve an address.|
|MetaMask normal Omni|typef329…52cb; CCC modern args `12 || EVM-address20 || 00`, legacy01 profile also discoverable. Modern signer personal-signs `CKB transaction: <hash>` and uses the Omni witness table; not bare standard-secp signing.|Not admitted. No authentic Omni native signature or MetaMask extension PASS. Exact normal-mode source is not dismissed merely because auth flag is0x12.|
|BTC normal Omni|Same type; CCC args `04 || BTC-public-key-hash20 || 00`, distinct BTC message/signature rules;85-byte prepared witness placeholder.|Not admitted. No actual BTC external signer/native profile qualification.|
|JoyID|typed237…baac; resolved primary live data hashd2c0…a6d7 and additional auth deps. CCC source prepares1000-byte placeholder, subkeys add CoTA deps/SMT data in outputType, popup returns signatures.|Not admitted. Placeholder is not signature evidence. Main-key, subkey and recovery configuration and actual passkey interaction need separate validation.|
|ACP|type3419…1356; live code data hashcd69…31e6; no-signature payment alternative verified natively after byte-preserving local relocation.|Rejected as claim-consent authority, even though ordinary payments are legitimate. Relocation is not a public-chain transaction or wallet-compatibility PASS.|
|PW-Lock|type58c5…5a63; live data hasheffe…9878. Inspected source branches to signature verification when present, otherwise check_payment_unlock; CCC uses its own signing domain.|Rejected/unqualified. Inspected source not rebuilt against deployed bytes; no native PW payment/signature equivalence claim.|
|Always-success, unknown, proxy/delegated locks|No arbitrary-lock fallthrough. Native always-success control proves execution may be permissionless.|Rejected/unreviewed.|

Pinned Omni source `cryptape/omnilock` commit280dd97ac0930ea1ed766a18d49478229347c832: `parse_args` controls root/administrator, ACP, since and supply flags. `main` may choose administrator identity/proofs, omit normal timelock in admin mode, or return payment validation without checking identity when ACP and no signature apply. Identity flagsFC/FD/FE include owner-lock/exec/dynamic-library authority. Those are not approved solely by matching a wallet label. A hypothetical future limited profile would require exact22-byte args, a reviewed direct identity such as12/04, flags00, exact witness/dependencies and genuine signature tests, plus an explicit deployment-upgrade trust policy.

Live Omni/JoyID/PW code Cells are controlled by normal lock scripts rather than the immutable genesis pattern. Type-hash identity does not by itself pin future binary contents; code upgrade/availability trust must be understood. A client-side code snapshot alone is not a covenant-level rule. This is a qualification dependency, not an allegation that their operators act maliciously.

## Capacity and consent

For an empty-type/empty-data Cell: capacity is `8 + 33 + args_length` CKB, derived from the **exact** script. Standard20byte args require61CKB; normal22byte Omni requires63CKB if ever qualified; JoyID's actual args must be measured (22bytes would mean63), while admin/delegated/extended profiles may require more. No nonstandard capacity calculation constitutes permission to use it. The existing contract/app retains its correct61CKB assumption only for its exact supported subset.

Browser overlay exposes full lock hash, calculated capacity and explicit profile rejection reasons. It reuses the frozen WO10 builder/connector, fixed80/20 policy, latest-state reconstruction, selected market/index/price/buyer intent checks and wallet signing. No broadening through a UI-only allowlist occurs. Public manifest code outpoint remains null. Connection can be read-only; it is not permission to sign unsupported financial operations.

## What remains unverified

Authentic MetaMask/Omni and BTC/Omni positive execution; JoyID passkey/main/subkey/COTA/recovery validation; native Omni administrator/ACP/delegation abuse tests; arbitrary-wallet safe authorization; real browser extension round trips; source-to-deployed-code equivalence; third-party code upgrades; public Pudge deployment/signing and all committed Pudge lifecycle transactions. Source-only denials are not passed adversarial executions. Unavailable signers have not been impersonated or replaced with mock signature success.

No new candidate means there is no new hash or all-wallet regression PASS to report. Original SHA256c569360ba498e715899635410dc0474003e8f61c6afc08a5c3f2a87527711c1f / CKB data hash53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f remain authoritative. Candidate hash: **not applicable**. Keep the original fallback; request a separate scoped review only if a real pilot needs a nonstandard profile. No quarantined E1 beneficiary or LO-01 investigation was resumed.

Sources reviewed3November2026: pinned Omni/PW provenance under `labs/wo11-pudge-pilot/vendor`; current installed/pinned CCC core and utxo-global/joy-id signing source and lock deployment evidence; [official CCC signer documentation](https://docs.ckbccc.com/en/docs/concepts/signer); [Omni RFC42](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0042-omnilock/0042-omnilock.md); [JoyID contract documentation](https://docs.joyid.dev/guide/ckb/smart-contract). Older documentation does not establish current audit or source-publication status. No upstream source license or deployed equivalence was invented where not established.

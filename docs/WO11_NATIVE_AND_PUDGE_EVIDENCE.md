# WO11 native and Pudge evidence

Verdict **B. PARTIAL WALLET SUPPORT, KEEP ORIGINAL FALLBACK**. See `WO11_WALLET_COMPATIBILITY_DECISION.md` for the authorization trace and exact non-support boundaries. No new market candidate, binary identity, public funding/signing/deployment or committed Pudge lifecycle is claimed.

## Primary successful native runs

All use disposable local CKB0.210.0 and the unchanged configured binary. Native transactions and raw RPC/case records are retained; independent offline UTXO/Merkle replay verifies primary accepted histories. Counts are evidence scope, not security or adoption metrics.

| Evidence directory | Accepted transactions | Rejections | Qualification |
|---|---:|---:|---|
|`labs/wo11-pudge-pilot/evidence/authority-1793740640737`|14|10|Original secp market plus real ACP/always-success authority controls;7market transactions and7deployment/funding/control transactions.|
|`apps/trade-pilot/evidence/browser-native-1793740864353`|10|5|Chromium shared browser builder, actual CCC Node signers; no private key in browser; not an external wallet extension.|
|`labs/wo11-pudge-pilot/evidence/regression-merkle-configured-security-1793740925311`|22|30|Original complete configured-covenant security suite, including historical optional-feature regression; new UI exposes no optional features.|
|`labs/wo11-pudge-pilot/evidence/regression-merkle-configured-scale-1793740928296`|25|9|Original16-holder policy/maturity lifecycle. No rebuilt/rerun1,000-holder mechanism.|

Primary runs executed sequentially. An earlier accidental shared19224port overlap produced browser unknown-outpoint failure; those outputs and the overlapping security run remain explicitly excluded from PASS counts in `runner-collision.json`. The sequential reruns supersede them as evidence without deleting them. A first local import-path error was corrected; it was not a protocol failure. No checks were weakened to make failed attempts pass.

### Exact new native findings

- Genuine published ACP bytes from Pudge were redeployed locally under data1; hashcd69ba816f7471e59110058aa37387c362ed9a240cd178f7bb1ecee386cb31e6,66048bytes. Unsigned payment path committed `0x5e021484198f5e353aa036e4f6c307d0b7917bf114da657392ed50ea574e6995`; owner-signed decreasing spend committed `0x9654bd19e8d208ba3b543c952221538be2608de0886d958c4b8ebeb1f3f682bd`. This qualifies the actual relocated binary behavior, not Pudge execution or generic wallet support.
- Explicit existing always-success fixture spent unsigned: `0x9c46343c0c7fc0f5c4667fa05d8619d1312d696fa505cf6b438592666de94cc2`. It is a labelled permissionless control, never substituted for Omni/JoyID.
- Original market rejected signed ACP funder(error20 at creation type) and signed ACP enrollment(error50 at market lock). Those are expected admission rejections, not ACP signature failures.
- Seller/buyer standard signatures produced identical final witnesses in both signing orders; actual reverse-order paid transfer committed `0xc4ef5f40deb55225ca6bea003f1cd74e84387e8b79862ce3123380e9be7b937a`.
- After seller signed, a changed raw payment with only buyer re-signing rejected at seller lock error-31. Extra witness framing rejected43; extra input/output groups60.
- Duplicate wallet input resolved Dead before VM; later valid payment consumed the same legitimate live inputs, so it is not represented as an owner-signature proof.
- Missing covenant dependency produced ScriptNotFound before covenant validation. Insufficient replacement output produced native InsufficientCellCapacity before VM. Stale consumed vault rejected during resolution, not an authorization error.
- Current-owner partial/full redemptions and lawful closure committed, final backing0. Browser suite separately exercises wrong signature(-11), missing seller signature, unpaid assignment(71), former-owner denial(60), paid assignment, recovery after updates and stale input rejection.

Wrong network/missing history are fail-closed client/RPC tests in the browser harness, not intrinsically network-domain-bound signatures or public-chain consensus proofs. Genuine current Omni/BTC and JoyID native signatures, Omni-specific administrator/ACP/delegation attacks and real external browser-wallet behavior remain **not performed**; no mock is counted as authentic verification.

## Read-only Pudge observations

`preflight-1793740498584`: expected genesis0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606 matched. Public RPC/indexer at `https://testnet.ckb.dev/` answered get_cells, live dep/code reads and one committed historical body with7witnesses. Body hash was recomputed. Every supported-script declaration resolved to exactly one matching live code type hash in the sampled dep set. Exact primary and auxiliary deps, full code-cell locks, data hashes and sizes are retained. This is a sampled public-node observation, not independent consensus or archival completeness.

`relay-*.json` at2026-11-03T21:25:15UTC/22:25:15WAT: public node reported min_fee_rate1000sh/1000bytes, min_rbf_rate1500 and tx_size_limit512000bytes. Separate sampled median19685sh/1000bytes is a mining estimate, not relay policy. Fees, queues and service availability can change. No low-fee public transaction was broadcast to test inclusion.

Data identities include secp709f…8649, Omni6b29…18fa, JoyIDd2c0…a6d7, ACPcd69…31e6 and PWeffe…9878. Complete hashes are in preflight analysis. Source snapshots are pinned separately; no deployed-source equivalence proof or upstream security/audit claim is inferred.

## UI and deployment preparation

`apps/trade-pilot` reuses the untouched WO10 builder/interface; new public lock inspector shows exact full owner hash, measured plain-cell occupied capacity and explicit unsupported reasons. Standard20byte profile is61CKB; normal22byte Omni would be63 if independently qualified, but remains blocked. Financial policy is unchanged80% backing/20% gross creator proceeds, flags0, no royalties/yield/AMM/new token. Both signing intent and latest-root recovery remain inherited. TypeScript/production build and refreshed Chromium native path are checked; no extension/Passkey account was impersonated.

Original binary17848bytes, SHA256c569360ba498e715899635410dc0474003e8f61c6afc08a5c3f2a87527711c1f, CKB data hash53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f. **Candidate: none**. Both the expected identity and code:null are retained in the overlay manifest. Read-only code verification does not enable signing. No silently substituted deployment is possible through the prepared default manifest.

Offline deployment fixture reproduces18288serialized bytes at one ordinary input/65-byte signature placeholder,17889CKB code and61CKB change. Selected deployment fee0.01CKB gives exact standalone funding17950.01CKB; sampled median size estimate0.0036CKB is separately reported. Creation needs383.001CKB. Detailed two-owner default-journey plan: Alice18272.137CKB (publisher/funder/creator/first contributor), Bob61.137CKB; total18333.274CKB. These are exact analytical budgets under declared topology/fees, not actual funded Pudge balances. Inputs/capacity, added refund rounds and fee changes require recalculation. Occupied code/cushion/wallets, protected principal and spent fees are not double-counted.

Prepared offline unsigned deployment planner, read-only genesis/live-code/committed-status verifier, and external-wallet acceptance plan are in `apps/trade-pilot/deploy/README.md`. Planner's funding_live_verified=false is intentional: a synthetic/offline plan is neither an actual funding Cell nor a signature. Verification scripts cannot fund, sign, broadcast or enable a signing manifest. Actual ordinary-wallet signing after approval still needs device/provider and current fee/dependency validation.

## Remaining gate

No actual external wallet or public Pudge lifecycle has passed. Standard-secp/UTXO Global CKB source path is a plausible smallest manual pilot subset; it is not a fully accepted wallet merely by brand. If that subset suffices after real acceptance, keep it instead of expanding the contract. Omni/JoyID/BTC require separate native and manual qualification if genuinely needed. No public deploy, funding or signing without explicit approval. No production/mainnet readiness or universal small exit is asserted.

# WO09-E1 native execution results

> **Restriction/status update:** Beneficiary-address settlement liveness remains **UNRESOLVED**. Original consumable-right happy paths and pre-warning observations are preserved, but the proposed correction has no native validation: its replay stopped at a JavaScript syntax error. Compiled/source-only changes are quarantined in `labs/wo09-open-markets/research/blocked-beneficiary-correction`. No security PASS or production readiness is asserted. Further restricted-case validation is paused; independent launch, fixed-risk, OTX and incentive research continues.


## Scope and current evidence

VERIFIED on new disposable private CKB chains, CKB0.210.0 and normal published secp locks. These are new WO09 experiments; inherited A2, compact-C and DAO results are not recounted. Source in `labs/wo09-open-markets/contracts`; build commands/compiler/binary hashes in `build/manifest.json`. Raw RPC requests/responses, node logs, chain configuration, genesis metadata, transactions and rejection errors stay under `evidence`. `src/verify.cjs` independently checks transaction hashes with SDK and CCC, serialized bytes, committed RPC outputs/data/witnesses, deployed code hashes and recorded rejection errors. This checks trace consistency, not consensus independently of the local node or comprehensive security.

| Experiment | Canonical initial trace | Committed transactions | Rejected cases |
|---|---|---:|---:|
| Individually funded claims + signed exchange | funded-claims-1793598761344 | 9 | 6 |
| Fixed-term funded senior/junior payoffs + fallback races | fixed-term-risk-1793598780872 | 45 | 10 |

Earlier successful traces are retained separately. They are iterations, not additional independent mechanisms. Exact hashes/bytes/cycles for every event are in `evidence/native-index.json`.

## Independently funded claims — VERIFIED bounded prototype

Four100-unit claims each carry850 CKB principal plus150 CKB occupied reserve. Two buyers each fund2300 CKB:2000 goes to their two backed cells,300 to the issuer. Issuer receives600 CKB overall. Thus effective buyer outlay is1150 per claim, not1000: occupied capital must be included. Face is8.5 CKB/unit, maturity an actual absolute block height. This is a fixed native claim, not a globally ratcheting token floor or complete fundraising application.

Both holders signed an atomic exchange of two notes and250 actual CKB. Removing one holder witness failed. After maturity, partial and all four complete redemptions committed with only each current holder's normal authorization; issuer participation was absent. Redemption after ownership transfer paid the new holder. Additional units, missing maturity `since`, early consensus admission and payout diversion failed. Final redemption returns occupied capital too; that capital is not economic yield.

A one-unit standalone payout8.49 CKB failed actual node capacity checks. Merging with the holder's wallet succeeded, and the type subtracts the holder's non-claim input capacity when checking net payout. A ten-unit unsponsored redemption84.99 CKB worked. The implementation intentionally restricts redemption to one family/owner and normal secp locks; it is not a generic wallet/recovery proof.

## Fixed-term risk — VERIFIED bounded prototype

Two parties genuinely cofund2000 CKB principal,122 CKB prepaid output budgets and0.01 CKB settlement fee. A uniquely typed event binds publisher, maturity and event identity. Publisher can update an unpriced record once after genuine height maturity; it cannot alter the published record. The pool requires its committed terms and exact event dependency, then pays fixed recipient locks without either counterparty signing settlement.

Eight independently generated Python integer fixtures were replayed at illustrative USD/CKB prices0.8,0.5,0.2,0.01,1,1.25,2,0.51. Target1000 USD uses scaled exact arithmetic, rounds senior payout upward one shannon when needed and clips to2000 CKB. Junior receives the complement. Every actual output equals its principal fixture plus61 CKB returned budget. The zero-junior and39.21568627 CKB junior principal cases therefore produce valid outputs. These synthetic prices are not current CKB market prices or attainable quotes.

Early publisher admission, omitted publisher `since`, altered terms, missing event, wrong payoff, wrong recipient, re-publication and premature fallback failed. No-price fallback after maturity+10 blocks returns original native contributions, not dollars.

Both actual ordering schedules were tested. Late publication first consumes the initial event and invalidates an old refund dependency; the published payoff then commits. Refund first consumes the pool; later publication cannot settle it again. Therefore the grace height is not passive upper publication expiry, and this prototype does not promise time-priority fairness or an unambiguous official fixing time. Publisher may lie, withhold or publish opportunistically; no external price truth is established.

## Security boundary

New scripts are bounded own-contract experiments, unaudited and not production-ready. Tests do not prove arbitrary client signing, history interpretation, oracle honesty or general invariant completeness. Authenticated recovery signing and upstream A2 LO-01 remain unresolved under the inherited boundary. None of these transactions is presented as a correction for them.

## Secondary risk rights and market-scale checks

VERIFIED trace `transferable-risk-1793598933221`:9 committed/4 rejection cases. Normal-owner beneficiary records enabled a900 CKB senior-right sale without junior participation. Anyone then settled to the new owner. The spent former record failed dependency resolution; diverting payout to the seller failed. Fixed-recipient settlement was633 bytes/32616 cycles; this live-record version707 bytes/49029 cycles, plus an860-byte3292632-cycle sale and316 CKB persistent records. Burning those records after settlement was actually rejected: cleanup is UNIMPLEMENTED, a measured design disadvantage, not a security success.

VERIFIED trace `market-scale-risk-1793599028590`:37 committed/8 rejection cases. Native payouts were rerun at relative shocks around the captured0.00121886 USD/CKB reference, with exact price quantization and principal fixtures. The2000 CKB pool's senior target is1.21886 USD, not1000 USD. A1000 USD senior/equal-junior position would require about1.64 million CKB principal at that reference. No current trade, price premium or customer evidence is inferred. Fixed output/event capital adds16.4% to a2000 CKB pool before code/fees; adding permanent beneficiary records raises this to32.2%. Sharing a maturity event could amortize event occupancy without reusing pledged principal; a ten-pool native batch is not claimed.

VERIFIED trace `hybrid-claim-settlement-1793599107960`:10 committed/7 rejection cases. One atomic transaction transfers funded claims, actual published-contract xUDT and CKB between ordinary signers. Inflated xUDT fails when its independent issuer is absent. Earlier trace `hybrid-claim-settlement-1793599080809` is FAILED and retained: the negative test unintentionally included xUDT issuer authority, so the VM correctly allowed minting. No rejected/committed inflated trade is invented; the initial accepted operation was an estimate, not a committed transaction.

Latest claim trace `funded-claims-1793599166313` adds issuer re-mint and insufficient net-principal-payout rejections:9 committed/8 cases. The label `redemption_fee_above_bound` checks a partial payout below principal-minus0.01; it does **not** establish a global transaction-fee cap. Normal owners can authorize spending excess reserve. Final reserve return is demonstrated by the builder, not a universal reserve-return covenant. Diagnostic node-log snapshots are compressed alongside raw RPC evidence.

## Consumable transferable rights — materially different correction

VERIFIED final-build traces `consumable-risk-1793599534615`, `consumable-risk-1793599536260`, `consumable-risk-1793599537840` and `consumable-outage-1793599539485`: respectively8/5,8/5,8/5 and7/5 committed/rejected cases. They test ordinary20% downside, zero junior principal, positive dust principal and publisher outage. Earlier successful/failed development traces remain explicitly separate.

A unique beneficiary record now uses the same custom script as lock and type, with recorded normal owner, bound pool hash and event. Funding atomically creates both records and the pool, with both contributors signing. Transfer requires the recorded owner's normal signed wallet input, preserves pool/event binding, and changes beneficiary. Settlement consumes the pool **and both exact records**, returns each record's234 CKB along with61 CKB output budget and its principal payout, and needs no beneficiary signatures. The900 CKB senior sale uses seller/buyer wallets but no junior input. This addresses the permanent-record prototype's cleanup limitation for the demonstrated cases; it does not improve oracle truth or prove production security.

Missing seller authorization, pool rebinding, record burning without its bound pool, old-owner payout and missing settlement rights all failed. All three cells are verified live before settlement; committed receipt inputs identify their consumption, and subsequent queries report not-live. First development trace `consumable-risk-1793599429371` remains FAILED: eight transactions committed, then the harness incorrectly expected RPC status `dead` rather than actual `unknown`. The corrected check adds pre-spend liveness and committed consumption evidence; it does not treat an arbitrary unknown outpoint as proof of spending.

Peak record capital rises316->468 CKB but is returned on completion. The206 CKB immutable publisher event still remains permanently occupied; sharing an event can amortize, not reclaim, it. A current-holder record can be transferred after maturity before settlement wins, so owners bear ordinary Cell-consumption ordering; no priority market is proved. New funding clients must validate approved script identities, terms and outputs before signing; no arbitrary-history general signing client is delivered.

## Saved post-checkpoint evidence and restricted-case boundary

The fresh GitHub reproduction of **11c87a6141d5893e5da1b87483e2855324b1dea1** completed before the latest warning: nine isolated runs,141 committed transactions and59 expected rejections, independently installed npm/compiler, seven byte-identical rebuilt artifacts and exact model regeneration. It reproduces that revision's tested behaviors, **not** beneficiary-address settlement-liveness security. Original and reproduction iterations remain separately identified by `reproduction.json`.

Pre-warning trace `consumable-risk-1793600412018` records the malformed hash-owner observation:7 transactions committed and the advertised normal settlement output failed. It is a negative finding about the original prototype. No proposed correction transaction ran. The correction attempt failed immediately because C source was accidentally written into the JavaScript runner. Original known-running source was restored; the proposed20-byte address design, compiled artifacts, broken runner and failure report remain quarantined. Default future reproduction excludes beneficiary experiments.

Claim-body signature validation also caught an over-specific harness assumption about which owner script runs first. Trace `funded-claims-1793599904305` remains FAILED; corrected ordinary normal-lock regression checks the expected secp signature error on either expected owner group. This does not qualify a general signing client.

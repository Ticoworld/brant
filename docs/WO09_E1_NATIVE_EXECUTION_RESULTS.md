# WO09-E1 native execution results

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

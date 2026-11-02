# Track A — launches, finance and enforceable exit

Evidence: VERIFIED SOURCE competitor review; TESTED SYNTHETIC exact models in models/discovery.py and evidence/discovery-models.json. Native qualification is not implied by this phase.

The customer split matters. A speculative buyer seeks upside and timing advantage; an issuer needs spendable financing; a protected buyer wants a funded exit after issuer disappearance. A mechanism can improve the third while worsening the second. Demand for a token launch is not evidence of demand for a new protected financial claim.

## Liability accounting

Track minted, circulating, redeemable, team, burned and locked-collateral units separately. A cash floor f on S redeemable units requires spendable reserve at least f*S plus explicitly funded fees/output budgets. DAO/iCKB mark-to-market or receivables are not instant spendable CKB. Under a curve, Nirvana's documented integral of the bid curve is a stronger condition than just f*S. Borrowed tokens locked as collateral cannot also be counted as immediately redeemable external supply; repaid debt/claim cancellation must be explicit.

Ratchet counterexample: with100 reserve/100 redeemable units, a1.1 floor is insolvent, but a0.85->0.9 floor can use existing uncommitted surplus. It is false that every ratchet requires new buyers. Independent immutable claims can retain old rights while new cohorts have different terms; that is not a globally raised enforceable floor. A global observation/epoch design would add a shared state/security dependency and needs its own proof.

## Financing and issuer incentives

The exact grid varies reserve fractions1/0.85/0.5, issuer funding needs10%/30% and fees0/1%. At85% protection, available issuer finance is15% before fees; a30%-of-entry project budget fails without additional independent funding. Full entry refund after spending the at-risk15% cannot be promised from the remaining85%. If fees exhaust the unprotected component, someone must add external fee capital, not issue hidden claims.

The simplest rival is retaining850 CKB and spending150 on a risky entitlement. A custom note with the same payoff cannot claim a superior product solely because its type script works. It may impose more occupied capital and a maturity lock. Any native claim prototype is an enforcement/secondary-transfer baseline, not a validation of generic launch economics.

## Structures compared

- Fixed-price distribution: simple and finance-transparent; sniping/admission/discretionary selection remain.
- Uniform/continuous clearing: already serious CCA prior art; within-batch uniformity does not make all temporal prices equal or defeat Sybil identities.
- Rising/curve auctions: discover price but retain ordering, self-purchase and roundtrip questions; solvency does not imply fairness.
- Fixed native floor/pro-rata reserve: explicit liabilities, creator dilution and final redemption matter. Native-asset protection is not USD insurance.
- Individually funded/sharded claims: eliminate shared-reserve oversubscription for the funded right if every unit has isolated collateral. Costs scale with occupied capacity; small partial outputs and fee budgets are real liveness issues.
- Senior/junior finance: separate protected principal and at-risk issuer/project money, with no double pledge. Strong protection limits freely spendable proceeds.
- Refundable/all-or-nothing launch: existing CrowdCell already has pledge/receipt/campaign settlement and delayed refund mechanisms; reuse/compare rather than rename it.
- Milestone or yield-linked finance: conditional funding and maturity can be useful, but external milestones and DAO delays require distinct evidence; no instantaneous yield-funded guarantee.
- Paid liquidity/auction-to-book migration: can add a counterparty only if real inventory/service compensation is funded; ordinary auto-AMM migration is existing Ohrex/Launcher territory.

## Fairness and early upside

All six WO06 classes are retested at the mechanism/property level. Independent redemption removes issuer reserve withdrawal for that right, but does not solve speculative-price manipulation, creator demand, Sybil allocation or secondary liquidity. Distribution still needs separate inclusion rules. A50 early-risk premium must consume50 of issuer surplus or another identified contributor; it cannot be promised as guaranteed secondary appreciation. Decaying fees, cohort classes and release schedules are alternatives with different transfers, not universally fair solutions.

Decision before native promotion: REVISE generic protected launch; UNPROVED commercial differentiation. Advance only the smallest individually funded right experiment needed to test principal conservation, authorized creation/transfer, partial/final redemption and output-capacity liveness. Freeze it as a fallback after proof, then attack the higher-ceiling risk/claim opportunity. No claim of a ratcheting-floor product or launch market yet.

## Executed baseline and what it does not establish

Four notes were independently purchased by two fixture buyers, transferred under genuine normal-owner signatures and entirely redeemed by their current holders after actual maturity. Each note carries850 CKB principal and150 CKB occupied reserve; effective outlay1150 funds the1000-CKB note and150 issuer proceeds. Across four notes, issuer receives600 CKB and no redemption needs the issuer/solver. Partial, final, small-output, net-principal, re-mint and authorization cases are recorded. This closes a bounded native right, not a globally ratcheting launch design.

A buyer may keep850 CKB and expose150 directly instead, with fewer state/fee/coordination costs. A launch must justify why immobilizing protection capital creates enough distribution, credibility or financing value to beat that alternative. An issuer needing more than the at-risk share cannot spend promised reserves; DAO yield on that reserve does not make it instantly spendable. Early discounts funded by another participant are a transfer; genuine fees/surplus may fund a floor ratchet, but new buyers are not mathematically necessary for every rival design.

Failed-campaign full refunds, fair identity allocation, curve migration, global reserve ratchets and reorg handling are not implemented in the new baseline. Full refund after spending the issuer grant remains unfunded unless a separate source covers it. CrowdCell/CCA already address important fundraising/distribution jobs, so rebuilding those systems without a tested advantage is not justified. Preserve issuer-financing and fair-distribution research independently of the stronger term-rights track.

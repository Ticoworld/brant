# Counterexamples and proof boundaries — formal phase

> **Restriction/status update:** Beneficiary-address settlement liveness remains **UNRESOLVED**. Original consumable-right happy paths and pre-warning observations are preserved, but the proposed correction has no native validation: its replay stopped at a JavaScript syntax error. Compiled/source-only changes are quarantined in `labs/wo09-open-markets/research/blocked-beneficiary-correction`. No security PASS or production readiness is asserted. Further restricted-case validation is paused; independent launch, fixed-risk, OTX and incentive research continues.


TESTED SYNTHETIC results in discovery.py preserve: (1) unsupported floor/team liability, (2) promised full refund after spending the missing amount, (3) DAO value without instant spendable cash, (4) global floor updates not reflected in immutable claim classes, (5) Sybil allocation advantage and unfunded early premiums, (6) no finite collateral can preserve a positive constant USD target as price tends to zero, (7) positive risk payouts below CKB occupied minimum, (8) oracle outage/refund not dollar protection, (9) incomplete trade-ring imbalance, (10) liquidity self-consumption/unbounded-demand failure, (11) double-pledging shared reserve across unrelated obligations.

Corrections worth testing: fully funded separate claim cells, explicit at-risk/fee/output budgets, bounded payoff bands and collateral, event-scoped maturity observations with a declared trust model, immutable published records, fallback terms with explicit late-publication ordering, actual ownership transfer rather than a UI balance, and finite paid quota instead of unlimited depth.

No public protocol exploitation, real assets or arbitrary malicious-history signing is authorized by this work. Existing A2 LO-01 and general recovery signing remain unresolved; no new paper/model/source read is a fix. New native negative tests, if executed, use our own contracts and disposable private assets and will be distinguished from simulations, VM estimates and consensus admission failures. A single publisher can publish a false price; native authorization does not establish external financial truth.

## Executed coverage and remaining gaps

The following is a property inventory, not a universal security certificate. Canonical trace directories and fresh-checkout report are in NATIVE_EXECUTION_RESULTS and `labs/wo09-open-markets/evidence`.

| Required stress | Actual evidence | Boundary |
|---|---|---|
|100% demand / last holder | All four issued claims fully redeem; exact32-claim reserve model | No large native simultaneous global-floor run; new right is partitioned fixed backing |
|Creator dilution / hidden mint | Extra units and same-family re-mint rejected | Not an arbitrary-history signing-client proof |
|Duplicate claims | Consumable funding with duplicate exact type identity rejected; anchored mint source inspected | General type/client integration not audited |
|Double-counted backing | Explicit launch+risk/inventory counterexamples in exact model | No claim of native unified collateral optimization |
|Unauthorized withdrawal/payout | Missing normal signatures, changed recipient and old-holder payout fail | Self-controlled test identities, not independent human counterparties |
|Fees | Net-principal protection and exact funded risk fee exercised | Claim reserve is owner-authorized; no universal transaction-fee ceiling. Fixed risk fee may fail future admission pricing; fee bump is unimplemented |
|Rounding / dust | Eight integer fixtures, actual subminimum payout rejection, wallet aggregation and zero/dust funded outputs | Small claim needs wallet aggregation; output budgets cost capital |
|Occupied capacity |150 claim,206 event,158 permanent/234 consumable records,61 ordinary outputs | Deployment cells are extra; event remains occupied forever |
|Multiple classes | Senior/junior distinct native right identities | Broad multi-family redemption and arbitrary asset classes not qualified |
|Oracle disagreement | Re-publication rejected; two actual publish/refund schedules | Single accepted publisher can lie or withhold; no threshold/dispute/external truth proof |
|Missing maturity data | Missing dependency rejected; no-price fallback returns native contributions | Refund is not stable purchasing power |
|Solver/operator unavailable | Holder-only claim exits and unsigned pool settlement execute; outage variant executes | Network/miner censorship and relayer availability not guaranteed |
|Concurrent consumption | Spent event/right cannot be reused; both late-fallback schedules committed | No mempool priority/fairness theorem or high-contention benchmark |
|Reorganization | No reorg security claim | Native reorg replay, canonical finality policy and wallet orphan handling not independently tested |
|Stale signatures | Modified signed body fails normal secp validation; missing signature cases | Does not establish safety of arbitrary signing prompts or off-chain history |
|Incomplete history / LO-01 | No new security fix | Arbitrary-history authenticated recovery and upstream order confusion explicitly unresolved |
|Independent authorization | Separate fixture wallets sign funding and sale; settling rights needs no holder signatures | Strong normal locks in bounded fixtures, not all wallets or external audits |

## Genuine failed implementations/harness assumptions retained

1. `hybrid-claim-settlement-1793599080809`: inflation estimate accepted because authorized issuer was an input. Corrected fixture uses separate absent issuer; unauthorized mint now fails. No protocol vulnerability is alleged.
2. `consumable-risk-1793599429371`: settlement committed, then harness wrongly required `dead`. Added pre-live checks, committed consuming inputs and post-not-live checks; no arbitrary unknown outpoint is treated as spent.
3. `funded-claims-1793599904305`: signed-body mutation correctly failed secp(-31), but harness assumed the VM reports owner input0 first. Actual owner input1 failed. Regression checks the specific standard-owner script/error on either expected owner group, without assuming execution order.

## Constructor, client and service limitations

Risk locks execute on spending, not creation. A malformed funding output can be committed and later become unspendable; the tested builders construct exact funding but no production pre-signing client/incorrect-funding rescue is delivered. Funders must independently validate approved code/type identities, terms, capacity, recipients and exact funded outpoints. A third party can create a similarly locked pool cell; discovering it by lock hash alone is not authenticated ownership. These experiments never ask a general recovery client to sign untrusted histories.

The inherited user-reported blocked boundary remains precise: specific arbitrary forged-lineage/authenticated-recovery and upstream A2 LO-01 reproduction/correction are not performed or certified here. Ordinary new own-contract signatures, exact current Cell dependencies, normal source inspection and private-chain payout tests proceeded independently. No control was bypassed; no blocked test is called passed.

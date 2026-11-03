# Payoff hypotheses and falsification

As of 3 November 2026. Public evidence is linked in the customer/jobs and competitive reports; scenarios here are **hypotheses/models**, not offers from those businesses. Working `merkle_market_configured` remains unchanged. It has an 80% initial cash floor, fixed leaf schema and no service consumption, xUDT bundle, milestone adjudication or operator-balance adapter.

## Financial invariant

For contributions P, spendable creator proceeds U, continuously redeemable protected liabilities R, separately funded fees F and external capital I:

`U + R + F <= P + I`.

Vault/code capacity is an additional capital requirement, not R or creator runway. Reserves cannot also fund channels, LP inventory or development. A 60%-immediate-use requirement and 80% floor require at least 40% of P in independent extra capital, before fees. Relabeling a reserve as a milestone tranche does not alter that constraint.

## A1: service plus unconditional cash returned at maturity

Scenario: 100 teams each pay $250 equivalent, total $25,000. $20,000 remains protected and $5,000 is gross development money. They receive a defined hypothetical 1M API requests each over 90 days, plus the cash right. This request quantity, price, provider funding need and customer count are **not** sourced demand.

Buyer net price before cash opportunity costs is $50 for the service. If the identical service can be bought for $50 while the buyer keeps $200, the elaborate package is weakly worse after extra costs. A genuinely scarce reservation or discount might invalidate that equivalence, but must be evidenced rather than invented. Service availability and request quality are not established by a signed entitlement. **REJECT as a differentiated offer without another advantage.**

## A2: refundable reservation, reserve becomes payment only on acceptance

Same numerical collection, but the buyer pays the remaining $200 on actual service acceptance/consumption; failure returns $200. Creator receives $5,000 initially and at most $20,000 later, when accepted liabilities are irrevocably discharged. Maximum cash exposure before acceptance is $50 per buyer; CKB/USD risk is separate. Claimed capacity is time-bounded, transferable only to eligible users, and partial use must decrement both remaining service and cash fallback under explicit agreed terms.

This is economically closer to a deposit plus staged escrow/preorder. A useful distinction would be **binding scarce capacity with portable unused allocation**, not a Merkle root. Provider authorization, measured capacity/cost, a discount or guaranteed reservation, cancellation terms and resale permission are missing. On-chain scripts can enforce cash ownership/consumption only after a trusted acceptance decision; they cannot assess arbitrary API quality or force a server online. User acceptance permits strategic refusal; provider attestation alone permits false delivery. An arbiter is outside trust, not operatorlessness. **RETAIN for customer discovery, not implementation.**

## B: funded cash-or-token participation package

Scenario: 1,000 buyers pay $25 equivalent each. Creator gets $5,000 gross, $20,000 cash remains, and 1M units of a **separately funded and specifically identified** hypothetical xUDT are escrowed. Each package may choose either its $20-equivalent native backing or 1,000 token units; it cannot claim both. Token usefulness/upside is unpriced and unproved, not equity or guaranteed profit. Cash backing is CKB-denominated, not guaranteed $20 at exit.

Falsifiable specification before any extension:

- Package identity binds market/index, owner, backing, exact token type/hash, token quantity, terms version, redemption choices and lifecycle.
- Creation/funding authenticates real token inventory and cash separately. Mint authority or token promises do not substitute for inventory or business value.
- Assignment changes **one authoritative package owner** with buyer consideration; no independently spendable token/access object may remain with the former owner.
- Cash redemption atomically nullifies the package and disposes of its token allocation according to agreed rules. Asset exercise atomically delivers its exact tokens to the owner, nullifies cash liability and releases only the corresponding backing as authorized consideration. Partial exercise needs exact unit/rounding rules; it is excluded from this minimal hypothesis.
- No route may transfer the token leg while retaining the protected claim, or redeem both. A model counterexample shows why two unrelated owner registries are insufficient. No new native package test has passed: the current financial leaf does not bind these fields or enforce these transitions.
- A finite exercise/expiry policy needs separate consensus qualification. Known `since` lower bounds must not be advertised as passive upper quote expiry. No existing quote limitation was silently solved.

Terminal package value is `max(R, asset_value) = R + max(asset_value-R,0)`. Retaining cash and buying a genuinely available collateralized call with strike R replicates that payoff; actual option availability/premium is **unknown**. It is invalid to assume the same full token allocation can simply be purchased for the at-risk $5: that price is not established. Nor does token issuance establish a legal claim on earnings. Revenue sharing would additionally need genuine revenue escrow/reporting and legal rights. **RETAIN narrow on-chain-asset hypothesis; NO buyer/issuer evidence justifies extension now.**

## C: milestone-conditioned creator finance

Scenario: 100 supporters contribute $50, total $5,000. A proposed $1,500 initial release and simultaneous $4,000 protected promise are underfunded by $500. A valid alternative is $1,000 initial / $4,000 escrow, with later releases only after agreed acceptance and corresponding refund-right reduction. Public development milestones such as useful UI, satisfactory audit, or operational uptime do not become objective because a hash is posted.

Two worlds can have identical chain records and different real service quality/delivery. A chain-only predicate cannot classify both correctly without extra information. Publishing a file/hash/test result proves publication, not customer fitness. Backer votes or a reviewer committee may be acceptable trust, but add dispute, collusion, inactivity and governance assumptions. Retain simpler staged escrow/CrowdCell where the job is goal/deadline routing; **REJECT an operatorless arbitrary-delivery claim**. Creator disappearance allows refund of unspent escrow only. At-risk initial payment is genuinely lost absent separate backing.

## D1: funded settlement of already-earned merchant balances

Scenario: merchants earn 100 CKB from genuine service sales; all 100 must remain backed until withdrawal/authorized transfer. Operator service revenue comes from a separately disclosed fee or merchant agreement, not a hidden 20% extraction. Counterfactual cash retention does not replicate buying the service and then collecting earned revenue. The advantage sought is removal of unilateral operator withdrawal veto over **already funded** balances.

This is a stronger distinct financial job than gifting an issuer capital for a cash-only claim. But the present 80/20 financing covenant is **not** a 100%-backed hosted-ledger adapter. Deposit authenticity, updates, service integration, privacy, high-frequency settlement and competing Fiber channels/Liquid Cells need equivalent qualification. Cashu's mint cannot be treated as trusting an unrelated vault automatically. Public testnet interest is not paid merchant demand. **RETAIN as high-ceiling alternative; customer/architecture-fit gate first.**

## D2: financing channel inventory

Hypothetical LP supplies 500,000 CKB for active channel liquidity while also promising 400,000 CKB cash fallback in a separate vault. Required funds are at least 900,000, not 500,000; reserve double-counting fails. A lease backed by enforceable channel-recovery rights is materially different, requires channel-specific custody/control/recovery qualification, and is not demonstrated by this covenant. Fees must compensate actual capital duration, directionality, operational risk and refusal. **STOP the double-funded-capital story; retain term-leasing as an independently scoped financial question only if an operator asks for it.**

Executable exact-arithmetic counterexamples and 720 financing scenarios: `labs/wo09-unified/product-research/model_product_offers.py`, `model-results.json`. They establish model identities/constraints only, not CKB execution, a new security proof or willingness to pay. No engineering gate is passed by this model.

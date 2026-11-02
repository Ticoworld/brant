# Track B — funded fixed-term protection and residual risk

Evidence: exact bounded payoff models and pinned DLC/Gamma/Lean Oracle source. All premiums/probability/capital-cost assumptions are synthetic. A price/reference snapshot is not a quoted option premium or demand evidence.

With risk collateral C=2000 CKB and senior target U=1000 USD at illustrative initial P=1 USD/CKB, senior=min(C,U/P), junior=C-senior. The native implementation would use explicit base units, one-shannon upward rounding, a cap at actual collateral and separate fee/output reserves. This conserves native assets, not dollars in every state.

| Price | Senior CKB | Senior USD | Junior USD | Consequence |
|---|---:|---:|---:|---|
|0.8|1250|1000|600|Senior target met, junior loses40% of initial1000 USD|
|0.5|2000|1000|0|Junior wiped out|
|0.2|2000|400|0|Protection cap exhausted|
|0.01|2000|20|0|99% crash defeats dollar target despite conservation|
|1|1000|1000|1000|No gain before costs|
|1.25|800|1000|1500|Junior asymmetric upside|
|2|500|1000|3000|Junior +200%, not free leverage|

Junior USD delta is C versus initial junior value1000, or2x before extra capital/premium/costs, until the loss boundary. No intermediate liquidation does not mean no severe maturity loss. The model varies synthetic terminal probabilities, annual capital cost, term and operating fees to calculate conditional break-even premiums, never a fair market quote. A band-limited put is a materially different lower-capital/lower-coverage alternative retained for comparison.

## Representation and materialization

At P=0.51 the positive junior risk payout is less than61 CKB. It cannot form an ordinary standalone output. Potential corrections: existing-wallet aggregation, sponsor capital, batching, delayed dust claims or prepaid output budgets. None is free. A serious native proof should pre-fund separate61-CKB return budgets for each party plus the exact settlement fee, so extreme/zero-economic payouts remain materializable without the losing party's cooperation. Those budgets are refunded capital, not junior profit or protected principal. This is analogous to DLC dust/fee budgeting, not a claim of invention.

## Oracle and unilateral-settlement alternatives

DLCs already use pre-agreed maturity outcomes, collateral, refunds and oracle assumptions. Gamma already has expiry pricers and dispute/finalization policy. Lean Oracle verifies configured feed/emitter/current-guardian authenticity and monotonic publication; freshness and risk interpretation remain consumer duties. Our Hermes CKB query returned[] at capture: a current authenticated CKB maturity feed is not established. This does not prove such a feed is impossible.

For a bounded private-chain experiment, a single explicitly trusted publisher may write one event-scoped price after a block maturity into a uniquely typed immutable record. This tests event/authorization/maturity/settlement enforcement, not external price truth, decentralization or real oracle availability. It is weaker than an audited threshold/external feed and must be labeled as such.

An outage fallback can refund original collateral after a grace threshold while the initial unpublished record remains live. A late publication may win ordering against fallback; since alone supplies no upper publication expiry. The contract must advertise that race. If the publisher chooses a wrong price, native solvency does not correct it. Reorganizations and actual finality policy remain production qualifications, not simulated timer claims.

Decision: ADVANCE a fully funded capped maturity payoff to a small native experiment, commercial UNPROVED. Do not call it a synthetic dollar or superior option market. After the fixed-beneficiary proof, investigate whether transferable funded beneficiaries produce enough secondary-exit value to justify extra state/capital. If the holder still needs a buyer, transferability is not automatic liquidity.

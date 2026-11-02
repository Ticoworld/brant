# Track B — funded fixed-term protection and residual risk

> **Restriction/status update:** Beneficiary-address settlement liveness remains **UNRESOLVED**. Original consumable-right happy paths and pre-warning observations are preserved, but the proposed correction has no native validation: its replay stopped at a JavaScript syntax error. Compiled/source-only changes are quarantined in `labs/wo09-open-markets/research/blocked-beneficiary-correction`. No security PASS or production readiness is asserted. Further restricted-case validation is paused; independent launch, fixed-risk, OTX and incentive research continues.


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

## Executed selection and participant economics

See NATIVE_EXECUTION_RESULTS for canonical and fresh-clone evidence. The full eight-state payoff grid now executes with actual node maturity and independent integer fixtures; a second grid uses the observed reference scale. Two normal counterparties fund the pool, a declared publisher signs a one-time event, and any actor can close to the exact agreed payouts. A no-price outage returns native contributions after grace, subject to the explicitly tested late-publication race.

Senior contributes1000 CKB principal plus61 CKB output budget and half the0.01 CKB settlement fee; junior contributes the same in the symmetric fixture. Funding transaction fees are additional. With consumable rights each also funds234 CKB record occupancy, returned at settlement. At synthetic P0=1, senior's principal pays1000 USD at P=0.8 while junior's pays600 USD; at P=0.2 senior pays400 USD and junior zero. Returned buffers are still exposed to CKB price changes; they are not dollar protection or profit. No intermediate liquidation occurs because all promised native payoffs are funded at outset, not because leverage risk disappeared.

For a proposed premium pi paid by senior to junior, senior's total economic cost rises by pi and junior's cost falls by pi, while risk collateral must remain fully funded. Exact terminal distributions, term capital costs and service fees determine each side's willingness; the model's probability grids are hypothetical, not observed or risk-neutral price estimates. Senior can instead sell CKB and hold cash/stable assets, accepting those assets' custody/peg/route risk. Junior can simply hold CKB or use an existing option/leveraged venue, accepting its funding/liquidation/custody terms. No superiority is established without actual attainable alternatives and premiums.

Transferability now executes without the other risk counterparty: seller and new buyer sign, then anyone settles to the buyer. The900 CKB test purchase is an arbitrary fixture price, not an observed discount or voluntary human demand. Permanent record design failed cleanup; consumable records return their468 CKB at higher peak capital and execution cost. This is a reusable improvement in bounded lifecycle behavior, not a globally new financial payoff.

At reference0.00121886 USD/CKB,2000 CKB risk principal is2.43772 USD and the symmetric senior target1.21886 USD. The illustrative1000-USD target is not a plausible full promise backed by2000 CKB at that reference. About1.64m CKB funds a1000-USD senior and equal junior principal at inception. Before deploy/fee costs, output+event occupancy adds16.4% to a2000 CKB fixed pool, consumable records raise peak overhead to39.8%, and the permanent-record alternative to32.2%. Only the206 CKB event remains permanent in the consumable variant. Small-ticket structure economics may therefore lose to simple spot/cash despite tiny chain fees.

Remaining decisive uncertainty: a defensible authenticated CKB maturity observation and two-sided quotes covering complete lifecycle capital/fees, plus multi-user wallet correctness. Lean Oracle/DLC source is stronger authentication prior art, not something this trusted-publisher prototype has reproduced. Replacing volatile CKB backing with an actually redeemable stable asset can reduce this specific collateral mismatch, but introduces issuer/peg/bridge risks and a separately qualified native delivery route; a test xUDT ticker cannot establish that property.

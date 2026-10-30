# Can the repaired design change economics?

**DERIVED, conditional:** repeated trading can amortize session opening/closing and reuse funded allocations. **HYPOTHESIS:** this yields a product traders prefer after proof costs, inventory constraints and exits. No new live price/depth quote was retrieved for this round; WO02's dated market snapshots remain historical evidence only.

## What is measured

The two-leg EVM lab session consumed 2,229,668 gas including per-session deployments, or 725,014 excluding them. This is neither a native CKB/EVM channel cost nor a production Perun cost. The session deliberately registers old and new states on-chain to test disputes. A production shared adjudicator may amortize code deployment, but has other storage, proof and funding costs. An anchor/follower native construction has not been measured.

WO02 measured310,512 EVM gas for one escrow approval/fund/claim fixture. Its allowance structure can be optimized and cheaper delivery chains can change economics. Comparing that fixture with the new two-EVM-leg lab is a *sensitivity calculation*, not an apples-to-apples price benchmark.

| Fills per session | Measured lab session gas divided by fills | Extra gas budget below N×310,512 |
| ---: | ---: | ---: |
| 1 | 2,229,668.00 | -1,919,156 |
| 10 | 222,966.80 | 875,452 |
| 100 | 22,296.68 | 28,821,532 |

The extra budget column includes no real proof cost. Positive headroom is not commercial profit. Negative headroom means this lab session envelope exceeds that repeated-escrow EVM fixture. A verifier/header relay may incur persistent costs even without session closes; allocate them explicitly. Neither mainnet dollar prices nor L2 all-in fees are claimed here.

## Inventory reuse example

Assume a frictionless constant price, a $1,000 CKB allocation initially owned by Alice and a $1,000 token allocation initially owned by Bob. One fully collateralized session therefore holds $2,000 combined principal, including Bob's initial $1,000. One hundred alternating $1,000 swaps produce $100,000 gross volume while allocations toggle between the same two funded portfolios. This is arithmetic under chosen flow, not observed demand, and both parties may spend most of a session locked into the counter-asset.

One hundred one-way $1,000 CKB sales instead require $100,000 token delivery capacity, or timely replenishment. A $1,000 token allocation cannot quote $100,000 simultaneous executable depth. One hundred separate customers generally need separately enforceable allocated balances or a proven safe reassignment mechanism. Session reuse does not authorize double-pledged maker capital.

A 50bps gross spread on $100,000 volume is $500 before costs. At 10bps hedge fees on every fill it loses $100; hedging only a net residual could reduce that charge but exposes the maker to intra-session mark-to-market and direction risk. Subtract adverse-selection losses, failed openings, disputes, session-exit proof/relay charges, inventory funding, rebalancing and operating expenses. No user commitment or maker profitability was observed.

## The economic risk that survives gas savings

Channel capital stays committed while the session remains open. At an assumed12% annual hurdle, $2,000 costs about $0.0274 per hour and $0.6575 per day, before risk premiums. A $100,000 maker allocation costs about $32.88 per day at that same assumption. Annualized simple opportunity cost is not a promised yield. Long idle sessions can erase the benefit of cheap updates.

Signed pending quotes also create option exposure. A failed acknowledgement is not revocation; forced cancellation/exit has an on-chain horizon. A maker that suppresses signature delivery or a customer that retains an exercisable quote may exploit price moves. Pricing this option and making its duration independently bounded are required before claiming tight professional spreads.

## Compare the customer job

| Customer job | Strongest plausible architecture | Reason / unresolved cost |
| --- | --- | --- |
| One CKB sale, native stablecoins in external wallet | Competitive conditional delivery | No long-lived session onboarding; WO02's timing/option risks remain |
| Many self-custodial trades, retained balances | Anchored funded portfolio session | Per-fill signature updates; foreign proof and exits unimplemented |
| Frequent one-way customer flow | Delivery plus maker netting/hedging | Inventory must replenish; channels do not manufacture stablecoins |
| Switching among makers | Competitive discovery plus safe reassignment | Allocation migration and independent exit costs are unresolved |
| Ordinary CEX spot activity | Existing CEX plus withdrawal remains benchmark | This round obtains no executable comparison proving customer advantage |

No Binance replacement claim survives this round. The plausible advantage is a narrow repeated-trading or inventory-reuse service, with competitive one-off delivery retained. Prove the native close mechanism, then compare actual delivered prices and customer friction.

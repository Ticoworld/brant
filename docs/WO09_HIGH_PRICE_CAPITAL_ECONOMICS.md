# High-price reusable capital economics

3 November 2026. Prices are mandatory **hypothetical stress cases**, not forecasts or current market quotes. Native financial tests use actual disposable CKB; all100/1000/10000-user utilization/exit costs below are modeled. No new10,000-user execution result is claimed.

## What gets reused

Measured binary48,752bytes; published test code Cell48,793CKB, unspendable in this deployment. Shared vault282CKB occupied capacity per cohort, plus exact funded customer principal and optional separate subsidy. Customer signing identities add witness/history data, not a new funded personal Cell per entry. Code is shared across cohorts/markets; it is not destroyed per trade or automatically recoverable. Code/crypto overhead is higher than the preserved17,889CKB financial version and needs explicit funding.

The implemented target limit is1024. The model chooses1000 per cohort:100users need1Cell,1000need1,10000need10. The new native signature covenant was tested with three independently generated owners and two distinct markets, not all modeled sizes. Previous large Merkle results are a useful foundation, not a scale qualification of this new binary.

| Active users | Modeled vault Cells | Shared storage CKB | Ordinary per-user wallet storage avoided CKB | Cold code+vault CKB |
|---:|---:|---:|---:|---:|
| 100 | 1 | 282 | 6,100 | 49,075 |
| 1,000 | 1 | 282 | 61,000 | 49,075 |
| 10,000 | 10 | 2,820 | 610,000 | 51,613 |

The avoided-wallet comparison is not money created. Old code may already be deployed, and ordinary wallets may already exist. A small cold cohort can be more capital-expensive with this larger new code than buying standard wallet capacity. Warm shared storage scales per cohort, not per new customer; backed principal still scales with actual positions. Dedicated150CKB claims remain another preserved encoding comparison, not an equivalent new native trading benchmark.

## Full requested price/position grid

| USD/CKB | $1 position CKB | $5 position CKB | $20 position CKB | 282CKB vault USD | Code USD | One61CKB exit gift USD |
|---:|---:|---:|---:|---:|---:|---:|
| 0.50 | 2 | 1E+1 | 4E+1 | 141.00 | 24,396.50 | 30.50 |
| 1 | 1 | 5 | 20 | 282.00 | 48,793.00 | 61.00 |
| 2 | 0.5 | 2.5 | 10 | 564.00 | 97,586.00 | 122.00 |
| 10 | 0.1 | 0.5 | 2 | 2,820.00 | 487,930.00 | 610.00 |

Every position in the table is below the41CKB structural output lower bound. Exact-value standalone cash withdrawal cannot be funded by that position alone. Standard recipient Cells require61CKB. A different lock might change a specific output footprint, but cannot make all these values independently occupy a zero-capacity output.

For any row and N active positions, **customer backing** is `N*position_USD/CKB_price` CKB, once, separately from sponsor/code capital. Thus100/1000/10000 users at$1 positions need$100/$1000/$10000 of real principal at the scenario entry price; at$5 or$20 multiply by5or20. Backing is not capacity-provider revenue, spare inventory or a second person's payout. CKB/USD losses are not insured.

## $1 at $1 and $2 CKB

At$1/CKB,1CKB is sufficient for the tested funded right and claim-paid10,000shannon fee ($0.0001,0.01% of position). At$2,0.5CKB similarly supports the separate actual native run; that fee is$0.0002,0.02%. Alice had no personal Cell at enrollment/trading in both. This establishes bounded technical usability **inside the funded pool**, not commercial liquidity, public fee stability or unconditional external cash.

For1000users, warm incremental sponsor vault capacity is$282/$564 at those prices, compared with real$1000 customer backing. Cold code adds$48,793/$97,586. Allocating code over100markets is$487.93/$975.86 per market, but someone still funds the entire publication at deployment. Those capital amounts may be reusable/long-lived rather than fees, yet their opportunity cost is real. No sponsor/LP has agreed to fund them. A brand-new small cold deployment is not justified by the low fee alone.

At$10, an owner-paid10,000shannon fee is$0.001:0.1% of a$1 position. Warm1000-user storage is$2820, and cold code$487,930. These are serious infrastructure capital requirements even though no trader personally deposits61CKB. A code-sharing entity needs enough aggregate use and a fee/service model; arithmetic amortization is not actual adoption.

## Expected versus simultaneous exits

Current native gift route provides61extraCKB per ordinary new receiving Cell (in addition to the claim). It becomes the recipient's property. For1%ofN users requesting that exit, expected gift capital is`0.01*N*61`; for everyone at once it is`N*61`. At1000users that is610expectedCKB versus61,000worst-caseCKB. At$1/$2, worst-case cost is$61,000/$122,000 for$1000 of $1positions. This is a scenario, not a measured exit rate.

A theoretical minimal standard-Cell topup is`max(0,61-position_CKB)` per output if the final receiving Cell totals61CKB. The model records that lower topup as well as the actual prototype's61CKB gift. It still requires real outside funding and becomes customer-controlled ordinary CKB; cannot simultaneously be counted as recovered reusable sponsor capital. Repayment/reuse requires voluntary return, another counterparty or a restrictive split-ownership covenant not demonstrated here.

A capacity reserve for only100exits cannot guarantee1000simultaneous ordinary cash exits. Queueing/refusal is a weaker guarantee. A lease that lets the sponsor confiscate customer principal is unacceptable; a lease that protects all principal until owners settle may lock its storage indefinitely. Therefore unconditional ordinary small-output guarantee reintroduces linear capital somewhere, even if the protocol rather than the customer pays it.

Existing funded recipients/ACP, willing funded claim buyers or channels avoid continuously creating new recipient Cells, but add availability, control, inventory and liquidity conditions. Cash transferred into someone else's wallet is not automatically independently spendable by the original customer. No executable external quote or unconditional route is supplied here.

## Ongoing fees, history and capital duration

Optional provider-paid fee budget for an assumed60actions/user/month at fixture fee0.0001CKB is0.006CKB per user:0.6/6/60CKB for100/1000/10000users. It is **optional** because owners can pay from backed claims. The subsidy can be exhausted; real network fees may differ and consensus validity alone does not imply relay admission. No free-user transaction throughput guarantee follows.

`evidence/capital-economics.json` includes the complete108-row grid over all counts/prices/positions and code reuse1/10/100, along with six lost-key scenarios. For assumed independent0.1%key loss across1000holders, probability at least one prevents final closure is about63.2%; the corresponding282CKB cushion may stay locked. Actual key-loss rates are unknown. Lost principal remains an owner's liability, not sponsor profit. Worst case locks every cohort cushion indefinitely plus deployed code.

At assumed5%annual opportunity cost and90days, warm282CKB storage costs3.525CKB, or$3.525/$7.05/$35.25 at$1/$2/$10, before code funding. Models show code allocations and backing costs separately; no investment return or rate is promised. Archive/proof service remains necessary and unquoted: illustrative$50/$300/$1000monthly budgets must be added, not erased by small live state. At1000traders, $300/month is$0.30/trader/month before support/security, already material to a$1 low-turnover position. Higher turnover can spread that cost but was not measured commercially.

Code, shared capacity, customer backing, LP payment inventory, fees and archival labor are separate funding obligations. A sponsor's lending price must reflect lock duration/default/refusal rights. No paid infrastructure, customer money or current-price operation was undertaken.

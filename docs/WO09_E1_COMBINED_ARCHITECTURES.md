# Nine required combinations — distinguish shared infrastructure from collateral

> **Restriction/status update:** Beneficiary-address settlement liveness remains **UNRESOLVED**. Original consumable-right happy paths and pre-warning observations are preserved, but the proposed correction has no native validation: its replay stopped at a JavaScript syntax error. Compiled/source-only changes are quarantined in `labs/wo09-open-markets/research/blocked-beneficiary-correction`. No security PASS or production readiness is asserted. Further restricted-case validation is paused; independent launch, fixed-risk, OTX and incentive research continues.


All rows have exact accounting witnesses in evidence/discovery-models.json. They are TESTED SYNTHETIC; native rights will be separately qualified. No user demand, secondary liquidity or commercial synergy is inferred from a sum balancing.

| Case | Gained right / new participant | Collateral and new risk | Current adjudication |
|---|---|---|---|
| Launch alone | Buyer limits native principal exposure; issuer receives unprotected portion |850 backing for850 claims;150 at-risk finance from1000 entry; output/fee budgets extra | Cash+grant rival may replicate it more cheaply; REVISE |
| Risk alone | Hedger and junior voluntarily split funded term payoff |2000 separate risk collateral; fixed publisher/fallback/term costs | Small native solvency/settlement proof justified; ADVANCE research |
| Trading alone | Compatible asset owners exchange rights | No new backing; signature/solver/withdrawal costs and missing-leg risk | Infrastructure/rail reuse, not a differentiated exchange by itself |
| Commitment alone | Issuer buys finite availability; maker supplies quota |1000 inventory, real retainer and adverse-selection exposure | REVISE truthful finite quota; reject unfunded depth promise |
| Launch + secondary trading | Holder can offer claim before redemption; new secondary buyer | Backing stays850; buyer must exist; transfer not guaranteed cash liquidity | Test funded claim transfer, keep modules independent |
| Protection + secondary trading | Hedger/junior may exit before maturity | Same2000 collateral, but beneficiary changes must be enforced; fixed-recipient pool cannot be sold merely by changing UI | Higher-ceiling conditional experiment, not already proved |
| Launch + funded protection | Buyer adds an explicitly priced risk band |850 cash backing plus2000 independent risk collateral; reusing the850 for both would overpledge | No demonstrated shared-capital saving; modular only |
| Launch + liquidity commitments | Issuer buys a finite secondary backstop |850 redemption backing plus1000 distinct executable inventory and paid service | Depth cannot use the same reserve twice; demand/retainer unknown |
| Modular funded rights + common event oracle/discovery | Reuse code, wallet settlement and one maturity record across multiple independent contracts |2850 distinct liabilities retain2850 distinct funding; observation/code costs may amortize, not principal | Strongest investigated shared-infrastructure direction; not yet commercial proof |

A two-sided tranche shares collateral coherently because senior and junior payoffs are complementary and sum to C; unrelated launch/redemption/execution obligations cannot just pledge the same C again. Sharing an event observation is different from sharing collateral. A global reserve/price state can create contention even when independent exits would otherwise be parallel.

Current conclusion: preserve separate financial contracts and common discovery/settlement primitives. A monolithic launch+DEX+protection platform has not earned its complexity. The economically important question is whether buyers value actual funded transferable rights enough to pay the additional capital, publisher and lifecycle costs.

## Native adjudication update

Launch+secondary trading now has actual normal-owner claim exchange, including a genuine xUDT/CKB hybrid settlement. It adds a sale right but no assured buyer. Risk+secondary trading progressed through permanent beneficiaries to consumable rights: actual sale without junior cooperation, current-owner payout, and returned record capital. Fixed-recipient settlement633 bytes/32616 cycles becomes774 bytes/111064 cycles for the consumable variant; record peak capital468 CKB is additional and refundable. A988-byte sale and an owner wallet input are also required. This is a measured rights/cost tradeoff, not proof of superior returns.

The strongest new combination is distinct funded term rights with common event/discovery/execution infrastructure. Ten fixed pools could share206 rather than2060 CKB event occupancy: a derived1854 CKB observation-state saving, not a native ten-pool benchmark and not a reduction in20000 CKB principal. The immutable event's206 CKB remains permanent even after settlement. Unrelated launch protection, execution inventory and risk collateral cannot share their pledged principal. Combining all products in one covenant adds oracle exposure to otherwise oracle-free refund claims without demonstrated customer value.

Independent continuation changes the ranking: transferable settlement liveness is unresolved, so fixed-recipient priced risk, issuer-financing alternatives and finite paid inventory remain independent candidates. Senior/junior contribution pricing changes outage refunds and customer economics without needing beneficiary records. A retainer cannot be both spendable issuer proceeds and protected buyer reserve. A monolith still lacks demonstrated advantage.

# Native maker acquisition and replenishment economics

2026-11-03. Exact offline model: `labs/wo09-unified/inventory-discovery/src/analyze.py`,45 explicitly hypothetical maker scenarios in `evidence/comparison.json`. No maker account, quotes or keys were requested; no trade/funding occurred.

## Actual sources of inventory

A maker can acquire iCKB from a willing seller or create it through genuine iCKB DAO deposits and receipt collection. The latter consumes actual CKB. SDK standard deposits target100,000iCKB: at the sampled gross reference one deposit is120,793.41901701CKB, plus receipt/output headroom and actual network fees. Direct protocol deposit minimum is1000CKB free capacity,1082total. A small deposit's82CKB occupied portion is a real allocation, not token inventory or a network fee; eventual withdrawal returns it to the lawful withdrawer, not automatically the original minter. Small custom deposits have worse amortization, so the shipped wallet favors cap-sized deposits and remainder orders.

Receipt phase2 requires208CKB for standard secp outputs (61plain+146iCKB+1fee headroom); that1CKB is a reserve rather than a measured fee. These reusable Cells/capacity are not counted again as CKB principal freely available for a quote. Existing suitable Cells can reduce incremental capacity; no personal Cell may be presumed available for a new customer.

A maker acquiring iCKB by selling CKB then replenishes **CKB** through actual sellers, funded opposite orders or authentic mature DAO withdrawals. Selling iCKB replenishes **iCKB** through actual buys or new minting. Hedging a CKB dollar price does not refill either physical inventory. Pool deposits are shared redemption backing; outstanding holders have claims against them, so they are not unencumbered maker inventory.

Observed canonical book has no remaining sell or buy inventory. No current acquisition price from another willing participant is verified. DApp0.01% simulated output is therefore neither a current acquisition offer nor an arbitrage route. The source bot can compete with any Trade maker using the same contracts and selection policy; implementing another bot adds no established moat.

## Liquidity, holding period and capital

The published bot policy recommends about3.2standard-deposit equivalents plus1000CKB reserve. At the sampled ratio this reference is387,538.940854432CKB before extra receipt/funding/operating requirements. It is a recommendation, not a protocol minimum and not an observed operator wallet. Smaller makers can fill smaller amounts, but may idle or lack the ability to refill/seed maturities.

| Hypothetical/reference CKB price | Reference bot float USD |
|---:|---:|
|0.001152, denomination-only observation|446.444859864305664|
|0.50|193,769.470427216|
|1|387,538.940854432|
|2|775,077.881708864|
|10|3,875,389.40854432|

Published refill/withdraw bands are2000/120000iCKB, retaining20000. They are implementation choices, not economically normalized to dollar appreciation. Trade could propose a smaller maker, but lower inventory is less immediate service, not free efficiency. A real opportunity would require demonstrated demand size and measured replenishment, not merely rescaling those constants.

The first modeled pool claim at reference snapshot is5.62days away; all current wallet-ready counts are0. Normal DAO rollover is180epochs, nominally30days, with strict request timing. Shipped wallet selects roughly2hours–3days ahead, bot20–60minutes; missing the window can roll a cycle. Nominal schedules and modeled fill timing do not guarantee block inclusion or a counterparty. Concentrated maturity was already recognized by iCKB; its new bot's ring policy addresses it. Reimplementing that published policy is not a Trade invention.

## Profit gate and useful counterexamples

Default customer order fee1basis point produces$0.002/$0.005/$0.01 gross for20/50/100dollar tickets. Maker must subtract actual marginal fill fees, replenishment/mint/collection fees, funding costs, operational costs and adverse selection. Observed SDK marginal fee model10,598sh per matched order implies its ten-fee allowance105,980sh=0.0010598CKB. At$10CKB that allowance alone is$0.010598, exceeding the default gross fee of even the$100ticket. A conditional missing quote is not a profitable fill.

The model compares net annual capital rates0%,2%,10%, explicitly **after** held-asset DAO income. It does not add DAO yield a second time. With the5.62day reference wait,2% annual net capital cost is about0.0308% of deployed notional, already greater than0.01% gross revenue. At10% it is about0.154%. These are counterexamples under assumptions, not a claim every maker waits that exact duration or loses money. Matched opposite flow may shorten capital duration, but none is observed here. Longer rollover/replenishment delays make the counterexample stronger.

At observed denomination, the reference float costs about$0.122/day at10% annual net capital cost. At1bp capture that alone needs roughly$1223/day of executed notional, before operating expenses/fees. At a hypothetical$1CKB it needs about$1.062million/day. Such volume is not established by an empty current book; higher fees need actual users willing to pay them. The same capital may support repeated turnover, but cannot simultaneously back several independent withdrawals.

## Who might pay and why not advance yet

A holder might value faster native CKB redemption than the next DAO maturity. A maker could charge for that committed inventory/time. That is the strongest surviving **hypothesis**, but there is no standing unpaid demand, paid quote, agreed premium or independent evidence of unmet willingness to pay at present. Existing DApp/bot/A2 already target the same job with0.01% default incentive. A new mechanism is unjustified until a measurable latency/size/availability gap supports an explicit paid premium beyond costs.

RUSD cannot be assumed a dollar-neutral inventory hedge simply because it has a stablecoin name. Native contract/Cells are verified; issuer collateral, peg, current venue and replenishment are unverified. No route uses unrelated similarly named assets, no centralized CKB/USDT depth is treated as iCKB liquidity, and no cross-chain settlement or quarantined security investigation was reopened.

# Real financing scale and whole-lifecycle economics

3 November 2026. Published asks establish reference **development budgets**, not customer demand or agreements to use Trade. All CKB/USD conversions below are hypothetical sensitivity cases, not current prices, dollar insurance or executable off-ramp quotes. Full reproducible results: `product-research/model_product_offers.py` and `model-results.json` (720 financing rows, 18 operating-cost stress rows; model-only).

## Financing that actually becomes usable

If creator needs G of genuinely spendable money, protected fraction b and gross fee fraction f, the lower bound before additional costs is `P = G/(1-b-f)`. The same P cannot simultaneously serve as reserve and runway. For the current 80% policy, G requires at least 5G in subscriptions, before fees. Changing to 40%/20% floors is a modeled alternative, not a tested configuration option in the preserved fixed-80% covenant.

| Published budget reference | Need G USD | Raise at 80% floor, no fees | Initial fraction/source qualification |
|---|---:|---:|---|
| FiberLatch historical | 3,000.00 | 15,000.00 | Completed, related-party reference; not current new demand. |
| CrowdCell | 5,000.00 | 25,000.00 | $1500 completed-work tranche; grant thread reports initial payment. |
| Kirea | 7,250.00 | 36,250.00 | 20%approval proposed, remainder milestones. |
| Fiber Link original | 20,000.00 | 100,000.00 | Historical milestone-payment request, not an unfilled order. |
| Cellula | 22,258.48 | 111,292.40 | $3458.48 first payment; separate operator capital, not grant reserves. |

Primary sources/dates: [customer/job inventory](WO09_MASTER_CUSTOMER_AND_CREATOR_JOBS.md), S01/S05/S06/S08/S09. The financing calculation does not assert those creators need their full lifetime budget immediately or accept a retail protected offering. In particular, staged grants can pay for actual progress while fixed refund backing cannot be spent later without extinguishing the corresponding liability.

For G=$5,000: an 80% floor needs$25,000 raised, a 40% floor$8,333.33, a 20% floor$6,250, before costs. The guarantees differ. A 1%gross fee with 80% backing raises the requirement to$26,315.79. A creator needing 60% of entry immediately cannot maintain 80% protection from those same funds; independent additional capital must cover at least 40% of entry. More total raising can supply a fixed-dollar need, but does not improve the fraction available per buyer.

## Whole offer at 100 and 1,000 buyers

Scenario G=$5,000,80% floor, no extra fee/cost: raise$25,000. At100 buyers each pays$250, receives a$200-at-entry CKB claim, and funds$50 of creator gross. At1,000 each pays$25, receives$20-at-entry backing, funds$5 gross. A hypothetical service/token benefit must justify that nonrefundable component **and** additional costs; its existence/value is unproved. Buyers do not receive USD protection: if CKB/USD falls90%, the80%-CKB reserve is worth only8% of original USD entry value. Creator dollar expenses also require an actual CKB conversion arrangement.

Current deployed experimental code uses 17,889CKB of occupied capacity and a 322CKB vault cushion. Each new plain secp holder needs at least 61CKB of retained wallet capacity plus contribution and fees; existing compatible wallets may make that incremental capacity zero. Creator needs a suitable wallet too. Contributions are transferred out of funded wallet balances, not added twice to initial capital.

| Hypothetical USD/CKB | Cold code value USD | Per-market vault USD | One new 61CKB wallet USD | 1,000 new wallets USD | 1,000-buyer modeled position CKB |
|---:|---:|---:|---:|---:|---:|
| 0.00122 | 21.82458 | 0.39284 | 0.07442 | 74.42000 | 20,491.80328 |
| 0.10 | 1,788.90000 | 32.20000 | 6.10000 | 6,100.00000 | 250.00000 |
| 1 | 17,889.00000 | 322.00000 | 61.00000 | 61,000.00000 | 25.00000 |
| 10 | 178,890.00000 | 3,220.00000 | 610.00000 | 610,000.00000 | 2.50000 |

Occupied capital is not a destroyed miner fee. Wallet capacity can be reused. The current code Cell has an unspendable lock and is not automatically recoverable; funding it has opportunity cost even when reused. Vault cushion returns only after every liability settles, potentially indefinitely delayed by refusal/lost keys. At M markets code allocation is17,889/M CKB per market; 322CKB vault remains per market. Ten markets at the hypothetical$0.10/CKB allocate $178.89 of code each, plus $32.20 vault. At$10/CKB those become $17,889 and$3,220: a serious capital burden against a$5,000 creator budget. Established-wallet and cold-retail cases must not be conflated.

The native 1,000-holder financial baseline paid 0.1114CKB in market fees excluding code/wallet setup; 100-holder0.0124,16-holder0.004. These are actual fees for previous **mechanics fixtures**, not price quotes for service/xUDT/milestone offers. New payoff contracts and data would need their own qualification and code-capacity measurement. User-authorized ordinary redemption pays its actual fee; a relayer/LP/keeper is not free or guaranteed.

## Costs that realistic offers cannot omit

- Development/delivery: the published budgets above are concrete references. New provider unit costs, service quantities, acquisition and salaries remain unknown. Do not charge an existing budget's development expense twice.
- Service/compute supply: for 1M hypothetical API calls at assumed variable cost$0.0001/$0.001/$0.01, cost is$100/$1,000/$10,000 per allocation, before support. These are sensitivity assumptions, not Cellora/Infern prices or cost measurements. A$50 net receipt cannot fund even the first case without subsidy or later consumption payments.
- Archive/proof availability: need historical witnesses, chain validation, backups, reorg response, request service and an exit runbook. [DigitalOcean's public VM price list](https://www.digitalocean.com/pricing/droplets) (S21) supplies sticker examples, **not** a sufficient CKB-archive deployment quote. [Ankr](https://www.ankr.com/docs/rpc-service/chains/chains-api/nervos_ckb/) (S22) does not establish a qualified historic-witness SLA. Two independent replicas still need validation and reconciliation, not merely two endpoints.
- LP/settlement capital: whoever buys rights or advances cash must fund inventory, duration and failure exposure. Neither a test transfer nor public testnet channel offer provides a real bid, spread or guaranteed route. Channel capacity, protected reserves and operating grants cannot be double-counted.
- Buyer acquisition/support: distribution to unrelated users, wallets, recovery support and dispute administration are real jobs. No measured CAC or support burden exists for Trade.
- Security/legal: no external security quote, enforceable service terms, resale permission, revenue-right framework or relevant conversion/compliance cost was obtained. Those are unpriced, not zero.

Explicit additional Trade-layer stress, **not supplier quotes**: six months archive/operation at $50/$300/$1,000 per month, acquisition at $0/$5/$20 each, plus 20support hours at an assumed$40/hour. With 1,000buyers, $300/month and$5acquisition each, added expenses are$7,600. To net$5,000 creator money with 80%backing and 1%grossfee then requires$66,315.79 raised, not$25,000. The lowest modeled expense case needs$32,105.26; the highest$167,368.42. Formal audit, variable delivery costs and LP liquidity remain excluded, so these are not complete commercial price quotes. Real quotes must replace assumptions before selection.

Illustrative90-day opportunity cost at assumed 5%annual rate: reserve$20,000 costs$250; cold code at $0.10/CKB costs$22.36. Neither rate nor duration is observed market funding; code remains locked beyond 90days and cushion duration may be indefinite. Capital duration cannot be erased through per-market accounting.

## Financing conclusion

Higher transaction amounts amortize fixed storage, but do not repair a missing buyer benefit, free liquidity or a 20%-usable funding fraction. Paid service/resale economics depend on delivery costs and actual contracts. The small native125CKB/25CKB-proceeds fixture was never a viable budget demonstration. The new modeled amounts likewise do not constitute funded campaigns. Whole-lifecycle economics is **plausible only conditionally**, with price, wallet incumbency, code reuse, customer acquisition, operating budget and real counterparties specified.

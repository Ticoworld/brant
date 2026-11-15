# WO09 trading economics and liquidity — 2026-11-03

Reproducible exact-decimal model: `labs/wo09-unified/trading-return/src/economics.py`; generated `research/economics.json` contains36 price/ticket/utilization scenarios and27 maker counterexamples. These are models, not executed100/1000-user markets. No actual USD peg or prices are assigned to TEST.

## Principal, reusable storage and deployment

For dollar ticket V and hypothetical CKB price P, required CKB-side principal is V/P. The maker must separately deliver the other asset from real inventory; an internal claim backed by another customer's already-owed tokens cannot be reused as spare inventory. Two-sided quoting needs both directions' unencumbered inventory. A CKB-only instrument cannot manufacture a real USD hedge or externally redeemable stable asset.

| Hypothetical CKB price | $1 position CKB | $5 position CKB | $20 position CKB | New142CKB typed receiver USD | Shared485CKB storage USD | Code50,441CKB USD |
|---:|---:|---:|---:|---:|---:|---:|
|$0.50|2|10|40|71|242.50|25,220.50|
|$1|1|5|20|142|485|50,441|
|$2|0.5|2.5|10|284|970|100,882|
|$10|0.1|0.5|2|1,420|4,850|504,410|

This142CKB minimum is the actual secp + exact xUDT configuration measured here, not a universal CKB minimum. It replaces neither the frozen61CKB ordinary-wallet finding nor other valid Cell formats. Existing suitable wallet adds zero incremental occupied storage. The tested tiny exit relies on a separately supplied existing receiver. A native independent output must still satisfy its real occupied-capacity rule.

Shared storage per active owner is4.85CKB at100,0.485CKB at1000. Cold code allocation adds504.41 and50.441CKB respectively. At1000 owners and$1/$2CKB, warm storage is$0.485/$0.97 per owner, but code allocation is$50.441/$100.882, before principal, fees, other assets, archive and exit liquidity. One code deployment can serve future markets, but utilization is a commercial assumption. Deployed code in this fixture is not assumed recoverable. Reusable state/reserve cushion is returned only after all claims are actually settled, not on sponsor demand.

Storage-only break-even:

- Already deployed shared code versus a new142CKB typed wallet each:4owners.
- Cold shared code+vault versus those new wallets:359owners.
- Cold shared code+vault versus already available A2 code and this independent289CKB bid/master profile:177owners.
- Both cold, against this rebuilt optimized A2 code profile:57owners.

These thresholds are analytical and partial. They exclude principal, exit capacity, signature costs, proof service, congestion and maker adaptation. They do not prove scale execution or cost superiority over master sharing, sharding or wallets already held. Against existing suitable wallets, shared storage never wins the incremental storage metric.

At hypothetical10% annual opportunity cost over30days,1000-owner warm485CKB costs about3.986CKB total; cold code costs414.584CKB total. At$2CKB those are about$0.00797 and$0.82917 per owner. Assumed opportunity cost is neither a quoted financing rate nor a fee actually spent. Code may remain locked far longer than30days.

## Fees and maker business

Chosen internal transaction fee0.0001CKB costs$0.00005/$0.0001/$0.0002/$0.001 at required prices. This is not a guarantee of fee floor or congestion cost. State updates serialize; root changes cause quote rebuilding and signature coordination. At11.5million estimated cycles/action and higher input contention than independent wallets, CPU/network resource consumption matters even when fixture miner fees match.

Controlled quote markup0.3% on dollar tickets1/5/20 gives gross$0.003/$0.015/$0.06. A1% adverse inventory move on the same notional costs$0.01/$0.05/$0.20;5% costs$0.05/$0.25/$1. These counterexamples overwhelm the gross spread before replenishment, basis, hedge, operations or capital costs. Quote makers need spread, paid availability or another identifiable revenue source; P2P netting alone does not create LP income.

Hedging changes price exposure, not physical delivery inventory. If a maker sells100 tokens it must buy or redeem another100 to repeat that service. A net-zero CKB mark-to-market is not replenished xUDT. iCKB has authentic DAO conversion and delayed redemption as preserved WO08 evidence, but that does not prove immediate liquid iCKB replenishment, profitable basis, or executable current bid/ask.

External makers can refuse quotes or disappear. New pool currently requires maker deposit and custom witness participation. An A2 maker may serve existing orders without adopting that pool. Internal transferability does not create a buyer. Any claimed narrow economic advantage therefore needs paid repeat demand plus actual inventory-replenishment quotes, not another controlled swap.

## Live public benchmark, explicitly bounded

Snapshot: official public [exchange information](https://data-api.binance.vision/api/v3/exchangeInfo?symbol=CKBUSDT) retrieved2026-11-03T07:19:05UTC, [depth](https://data-api.binance.vision/api/v3/depth?symbol=CKBUSDT&limit=100)07:19:06UTC; exact responses retained. CKBUSDT statusTRADING, displayed bid0.001156/ask0.001158USDT, approximate mid spread0.17286%. Minimum published notional5USDT, step1CKB. At displayed ask,4318CKB costs5.000244USDT; a strict5USDT budget rounds down below the minimum. A20USDT illustrative quantity fits the displayed best ask and notional rule. A1USDT standalone order fails that minimum.

No order was sent. Market-order filters use an average-price rule; this calculation is an indicative limit-notional check. Account fees, access, time validity, withdrawals, local rules, price impact after snapshot and USD/USDT parity are not guaranteed. The displayed book has real published quantity, unlike our TEST-maker fixture, but delivers an exchange account asset under custodial rules. The minimum creates a possible small-ticket gap, not proof that anyone wants to pay Trade to fill it. Hypothetical$0.50/$1/$2/$10 scenarios remain stress cases, not this observed price or forecasts.

# WO01: Business and liquidity

## Business hypothesis

Build a competitive native-asset conversion service: CKB in the customer's wallet to native stablecoins in a chosen external wallet, and the reverse direction. Customers pay for delivered value, reduced custody exposure and reliable recovery. Market makers pay nothing merely to support CKB; they participate only if inventory turns and realized spread compensate their costs.

This is a hypothesis, not validated customer demand. There were no customer interviews, maker commitments, integration agreements or live quote requests in WO01. No outside party was contacted. The evidence does not support a full exchange build, fundraising promise or claim of product-market fit.

A separate high-ceiling business could serve frequent traders through funded portfolio-channel sessions. That business needs repeat trading sufficient to amortize channel setup, maker allocation and forced-exit costs. It should not be bundled into one-off swaps merely to make the architecture sound more sophisticated.

## The actual rival benchmark

X03 captured a live official Binance CKBUSDT spot order book. Best bid was 0.001228 USDT, ask 0.001231, midpoint 0.0012295. Full spread was 24.40 bps. Model hypothetical market orders for the same CKB quantity corresponding to each midpoint notional, consuming displayed depth without extrapolation.

| Midpoint reference notional | Sell CKB: cost versus midpoint | Buy CKB: cost versus midpoint | Depth covered? |
|---|---:|---:|---|
| 100 USDT | 18.29 bps | 12.20 bps | Yes, both sides |
| 1,000 USDT | 21.67 bps | 15.90 bps | Yes, both sides |
| 10,000 USDT | 60.35 bps | 57.02 bps | Yes, both sides |

These costs exclude account trading fees, withdrawal/deposit costs, USDT/USDC basis and conversion, market movement, failed execution and delivery time. The public fee guidance commonly illustrates 10-bps regular-user spot fees, with discounts and pair/account differences. Use the customer's and maker's actual fees, not a universal 10-bps assumption.

For example, with an assumed 10-bps fee, a 1,000-USDT buy-side hedge in this snapshot costs approximately 25.90 bps from midpoint, before all other costs. A sell-side hedge costs approximately 31.67 bps. A design that assumes the maker hedges at midpoint for free is already underpriced.

The accompanying 24-hour ticker reported about 455,929.92 USDT quote volume and 5,283 trades on this one spot pair. The reported price change was about -10.885%. That is not total CKB volume, not a forecast and not transferable demand. It is direct evidence that a modest venue-level market and a substantial price move can coexist. A large move makes selective-abort risk more important.

The book was a snapshot, not an executed trade. Prices may disappear immediately. A serious business comparison needs repeated contemporaneous firm quotes at $25/$100/$500/$1,000/$10,000, across both directions and destination chains, including failed/expired routes. Compare net receipt, completion distribution, worst-case lockup and recovery, not a screenshot of spread.

## Three strongest alternatives

| Alternative | Why a customer selects it | Where our D might help | Where our D is worse or unproven |
|---|---|---|---|
| Binance spot plus withdrawal | Familiar interface, existing account balance and established liquidity | Native CKB holder avoids depositing at a custodian and manually withdrawing a stablecoin | Additional chain funding/claims; likely poor fit for an already-funded frequent Binance trader |
| Strong solver swap system, exemplified by 1inch Fusion+ | Competitive solvers, mature escrow/secret/recovery design and broad supported-chain distribution | Native CKB adapter and independently recoverable CKB route, if not already covered | Much weaker distribution and unproved liquidity; cannot claim solver auctions or HTLCs as our invention |
| CKB wallet-native conversion, represented by Kaze's announcement; Perun-style sessions for repeated trading | Existing wallet users or funded session users avoid a new venue | Potential verifiable recovery and executable maker competition | Kaze's actual mechanism/price unverified; channel execution may outperform repeated escrow funding |

Lucent's published CKB testnet direction already includes independent order cells and RFQ. That is a strong native design comparator for A/B, although this investigation did not establish current production depth or complete safety. Perun L2Trade is another strong architecture comparator for C, but its inspected README describes Ethereum/Solana prototype flows rather than a proven CKB/native-USDC production venue.

A realistic strongest rival is an established wallet integrating a funded native-CKB solver route with multiple professional makers and good recovery. We must beat that on price, availability or distribution. A new brand plus open-source contracts is not a moat.

## Liquidity accounting that cannot hide insolvency

Maintain separate balances for each asset, chain and maker. A usable-depth calculation starts with confirmed inventory, subtracts required capacity/fees, reserved allocations, pending source spends, destination escrows, hedge margin and volatility/recovery buffers. An unconfirmed receipt is not immediately reusable firm depth unless its dependency risk is explicitly accepted. CEX hedge balances are separate from wallet settlement balances.

For every quote expose the inventory source internally and enforce a single reservation identity. The public interface can aggregate maker prices without pooling custody. One maker advertising the same inventory through several endpoints must share reservations or be excluded from guaranteed-depth accounting. A public proof of gross reserves does not prove absence of hidden liabilities.

### Small capital can support useful turnover, conditionally

Example total capital: $20,000, split $10,000-equivalent CKB and 10,000 native USDC. With 40% of each side kept as buffer, $6,000 of either side is available for one-way immediate allocations. This can fund sixty concurrent $100 fills in one direction, not 100. To fund 100 simultaneous $100 one-way destination obligations, increase that side's usable capital to $10,000, reduce ticket size, obtain opposing settled flow or queue some requests. Never advertise the unbacked remainder as firm.

Upper-bound one-way inventory turnover, assuming immediate replenishment after each occupancy interval, is `usable_one_side_inventory * 3600 / occupancy_seconds`:

| Capital busy per cycle | Upper-bound one-way notional per hour from $6,000 |
|---|---:|
| 30 seconds | $720,000 |
| 120 seconds | $180,000 |
| 600 seconds | $36,000 |
| 3,600 seconds | $6,000 |

These are algebraic service-capacity bounds, not plausible realized volume forecasts. They assume demand, replenishment, balanced logistics and no network/cycle bottleneck. One-way trading depletes the destination asset; without an external replenishment path the bound fails after the initial allocation. Rebalancing latency and failed-trade refund time belong in occupancy, not just successful settlement time.

Opposing-flow example: sixty $100 buys plus forty $100 sells equals $10,000 gross, $2,000 net. Same-domain atomic batching could reduce external inventory movement by 80%. One hundred buys require $10,000 of net inventory. Cross-chain per-trade escrows may still need full gross temporary funding until individual obligations resolve. Do not carry a same-chain netting saving into cross-chain capital accounting without a safe net-settlement protocol.

Quoted depth, usable inventory, gross executed volume, net inventory movement and realized P&L must be reported as separate metrics.

## Market-maker profitability

A minimum spread budget, in basis points of executed notional, is:

`hedge execution + external trading fees + native funding/claims + rebalancing + adverse selection + failed-hedge unwind + inventory funding + allocated operating cost + required profit`.

If turnover is daily executed volume divided by total committed inventory, an assumed annual capital hurdle `h` contributes approximately `h / 365 / turnover * 10000` bps. It is a model of opportunity cost, not a promised provider return.

X02 optimistic model: $20,000 capital, 12% annual hurdle, 8-bps hedge cost, 3-bps gas/rebalancing, and adverse selection 5/20/50 bps. At one daily turnover the break-even spreads are 19.29/34.29/64.29 bps, excluding maker fixed operating costs. With a 40-bps spread the modeled daily profits are about $41.42/$11.42/-$48.58. This optimistic hedge assumption is below the observed snapshot's $1,000 hedge costs and is not the main forecast.

A less generous sensitivity uses 26–32 bps for a one-sided hedge including an assumed 10-bps fee, 3 bps for other variable costs and one daily turnover:

| Hedge cost | Adverse selection | Capital cost | Required spread before fixed overhead/profit |
|---|---:|---:|---:|
| 26 bps | 5 bps | 3.29 bps | 37.29 bps |
| 32 bps | 5 bps | 3.29 bps | 43.29 bps |
| 26 bps | 20 bps | 3.29 bps | 52.29 bps |
| 32 bps | 20 bps | 3.29 bps | 58.29 bps |
| 26 bps | 50 bps | 3.29 bps | 82.29 bps |
| 32 bps | 50 bps | 3.29 bps | 88.29 bps |

These are scenarios calibrated only loosely to one depth snapshot. No maker has offered these terms. Large hedges can cost much more. Persistent opposing flow, existing inventory positions or better maker fee tiers can improve economics. Claims of such savings require actual maker quotes and P&L.

Maker-last signing attacks pre-commit quote staleness. It does not erase post-funding abort options. A 3% adversarial move on $10,000 of exposed stale inventory is $300 of mark-to-market exposure, before offsets. One such event can erase many ordinary-spread trades. Inventory and quote limits must constrain tail loss; mean daily profits are insufficient.

### Passive CKB holders

The honest offer is participation in a specific strategy with a named operator, explicit fee split, enforceable withdrawal conditions and loss reporting. If the holder cannot supply/hedge the stablecoin leg, the maker must do so and charge for it. Ordinary holders can alternatively hold CKB without taking this strategy risk. There is no evidence yet of a sufficiently profitable arrangement to recruit them.

iCKB can be considered a slow reserve asset with conservative conversion haircuts. It is not counted as immediate executable CKB. DAO compensation or a token incentive is not a substitute for profitable trading after risk and costs.

## Operator revenue and business size

At a 5-bps retained routing fee:

| Daily settled notional | Gross daily routing revenue | Gross monthly revenue, 30 days |
|---|---:|---:|
| $10,000 | $5 | $150 |
| $100,000 | $50 | $1,500 |
| $1,000,000 | $500 | $15,000 |

Gross is before infrastructure, security maintenance, support, wallet revenue share, refunds, monitoring and incident costs. A hypothetical $3,000 monthly fixed-cost target needs $6 million monthly settled notional, about $200,000 daily, at 5 bps with zero variable costs. At 10 bps it needs $100,000 daily before variable costs. These are targets, not observed costs or achievable demand estimates.

For scale only, 100% of the observed Binance pair's $456,000 daily volume would generate about $228/day at 5 bps. A 1% share would generate about $2.28/day. Neither share is justified, and native conversion demand is not necessarily a subset of that one pair. The exercise shows why a respectable niche swap service may still be too small for an ambitious standalone exchange business.

Potential revenue extensions include wallet routing integrations or paid treasury conversion services. These are unvalidated distribution/business hypotheses. Do not inflate scope with subscriptions before proving a recurring paying job.

## A defensible customer advantage, if it can be earned

A credible statement would be: native CKB enters directly from your wallet, native stablecoin arrives directly in your chosen wallet, every accepted route has visible recovery terms, and firm quotes beat or justify their premium against the full alternative journey. This requires demonstrated execution and customer use.

A weak statement would be: CKB is a UTXO chain, therefore our exchange is uniquely fast and efficient. The tests do not support that claim. The distinct value would be chain coverage plus route quality and operational reliability, not blockchain allegiance.

Distribution should initially be where customers already hold CKB: wallets and services with a real conversion event. A standalone trading screen is a harder acquisition problem. Kaze's announcement is evidence of existing competition and possible customer relevance, not evidence they will integrate or that their customers will switch.

## Commercial gates before a full build

1. Demonstrate a real two-way native test-asset swap with independent recovery, including adverse timeout paths.
2. Obtain read-only repeatable benchmark coverage of actual alternatives; do not equate missing quotes with a free market.
3. Under separately authorized future work, establish at least two independent makers' executable economics and customers' willingness to pay. No outreach is authorized or performed now.
4. Show positive contribution margin under realistic adverse selection, failed settlements, rebalancing and distribution share.
5. Prove a customer benefit beyond what an established wallet can reproduce with an ordinary solver integration.

Until then, D is a research candidate with a useful customer job, not a sustainable business established by evidence.

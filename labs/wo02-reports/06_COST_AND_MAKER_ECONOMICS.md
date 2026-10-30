# Costs and maker economics

## Measured local contract costs

| Direction | CKB funding bytes | Funding cycles | CKB claim bytes | Claim cycles | EVM approval gas | EVM funding gas | EVM claim gas |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 625 | 1,626,005 | 299 | 13,997 | 44,282 | 216,158 | 50,072 |
| B | 625 | 1,646,441 | 299 | 13,997 | 44,282 | 216,158 | 50,072 |

Each successful trade paid 100,000 shannons for funding and 100,000 for closing: **0.002 CKB total**. This was a fixed experimental fee budget, not the lowest fee inferred from production policy. CKB refund measured 267 bytes and 7,885 cycles, with the same fixed 0.001-CKB close reserve. CKB escrow occupied capacity is 226 CKB from actual fields (8 capacity + 33 script header + 185 arguments), already inside the much larger native principal. The EVM refund measured 46,490 gas. Successful path including per-trade approval used 310,512 gas. Existing allowances could remove approval cost, but allowance scope and authorization risks must be considered. Different amount bytes can slightly change calldata gas; the tests measured the fixed fixture amounts.

Test-token deployment used **423,304 gas**; EVM escrow deployment **587,801 gas**. These are one-time deployments in this construction, not a per-trade clone cost. CKB code was loaded in genesis, so a CKB code-deployment transaction fee was not measured. The code cell's allocated capacity is not a trade execution fee.

At the explicitly configured development transaction price of 2 gwei, the happy-path EVM fee was **621,024,000,000,000 wei**, excluding deployment. Token funder paid approval/funding and the watcher paid the claim. The initial/final native-gas balances and receipts retain actual fee responsibility. In production a quote must include whoever reimburses those costs; the prototype implements no operator fee or automated reimbursement.

The maximum observed CKB accepted-funding-to-observed-closing interval was **7.098 host seconds**, and the maximum recorded funding-to-close span was **36 manually generated blocks**. These are harness measurements, not mainnet settlement latency. Aborted trades wait for fixture H/T, not for those short host durations in production. evidence/cost-ledger.json records each path's occupancy, block span, gas, fees and result. Deep rollback receipts are labeled branch executions; their summed fees are not silently called canonical paid fees after rollback. Gas-balance injections are explicitly artificial.

The real successful fixture locked 100,000 CKB plus 0.001 CKB close reserve on one side and 100 test tokens on the other. At the dated market midpoint those principals have different dollar values: this is an arbitrary protocol test rate, not an economically executable market quote. Commercial models below instead derive CKB quantities at the live midpoint for each requested notional.

## Fresh market input, separate from WO01

Retrieval timestamp: **2026-10-30 03:01:54 UTC**, 04:01:54 Lagos. Official Binance public-data endpoint returned a new 1,000-level CKBUSDT book, not WO01's prior snapshot. Ticker/depth were separate requests. Midpoint: **0.001176000 USDT/CKB**. ETHUSDT spot input: **2,214.19**. Displayed-depth arithmetic assumes consuming the book immediately, with no price movement or hidden execution costs; it is not an executed trade or a firm hedge commitment.

| Midpoint reference size | Sell-side impact versus midpoint, bps | Buy-side impact, bps | Returned depth covered both? |
|---|---:|---:|---|
| $100 | 8.50 | 8.50 | Yes |
| $1,000 | 12.06 | 17.20 | Yes |
| $10,000 | 57.51 | 47.75 | Yes |
| $50,000 | 276.97 | 209.56 | Yes |

Add the actual maker's exchange fee. A 10-bps fee is an explicit regular-tier scenario, not the fee every professional maker pays. Discounts, USDT/USDC conversion/basis, CKB deposits, stablecoin withdrawal, congestion and rebalancing can change the complete route. None was invented as a free operation.

## Production cost model, not a production measurement

Read-only RPC gas-price snapshots returned Ethereum **1.665974567 gwei** and Arbitrum **0.020000000 gwei**. URLs, request bodies and retrieval timestamps are preserved. Ethereum-style multiplication of the measured 310,512 gas by that observed gas-price input and ETH price yields approximately **$1.1454 per success**, including the negligible modeled CKB fee at that midpoint. It is not a quoted transaction fee for deployed production USDC. Actual token behavior, code, calldata, base/priority fee and finality requirements differ.

Arbitrum's observed execution gas price alone is insufficient for an all-in fee: L1 data fees must also be estimated using the actual deployed adapter and transaction. No misleading execution-only Arbitrum dollar cost is presented. A cheaper chain can reduce fixed network cost but cannot remove hedge impact, abort options, capital fragmentation or bridge/issuer risk.

## Maker model

For each size and direction, use the relevant side of the current displayed book as one potential hedge, add an assumed 10-bps exchange fee, 5-bps selective-abort/adverse-selection allowance, 3-bps rebalancing, $0.25 per-trade operating allocation, 120 seconds occupancy, 12% annual capital hurdle and 60% use of two-sided capital. These inputs are deliberately labeled assumptions. The tested host runtime is not used as production occupancy. Required two-sided capital allocation is modeled as 2 * notional / 0.6, not as simultaneously reusable quotes for many customers.

| Size | Direction | Break-even bps before profit/operator fee | Contribution at 50-bps customer spread |
|---|---|---:|---:|
| $100 | CKB_to_token | 166.06 | $-1.16 |
| $100 | token_to_CKB | 166.06 | $-1.16 |
| $1,000 | CKB_to_token | 44.02 | $0.60 |
| $1,000 | token_to_CKB | 49.17 | $0.08 |
| $10,000 | CKB_to_token | 76.92 | $-26.92 |
| $10,000 | token_to_CKB | 67.16 | $-17.16 |
| $50,000 | CKB_to_token | 295.26 | $-1226.31 |
| $50,000 | token_to_CKB | 227.85 | $-889.27 |

The $1,000 scenarios leave roughly $0.60 and $0.08 contribution before any additional exchange-operator fee or unallocated fixed overhead. A 5-bps routing fee is $0.50 there and consumes most/all of that contribution. At $100, fixed network/operations dominate this Ethereum model. At $10,000/$50,000, the observed hedge impact dominates the assumed 50-bps spread. The model does not establish that a particular customer would accept a wider spread.

The included stress case uses 30-bps abort exposure, 15-bps rebalancing, $1 operations, 900-second occupancy and a 20% annual hurdle. The one-way case separately raises inventory replenishment costs. Full tables are in evidence/economics.json, with the runnable model. No modeled profit is described as observed maker profit.

## The strongest plausible repairs to economics

A professional rival may have better fee tiers, natural opposing flow, existing native inventory and lower-cost delivery networks. We should compare against that rival, not insist every maker immediately market-hedges every fill. Residual net hedging can substantially improve costs. Sixty $1,000 buys and forty $1,000 sells have $100,000 gross but $20,000 residual exposure. The hedge should be priced at the residual size, not assumed free or simply one-fifth of an individual quote. Two-chain escrows still temporarily allocate each user's full obligation until that trade resolves. Same-chain atomic netting cannot be copied into a cross-chain balance sheet without a safe net-settlement mechanism.

The chain-oriented repair makes the CKB maker fund first for token-to-CKB trades. That may improve technical reasoning while making capital-griefing worse for the maker. Short quote collection times do not eliminate the funded counterparty's ability to abandon. Pricing a reservation premium or collateralized deliver/refund promise needs its own objective enforcement and default/refund analysis. No token subsidy, DAO yield or assumed iCKB conversion is used to hide this cost.

## Strongest-rival comparison for the same customer job

| Route | Delivered-price evidence | User workflow | Settlement/recovery/risk | Commercial implication |
|---|---|---|---|---|
| Binance plus native stablecoin withdrawal | Actual dated displayed CKB book; account-specific fee/withdrawal quote not obtained | Deposit CKB, trade, possibly convert quote asset, withdraw | Custodial exchange exposure and its withdrawal policies | Strong benchmark for funded traders; no complete delivered-price superiority established either way |
| Established solver network, exemplified by Fusion+ | Architecture/security source inspected; no executable native CKB route obtained | Signed order/funding and protocol-specific secret handling | Mature escrow/incentive/monitoring design, with accepted secret/time assumptions | A CKB adapter alone is weak defensibility; our raw HTLC demonstration is not competitive proof |
| CKB wallet conversion, including Kaze's prior announcement | No authenticated executable quote or actual route verified in WO02 | Potentially existing wallet distribution | Internal mechanism, live prices and recovery unknown | Unknown is not absent competition; cannot claim a vacant market |
| Correct funded portfolio channels | Hypothetical same-job model; no full cross-chain channel implemented | Fund a session, repeat signed exchanges, then close/exit | Conditional on correct cross-chain update and unilateral-exit protocol, monitoring/data | Potentially much lower per-fill cost and stronger repeat execution, with funding/maker lock-in |

No rival transaction was executed, no real assets moved, no outside party contacted. The analysis establishes actual protocol costs and plausible economic obstacles, not an executable delivered-price winner.

## Business decision

Safe escrow alone would not create a sustainable trading business. On current evidence the route has no demonstrated exceptional customer advantage or maker profit after full costs. A narrow conversion service may still serve custody-sensitive demand, but that willingness to pay is unverified. The channel/netting ceiling deserves a decisive comparison before building more escrow interfaces.

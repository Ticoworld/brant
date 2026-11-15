# Exact native inventory comparison — 2026-11-03

## Observation classes

**LIVE PUBLIC READ:** two mainnet endpoint reads found eighteen fulfilled iCKB order groups, zero executable matchers and twenty-four pool deposits. No remaining standing bid or ask was observed. Exact contract identities and raw traces: `WO09_NATIVE_INVENTORY_OBSERVATIONS.md`.

**SIMULATION:** pinned official SDK new-order quote/estimate functions, run without a signer, funding or broadcast. These are potential offers the customer could place, not existing maker quotations. They do not establish input affordability, transaction completion or realized delay. `labs/wo09-unified/inventory-discovery/src/analyze.py` independently checks exact integer output arithmetic for30 directional notional scenarios; `evidence/comparison.json` retains amounts and classifications.

**UNAVAILABLE:** actual executed output, spread, minimum executable order, fill latency and delivered assets for current$20/$50/$100 CKB/iCKB trades. None was traded. An absent standing order is not a zero spread. The SDK's0.01% order fee is not an observed market spread.

## $20/$50/$100 equivalent new-order scenarios

Dollar denomination uses a dated public CKB/USDT bid0.001151/ask0.001153 response and midpoint0.001152USDT/CKB, retrieved2026-11-03. USDT=USD is assumed only to express ticket sizes. That response supplies no iCKB liquidity, bid/ask or inventory. Primary native ratio at reference block20913464 is1.2079341901701075CKB/iCKB (gross standard-deposit ratio, not a market quote).

| Dollar-equivalent ticket | CKB buy input | Simulated iCKB output after order fee | iCKB sell input valued at gross reference | Simulated CKB sell output after order fee | Gross fee USD approximately |
|---:|---:|---:|---:|---:|---:|
|20|17,361.11111111|14,371.12645811|14,372.56371447|17,359.375|0.002|
|50|43,402.77777777|35,927.81614525|35,931.40928617|43,398.43749999|0.005|
|100|86,805.55555555|71,855.63229051|71,862.81857236|86,796.87499999|0.01|

Buying then selling is two fees and two distinct counterparties/fills, not the same-value rows above. Actual network/collection fees are additional. Raw quotes include exact eight-decimal amounts, ratios, fee amounts and maturity outputs.

The SDK estimates600seconds for these new orders because it assumes bot working capital, and neither inventory nor bot availability is measured. That is not a ten-minute service guarantee. New-order cancellation/collection and epoch rollover rules still apply. The sampled pool has no wallet-ready deposits; the first modeled pool claim is about5.62days out. Epoch timing is an estimate, not a simulated timer or guarantee.

At sampled33,222shannons/1000bytes, source-derived new-buy minimum33.2221CKB; new-sell minimum0.00275033iCKB. Those are SDK request/estimation floors, not sufficient wallet balances or guaranteed fill minimums. Default partial-match minimum2^36shannons=687.19476736CKB does not prohibit smaller whole-order fills. Existing older orders use different minimum exponents, but all sampled groups are fulfilled.

## Stress prices and entry affordability

| Hypothetical CKB price | $20/$50/$100 source CKB | New-buy amount-floor result at sampled fee rate | Existing suitable iCKB receiver occupied USD |
|---:|---|---|---:|
|$0.50|40 /100 /200|All three pass amount floor|73|
|$1|20 /50 /100|20 fails;50/100 pass|146|
|$2|10 /25 /50|20/50 fail;100 passes|292|
|$10|2 /5 /10|All three fail|1460|

Passing this floor does not fund the wallet. A standard secp iCKB Cell occupies146CKB: exact iCKB args are36bytes, unlike the preceding TEST asset's32bytes/142CKB. A new standard iCKB A2 order/master uses199+94=293CKB, excluding principal and transaction change/fees; sampled JoyID masters use96 instead of94. The capital is reusable on collection, not a destroyed fee, but must actually exist. Plain secp change usually needs61CKB when needed; not every transaction necessarily creates one. Wallet-specific lock sizes alter these numbers.

A DApp conversion previews actual completion only with real account state and signer preparation. This investigation deliberately does not invent a funded wallet or sign one; source-based amounts/minimums must not be called completed affordable transactions.

## Equivalent alternatives

| Path | Genuine asset source and pricing | Entry/exit and timing | Current executable evidence | Advantage over Trade |
|---|---|---|---|---|
| New iCKB DApp/SDK/bot | Genuine iCKB contracts, gross DAO reference plus0.01% new-order fee; maker inventory still required | Actual wallet-funded creation/collection; direct DAO legs when selected and ready; bot timing conditional | Successful actual book/pool reads; no remaining standing offers observed; new-order output/latency simulated | Already ships conversion UI, SDK, bot, maturity policy and public reads; no new code deployment required |
| Published A2 directly | Funded live limit order fixes price; contract alone is not an LP | Funded order/master; passive fill; proper owner collection | Native qualification frozen from prior work; exact mainnet deployed order code independently read here; no current unfilled iCKB offer | Existing permissionless settlement, independent orders and already deployed code |
| Direct existing-wallet RFQ | Identified maker supplies exact iCKB and firm bilateral price | Actual recipient/inventory Cells; signatures coordinate transaction; once confirmed direct delivery | Prior native TEST settlement only; no current firm iCKB RFQ obtained | Existing suitable wallets add no storage or archive, fewer measured cycles; not an automatic quote service |
| Trade shared two-asset rights | External real principal and exact token inventory deposited, owner-authenticated bilateral quote | Internal position control without personal input; external receiving route remains funded/conditional | Frozen TEST native evidence only; this specific iCKB integration not qualified | Potential repeated-user storage amortization, but extra code, archive, root contention and maker adoption. No observed economic superiority |
| RUSD/CKB via documented UTXOSwap integration | Independently verified native RUSD code/Cells; current reserve/peg/price not qualified | Sequencer, intent funding, actual native receiver, service availability required | Public pool/config requests403; no quote, minima, output or delay verified | Cannot be used as executable replenishment or hedge on present evidence |
| Fiber | Must have exact token support and funded directional routes | Channel capital, routing and closing requirements; payment is not automatically asset exchange | Public examples include testnet RUSD; no applicable mainnet iCKB exchange route quoted | Conditional future route only; no commercial comparator rate manufactured |

Optimized A2 and direct-wallet native byte/cycle comparisons stay frozen in `WO09_TRADING_EXECUTION_COMPARISON.md`; this read-only work does not rerun or rebrand them as mainnet iCKB fills. CKBSwap's published testnet AMM is not credited with live mainnet iCKB inventory. Custodial CKB/USDT depth is not substituted for CKB/iCKB execution.

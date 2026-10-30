# Individual versus shared verification economics

All costs below are isolated measured records or explicitly labeled arithmetic models. No historical market price is represented as a current executable quote. No mainnet dollar price, profitable maker operation or demand advantage was established.

## Native verification resources

For the two-trade batch, checkpoint publication plus shared consumption used2,163,576cycles versus a884,807-cycle proxy from two measured direct proofs. It used2,671bytes versus a3,017-byte direct proxy. These compare different actual trade proof paths in the same final source state, not paired identical-trade benchmark runs.

Cycles therefore **increase** at the tested batch size2, while transaction bytes decrease. All settlement closes paid the same prototype-fixed100,000shannons regardless of cycle count. A checkpoint adds another100,000-shannon publication fee. Cycles are not EVM-style gas charges and lower cycle count does not automatically lower the paid fee.

| N, modeled trades | Shared cycles, constant small-tree envelope | Direct cycles proxy |
| --- | --- | --- |
| 1 | 2,113,982 | 442,404 |
| 2 | 2,163,576 | 884,807 |
| 10 | 2,560,328 | 4,424,035 |
| 100 | 7,023,788 | 44,240,350 |
| 1000 | 51,658,388 | 442,403,500 |

Under that simplified envelope, the cycle break-even is about6trades. **Only batches of1 or2 are implemented.** Larger rows omit increasing membership depth, source tree construction gas, root-verifier cost, header retention, traffic arrival/batch waiting, and proof-generation scaling. They are arithmetic sensitivity, not achieved throughput, a promised saving percentage or an economic forecast.

## Actual EVM gas and paid fees

| Operation | Gas used | Actual paid wei |
| --- | --- | --- |
| deploy_TestToken | 492758 | 923921250000000 |
| deploy_Outcomes | 825131 | 1459836640661668 |
| filled_shared_open | 185259 | 310930366907151 |
| unfilled_shared_open | 185259 | 295415460685143 |
| filled_individual_open | 185247 | 281797711021161 |
| failed_then_unfilled_open | 185247 | 269877920004090 |
| pending_without_terminal_outcome_open | 185259 | 259446507321021 |
| maker_allowance | 46115 | 62302035235410 |
| wrong_amount | 36055 | 47133713953550 |
| wrong_recipient | 33926 | 43050596404582 |
| wrong_token | 31782 | 39263877341748 |
| wrong_trade_id | 25311 | 30526286293932 |
| filled_shared_delivery | 93023 | 109798362890881 |
| filled_individual_delivery | 93023 | 107714446668178 |
| duplicate_fill | 25311 | 28811871450219 |
| bad_expire_filled | 24200 | 27129509825000 |
| token_failure_on | 43747 | 48381853434684 |
| failed_payment | 48019 | 52472380498950 |
| token_failure_off | 21835 | 23607705175010 |
| unfilled_shared_expire | 56480 | 59991433273120 |
| failed_then_unfilled_expire | 56468 | 59541503717564 |
| late_fill | 25311 | 26517096890856 |
| duplicate_expiry | 24200 | 25209255192000 |
| commit_shared_outcomes | 53049 | 54985292531724 |

The shared token approval can be reused while allowance remains. Source open/fill/expire and root commitment fees are distinct from CKB proof verification. Actual dev gas prices varied with the development fee mechanism; multiplying them by a live ETH price would not create a production quote. Deployment, defensive failures and token failure-switch transactions are separately labeled and are not normal trade costs.

## Capacity and capital

Each trade committed10,000 CKB principal plus0.001 CKB closing reserve, with a430-CKB minimum occupied-capacity footprint inside that principal. Peak reserved trade principal was50,000 CKB across five trades, not executable stablecoin depth. Four terminal trades closed and one10,000-CKB principal remains reserved. The isolated setup's700 CKB checkpoint/bootstrap allocation remains locked. Minimum data/script occupied capacities are210 CKB for bootstrap and294 CKB for checkpoint; configured values are300/400.

Script code was installed in genesis. Code footprint and corresponding minimum code-cell capacity are measurable, but deployment fees are unmeasured. The final reservation binary is12,288bytes, settlement9,224bytes, checkpoint7,120bytes and deny1,016bytes; a simple empty-args code cell adds41 capacity bytes. This shared static capital cost matters to a small venue. Genesis allocates larger100,000-CKB code cells, which is fixture configuration rather than an optimized production requirement.

Recorded terminal trades occupied principal for roughly4–5 host seconds in the final run. Blocks were manually mined and source time was advanced400/3600seconds. These values are not mainnet latency, wall-clock deadline behavior or a production capital-occupancy estimate. Proof-generation observations are local RPC response/transport/logging durations, not a standalone prover benchmark.

## Liquidity and maker margin

Bob kept test tokens in his separate wallet until successful delivery. That avoids a pre-funded per-trade external escrow, but executable quotes still need reserved spendable inventory. After delivery Bob waits for CKB risk-finality/outcome verification and can have delivery capital or hedge exposure outstanding. Batch verification creates no stablecoins and does not reduce one-way inventory depletion.

A maker's required spread must cover hedge fee/impact, adverse selection during the authorized quote window, network and proof/relay fees, failed trade expenses, rebalancing, capital occupancy, monitoring and operating margin. Alice's native reservation while Bob can choose whether to fill still gives Bob a selective-abort option. A short deadline narrows that option but cannot remove all inclusion/finality risk. No observed profitability model or customer willingness to pay was obtained.

At an assumed12% annual capital hurdle, simple opportunity cost is principal×0.12×lockedSeconds/31,536,000. This is a scenario formula, not yield. Shared finality verification also needs an amortized operating/proving budget. Without a measured finality verifier and realistic occupancy, a complete delivered-price estimate is unavailable.

## Comparison with WO02 and repeated trading

WO02's measured EVM approval/fund/claim fixture used310,512gas. E1's source delivery path has separate open and fill plus allowance, optional root commitment and a still-missing consensus verifier. Asset flow, authorization and amortization differ; no like-for-like all-in price superiority is established. E1 improves the *meaning* of release evidence relative to a naked preimage and uses one source contract to decide fill versus unfilled expiry. The trusted bootstrap means E1 has not yet demonstrated a stronger end-to-end trust model.

One-off conversion may favor direct execution proofs. Ten/hundred/thousand express trades still require per-trade physical delivery and source operations; only proof/checkpoint overhead might amortize. Idle reservations, maker switching, failed sessions and forced recovery remain costs. E1 does not implement100off-chain trades or rebalancing. Repeated funded portfolio trading can potentially remove per-fill chain writes, but its consistency and collateral protocol remains a distinct unproved branch.

The current contract requires Alice to fund an EVM open transaction and Bob to deliver with EVM gas. That is friction for a native-CKB-only customer. Gas sponsorship with independently signed terms is a possible repair, not an implemented customer journey.

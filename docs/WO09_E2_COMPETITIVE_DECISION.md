# E2 competitive decision — checkpoint 1

## Current result

The strongest new execution result is ordinary complete-fill spot settlement using only each user's existing wallet and asset Cells. It added0 persistent Cells across4 inputs/4 outputs. Trade can use this as a baseline for occasional swaps. Existing CoBuild OTX remains stronger for flexible signed ranges; no OTX integration or equivalent-workload performance comparison exists.

This is not a universal market architecture. An entrant needs funded Cells; an exit output needs capacity; a valid whole-body signature cannot reserve an input after it is spent. Fiber is a better established candidate for recurring micropayments when a channel route/liquidity is available. Liquid Cells is the primary pooled claim comparator: its pinned README describes validity proofs, DA and force exit, but it remains pre-alpha/testnet and unaudited. Reuse/reproduce before inventing another vault.

| Architecture | Technical decision | Commercial decision |
|---|---|---|
| Existing-cell whole-body swap | ADVANCE as spot fallback | UNPROVED advantage vs OTX/maker/RFQ |
| Existing E1 funded note | ADVANCE as independent claim fallback | UNPROVED; capacity limits small position |
| Root/bitmap pool | REVISE after uniqueness/data/exit model | UNPROVED |
| Fiber/Perun/Myelin | REUSE/reproduce applicable existing systems | UNPROVED access/route/lifecycle cost for target users |
| New generic rollup | STOP for now; better reuse candidates exist | UNPROVED |

## Answers to the first decision questions

An on-chain order Cell is not necessary for a one-shot whole-body bilateral spot trade. The best executed baseline is a signed atomic transaction over existing wallet and asset Cells. It costs a normal transaction fee, VM cycles, bytes, signature coordination and existing asset-cell capacity; exact fee is unmeasured. Tiny financial principal can be represented off chain or inside a pooled system, but standalone L1 output/independent exit cannot avoid the occupied-capacity boundary by naming a Merkle root. Collateral funds financial claims; sponsor or existing recipient funds output capacity. Near-empty roots have fee/last-holder risks; root-mutating concurrent exits conflict. Sharding reduces unrelated conflicts but not same-shard contention.

Current permitted work does not establish a new independent pooled exit. It identifies the missing test. Fiber may be better for repeated tiny transfers if channel liquidity/routes exist; for general claim ownership, Liquid Cells appears closer and deserves source-to-native validation. Static commitments and accumulators remain hypotheses. The E2 unexpected finding is that Trade's spot order workflow needs no exchange-specific persistent order Cell when full body is signed at fill time.

All $1/$10/$100 CKB valuations are in the capacity model and are only stress arithmetic. Financial product demand, ACP semantics, concurrent pooled exit, authenticated recovery and production security remain unproved. E1 beneficiary validation and general recovery/LO-01 remain unresolved.

## Next decision-changing experiment

Pin exact Liquid Cells source/scripts and reproduce its deposited claim and force exit; then attack operator data loss, two simultaneous claims, last exit, duplicate/nullifier, missing fee sponsor and reorg. Compare exact total capital/fees/cycles with E1 claims and per-shard immutable/bitmap sketches. If upstream already meets the customer requirements, reuse it.

## Required thirty answers at this checkpoint

1. **Need an order Cell?** Not for the demonstrated complete bilateral full-body swap; open resting/partial orders still need a reliable discovery/reservation design.
2. **Best executable intent baseline?** Existing funded wallets/assets with all affected owners signing one atomic whole-body transaction. CoBuild is stronger range-signing prior art but not E2-integrated.
3. **What still costs?** Fee, bytes, CKB-VM cycles, signature coordination, compatible live inputs, discovery and liquidity; harness did not record fee.
4. **Tiny claims without per-user Cells?** Off-chain/channel or pooled validity state may; no E2 proof says every holder has independent recoverable ownership.
5. **Avoid extra exchange-owner capacity?** Complete fill can reuse existing recipient wallets/assets. New outputs/entrants still need occupied capacity.
6. **Who supplies collateral?** Claim issuer/LP funds financial liabilities; wallet owner or sponsor funds storage capacity; maker funds inventory.
7. **Minimum boundary?** About61 CKB for a standard wallet Cell; actual script/data size sets the exact amount.
8. **Can principal fund occupancy?** Sometimes, if the asset-bearing Cell capacity satisfies its occupied requirement. It cannot be double-counted as spendable claim payout; prove conservation per transition.
9. **Nearly empty pool?** Rounding, fee reserve and last claimant can make it stuck; no E2 pool tested.
10. **Operator-free recovery?** Spot owners can spend their existing replacement Cells. Pooled recovery not proven here.
11. **No private indexer?** Not proven for pooled rights. A signed spot transaction does not require an operator indexer to recover cell ownership.
12. **Concurrent exits?** Distinct wallet Cells can be independent; shared root is a single spend conflict domain. No pooled concurrency test.
13. **Is sharding better?** Only for cross-shard independence. It adds roots/coordination and leaves same-shard contention.
14. **Immutable commitment better?** It avoids mutation until the first exit, then duplicate payment requires consumed state or unique user output; model only.
15. **Cell reuse/ACP?** Existing compatible cell reuse is mechanically demonstrated for swap. ACP remains unpinned/unexecuted; either way output storage still needs capacity.
16. **No funded Cell?** A sponsor or faucet must fund onboarding; user can't create an ordinary spendable output from sub-minimum principal alone.
17. **Fiber better?** Likely for repeated tiny routed payments when channels/liquidity exist; not shown for arbitrary collateralized claims, and no E2 route tested.
18. **Most prior art solved?** Liquid Cells most directly targets pooled microclaims/force exits per pinned README; Fiber/Perun solve channel payments; OTX solves fragment authorization.
19. **Prior-art gap?** Need independently verify current contracts/DA, fees, forced exit and concurrent/last exits. E2 has not established a defect in it.
20. **New architecture discovered?** For spot, separate intent from asset state: sign a complete transaction only at fill and reuse all four Cells. This is a bounded pattern, not a new protocol.
21. **Native survivor?** Four-cell xUDT/CKB complete-fill swap.
22. **Exact improvement?** Zero added persistent Cells over its four existing inputs/outputs, with owners' wallets and balances replaced one-for-one.
23. **Which market benefits?** Occasional spot/RFQ complete fills. No evidence yet for pooled claims.
24. **At $1/$10/$100 CKB?** No new exchange Cell remains zero at every valuation; existing61-Ckb wallet capital is worth $61/$610/$6100. Dollar position and fee economics change.
25. **Trust/liveness sacrificed?** No fill while intent is off chain; inputs may be spent; whole-body owners must sign. No independent matching or partial fill.
26. **Better existing platform?** CoBuild for flexible OTX; Fiber for tiny repeated payments with route liquidity; Liquid Cells for pooled microclaims. Exact usable cost not benchmarked.
27. **Technical gaps?** OTX integration, partial fills, ACP, sponsorless entrants, root/DA, simultaneous/final exits, channel closure/reorg and independent recovery.
28. **Commercial gaps?** Users, compatible asset owners, routes, maker quotes, willingness-to-pay and lifecycle fee/access estimates.
29. **Higher-ceiling alternative?** Reproduce Liquid Cells force exit and operator-data-loss case; compare a fixed cohort/bitmap only if it improves that proven baseline.
30. **Build next?** A measured independent-exit benchmark on the strongest existing pooled system, not a new generic rollup.

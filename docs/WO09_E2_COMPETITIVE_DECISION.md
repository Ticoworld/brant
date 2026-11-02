# E2 competitive decision — checkpoint 1

## Current result

The strongest new execution result is ordinary complete-fill spot settlement using only each user's existing wallet and asset Cells. It added0 persistent Cells across4 inputs/4 outputs. Trade can use this as a baseline for occasional swaps. Existing CoBuild OTX remains stronger for flexible signed ranges; no OTX integration or equivalent-workload performance comparison exists.

This is not a universal market architecture. An entrant needs funded Cells; an exit output needs capacity; a valid whole-body signature cannot reserve an input after it is spent. Fiber is a better established candidate for recurring micropayments when a channel route/liquidity is available. Liquid Cells is the primary pooled-claim comparator. Pinned contract and test sources describe proof inclusion, leaf nullification, an owner-derived canonical payout lock, a 180-epoch silence gate and checkpoint-witness DA reconstruction; 24 upstream CKB-VM tests passed with a locally built RISC-V binary and checksum-pinned Zig adapter. The adapter differs from upstream CI clang, and no private devnet exit was run. The project remains publisher-described pre-alpha/testnet and unaudited. Below roughly 61 CKB, unilateral standalone exit is unavailable; the proposed swap/Fiber path needs counterparty liquidity. Reuse/reproduce before inventing another vault.

| Architecture | Technical decision | Commercial decision |
|---|---|---|
| Existing-cell whole-body swap | ADVANCE as spot fallback | UNPROVED advantage vs OTX/maker/RFQ |
| Existing E1 funded note | ADVANCE as independent claim fallback | UNPROVED; capacity limits small position |
| Root/bitmap pool | REVISE; Liquid Cells' pinned design is the strongest reviewed prototype, with 24/24 CKB-VM suites passing under the disclosed RISC-V adapter | UNPROVED pending private-chain DA reconstruction, real timeout exit, capacity/fee and concurrency tests |
| Fiber/Perun/Myelin | REUSE/reproduce applicable existing systems | UNPROVED access/route/lifecycle cost for target users |
| New generic rollup | STOP for now; better reuse candidates exist | UNPROVED |

## Answers to the first decision questions

An on-chain order Cell is not necessary for a one-shot whole-body bilateral spot trade. The best executed baseline is a signed atomic transaction over existing wallet and asset Cells. It costs a normal transaction fee, VM cycles, bytes, signature coordination and existing asset-cell capacity; exact fee is unmeasured. Tiny financial principal can be represented off chain or inside a pooled system, but standalone L1 output/independent exit cannot avoid the occupied-capacity boundary by naming a Merkle root. Collateral funds financial claims; sponsor or existing recipient funds output capacity. Near-empty roots have fee/last-holder risks; root-mutating concurrent exits conflict. Sharding reduces unrelated conflicts but not same-shard contention.

Current permitted work does not establish a new independent pooled exit. Pinned-source review narrows the missing test: run Liquid Cells’ force-exit CKB-VM suite, then reconstruct and exit from published DA on disposable private devnet. Fiber may be better for repeated tiny transfers if channels/liquidity/routes exist; Liquid Cells is the strongest reviewed general pooled-claim candidate but retains the tiny unilateral payout floor and shared-anchor serialization. Static commitments and accumulators remain hypotheses. The E2 unexpected finding is that Trade's spot order workflow needs no exchange-specific persistent order Cell when full body is signed at fill time.

All $1/$10/$100 CKB valuations are in the capacity model and are only stress arithmetic. Financial product demand, ACP semantics, concurrent pooled exit, authenticated recovery and production security remain unproved. E1 beneficiary validation and general recovery/LO-01 remain unresolved.

## Next decision-changing experiment

Build pinned Liquid Cells source and run its published CKB-VM force-exit suite, then reproduce a deposit and force exit on private devnet from archived checkpoint DA; attack operator data loss, two simultaneous claims, last exit, duplicate/nullifier, missing fee sponsor and reorg. Compare exact total capital/fees/cycles with E1 claims and per-shard immutable/bitmap sketches. If upstream already meets the customer requirements, reuse it.

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
10. **Operator-free recovery?** The pinned Liquid force-exit script passed CKB-VM tests for an owner-derived payout after the 180-epoch silence gate when a standalone payout is possible. Trade has not yet reconstructed a live chain exit from archived DA or submitted it on private devnet.
11. **No private indexer?** The upstream host STF suite passes DA reconstruction from checkpoint blobs, and the CKB-VM contract binds the exit proof to the root. Full independent retrieval/reconstruction from a CKB archival node and private-chain exit remain untested here.
12. **Concurrent exits?** Distinct spot wallet Cells can be independent; pooled Liquid exits consume one shared anchor and therefore conflict. No multi-exit/retry benchmark was run.
13. **Is sharding better?** Only for cross-shard independence. It adds roots/coordination and leaves same-shard contention.
14. **Immutable commitment better?** It avoids mutation until the first exit, then duplicate payment requires consumed state or unique user output; model only.
15. **Cell reuse/ACP?** Existing compatible cell reuse is mechanically demonstrated for swap. ACP remains unpinned/unexecuted; either way output storage still needs capacity.
16. **No funded Cell?** A sponsor or faucet must fund onboarding; user can't create an ordinary spendable output from sub-minimum principal alone.
17. **Fiber better?** It may serve repeated tiny routed payments when channels/liquidity exist; no route tested. Liquid Cells is closer for pooled collateral claims but its sub-floor exit still depends on swap/Fiber liquidity.
18. **Most prior art solved?** Liquid Cells most directly targets pooled claims and passed upstream STF plus CKB-VM tests here; Fiber/Perun address channel payments; OTX addresses fragment authorization.
19. **Prior-art gap?** The current gap is empirical integration: private-chain publication identity, archived-DA reconstruction, real epoch timeout, small-balance liveness, concurrency, and total fees/capacity. No defect in Liquid Cells has been demonstrated by this E2 work.
20. **New architecture discovered?** For spot, separate intent from asset state: sign a complete transaction only at fill and reuse all four Cells. This is a bounded pattern, not a new protocol.
21. **Native survivor?** Four-cell xUDT/CKB complete-fill swap.
22. **Exact improvement?** Zero added persistent Cells over its four existing inputs/outputs, with owners' wallets and balances replaced one-for-one.
23. **Which market benefits?** Occasional spot/RFQ complete fills. No evidence yet for pooled claims.
24. **At $1/$10/$100 CKB?** No new exchange Cell remains zero at every valuation; existing61-Ckb wallet capital is worth $61/$610/$6100. Dollar position and fee economics change.
25. **Trust/liveness sacrificed?** No fill while intent is off chain; inputs may be spent; whole-body owners must sign. No independent matching or partial fill.
26. **Better existing platform?** CoBuild for flexible OTX; Fiber for tiny repeated payments with route liquidity; Liquid Cells for pooled microclaims. Exact usable cost not benchmarked.
27. **Technical gaps?** OTX integration, partial fills, ACP, sponsorless entrants, Liquid private-chain deposit/DA reconstruction/real-timeout exit, simultaneous/final exits, channel closure/reorg and general authenticated recovery.
28. **Commercial gaps?** Users, compatible asset owners, routes, maker quotes, willingness-to-pay and lifecycle fee/access estimates.
29. **Higher-ceiling alternative?** Reproduce Liquid Cells on private devnet from archived DA, including operator-data-loss and concurrent/last exits; then compare a fixed cohort/bitmap only if it improves that tested baseline.
30. **Build next?** A measured independent-exit benchmark on the strongest existing pooled system, not a new generic rollup.

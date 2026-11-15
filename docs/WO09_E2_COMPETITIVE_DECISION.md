# E2 competitive decision — checkpoint 1

## Current result

The strongest execution results are the ordinary complete-fill spot settlement using only existing wallet/asset Cells and a bounded Liquid Cells private-devnet lifecycle. The spot fill added zero persistent Cells across four inputs/four outputs. The pooled comparator now commits a real genesis deposit, Groth16 checkpoint and owner exit after 180 private-chain epochs. Trade can retain both as fallbacks. Existing CoBuild OTX remains stronger for flexible signed ranges; no OTX integration or equivalent-workload performance comparison exists.

This is not a universal market architecture. An entrant needs funded Cells; an exit output needs capacity; a valid whole-body signature cannot reserve an input after it is spent. Fiber is a better established candidate for recurring micropayments when a channel route/liquidity is available. Liquid Cells is the primary pooled-claim comparator. Its pinned source now has 24 upstream CKB-VM cases and one actual private-devnet deposit/checkpoint/180-epoch force exit, including rejection of tampered DA, early exit, and wrong payout. The successful node run requires an isolated single-hart patch to `bytes 1.11.1`; the unmodified binary failed with an A-extension `InvalidInstruction` on CKB 0.210.0. The patch is experimental, not an upstream correction. The project remains publisher-described pre-alpha/testnet and unaudited. The tested account balance was 99.99899 CKB; below roughly 61 CKB a unilateral standalone exit remains unavailable, and the proposed swap/Fiber path needs counterparty liquidity. Reuse/reproduce before inventing another vault.

| Architecture | Technical decision | Commercial decision |
|---|---|---|
| Existing-cell whole-body swap | ADVANCE as spot fallback | UNPROVED advantage vs OTX/maker/RFQ |
| Existing E1 funded note | ADVANCE as independent claim fallback | UNPROVED; capacity limits small position |
| Root/bitmap pool | REVISE; Liquid Cells is the strongest reviewed pooled-claim prototype; its exact single-hart variant passes 24 CKB-VM cases and one private-devnet lifecycle, including fresh-process proof reconstruction from the committed transaction via live RPC | UNPROVED for archival DA retrieval, RPC outage, operator/database loss, full history replay, competing exits, sub-floor balances, economics, and the unmodified upstream binary on CKB 0.210 |
| Fiber/Perun/Myelin | REUSE/reproduce applicable existing systems | UNPROVED access/route/lifecycle cost for target users |
| New generic rollup | STOP for now; better reuse candidates exist | UNPROVED |

## Answers to the first decision questions

An on-chain order Cell is not necessary for a one-shot whole-body bilateral spot trade. The best executed baseline is a signed atomic transaction over existing wallet and asset Cells. It costs a normal transaction fee, VM cycles, bytes, signature coordination and existing asset-cell capacity; exact fee is unmeasured. Tiny financial principal can be represented off chain or inside a pooled system, but standalone L1 output/independent exit cannot avoid the occupied-capacity boundary by naming a Merkle root. Collateral funds financial claims; sponsor or existing recipient funds output capacity. Near-empty roots have fee/last-holder risks; root-mutating concurrent exits conflict. Sharding reduces unrelated conflicts but not same-shard contention.

The private-devnet test establishes one owner exit after a fresh child process fetched the committed checkpoint transaction from live local CKB RPC and rebuilt the proof from its published DA. It does not establish archival RPC availability, recovery during RPC outage, complete history replay, or operator/database-loss recovery. Fiber may be better for repeated tiny transfers if channels/liquidity/routes exist; Liquid Cells remains the strongest reviewed general pooled-claim candidate but retains the tiny unilateral payout floor and shared-anchor serialization. Static commitments and accumulators remain hypotheses. The E2 unexpected finding is that Trade's spot order workflow needs no exchange-specific persistent order Cell when full body is signed at fill time.

All $1/$10/$100 CKB valuations are in the capacity model and are only stress arithmetic. Financial product demand, ACP semantics, concurrent pooled exit, authenticated recovery and production security remain unproved. E1 beneficiary validation and general recovery/LO-01 remain unresolved.

## Next decision-changing experiment

Start from a fresh process with no pinned fixture or sequencer state, retrieve the committed anchor and DA witness data through archival private-chain RPC, replay history and verify the owner proof against the live root. Then create a second owner and test two exits, same-anchor conflict/retry, and a last exit after the actual silence window. Include a deliberate missing-DA record and compare the rebuilt root against the live anchor. Only after those pass should we compare capital, fees and cycles against E1 claims and per-shard/static-cohort models. Keep the single-hart build limitation explicit.

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
10. **Operator-free recovery?** The original owner-locked run does not prove independent recovery. Paired CKB 0.210.0 tests show a mature user-only exit fails at an operator secp anchor lock (error -2), while a permissionless anchor lock lets an independent fee-paying user submit the proof-backed exit without the operator signature. The proof was reconstructed from committed live-RPC DA. Full history replay, multi-owner exits, operator/database loss and small-value payout remain untested; see `WO09_E2_ANCHOR_LOCK_RECOVERY.md`.
11. **No private indexer?** A fresh child process fetched a committed checkpoint transaction through live local CKB RPC and reconstructed a depth-256 proof from its published DA; the proof executed on private devnet and its root matched the live anchor. Archival retrieval and complete checkpoint-history replay remain untested.
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
27. **Technical gaps?** OTX integration, partial fills, ACP, sponsorless entrants, cold chain-only Liquid DA reconstruction, multi/last exits, sub-floor egress, channel closure/reorg, upstream native ISA compatibility and general authenticated recovery.
28. **Commercial gaps?** Users, compatible asset owners, routes, maker quotes, willingness-to-pay and lifecycle fee/access estimates.
29. **Higher-ceiling alternative?** Retrieve and replay complete Liquid Cells checkpoint history from archival RPC in a fresh environment with no fixture/indexer data, then test two owners and a last exit. Compare a fixed cohort/bitmap only if it improves that measured baseline.
30. **Build next?** A chain-only DA recovery and multi-exit benchmark on the strongest existing pooled system, while independently resolving the upstream no-A build compatibility. Do not claim commercial advantage from the current lifecycle.

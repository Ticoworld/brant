> Historical pre-integration report. Subsequent verified financial Merkle native results and current decision are in [WO09_MASTER_MERKLE_DECISION.md](WO09_MASTER_MERKLE_DECISION.md). Earlier statements that this complete Merkle workload is unproved describe that earlier checkpoint.

# WO09 master bounded implementation status

Product classification: END-TO-END RESEARCH DEMONSTRATION for a fixed three-owner, existing-wallet financing cohort; not a complete production financial market. Broader architecture comparison and commercial selection remain incomplete.

1. Groth16: absent from executed direct financial variants; not claimed unnecessary for arbitrary off-chain execution.
2. Operator signatures: no privileged checkpoint operator; ordinary creator/buyer/holder wallet signatures remain.
3. Redemption: current owners independently submit under fixed financial terms, with their funded wallet and chain access.
4. Dependencies: explicit variant needs live Cell data; snapshot needs current transaction witness. Local validating-node RPC, data availability and wallet signing remain. No private indexer/prover is used in tested recovery.
5. Enrollment: individually signed native contributions create no dedicated persistent claim Cells.
6. Wallet capacity: participants must own suitable funded Cells; creator setup in fixture is separately funded by Alice.
7. Shared state: 378 CKB explicit or 170 CKB snapshot, plus code publication and backing.
8. Authentication: validated enrollment and transitions; full explicit records or authenticated old/new snapshots. Fresh processes reconstruct tested current state.
9. Transfer: native atomic seller/buyer payment with both signatures.
10. Stale seller: cannot redeem the assigned right in tested case; new owner can.
11. Tiny claims: initial 0.1/1 CKB rights are legitimately funded; 0.05 partial and purchased residual plus full 1 CKB redemption executed with wallet merging. Standalone no-wallet payout not implemented.
12. Self-paid fees: executed natively in the new covenant, independently of earlier E3 VM results. v2 prevents reducing prior recipient principal.
13. Contention: stale shared-vault transaction rejects; rebuild/current-state redemption succeeds. No throughput or anti-starvation guarantee.
14. Final exit: liabilities reach zero; designated funder, not final claimant, receives cushion.
15. Creator funds: 25.275 CKB gross is released; 101.1 CKB stays backing in the tested configuration.
16. Solvency: checked after every accepted transition and by offline native evidence verification.
17. Ratchet: general floor increase not implemented. Model rejects unfunded increases; fixed floor retained.
18. Size/cycles: explicit v2 15,176 bytes; snapshot 15,424. Redemption roughly 1.73/1.80M cycles including secp and both covenant roles. See economics report.
19. Capital comparison: snapshot storage amortizes versus individual claims only with sufficient reuse; cold deployment can cost more. Merkle/bitmap tests are kernels, not full rivals.
20. UX: no current Merkle proof needed for tested variants; existing-wallet and shared-input rebuilding requirements remain.
21. Rivals: independent Cells avoid shared contention; Liquid Cells batches off-chain execution; simple financing avoids protocol complexity; CoBuild provides authorization flexibility not implemented here.
22. Technical unknowns: general cohorts, full financial Merkle/bitmap versions, external security review, reorg/archive failures, wallet integration, standalone payout and full stress testing.
23. Commercial unknowns: issuer demand, buyer preference, liquidity and actual service economics.
24. Demonstrated contribution: direct on-chain funded financing/paid-right-assignment lifecycle with two public-state representations and tiny existing-wallet redemption. No broad cryptographic novelty claim.
25. Flagship: insufficient commercial/security evidence to select a flagship product.
26. Decision: stop global explicit-array scaling; freeze bounded working variants. Next justified gate is realistic usage/capital/data-availability requirements before investing in a complete optimized financial Merkle variant.
27. Git: exact checkpoint SHAs are recorded by verified non-force pushes in the execution history. Protected refs remain untouched; no PR or public deployment.

Technical: ADVANCE for bounded financial lifecycle; REVISE global/high-volume representation. Commercial: UNPROVED. These qualifications are intentional; passing a native lifecycle does not settle the product question.

Additional qualifications: maturity was subsequently executed at block 100 with real waiting and early-consensus/script rejections; pre-activation refund was exercised. Two distinct native markets' enrollment transactions committed in the same block, with independent refunds/closures. Total run count across preserved new native directories is 76 committed transactions (12 v1 + 12 v2 + 12 snapshot + 14 maturity + 17 kernels + 9 independent markets); their rights/workloads are explicitly different. This number is not a security score.

Stopping decision is comparative: do not extend the explicit-array architecture as a global vault, and do not select this cold-deployment prototype as a flagship. Preserve bounded implementations and evidence. A full financial Merkle/bitmap rival and customer-relevant large-cohort qualification are still research tasks, not completed gates or proven-impossible mechanisms.

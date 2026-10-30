# The next experiment must build the consistency mechanism

Do not build an order book, SDK or trading frontend. The goal is one independently recoverable native CKB/EVM session whose external payout can follow only the unique sealed portfolio outcome.

## Construction gate

First inspect and pin a complete supported multi-ledger protocol and its exact security assumptions. The four Perun files reviewed here are insufficient to approve or reject the complete protocol. If its full construction already provides the necessary cross-ledger consistency, use that construction rather than invent an incompatible derivative. Reproduce withheld-signature and skewed-close schedules against its actual contracts and client behavior.

Otherwise specify an anchor/follower protocol. Compare CKB-to-EVM and EVM-to-CKB authenticated proof costs before selecting the anchor. Do not silently substitute a committee, TEE or trusted RPC for consensus proof verification. A trusted control is useful only if labeled as such.

## Bounded build

1. Implement a genuine CKB funded session and native test-token EVM vault. Bind funding outpoints/addresses, exact amounts, recipients, chain identities and session uniqueness.
2. Implement anchor registration, newer-state challenge and a unique sealed outcome. No opaque current-time assumptions. Test source-script conservation and fee sponsorship.
3. Implement one actual foreign proof path. Start from a documented checkpoint and consensus/finality rule. A fixture receipt with an always-true verifier does not pass.
4. Execute at least 100 alternating signed updates using independently retained states, with no per-fill chain writes, then force settlement from a different process with the coordinator removed.
5. Repeat withheld last signature, withheld pending proposals, early old-state dispute, late new-state publication, skewed chain progress, proof withholding, proof replay, wrong recipients and wrong session.
6. Measure maximum independently fundable obligations, local bytes/cycles, EVM funding/close/proof gas, permissionless relay fee requirements and time-to-usable-assets under stated chain schedules.

## Pass/fail gates

A mixed allocation is a safety failure. With a sound finalized outcome and progress/relay bounds, inability to release the matching foreign allocation is a liveness failure. A committee-only implementation fails the no-mandatory-trusted-operator objective even if every honest-path test passes. Recovery requiring a missing secret/database fails independent recoverability. A customer quote that can be exercised after the UI says it expired fails truthful execution semantics.

Production readiness requires much more than these gates. They are enough to decide whether the mechanism deserves the next engineering investment.

## Commercial gate

Reprice live hedge books and obtain independently verifiable delivered-route quotes without contacting outside parties or spending assets. Compare one-off conversion and repeated-session trading separately. Model opposing flow, one-way depletion, maker switching, funding abandonment, disputes and tail capital occupancy. Count proof/relay cost and rebalancing. Do not reuse WO02 prices as live or score a breakthrough from amortized gas alone.

Stop the channel branch if native consistency or proof costs make its actual customer job inferior to competitive escrow delivery. Keep it alive if repeated balanced volume can amortize safe exits and customers have a reason to retain funded sessions. A different verdict from WO02 is earned by evidence, not by novelty.

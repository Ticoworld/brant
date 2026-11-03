# WO09 master first principles

Research hypothesis: protected creator participation denominated in CKB, with fixed explicitly funded rights and a stated creator funding fraction. Commercial need remains unproved. This avoids a price oracle for a native CKB floor, but cannot promise a USD or launched-token price floor.

Liquid Cells uses Groth16 to validate arbitrary off-chain batches succinctly. Moving every market transition on-chain can permit direct validation of a much narrower state machine; it also loses off-chain batch throughput. Removing the prover does not remove chain fees, data publication, wallet capacity, contention, archival availability or security review.

A root authenticates claims only when formation and every update are validated. A small directly stored cohort is a stronger initial rival than a global root for a three-person proof: explicit records permit full sum/ownership checking and remove proof freshness machinery, at a marginal on-cell byte/capacity cost. Direct arrays do not automatically scale to 1,000 participants economically.

An immutable entitlement root plus spent bitmap is another rival: stable membership proofs after unrelated redemption, but 1,000 claims need 125 bitmap bytes, ownership transfer needs additional authenticated state, and partial redemption needs amount tracking or granular rights. It is not a drop-in replacement for mutable transferable balances.

Independent funded claim Cells remain a strong contention/ownership rival. Liquid Cells retains throughput advantages when proving and cooperative inclusion are available. Simple staged escrow or cash retention plus an at-risk grant may beat a complex protected launch commercially. Whole-body atomic spot settlement is useful prior art but not an equivalent long-lived financial right.

Gate order: exact liabilities and cushion ownership; valid formation; smallest direct state transitions; public replay; independent authorization; native lifecycle; contention/cohort comparison; economic and customer decision. No gate is passed merely because this specification runs.

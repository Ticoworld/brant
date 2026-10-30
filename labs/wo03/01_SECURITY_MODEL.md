# WO03: atomic portfolio-channel frontier

Scope: one bounded follow-up to WO02. This specification precedes new contract code. Preserve WO01 and WO02. No real money or public deployment.

## Question and baseline

Can two independently adjudicated legs safely reuse funded inventory for signed portfolio swaps? Start with the strongest simple baseline: each signature binds the *entire* allocation vector, session, both participants, both asset identities and both adjudicator identities through a common context commitment. Both signatures are needed for every state. Each leg accepts increasing versions and gives a monitoring participant a dispute window. The experimental contract deliberately models only settlement after funding, not a complete production channel.

State S_v=(context,v,x,y). x is Alice's allocation of asset X, y her allocation of asset Y; Bob gets the residual totals. Conservation and range checks apply. S0=(50,50), S1=(40,60), S2=(60,40) over totals100 on each leg. These are arbitrary units, not CKB exchange rates. Alice sends her signature first; Bob may countersign privately. Reversing signing order must also be analyzed. No claim of a Perun vulnerability follows from testing this independent baseline.

## Safety and availability

The desired narrow property is consistent final projection: if both legs close, they must project the same authorized portfolio state. Any mixed result must be reported, even if the modeled scalar valuation happens to hide its economic effect. Principal safety also requires an authorized exchange or restoration, not merely conservation on each chain.

A signature held by Bob is usable by Bob, even if Alice never received it. Local wallet acceptance and on-chain enforceability differ. An acknowledgement alone cannot revoke a previously enforceable certificate. Honest Alice stops signing after observing any close request. That does not erase certificates signed earlier.

Baseline states: funded -> disputing(version,deadline) -> final(version). Valid newer signed states may replace a disputed version before deadline; variants retain or restart deadline. Final is irreversible in the no-reorg abstraction. No arbitrary stalls or reorg safety is claimed.

## Candidate repairs

R1: restart challenge period on every newer state. This improves response opportunity on that leg but does not bind a hidden certificate's use on a second leg after the first has finalized.

R2: one designated adjudication anchor seals an outcome. Other legs release only against authenticated evidence of that *sealed* outcome for the exact session, never a mere pair of participant signatures. Proof must bind anchor identity, finality, full state and session/asset/recipient identities. No independent timed refund on a follower is safe if it can contradict a later valid anchor outcome. Under anchor progress, finality, sound proof verification, preserved data and funded relay-fee assumptions, followers eventually deliver the same projection. Without proof availability, safety may hold while liveness fails.

For an executable control, a follower can verify a designated test attestor's signature. This is explicitly TRUSTED and not a solution to the no-mandatory-trusted-operator objective. A false attestation is a required attack. A real CKB/EVM finality verifier is not implemented by pretending an attestor is a proof system.

## Test level

Finite enumeration tests the transition abstraction. Real Solidity tests enforce signatures, conservation, deadlines, finality of local contract state and token movements. Two adjudicators in one isolated EVM runtime suffice to execute the staggered-close counterexample; they do NOT measure independent-chain timing, CKB script behavior, network reorg probabilities or CKB channel costs. WO02 remains the evidence for native CKB execution. No WO02 throughput tests need repeating.

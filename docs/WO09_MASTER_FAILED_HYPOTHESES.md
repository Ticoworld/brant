# Negative findings and revised assumptions

1. A global aggregate floor cannot substitute for the sum of individually rounded promises. The integer model retains an explicit counterexample.
2. Protected backing is not spendable creator funding. Native transactions enforce 126.375 CKB = 101.1 backing + 25.275 gross proceeds; cushion and wallet setup are separate.
3. A small signature-authorized payout can be net-negative if the fee cap is larger than the claim. Version 2 rejects reducing the existing recipient wallet principal. Version 1 is preserved, not falsely described as an unauthorized-withdrawal exploit.
4. A Merkle root is not automatically the best first direct covenant. Explicit records validated the financial semantics with no proving dependency. A simpler full-snapshot commitment then demonstrated reduced live state while preserving those financial checks.
5. Full-snapshot commitment does not eliminate data availability: it moves public state to transaction witnesses. Access to the latest witness must remain available. The explicit cohort instead carries it in live Cell data.
6. Immutable-root membership proofs remain stable after unrelated redemption, but a spent bitmap alone cannot express arbitrary paid ownership transfer and partial balances. Root-kernel tests do not qualify those financial rights.
7. Fewer state bytes need not mean less total locked CKB for a cold deployment: the snapshot binary is larger. At one three-person cohort it consumes 40 CKB more combined code+vault capacity than explicit v2; reuse changes that comparison.
8. No dedicated claim Cell does not mean a customer needs no funded Cell. Existing-wallet merging remains conditional on destination capacity and fees.
9. Native success establishes feasibility, not commercially useful creator finance or a liquid market. No external issuer/customer/buyer commitment or quote was invented.

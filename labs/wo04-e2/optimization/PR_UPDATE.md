Additional E2A milestone: canonical affine BLS witnesses, simultaneous Miller pairing, and authenticated missing-signer subtraction.

Production CKB-VM/node results:
- Genuine 512/512: 62,530,288 cycles, 1,911 transaction bytes.
- Genuine 511/512: 65,113,103 cycles, 2,345 transaction bytes.
- Genuine 510/512: 67,603,211 cycles, 2,779 transaction bytes.

All three were accepted and committed on isolated CKB v0.210.0 nodes with the unchanged 70-million policy. 78 debugger outcomes passed, including 60 invalid cases, canonical on-curve/non-subgroup signature rejection and wrong-message pairing rejection. The fallback and earlier evidence are unchanged.

A separate bootstrap-authenticated immutable committee certificate passed construction (2,533,936 cycles), repeated read-only reuse (27,347 cycles each), forgery and mutation rejection. It is not a staged finality proof and does not authorize rotation or payouts.

Full on-chain trust-state rotation, live weak subjectivity/fork policy, and E1 publisher identity remain incomplete. Partial-verifier contexts retain the prior host-reference-authenticated boundary. No two-transaction BLS split, succinct proof, 45-million-cycle result or complete production authentication is claimed.

Details: labs/wo04-e2/optimization/README.md and docs/E2_FINALITY_PROGRESS.md. Reproduce with optimization/src/reproduce.sh.

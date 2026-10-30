This adds executable historical Ethereum mainnet Capella finality verification and a measured CKB-VM root-binding harness under labs/wo04-e2. E1 previously consumed a controller-selected root at boot+32; the new code validates a fixed-checkpoint bootstrap, committee transitions, mainnet-domain BLS signatures, finality proofs and execution-header binding on the host, then exercises the single-committee predicate and E1-format output binding in CKB-VM.

The draft is deliberately incomplete: CKB bootstrap/committee rotation and persistent replay/fork state are not implemented. The VM context is pinned from a host-verified fixture sequence. It is not a production root publisher or a demonstrated E1 principal payout.

Validation:
- Eight reference test methods passed, including eleven invalid-update mutations; seven captured mainnet updates verified.
- General BLS path exceeded a 3.5-billion-cycle cap; 64-bit portable arithmetic reduced it to about 1.52 billion cycles.
- Full-participation aggregate-key path passed at 69,703,714 cycles, with subgroup checks retained in blst's core verifier; any missing participation bit is rejected.
- Six debugger transaction cases per witness format observed the expected pass/rejection outcomes.
- Compact transaction: 1,622 bytes, including a 1,272-byte witness. It was accepted and committed on an isolated loopback CKB v0.210.0 devnet with a 70-million tx-verification policy. Only 296,286 cycles of that policy remain.
- Empirical general-path stack watermark: 50,672 bytes; exact peak total memory remains unmeasured.
- All 200 migration manifest records remain unchanged.

See docs/E2_FINALITY_PROGRESS.md for trust assumptions, precise implementation boundaries, evidence and next engineering steps. No public deployment, real funds, historical-lab changes or main merge.

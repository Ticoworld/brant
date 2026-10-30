# E1 progress

Stage0 COMPLETE: recovered Library status/security specification and archive; CRC/all233 checksum entries passed. Prior WO04 unchanged. Separate workspace and preimplementation invariants written.

Current limitation: canonical external root authentication is missing. Selected experiment is real EVM outcome execution and CKB execution/storage-proof verification relative to explicit immutable test checkpoints.

Next command: python3 src/build.py, then python3 src/launch.py. These commands will be added with the implementation. No prior WO04 test is repeated.

2026-10-30T08:25:53.180Z Stage1: contracts compiled and isolated nodes deployed
Observed records saved: 2 transactions, 0 cases.
Limitations: No foreign consensus authentication
Next: Execute exact delivery and expired-unfilled source states

2026-10-30T08:25:56.330Z Stage2: four reserved trades reached actual EVM terminal states; real eth_getProof evidence obtained
Observed records saved: 27 transactions, 9 cases.
Limitations: Execution proof root is not yet authenticated by consensus
Next: Publish explicit bootstrap and run CKB proof verifier

2026-10-30T08:25:56.811Z Stage3: native checkpoint creation verified real EVM account/storage proof
Observed records saved: 29 transactions, 13 cases.
Limitations: Only relative to controller-selected bootstrap; no consensus finality proof
Next: Test immutable checkpoint and independent settlements

2026-10-30T08:25:59.028Z Stage4 COMPLETE: real shared and direct native payout/refund, separate recovery, defensive cases executed
Observed records saved: 34 transactions, 25 cases.
Limitations: Root finality/bootstrap authenticity remains critical; fixed fees and permanent checkpoint capacity remain
Next: Offline verify records, measure costs, write E1 decision

2026-10-30T08:31:26.158Z Stage1: contracts compiled and isolated nodes deployed
Observed records saved: 2 transactions, 0 cases.
Limitations: No foreign consensus authentication
Next: Execute exact delivery and expired-unfilled source states

2026-10-30T08:31:29.623Z Stage2: four reserved trades reached actual EVM terminal states; real eth_getProof evidence obtained
Observed records saved: 29 transactions, 11 cases.
Limitations: Execution proof root is not yet authenticated by consensus
Next: Publish explicit bootstrap and run CKB proof verifier

2026-10-30T08:31:30.063Z Stage3: native checkpoint creation verified real EVM account/storage proof
Observed records saved: 31 transactions, 15 cases.
Limitations: Only relative to controller-selected bootstrap; no consensus finality proof
Next: Test immutable checkpoint and independent settlements

2026-10-30T08:31:32.991Z Stage4 COMPLETE: real shared and direct native payout/refund, separate recovery, defensive cases executed
Observed records saved: 36 transactions, 30 cases.
Limitations: Root finality/bootstrap authenticity remains critical; fixed fees and permanent checkpoint capacity remain
Next: Offline verify records, measure costs, write E1 decision

2026-10-30T08:35:53.184Z Stage1: contracts compiled and isolated nodes deployed
Observed records saved: 2 transactions, 0 cases.
Limitations: No foreign consensus authentication
Next: Execute exact delivery and expired-unfilled source states

2026-10-30T08:35:56.707Z Stage2: four reserved trades reached actual EVM terminal states; real eth_getProof evidence obtained
Observed records saved: 29 transactions, 11 cases.
Limitations: Execution proof root is not yet authenticated by consensus
Next: Publish explicit bootstrap and run CKB proof verifier

2026-10-30T08:35:57.165Z Stage3: native checkpoint creation verified real EVM account/storage proof
Observed records saved: 31 transactions, 15 cases.
Limitations: Only relative to controller-selected bootstrap; no consensus finality proof
Next: Test immutable checkpoint and independent settlements

2026-10-30T08:36:00.343Z Stage4 COMPLETE: real shared and direct native payout/refund, separate recovery, defensive cases executed
Observed records saved: 36 transactions, 30 cases.
Limitations: Root finality/bootstrap authenticity remains critical; fixed fees and permanent checkpoint capacity remain
Next: Offline verify records, measure costs, write E1 decision

Final assessment stage COMPLETE: all seven requested reports exist. The final controlled ERC-20 run contains12 committed CKB transactions,24 EVM receipts and30 case records. Four terminal trades settled; one OPEN trade remains reserved during source unavailability. Offline independent MPT/hash/terms/payout checks passed. Both terminal token transfers were cross-checked from receipt logs. Prior WO04's233 checksum entries still match.

Decision: PARTIAL MECHANISM, CRITICAL PROOF REMAINING. No foreign consensus/finality verifier or verified root advancement is implemented. Smaller proof-consumption costs do not close that boundary or establish a trading business.

Reproduction: follow02_REAL_CHAIN_IMPLEMENTATION.md on a fresh COPY. Historical E1 runs are retained under historical/ and are not added to the final-run counts. No prior WO01–WO04 run was restarted.

Next engineering predicate: authenticate a real finalized execution stateRoot from a pinned light-client bootstrap/update, then connect that accepted root to the existing direct/checkpoint execution-proof interface. Archive creation and CRC/SHA256 validation are performed by src/package.py; delivery-index.json records the resulting archive identities outside the ZIPs.

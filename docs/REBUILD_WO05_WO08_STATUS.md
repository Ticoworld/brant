# Rebuild WO05–WO08 status — 2026-11-01

Base VERIFIED: origin/main ce7f27ec0d6657645e3198b0ea6a5831171003d0. Branch rebuild/wo05-wo08. No main push, force push, merge, PR or public deployment. WO01–WO04 labs byte-identical; no Ayrvo edits. Root .gitignore was deliberately extended; it is the only migration-checksum difference.

| Checkpoint | New evidence | Status |
|---|---|---|
| A | Genuine wallet signing, funded CKB/xUDT, partial/full fills, direct payouts, lineage, separate-process recovery | REPRODUCED |
| B | Two-owner atomic netting, 2/8/32 full-fill upstream batches, serial/shared comparison, lower-bound commitment and late fill; six synthetic launch counterexamples | REPRODUCED, bounded workload |
| C | Exact depth/fee/UNKNOWN import and inventory ledgers, quote expiry source review; active gate revocation classified historical | REPRODUCED offline / historical gate |
| D | Published-contract DAO deposit, receipt conversion, iCKB sale, independent successor recovery, burn/request, genuine mature withdrawal and subsequent spend | REPRODUCED |

Canonical run run-1793541730590: 76 commits, 18 expected rejections; offline CCC/SDK/raw consistency PASS. Historical source objects were not recovered or invented. Counts differ intentionally. Fresh GitHub-clone reproduction is the final outstanding readiness check.

Remotely verified backups so far: A e91c86831fa5a7a6efb1bf290bd12c212cbefa8f; B 1766012edb80a4338858cf12538c6d48114be352; C 3f1937e70469a4565a4031e9be5b75f4a9b3c201. C was committed while D changes were in progress; its worktree was therefore not clean. That procedural exception is recorded explicitly; D preservation must close it with a clean tree.

Not rebuilt: failed bonding curve, compact C matching engine/hybrid, optional gate covenant, historic maximum-batch/2-MiB heap variant and frozen WO04 cross-chain continuation. No omitted optional mechanism is claimed as newly reproduced. Source-to-release-binary build equivalence is still independently unproved; release bytes, hashes and runtime execution are verified.

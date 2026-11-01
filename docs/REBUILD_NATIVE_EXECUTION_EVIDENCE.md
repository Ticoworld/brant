# Native evidence

Checkpoint A: labs/rebuild/native/evidence/run-1793541179061. events.json contains five newly committed transactions with raw transaction, cycle estimate, byte count and node commitment response. cases.json contains five VM rejections: incorrect issuer signature, underpaid order, xUDT inflation, rewritten master lineage and wrong recovery key. recovery-package.json is consumed by a fresh recover.cjs process, with no coordinator memory.

The first failed run exposed a dependency RPC encoding error (depGroup vs dep_group); it is retained and corrected. Completed runs require complete.json. No assertion-only substitutes for native spends.

Checkpoint B complete: run-1793541393279. batch-metrics.json gives exact cycles/bytes for 2,8,32 (partial-fill workload); commitment.json gives actual deadline and late fill block. Published upstream 34,200-byte A2 is unchanged. Batching amortizes script overhead; this is a bounded native baseline, not reproduction of the historic 1,536 full-fill optimized limit. Extra owner lock bytes require 8 occupied CKB, and a wrong multisig configuration encoding initially failed authorization; both failures remain in prior raw runs. Fixed by correct capacity and SDK-required 0x-prefixed blake160 identity.

Raw RPC streams are losslessly gzip-compressed for Git. They include actual errors, admission and commitment responses.

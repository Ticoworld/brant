# Native evidence

Checkpoint A: labs/rebuild/native/evidence/run-1793541179061. events.json contains five newly committed transactions with raw transaction, cycle estimate, byte count and node commitment response. cases.json contains five VM rejections: incorrect issuer signature, underpaid order, xUDT inflation, rewritten master lineage and wrong recovery key. recovery-package.json is consumed by a fresh recover.cjs process, with no coordinator memory.

The first failed run exposed a dependency RPC encoding error (depGroup vs dep_group); it is retained and corrected. Completed runs require complete.json. No assertion-only substitutes for native spends.

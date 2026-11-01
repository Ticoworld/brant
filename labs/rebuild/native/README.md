# Isolated native rebuild

Only private disposable chains. Public fixture scalars 1,2,3 must never hold real assets.

`npm ci --ignore-scripts && npm test` runs a fresh private chain on localhost:19224 and records a new evidence directory. Set CKB_BIN to official CKB 0.210.0. Default uses the previously installed WO04 tool without modifying WO04. All source and evidence here are new; historical reports remain separate.

Pinned source/binary hashes: vendor/ickb/PROVENANCE.json. MIT license retained. Published binaries are executed directly; source-to-binary reproducibility is not yet independently established. CCC 1.23.0 and CKB SDK 0.109.5 are locked by package-lock.json. CKB release archive: SHA256 68a94c191109bae172f8dcb71828dbdf0383e2c314e0658743db217472b27bdf (official v0.210.0 Linux x86_64).

Each evidence run retains raw JSON-RPC, serialized signed transactions, node commitment responses, script cycle estimates, exact bytes, generated chain specification and cases. Fixed 0.01 CKB fees are fixtures, not market observations. Failed runs are retained as debugging evidence. Never count their partial events as a completed checkpoint.

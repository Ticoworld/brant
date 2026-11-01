# Isolated native rebuild

Only private disposable chains. Public fixture scalars 1,2,3 must never hold real assets.

`python3 src/bootstrap.py && npm ci --ignore-scripts && npm test` runs a fresh private chain on localhost:19224 and records a new evidence directory. Set CKB_BIN to official CKB 0.210.0. Default uses the local ignored tools/ckb downloaded and checksum-verified by bootstrap.py. No WO04 files are modified. All source and evidence here are new; historical reports remain separate.

Pinned source/binary hashes: vendor/ickb/PROVENANCE.json. MIT license retained. Published binaries are executed directly; source-to-binary reproducibility is not yet independently established. CCC 1.23.0 and CKB SDK 0.109.5 are locked by package-lock.json. CKB release archive: SHA256 68a94c191109bae172f8dcb71828dbdf0383e2c314e0658743db217472b27bdf (official v0.210.0 Linux x86_64).

Each evidence run retains raw JSON-RPC, serialized signed transactions, node commitment responses, script cycle estimates, exact bytes, generated chain specification and cases. Fixed 0.01 CKB fees are fixtures, not market observations. Failed runs are retained as debugging evidence. Never count their partial events as a completed checkpoint.

Run `node src/verify.cjs evidence/run-<timestamp>` for independent CCC/SDK and raw RPC consistency checks. Run `python3 ../models/research.py` and `python3 ../models/strategy.py` for exact offline scenarios. Evidence directories must be fresh. TCP ports 19224/19225 must be free. Node 24, Python 3 and Linux x86_64 were used.

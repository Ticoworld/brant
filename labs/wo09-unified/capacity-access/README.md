# WO09 reusable-capacity/key-only trading experiment

Decision: **PARTIAL ADVANCE**. Zero customer-funded personal Cells and owner-authorized funded-claim trading are actually native-tested. Small independent ordinary L1 withdrawal remains conditional. This is not a two-asset DEX, a new commercial product or production security qualification.

The original Merkle/financial/E3 contracts and evidence remain unchanged. This directory contains the isolated C covenant, Zig Ed25519 adapter, pinned source/license evidence, native runners, fresh-process recovery, independent OpenSSL verification and capital scenarios.

Use the established rebuild environment: Zig0.14.1 under `labs/rebuild/mechanisms/tools/python/ziglang`, existing CKB C stdlib, Node dependencies under `labs/rebuild/native`, CKB0.210.0 at its `tools/ckb`. Public/default devnet fixtures only; generated user secrets stay in memory and are not committed. Do not use real assets. Confirm resource space, and do not run multiple native runners on port19224.

```sh
python3 labs/wo09-unified/capacity-access/src/build.py
node labs/wo09-unified/capacity-access/src/run.cjs
ALICE_CLAIM_SHANNONS=50000000 node labs/wo09-unified/capacity-access/src/run.cjs
```

Each creates a new disposable native chain/evidence directory. Default Alice claim1CKB; second command's amount0.5CKB is the$1at$2hypothetical-price case. Funding is actual CKB; prices are not live quotes.

```sh
node labs/wo09-unified/capacity-access/src/verify.cjs labs/wo09-unified/capacity-access/evidence/native-1793681058034
node labs/wo09-unified/capacity-access/src/verify.cjs labs/wo09-unified/capacity-access/evidence/native-1793682981911
python3 labs/wo09-unified/capacity-access/src/economics.py
```

`recover.cjs` retrieves public committed history and checks current live vault, with no private receipts/indexer. The runner invokes it from fresh processes and tests missing-history failure. Original ephemeral nodes are not promised to survive workspace replacement; checked-in traces allow offline verification, and the runner can create a fresh actual chain.

Primary default final run:26committed transactions,25 owner Ed25519 signatures independently reverified with Node/OpenSSL, two closed markets.0.5CKB run repeats those counts under fresh keys/chain. Signed transactions, cycles, bytes, fees, raw RPC rejections and exact errors are preserved. Prior success, indexer-method failure, wrong-reason negative and JS syntax failure remain evidence, not false PASSes.

Binary48,752bytes; code Cell48,793CKB; vault144bytes /282CKBminimum. Raw transactions use custom directly authenticated witnesses; standard secp sponsor signatures alone are insufficient. Owner-funded internal fees are actual authorized principal deductions. The declared genesis domain is client/verifier checked; this is not an external-consensus proof. Optional fee topup exists in source but was not independently qualified as a separate feature.

Final reports: `docs/WO09_CAPACITY_FIRST_PRINCIPLES.md`, `WO09_REUSABLE_CELL_ARCHITECTURES.md`, `WO09_ZERO_PERSONAL_CELL_NATIVE_RESULT.md`, `WO09_INDEPENDENT_RECOVERY_BOUNDARIES.md`, `WO09_HIGH_PRICE_CAPITAL_ECONOMICS.md`, `WO09_FINAL_CAPACITY_DECISION.md`.

Final recovery-driven run: `native-1793683642752` (0.5CKB). The runner clears local tree/vault state, and `recover.cjs scan CODEHASH MARKETID INDEX OUTPUT` discovers/reconstructs the current live vault from public blocks/history. Its returned records/configuration/vault build the next accepted owner transaction. Use `verify.cjs` on that directory as well. No cached-state transaction is used to qualify this stronger recovery result.

# WO09 unified research laboratory

Current evidence/decision: [financial Merkle decision](../../docs/WO09_MASTER_MERKLE_DECISION.md). Earlier explicit, snapshot, maturity/refund and representation kernels remain independent frozen experiments. No production/security/commercial qualification is implied.

Run from the repository root. Dependencies are pinned in the preserved rebuild manifests/lockfiles: Node SDK dependencies under `labs/rebuild/native`, CKB 0.210.0 at its `tools/ckb`, Zig at `labs/rebuild/mechanisms/tools/python/ziglang/zig`, and pinned C stdlib under `labs/rebuild/mechanisms/deps`. Reuse these qualified tools; no SP1/Groth16 setup is needed. Do not run native runners concurrently: they use disposable private-chain RPC port 19224. Confirm free disk/RAM first. Fixture keys are public, disposable and never for real funds.

Build both independently reproducible binaries:

```sh
python3 labs/wo09-unified/src/build-merkle.py
python3 labs/wo09-unified/src/build-merkle-configured.py
```

Original framed binary SHA256: `925f4c387f34d8c0f2129dfa9cd3587ce6601158b18cdf5d1bbf2684cd2f5a7a`.
Configured preferred experimental binary SHA256: `c569360ba498e715899635410dc0474003e8f61c6afc08a5c3f2a87527711c1f`.

Small native acceptance/policy fixture:

```sh
MARKET_SIZES=3 BATCH_SIZE=3 ENROLLMENT_FEE=10000 FUNDING_GOAL=50000000 REFUND_ROUNDTRIP=1 REENROLL_EXTRA=12500000 TEST_FUNDING_GOAL=1 TEST_CONFIGURED_POLICY=1 node labs/wo09-unified/src/run-merkle-configured-scale.cjs
```

Separate native optional-topup and adversarial two-market lifecycle:

```sh
FUNDED_RATCHET=1 node labs/wo09-unified/src/run-merkle-configured-security.cjs
```

Full native 16/100/1,000-owner lifecycle (all claims actually settled), with standard signatures and chunked batch proofs:

```sh
node labs/wo09-unified/src/run-merkle-configured-scale.cjs
```

Each runner creates a new timestamped evidence directory containing specifications, code hashes, full signed transactions, committed results, actual bytes/cycles, raw compressed RPC traces, positive and intended-error negative cases. Use the printed directory in the independent offline verifier:

```sh
node labs/wo09-unified/src/verify-merkle-scale.cjs labs/wo09-unified/evidence/merkle-configured-scale-1793671317288
```

`recover-merkle.cjs` reconstructs a specified current live vault from public historical witnesses; the runner invokes it from fresh child processes. `recover-closed-scale.cjs DIR` can restart the original retained disposable node and replay the closed 1,000-holder archive. If that ephemeral node directory is gone, replay the runner on a new chain; do not invent its availability. The compressed evidence still permits offline verification.

Host-only/analytical work:

```sh
node labs/wo09-unified/src/benchmark-merkle-proof.cjs
python3 labs/wo09-unified/src/model-funded-ratchet.py
python3 labs/wo09-unified/src/model-merkle-lifecycle-economics.py
```

Known negative baseline: `test-dust-boundary.cjs` demonstrates the old framed binary's admitted 2-shannon contribution, script-valid but relay-inadequate tiny refund, and blocked closure. It intentionally tests that preserved old admission policy. It is not a passing configured-policy lifecycle or a claim of consensus impossibility. Earlier witness/transaction-builder/cycle-policy failed predictions remain under evidence and research; do not delete them or count unintended errors as security passes.

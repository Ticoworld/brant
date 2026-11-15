# WO11 qualification evidence

Keep the original secp-only fallback; no new covenant candidate. Source tracing, native permissionless controls, Pudge reads and exact budgets are explained in `docs/WO11_WALLET_COMPATIBILITY_DECISION.md` and `docs/WO11_NATIVE_AND_PUDGE_EVIDENCE.md`.

Read-only public preflight:

```sh
NODE_USE_ENV_PROXY=1 node labs/wo11-pudge-pilot/src/preflight.mjs
NODE_USE_ENV_PROXY=1 node labs/wo11-pudge-pilot/src/relay-read.mjs
node labs/wo11-pudge-pilot/src/analyze.mjs labs/wo11-pudge-pilot/evidence/preflight-1793740498584
```

Disposable native authority suite (19224must be free; do not run other runners concurrently):

```sh
node labs/wo11-pudge-pilot/src/native-authority.cjs labs/wo11-pudge-pilot/evidence/preflight-1793740498584/published-acp.bin
node labs/wo09-unified/src/verify-merkle-scale.cjs labs/wo11-pudge-pilot/evidence/authority-1793740640737
```

Original regressions, sequential from repository root:

```sh
node labs/wo09-unified/src/run-merkle-configured-security.cjs
MARKET_SIZES=16 TEST_CONFIGURED_POLICY=1 node labs/wo09-unified/src/run-merkle-configured-scale.cjs
```

They generate fresh output directories; do not overwrite existing evidence. This turn's new outputs were relocated under this lab; printed historical paths remain in logs. Browser/native and overlay instructions are in apps/trade-pilot. Original code/license/evidence remain intact. New source-review provenance does not invent a source license or source-to-deployed equivalence claim. Published ACP bytes are retained with exact chain/source metadata for native reproduction, not supplied as a production dependency or claimed as a rebuilt binary.

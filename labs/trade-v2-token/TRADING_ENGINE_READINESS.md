# CKB Trading Engine Readiness

**Gate 2 security: `SECURITY CLOSURE PARTIAL`**

**Gate 3 execution: `EXECUTION ENGINE PARTIAL`**

**Product readiness: `NOT READY FOR EXTERNAL USERS`**

This is an experimental engineering assessment, not an audit or deployment approval. It records two isolated branches built from the verified Gate 2 baseline `00e36a318a23014b5fdf2fb9f4f01608ecee3917`:

- Gate 2 security branch `codex/gate2-critical-security-final`, starting at `00e36a318a23014b5fdf2fb9f4f01608ecee3917`; the initial security/evidence publication is commit `42fbb8a`, with this provenance correction committed separately.
- Gate 3 execution branch `codex/gate3-high-performance-settlement`, validated commit `615bde2` (`Add Gate 3 native contention measurements`), pushed to `origin/codex/gate3-high-performance-settlement`.
- Preserved verified Gate 2 implementation `cd12260cc831ed2cf02633f72f490a887d3a39ab`, which is an ancestor of the baseline.

## What Works

The preserved Gate 2 implementation has demonstrated fixed-supply native xUDT, reversible curve trading, offline seller authorization and cancellation, owner-keyed Merkle custody, 1,024 distinct authenticated owners, bounded 16-owner updates, independent canonical-history reconstruction, owner withdrawal from reconstructed state, and full 1,024-owner sell-down followed by same-lineage rebuy. The preserved full-scale journey committed 1,100 transactions and independently verified 1,096 custody transitions with exact token, custody, external balance, inventory, reserve, fee and occupied-capacity reconciliation. The latest full-scale state returned all 2,000 tokens to market inventory with no internal or external owner balance.

Gate 2's 18 earlier native attacks and five newly completed native token-authority/layout attacks rejected their tested exploit transactions. New cases verified one-shot owner-mode issuance, counterfeit market inventory identity, unexpected xUDT output layout, genuine xUDT quantity inflation, and unexpected extra genuine xUDT input. Gate 3 committed independently authorized purchase transactions under same-root contention and committed native operation-2 batches of 8 and 16 owners.

## On-Chain Guarantees and Assumptions

The current scripts enforce fixed-supply issuance lineage, xUDT quantity conservation, market/custody state transitions, ownership proofs, and transaction layouts described in the Gate 2 reports. Current state uniqueness comes from consuming canonical singleton outpoints and validating their successors. Node pool policy and canonical chain selection decide competing spends. No contract prevents a consensus reorganization.

Offline-order cancellation and revision invalidation are available. There is no covenant-enforced absolute order expiry: relay-side expiry limits availability only, and an already signed authorization can remain usable until its owner revision changes. The xUDT and market scripts do not make a buyer's 80% individual purchase-price floor solvent; that protection is not implemented.

Independent recovery requires an unpruned full-history CKB RPC source with the committed transaction bodies, witnesses, canonical block history and current live-cell information. Recovery does not require a Trade-operated relay, website, solver or private database. The 1,024-owner recovery withdrawal was performed by a separate recovery process on the same host, not a separately provisioned physical machine. Incomplete or conflicting history is tested to fail closed through mocked RPC faults, but a physical provider disagreement and a real private-chain reorganization were not exercised in this closure run.

## Contended Execution Measurements

The Gate 3 experiment built concurrent same-root buyer transactions against shared market and custody outpoints. For 8, 16 and 32 competing intents, exactly one initial candidate committed; the remaining 7, 15 and 31 were rejected by private-node transaction-pool replacement policy and then rebuilt, reauthorized and committed sequentially. Queue drain was 31.67 s, 65.60 s and 138.14 s on the local harness. These are not public-network throughput estimates; proof generation and serial retries dominate, while local block generation was under 100 ms in the measured winner path.

Native aggregation committed 8-owner and 16-owner operation-2 batches at 16.35M and 33.49M VM cycles, respectively, with 1,000,000 shannons total fee per batch in the fixture. This lowers per-owner transaction fees but does not remove shared-cell contention. The selected conservative path is a deterministic single-writer queue with bounded aggregation and chain-based reconciliation. Pipelined successors, independent competing solvers, mixed buyer/seller/cancellation scheduling, cross-market races and within-market sharding remain unverified. The queue persistence check used a separate worker process and atomic file replacement; power-loss durability was not tested.

The preserved full-scale Gate 2 journey measured 11 CKB in synthetic fees, but its synthetic curve locked a peak market Cell capacity of 542,616 CKB. This is not normal onboarding cost or third-party liquidity. Earlier economic scenarios and a solvency counterexample are recorded in `gate2/GATE2_RESULT.md`; no market demand, sustainable maker revenue or operator economics have been observed.

## Coordinator Failure and User Rights

Committed user rights are reconstructed from canonical chain history and do not depend on the coordinator's in-memory state. The Gate 3 queue journal is a local execution aid, not the source of user ownership. A fresh recovery client can reconstruct the full-scale custody tree and create a current withdrawal proof from chain data. Pending transactions may be conflicted, replaced, or removed by a reorganization; users and coordinators must revalidate against canonical history and rebuild. Missing history cannot be inferred safely and causes recovery to fail closed.

The measured Gate 3 harness does not yet implement a complete public coordinator for buyer/seller intent intake, signed price/slippage validation, cancellation races, competing solver coordination, multi-provider canonical-state checks, or production-grade crash/reorganization recovery. Its race retries used runtime disposable buyer keys and fresh signatures at refreshed quotes; this does not authorize repricing a previously signed limit order.

## Remaining Blockers

Gate 2 remains partial because maximum curve quantity/base/step and arithmetic/capacity edges have not all executed at the intended native script boundary; revision overflow, tombstone re-enrollment/old-order revival, unrelated-owner mutation, alternate valid redemption, same-singleton competing valid spends on the Gate 2 security track, and a real reorganization remain outstanding. The five newly added native attacks do not close those gaps.

Gate 3 remains partial because the measured implementation is a queue and contention harness, not a complete competing-order settlement service. It lacks buyer-signed price bounds, mixed seller and cancellation cohorts, actual coordinator-process crash recovery, competing solvers, pipelining measurements, provider disagreement with live nodes, reorganization testing and public-network confirmation measurements.

The next highest-value milestone is a native deterministic coordinator that accepts seller and buyer authorizations with explicit owner revision and buyer maximum-price constraints, batches compatible intents up to 16, and rebuilds only from canonical current state. Test it with competing solver processes, stale/canceled orders, injected transaction-pool conflicts and coordinator termination at each broadcast/confirmation boundary. Then close the enumerated Gate 2 native arithmetic and revision attacks before any external-user qualification.

## Evidence and Reproduction

Detailed native transactions, script hashes, errors, ELF/source identities and reproduction commands are in:

- `gate2/GATE2_SECURITY_CLOSURE_RESULT.md`
- `gate2/GATE2_RESULT.md`
- `gate3/GATE3_EXECUTION_RESULT.md`
- `gate3/GATE3_FUTURE_LEDGER.md`
- `gate2/security/evidence/native-token-boundaries-1794450855229/evidence-manifest.json`
- `gate3/evidence-manifest.json`

The Gate 2 contract ELFs were rebuilt from the pinned source and matched the published SHA-256 build manifest. Gate 3 records CKB 0.210.0 identity, all five Gate 2 ELF hashes, native transaction receipts, cycles, serialized and witness bytes, fees, and the queue-race observations. Compact fixtures and reports are committed; large raw RPC/node transcripts are local-only and their hashes are recorded in the evidence manifests. No external durable artifact store was configured.

Reproduction commands are provided in the two track reports. Run the targeted Gate 2 tests with the pinned CKB 0.210.0 toolchain and disposable private chain, and run the Gate 3 queue test and `native-contention.cjs` against the documented Gate 2 fixture. Do not interpret private `generate_block` timing as public confirmation latency.

**Combined decision: the native trading foundation is experimentally real and independently recoverable, but security closure and high-contention execution are incomplete. The evidence does not justify external-user qualification yet.**

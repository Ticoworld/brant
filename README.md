# CKB Trading Opportunity — Research Engineering Repository

**Status: protocol research, NOT a production exchange.**

The initial package imports the preserved WO01–WO04 experiments and the working WO04-E1 execution-proof prototype. Its code and reports came from ChatGPT Work artifact archives. This is a **selective source migration**, not a claim that experiments were re-executed or security audited.

## Current native reconstruction

The comprehensive WO05–WO08 reconstruction is tracked in [the capability registry](docs/TRADE_CAPABILITY_REGISTRY.md), [current rebuild status](docs/REBUILD_WO05_WO08_STATUS.md) and [readiness decision](docs/WO09_READINESS.md). Source and experiments are isolated under labs/rebuild. General authenticated arbitrary-history recovery/LO-01 remains unresolved/blocked; neither A–D execution nor new native proofs constitute full recovery or a WO09 authorization. No WO09 product implementation has begun.

## Read first

1. `docs/CURRENT_STATE.md` — verified narrow findings, missing proof, and architecture candidates.
2. `docs/NEXT_CODEX_TASK.md` — first bounded Codex Cloud task.
3. `AGENTS.md` — engineering discipline, privacy, and preservation rules.
4. `labs/wo04-e1/07_E1_DECISION.md` and `labs/wo04-e1/README.md` — most recent working baseline.
5. `docs/PROVENANCE.md` — original artifact links and migration boundaries.

## Layout

- `labs/wo01`: concurrency research and scripts.
- `labs/wo02-reports`: recovered historical reports; original WO02 ZIP is damaged and source is not fully imported.
- `labs/wo03`: state-channel adversarial model and contract experiment.
- `labs/wo04-partial`: native CKB funded session code and recovered incomplete work.
- `labs/wo04-e1`: native CKB + EVM proof-gated settlement experiments; **trusted state-root bootstrap remains the critical gap**.

Run only on isolated development chains with disposable public test fixtures. Never use real funds or mainnet keys.

## E1 reproducibility

The original source README describes its pinned Linux workflow. It needs downloaded pinned tools, CKB v0.210.0, npm dependencies, and sufficient cloud network permissions. The migrated repo contains a subset of saved evidence; regenerate evidence in a clean workspace rather than confusing saved fixtures with a fresh pass. Review the source and declared dependency hashes before executing.

**Do not interpret a passing storage/MPT verifier as Ethereum consensus/finality verification.** E1 uses a controller-selected execution root. The business and safety case remain unproven.

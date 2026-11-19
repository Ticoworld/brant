# Brant

Brant is a native CKB token launch and trading platform on CKB Pudge Testnet. It was previously developed as Roveko and carries forward the existing RVK market and testnet evidence.

**VERIFIED:** Public Pudge acceptance includes Buy/Sell, two external xUDT withdrawals, and independent chain reconstruction with unsigned withdrawal preparation.

**OPEN:** Independently signed public server-down exit (WO2), reusable multi-token launch acceptance, remote public alpha, and production security acceptance.

Clone with `git clone https://github.com/Ticoworld/brant.git`.

## Brant application

`apps/trade-testnet` contains the Brant application. Its current UI includes Discover, Portfolio, Activity, Launch, and Pudge market/deployment workflows. Discover loads the registered public RVK market on Pudge.

The application source targets the public CKB Pudge testnet by default and includes wallet-mediated transaction signing and submission paths. These are code capabilities only: a supported live deployment, complete public Pudge lifecycle, external-wallet compatibility, and production security have not been independently verified. The interface and its research labs are not a production exchange; no mainnet use or real-asset claim is supported. See [Current State](docs/CURRENT_STATE.md) and [the app notes](apps/trade-testnet/README.md) for the current evidence boundary.

## Current native reconstruction

The comprehensive WO05–WO08 reconstruction is tracked in [the capability registry](docs/TRADE_CAPABILITY_REGISTRY.md), [current rebuild status](docs/REBUILD_WO05_WO08_STATUS.md) and [readiness decision](docs/WO09_READINESS.md). Source and experiments are isolated under labs/rebuild. General authenticated arbitrary-history recovery/LO-01 remains unresolved/blocked; neither A–D execution nor new native proofs constitute full recovery or a WO09 authorization. No WO09 product implementation has begun.

## Read first

1. `docs/CURRENT_STATE.md` — verified narrow findings, missing proof, and architecture candidates.
2. `docs/NEXT_CODEX_TASK.md` — controlled public Pudge alpha.
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

# Atomic Pudge release candidate

This package prepares owner-controlled qualification. It does not deploy contracts, activate writes, sign or send a public transaction. Native contracts and transaction construction are frozen. The only runtime closure change is a dormant, fail-closed public network/creator/deployment authorization gate.

## Evidence and measurements

`evidence-verification.json` checks the original transaction metadata signature, transaction hashes, linked browser acceptance and exact release binary hashes. The original complete browser journey spans linked runs of the same genesis/market, not one uninterrupted run. New release evidence independently reconstructs that market from canonical full blocks with the app stopped, without an indexer, database or proof cache. All seven units were withdrawn by the disposable owner; a second full-block replay verifies zero entitlement/custody. Inventory 1,993 plus seven external xUDT still equals supply 2,000.

A separate instrumented application Launch supplies timing measurements without repeating the native qualification experiments. It uses a real isolated CKB chain and simulated disposable browser signer; no separate metadata approval is permitted. See `release-closure.json` and its linked raw receipts.

| Measurement | Observed value | Scope |
|---|---:|---|
| Preparation RPC | 15 | Instrumented server RPC, including funding discovery |
| Submit verification RPC | 9 | Signature/live validation; broadcast is outside Server-Timing |
| Canonical confirmation/publication RPC | 4 | One reconciliation, combined publication/status response |
| Broadcast | 1 | Derived from the executed single-submit flow and committed receipt; not separately timed/counted in Server-Timing |
| Review preparation application time | 470 ms | Excludes development compilation |
| Review request to response headers | 20,656.6 ms | Cold development server, includes compilation/queuing/transport |
| Launch click to signer entry | 141.7 ms | Fixture `signOnlyTransaction` entry, not real wallet popup latency |
| Canonical commitment observation to publication response | 195.6 ms | First reconciliation waits for the observer; excludes unknown commitment-to-observer delay |

These are one controlled sample, not percentiles, production latency or real-wallet guarantees. The original browser sample was 14 preparation RPC; the release sample also discovered the external withdrawal Cell. Counts exclude wallet RPC, mining and bootstrap. The qualified two-input planner remains unchanged; public qualification adds two canonical deployment-receipt reads before preparation/submission. No public performance is claimed.

## Exact code deployment

`deployment-plan.json` contains full CKB data hashes, SHA-256 hashes, byte lengths, source commits/digests, linker recipe, reused dependency identities, output ordering and capacity/fee calculations. Deploy these exact bytes; do not substitute a new build or historical test validator.

| Output | File | Bytes | Minimum code capacity |
|---|---|---:|---:|
| 0 | `market_smt` | 38,464 | 38,525 CKB |
| 1 | `custody_marker` | 21,176 | 21,237 CKB |
| 2 | `atomic_initializer` | 43,752 | 43,813 CKB |

Total locked code capacity is **103,575 CKB**. This is occupied capacity, not a fee. Reuse existing custody, market marker, pinned xUDT and standard secp dep-group Cells; all four were canonically checked read-only in `public-dependencies-readonly.json`. Do not redeploy or replace RVK/CKBM dependencies.

At 1,000 shannons/KB with one standard-secp funding input: serialized transaction 104,070 bytes; estimated fee **104,074 shannons = 0.00104074 CKB**; minimum change 61 CKB; minimum deployment funding **103,636.00104074 CKB**. Actual inputs/fee must be recalculated. A default 2,000-supply Launch with seven initial units additionally needs 1,452.01 CKB eligible funding (1,391 CKB locked including 91 CKB reserve, 61 CKB change, 0.01 CKB fixed fee). Do not sum change requirements as irreversible costs.

New deployment transaction/block hashes cannot exist before owner approval and commitment. The draft uses null identities deliberately; they are rejected by the runtime validator. New dependencies must resolve to the confirmed deployment outputs 0/1/2. All scripts use the qualified `data1` hashes.

## Owner-controlled procedure

1. Keep Railway Auto deploy disabled and both write/qualification flags at zero. Back up the existing persistent launch SQLite database and retain its path, volume and private snapshot key. Do not replace the database or change RVK/CKBM records. Verify this candidate's Git SHA, `deployment-plan.json` and the binary hashes.
2. Connect the intended owner wallet on Pudge. Obtain its **public** recommended standard-secp lock script in camel-case JSON (`codeHash`, `hashType`, `args`), and independently confirm its script hash. Do not export/import a private key. The script hash becomes the single approved creator; no creator is preselected in the draft.
3. From `apps/trade-testnet`, prepare a fresh unsigned code-deployment review with Node 24.19:

   ```sh
   node --experimental-strip-types scripts/prepare-atomic-pudge-transaction.mjs OWNER-LOCK.json NEW-DEPLOYMENT-REVIEW.json
   ```

   This command reads Pudge genesis, eligible funding and dependency bytes, protects the legacy reserved anchor, builds the exact ordered code outputs using the existing deployment planner and rechecks live inputs. It cannot sign/broadcast/mine and refuses to overwrite an existing review. Funding is selected from actual live owner Cells; no synthetic balances or guessed inputs are used.
4. In a separately authorized deployment milestone, review that exact transaction in the owner's wallet using the existing CCC sign-only and reviewed-signature/live-input verification flow. Confirm network, code hashes/bytes, output order/capacity, owner change and fee immediately before individual approval. Reject any wallet mutation of the review. Broadcasting is a separate owner-approved action. Do not use the legacy deployment wizard: its pinned code set is different. Importing this review into a real wallet is an owner qualification step, not an acceptance result of this package.
5. Wait for canonical commitment. Verify genesis, transaction hash, canonical block hash, three live code output bytes/data hashes, and all reused dependencies again. Fill `creator`, `deployment.txHash`, `deployment.blockHash` and the three null dependency transaction hashes in a COPY of `qualification-manifest.draft.json`; preserve every hash, index and dep type. Do not change the frozen binary hashes to fit another deployment.
6. Only after separate owner authorization, place the completed manifest at a readable path on the existing persistent volume and manually deploy this candidate with `qualification.env.example` gates still closed. Keep the existing SQLite path, native proof tool paths, proof origin, volume and snapshot key. No isolated-network variable is allowed in production. The Dockerfile pins Node 24.19.0 and the existing proof tooling; this package does not alter Railway settings or deploy it.
7. Dry-check the completed pinned manifest and canonical receipt before a restricted qualification. With separate owner authorization, set `BRANT_ATOMIC_PUDGE_QUALIFICATION=1`, set `BRANT_LAUNCH_APPROVED_CREATOR` to the manifest creator and then `BRANT_LAUNCH_WRITES=1`. The server pins the Pudge endpoint/genesis, exact shared/new code identities, creator and confirmed deployment; funding/signature/live checks remain mandatory. Never copy the disposable fixture wallet/configuration into production.
8. The owner reviews one atomic Launch transaction and individually approves it. Require canonical confirmation, automatic metadata publication without a message signature, discovery, recovery, Buy/Sell, Portfolio/Activity and withdrawal before broadening qualification. Every later trading/withdrawal transaction still requires its own wallet approval. Return the write gate to zero after the bounded qualification; this package does not perform any of those public actions.
9. CKBM stays on its original legacy market. After the owner-authorized app rollout, use its saved launch's existing publication-retry control; it reuses saved authorization and cannot submit/relaunch. If saved authorization is missing, retain the `publication_signature` diagnostic and stop; do not relaunch CKBM or search for nonexistent historical logs.

## Limits

- No public atomic deployment/Launch, real-wallet popup timing, external-wallet interoperability or public independent withdrawal is claimed.
- The standalone signed exit demonstration is private-node/disposable-key only. Public owner signing handoff and suitable archival history remain qualification requirements; never import the fixture key or sign a public exit with the private-node CLI.
- True original commitment-to-publication wall-clock timing was not retained. The new measurement starts at canonical observation and labels that limitation.
- Hosted CKBM retry was not invoked, and the public app has not been replaced by this candidate.
- Build acceptance is `next build --webpack` on the pinned Node 24.19.0 without isolated overrides; it is not a Docker/Railway deployment or a security audit.

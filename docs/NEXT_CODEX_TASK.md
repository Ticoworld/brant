# ACTIVE NEXT TASK (2026-11-18): ROVEKO WO1, FAST VERIFIED STATE AND PROOFS

This is the active task pointer. Read [ROVEKO_DIRECTION_LOCK.md](ROVEKO_DIRECTION_LOCK.md) first. The locked execution order is WO1 -> WO2 -> WO3 -> WO4, one bounded task per Codex Cloud run. The prior hosting-first Checkpoint 2 instructions below are historical where inconsistent with this decision.

**Start WO1 now:** instrument and optimize the existing Pudge market/cache and owner-proof recovery paths; avoid repeated immutable/history validation on unchanged verified state; maintain shared verifiable Merkle custody state, safe incremental successors, dual market/custody liveness, canonical/reorg validation and signing-grade freshness. Benchmark before and after, including cold, warm, restart, and concurrency. Target <500ms warm public reads and <1s warm owner proofs where measured conditions permit, but never claim an unmet target or weaken proof validation to reach it.

**WO1 exclusions:** no wallet broadcast, public-chain mutations, new token factory, UI transplant, external hosting/proxy deployment, other work orders or historical lab refactors. Codex Cloud cannot leave a localhost instance running in the owner's Chrome. Preserve prior evidence and deliver reviewable changes with precise measurements and blocked gates.

**Hosting decision:** Not provisioned yet. This does not block WO1. Any pending deployment security gate remains unverified, not waived.

---

## Historical task snapshot (superseded where inconsistent)

# Next milestone: Complete Checkpoint 2 — verified recovery and remote readiness

## Checkpoint 1 status

Checkpoint 1 is implemented and pushed in commit `c3049f74faf9908334c8854fb5ace7176a9f9eb2` on `main`. It separates market capacity from curve liquidity, separates total CKB capacity from eligible spendable funding, improves CCC connection and quote UX, and binds the RVK display metadata to the verified Pudge market. Typecheck, production build, focused accounting/curve/review/dependency checks, and desktop/mobile browser checks passed. No wallet transaction was signed or broadcast for this checkpoint.

## Checkpoint 2 status

Checkpoint 2 is partial in commits `7169e5f` and `888b0f3` on `main`, both pushed to `origin/main`. The owner proof route has a registered-market allowlist, same-origin JSON checks, bounded body and RPC work, per-client rate limits, a two-request process concurrency cap, native execution timeouts, private temporary files, and a market/owner/anchor-bound custody history cache. Confirmed successor transactions append incrementally; native replay still checks the complete history. Cached proofs require the exact custody output and recorded anchor to remain live and canonical.

The market service also writes a private atomic Gate 2 checkpoint, reloads it after a separate process start, rechecks canonical market and issuance anchors, all code dependencies, live singleton/custody Cells, exact curve accounting, quotes, metadata binding, and tip stability, and incrementally validates confirmed successors from the saved market pair. Invalid checkpoints fall back to bounded full recovery. The proof route also has localized loading, timeout, and retry behavior. Typecheck, production build, indexed successor/reorg fixtures, collector append/stale-anchor fixtures, request-security checks, accounting/metadata, and native Buy/Sell proof-transition checks passed. Read-only Pudge owner and market reads returned the registered owner's 7-token balance and current 1,993 inventory / 7 custody state. No signature or broadcast occurred.

## Remaining work

1. Configure `ROVEKO_PUDGE_PROOF_CACHE_DIR` as a private, durable writable volume in the selected host. Without it, restart recovery of proof and market checkpoints is not enabled.
2. Confirm the hosting reverse proxy strips client-supplied forwarding headers and sets the real client IP before relying on `x-forwarded-for` for rate limits.
3. Run remote-origin proof checks and cache recovery after an actual application restart in that host. Keep the endpoint limited to registered markets and confirm rate, concurrency, history, and timeout rejections.
4. Exercise the market checkpoint's successor extension and reorganization/conflict invalidation against a controlled changing-chain fixture or an authorized new transaction. The public market did not change during these read-only checks; unapproved trades must not be generated for testing.
5. Repeat cold/warm market and owner-proof measurements on the same host and RPC path. Recent market samples varied from 4.6 to 17.7 seconds cold and 6.3 to 8.9 seconds across process restart with the saved snapshot, showing no stable timing improvement yet. Owner proof timings were 26.8 seconds cold, 18.0 seconds across restart, and 5.3 seconds warm in process. Sub-second warm proof has not been achieved. Arithmetic quote latency remains at its prior 96–141 ms measurement and was not rerun.

Do not advance to Checkpoint 3 until these remaining Checkpoint 2 proofs are complete. Use only bounded, relevant tests. Do not repeat unrelated private-chain suites or skip current state validation to meet a timing target. Public Pudge reads remain read-only; do not sign or broadcast.

---

# Historical snapshot: consumer-product integration before Checkpoint 1

The Pudge deployment, market initialization, one wallet-approved Buy and Sell, and chain-state recovery are completed owner milestones. The migration archive preserves exact transaction records; read-only public RPC checks on 2026-11-17 confirmed all 8 saved transaction references committed and verified the deployment and live market recovery. Do not repeat those transactions or redeploy.

## Objective

Integrate the confirmed public Pudge market into the trader-facing product:

- Load public markets automatically without manual verification.
- Provide one clear Buy/Sell action with wallet approval and automatic status tracking.
- Show real price history and curve charts.
- Make the trading UI consistent and readable.
- Implement real Portfolio and Activity screens.
- Remove technical and debug interfaces from normal trader workflows.

Keep current trading contract behavior, wallet review/signing safeguards, chain-state recovery, and existing public Pudge data. Do not execute another product work order or redeploy during this integration task. Public market reads should remain read-only until a new owner-approved transaction is necessary.

## Verified baseline

- Pudge genesis: `0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606`.
- Deployed code hash: `0x53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f`.
- Deployment: `0x1805b0fda22fd144dced70963cb8396d778b6cba2eb7325c81290f615c070dd8:0`.
- Market initialization: `0x9fadc8cf7bc2b1af4350da6f24c120a770c5394122ecfe7ea92cf80fa7706ddd`.
- Current live market Cell: `0x3fa9dd0155936e0dacc9bf5e57a4785c3d6d66191a7560f1ff5ec6a6b04954f3:0`.
- The protected migration archive contains raw records for all 8 saved Pudge transaction references. All were reported committed by read-only public RPC on 2026-11-17.
- Existing private-chain browser acceptance remains distinct from public Pudge evidence. A served route or mock-RPC test does not establish UX completion or public-chain acceptance.

## Evidence labels and limits

Label every new result **VERIFIED**, **DERIVED**, **HYPOTHESIS**, or **UNIMPLEMENTED**. Preserve prior evidence. Do not claim broad wallet compatibility, security audit, production readiness, liquidity, or profitable exchange economics based on the completed owner transaction flow.

---

# Historical handoff: Pudge Testnet owner acceptance (completed)

The checklist below is preserved as historical context from 2026-11-15. Do not restart the completed acceptance milestone.

## Objective

Prepare the existing Roveko application on `main` for an owner-operated Pudge Testnet acceptance. Use the existing `/launch`, `/v2/deploy`, and trading implementations. The immediate handoff is a running application where the owner can connect UTXO Global, review a real deployment transaction, and decide whether to sign and broadcast it.

The owner has authorized this milestone only on the official CKB Pudge Testnet, with Pudge testnet CKB, and the existing verified contract architecture. Each transaction requires its own review and approval by the owner in the connected browser wallet. Signing and broadcasting are separate owner actions. Never sign or broadcast automatically, import or extract keys, use fixture credentials, use mainnet, or deploy unattended.

## First checkpoint

1. Preserve the current worktree, both stashes, historical branches/worktrees, and all prior evidence. Do not alter WO15, Arena, Fiber, protocol-fee work, or business-model material.
2. Confirm the active checkout and branch. Inspect the existing Pudge configuration, pinned binary/tool identities, wallet controls, and recovery safeguards. Do not rebuild implemented features or weaken their checks.
3. Run typecheck, production build, and focused existing checks for Pudge transaction preparation, signature verification, and the separately gated broadcast control. Do not repeat the complete private-chain lifecycle.
4. Start the app in normal Pudge mode on localhost, confirm the exact URL responds and the launch/deployment view renders, and keep the process running for the owner's browser interaction. Ensure local fixture/test hooks are disabled.
5. Report the URL, commit and branch, build/check results, available wallet controls, the first owner action, and any exact blocker. Do not claim a public transaction has occurred.

## Owner-controlled transaction sequence

1. The owner connects UTXO Global on Pudge and verifies the address and live eligible Cells.
2. Prepare and inspect the deployment transaction's inputs, outputs, dependencies, capacity and fee. Use the guarded split workflow only if the verified eligible Cells require it; each split also needs an individual review and approval.
3. After the owner approves the reviewed transaction, request a wallet signature. Verify the returned signed transaction against the review before exposing its separate broadcast action. The owner decides whether to broadcast. Do not work around a wallet rejection or unexpected transaction mutation.
4. Capture the actual transaction hash and verify canonical confirmation, deployed code identities and exact outputs. Save durable recovery evidence and reconcile uncertain submission outcomes before retrying.
5. Continue setup, issuance and initial curve purchase as separate reviewed transactions. Confirm and reconcile each stage before preparing its dependent stage.
6. Register the verified public market identity only after initialization is confirmed. Then prepare owner-approved Buy and Sell transactions and verify them in Portfolio, Activity and recovered market state.

## Evidence and limits

- Label every result **VERIFIED**, **DERIVED**, **HYPOTHESIS**, or **UNIMPLEMENTED**.
- A running server, connected wallet, prepared transaction, local proof, or mocked wallet test is not public transaction acceptance.
- Do not request faucet funds unless read-only inspection confirms the connected owner's available funding is insufficient.
- Preserve unsigned/signed transaction evidence and exact wallet errors safely. Never include secret material.
- The public milestone is complete only with verified Pudge deployment, initialization, buy, sell, and chain-state recovery, each supported by actual public transaction hashes and canonical confirmation.

## Completed prerequisite: isolated local integration

**PASS (VERIFIED):** one disposable owner completed Launch, Discover, Buy, Sell, Portfolio, Activity, and reload recovery on one isolated private CKB node. Launch, buy, and sell committed as real private-chain transactions. After Buy/Sell, `/v2` followed the current market and custody successors and recovered inventory `1993`, custody `7`, and owner entitlement `7` before and after reload. The focused recovery check submitted no transaction and left the chain tip unchanged.

The summarized evidence is `apps/trade-testnet/evidence/v2-trade-recovery-1794764545869/trade-recovery.json`; timestamped raw receipts, logs, and screenshots remain preserved. Focused typecheck and fixture-gate, local-manifest, transaction-layout, and lineage checks passed for that local recovery change. This prerequisite does not establish any public Pudge transaction, external-wallet compatibility, liquidity, security audit, or business viability.

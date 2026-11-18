# ROVEKO Direction Lock
**Decision date:** 2026-11-18  
**Product:** Roveko (Ticoworld/trade, `apps/trade-testnet`)  
**Decision baseline:** `main` at `e4dda13fe7cc900f86d240e277535b3e5fbe4fe1` (checkpoint 2 partial)  
**Status:** Product direction locked; engineering acceptance not yet complete.

## Authority and local execution
- **This file fixes product intent, scope and work-order order.** It supersedes historical task recommendations in `docs/CURRENT_STATE.md` and the archived sections of `docs/NEXT_CODEX_TASK.md`. Existing `AGENTS.md` engineering, safety and security requirements remain applicable; if an old task instruction conflicts with the direction, do not obey that task instruction.
- **Executor: Codex Local, Windows repository `C:\\Users\\timot\\Desktop\\2026\\CKB\\trade`, working on `main`.** Do not create a branch/worktree or change repositories. Before modifying files, inspect `git status`, `git branch`, `git rev-parse HEAD`, and `git fetch origin`. Only use `git pull --ff-only` if a clean working tree and fast-forward are confirmed. Never discard local changes or force push. If sync is blocked by uncommitted changes or divergence, stop and report the exact condition rather than modifying history.
- On completion of a validated work order, commit and push its scoped change to `origin/main` without force. Compare final local and remote SHAs. Do not begin the next work order automatically.
- For instructions: read this file as active direction; consult the **current top section only** of `docs/CURRENT_STATE.md` for verified state and `docs/NEXT_CODEX_TASK.md` before its historical snapshot divider for active work. Other sections are historical evidence, not work orders. Read applicable `AGENTS.md` security rules and Next.js version instructions.
- Working locally does not grant permission for public signing or broadcasts. All public Pudge writes remain specifically user-approved.

## 1. Why Roveko exists
Roveko aims to make launching and trading native CKB/xUDT tokens capital-efficient and usable from the first trade, while retaining a verifiable, operator-independent withdrawal path.

The intended differentiators are:
1. **Shared Merkle custody:** trade without a separate occupied xUDT Cell for every internal holder/order, reducing incremental per-holder capacity requirements in supported journeys.
2. **Reserve-backed two-way curve:** allow buy and sell against finite, explicitly shown CKB reserves when no matching maker order is available. Quotes, fees, exit liquidity, slippage and reserve limits must be transparent.
3. **Independent L1 withdrawal:** holders can reconstruct history/proofs and recover external xUDT from canonical CKB data without Roveko's website or proprietary signing service.
4. **Later, a hybrid maker path:** offline signed limit orders can complement curve execution only when current code, public-chain flow and safety tests substantiate them.

These are **product hypotheses**, not exclusive-first-in-CKB claims. Compare against CKBSwap, LucentDex, Ohrex, Swapbook, Twine and emerging alternatives with matched transaction sizes, occupied capacities, fees, fill/exit behavior, custody assumptions and operational dependencies. Do not use arbitrary examples to claim 61% savings, zero total cost, guaranteed fills, 100% unconstrained liquidity, or the only DEX of its kind. Capacity is locked, not necessarily burned; shared custody introduces contention and new trust/performance obligations. Do not confuse Twine's fiat P2P job with Roveko's token-market job.

**Demand proof is open.** Before a public grant/dominance claim, obtain independent test use, comparable measurements and credible builder/trader feedback.

## 2. Evidence at decision baseline
Source of truth for exact evidence and transaction identifiers: `docs/CURRENT_STATE.md`.

- Public Pudge Gate 2 contract anchors and RVK market recovery are recorded; reported market state: 2,000 supply, 1,993 inventory, 7 in custody, 391 CKB market capacity, 300 CKB capacity floor, 91 CKB derived curve reserve, 17/16 CKB one-token buy/sell quotes.
- Owner-reported public wallet Buy/Sell and recovery predates the current UI checkpoints. **New UI external-wallet Buy/Sell and independent end-to-end exit are NOT yet accepted.**
- Persistent market checkpoint and bounded owner-proof checkpoint exist, but performance is not yet satisfactory: sample market read 17.7s cold / 8.9s after restart, owner proof 26.8s cold / 18.0s after restart / 5.3s warm in process. These are observations, not reliable percentiles.
- Current code repeatedly verifies historical market/issuance/dependency information on cache reuse and separately validates proof manifests. This is a demonstrated optimization target. The precise count of sequential RPC calls and a guaranteed 1-call or <500ms solution are **unproven**.
- Reusable multi-creator launch, public offline limit-order operation, broad wallet compatibility, production-grade independent exit, profitable economics and community demand remain unverified.

## 3. Ordered milestones (one bounded Codex Local task at a time)

### WO1: Fast verified market state and owner proofs (FIRST)
**Outcome:** a shared, trustworthy, incrementally maintained market/custody state that serves public reads and owner proofs without full historical revalidation or per-owner history reconstruction on each unchanged-state request.

- Instrument baseline: count RPC operations and HTTP round trips, serialization/disk load, immutable validation, native process startups, Merkle reconstruction, proof generation and wall-clock critical path. Record cold, warm, after-process-restart and concurrency behavior in one defined environment. Never assume how many RPC calls are sequential.
- Establish immutable provenance at trusted checkpoint initialization; bind stored state to CKB genesis, market/contract identity, confirmed canonical history, exact scripts/dependencies and expected state roots. A local JSON checksum is not authenticity.
- Keep a reusable market-wide custody tree/verified accumulator. Derive individual owner proofs from the shared validated state when possible, rather than independently replaying the same history per owner. Do not pretend a partial transaction history suffices to know all owner leaves.
- For unchanged-state quick checks, account for **both** market and custody singleton outpoints, all relevant paired/marker outputs, canonical anchoring and provider consistency. `get_live_cell` can be batched only if the actual RPC endpoint supports it; one HTTP batch is still multiple RPC operations. The public-display freshness policy may be bounded/stale-while-revalidate, but signing paths must fail closed on stale or unverified state.
- On spent outpoints, walk and verify canonical successors incrementally. On reorg, corruption, mismatch, delayed indexer, inconsistent RPC or uncertainty, invalidate/reconcile/rebuild as needed. Coalesce duplicate concurrent refresh work.
- Add deterministic tests for unspent unchanged state; custody-only mutation; market mutation; spender/successor; reorg; wrong genesis/contract/roots; poison/corrupt checkpoint; process restart; indexer lag; parallel requests; signing-time stale input rejection. Protect independent chain-only reconstruction.
- Aim for warm market reads <500ms and warm owner proof <1s in a defined controlled environment. These are **targets**, not guaranteed pass claims. Preserve security even if target is missed, report precise residual bottlenecks.
- Stop WO1 after focused checks, measurable results, a reviewable change and honest evidence. **Do not start WO2/WO3/WO4 in the same Codex Local run.**

### WO2: Complete and accept the trading/recovery lifecycle (AFTER WO1)
Integrate current market + proof engine with one wallet-approved Buy/Sell action followed by automatic broadcast **only after verifying the returned signed transaction**, plus clear Submitted vs Confirmed states, actual CKB/holding balances, Portfolio, Activity, error and interrupted-submission reconciliation. External xUDT withdrawal and chain-only recovery must be independently tested. Run local chain lifecycle and failure tests first. Public Pudge signing/broadcast is owner-controlled, never unattended Codex Local activity. Preserve the current UI; no third rebuild.

### WO3: Reusable multi-token Launch factory (AFTER WO2)
Reuse the five deployed Pudge Gate 2 code Cells (outputs 0x0..0x4 of `0x573be2deb4bd7cd28679e5f30a194b2774fd674bd4d96844898cc25dcc49897e`) and appropriate official xUDT dependency as reusable `cellDeps` where compatibility is verified. Each creator must use a fresh unique anchor/market identity, independent recoverable launch journal, authenticated durable market metadata and confirmed publication. Surface only parameters actual scripts support. Measure funding from real outputs, **do not promise ~1,100 CKB without evidence**. Prove two creator launches and trades on an isolated native CKB chain before owner-approved public attempts.

### WO4: Remote trial, operational safeguards and competitive validation (AFTER WO3)
Package persistent, restartable Node/native runtime with secure proxy/IP trust, rate/concurrency bounds, incident/recovery procedures and portable configuration. Choose hosting when remote testing is actionable, not as a prerequisite for WO1–WO3 local implementation. Invite independent testers; collect reproducible trading, withdrawal, concurrency and failure evidence. Compare Roveko against strongest real alternatives with matched operations and exact capacity/fees. Only then consider public promotional/grant claims.

## 4. Non-negotiable execution policy
- **No drift:** do not reopen UI transplant, rename the product, resurrect legacy routes, return to cross-chain WO04, pivot to fiat P2P, rebuild contracts or invent unrelated features.
- **One work order per run:** preserve a working fallback; make scoped diffs; run focused relevant checks, not endless historical suites; report actual measured benefits.
- **Evidence before conclusions:** mark findings VERIFIED, DERIVED, HYPOTHESIS or UNIMPLEMENTED; never equate a build, test pass or screenshot with real wallet/public acceptance, independent exit, demand or production readiness.
- **Try before declaring impossible:** when a desired approach is plausible, perform a bounded diagnostic/fixture or isolated-chain attempt first; explain exact obstruction and alternatives. Equally, reject shortcuts that fail safety, correctness or economic scrutiny.
- **Protected public state:** read-only Pudge inspection is permitted; no autonomous public signing/broadcast, funding, code redeployment, mainnet interaction, secret material or forced migration. Every public wallet transaction requires explicit owner review/approval.
- **Local execution:** Codex runs in the owner's Windows checkout on `main`, and must verify the server process and URL before claiming `http://127.0.0.1:3000` is usable. Run only the current work order, preserve a clean fallback, and commit/push verified progress without force. Wallet actions remain owner-controlled.
- **One source of status:** `docs/CURRENT_STATE.md` records proven outcomes; this document controls product direction and work order sequence; `docs/NEXT_CODEX_TASK.md` points at the immediate active work order. Preserve older reports as history.
- **Change control:** a material pivot needs a new empirical competitive or security reason and an explicit decision. Do not treat adrenaline, a competitor announcement, or another model's confident numbers as evidence.

## 5. Next action
Start **WO1 only** from the verified current `origin/main`. Read `AGENTS.md`, `apps/trade-testnet/AGENTS.md`, `docs/CURRENT_STATE.md`, this file and the active task pointer first. If the local environment prevents a native benchmark or public read, attempt the documented setup within scope, implement and verify bounded deterministic parts, report precise missing capabilities, and do not label unavailable tests passed. Deliver a local commit/push and a before/after result summary before authorizing WO2.

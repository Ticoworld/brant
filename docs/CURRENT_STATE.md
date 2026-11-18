# Current state update — 2026-11-17

## WO1B progress — 2026-11-18

- **VERIFIED:** Windows restart reused authenticated market, manifest and custody snapshots. Configure `ROVEKO_PUDGE_PROOF_CACHE_DIR` and a stable, privately held 32-byte hex `ROVEKO_PUDGE_SNAPSHOT_KEY` outside that directory. Rebuild the browser-proof binary for the snapshot worker. It reuses one verified tree per custody state. Display reads can serve snapshots up to 30 seconds old while reconciling in the background.
- **VERIFIED (read-only Pudge):** first reads after restart took 2.706s for market and 1.525s for proof, each with three HTTP requests. Warm verified reads took 1.992–2.017s for market and 1.326–1.998s for proof. Parallel distinct owners returned balances 7 and 0 against the same root.
- **VERIFIED:** typecheck, build, native proof tests, and pinned-artifact history fixture passed. The fixture uses simulated canonical RPC. A separate isolated CKB run committed initialization and Buy transactions, then failed batch enrollment with input lock validation error 22 before the Sell and withdrawal steps.
- **OPEN:** warm executable-state latency targets, confirmed-transition recovery timing, custody-only and withdrawal recovery on native CKB, live reorg recovery, and successor-only native replay. WO1 remains open.

## WO1 progress — 2026-11-18

- **VERIFIED:** Registered market refreshes share in-flight work and batch canonical anchor and live Cell checks. Owner proofs share a market-wide verified leaf snapshot and match its custody outpoint and bytes against the market read.
- **VERIFIED (read-only public Pudge, Windows Node process):** warm market 3.885s to 1.616s and warm owner proof 3.940s to 1.225s. In-process HTTP requests fell from 20 to 3 and from 19 to 3 respectively. A parallel pair used 3 requests for each read path. Proofs returned balance 7 and the market custody root. Collector subprocess RPC is excluded from the HTTP counts.
- **VERIFIED:** typecheck, production build, native replay and leaf corruption checks, separate and indexed lineage, collector, endpoint security and accounting checks passed. The history integration fixture requires additional native contract artifacts.
- **UNIMPLEMENTED:** native successor-only replay and durable authenticated snapshots. A process restart rebuilds market provenance and replays the custody bundle. Both warm latency targets remain open.

## Authoritative Roveko status

- **VERIFIED (public Pudge anchors):** the Gate 2 code Cells are outputs `0x0` through `0x4` of `0x573be2deb4bd7cd28679e5f30a194b2774fd674bd4d96844898cc25dcc49897e`; initialization is `0xc37029b982276a7c3e126a5658510fda1cd5f2963caf650b04f397a8484c7d2a`; xUDT type hash is `0xa706188a0d74a200306109a88fd7835b75eff42f35e9983fa0d3c2138e181ddb`.
- **VERIFIED (owner-reported, transaction references checked read-only):** one public wallet-approved Buy and Sell and subsequent recovery were completed. Exact transaction records and raw receipts remain in the protected migration archive. No public transaction was signed or broadcast during Checkpoint 1.
- **VERIFIED (Checkpoint 1, commit `c3049f74faf9908334c8854fb5ace7176a9f9eb2`, pushed to `origin/main`):** CCC opens from navbar and trade card; wallet states are localized and retryable; total Cell capacity is separated from spendable trade funds; quote, fee, funding capacity, and RVK registry identity are displayed with integer-safe validation.
- **VERIFIED (read-only chain accounting):** current market capacity is 391 CKB and the confirmed issuance output is 300 CKB. **DERIVED:** spendable curve liquidity is 91 CKB. Current one-token Buy/Sell quotes are 17/16 CKB; supply is 2,000, curve inventory 1,993, and custody 7.
- **VERIFIED (browser check):** a 100 CKB Buy budget quotes 5 RVK for 95 CKB, with a 0.01 CKB fee, 156.01 CKB minimum input capacity, and 95.01 CKB total required. Fractional Sell input is rejected without rounding. The “Roveko Genesis, RVK” name is off-chain Pudge registry metadata bound to genesis, market script, xUDT type, and initialization transaction; it is not an on-chain name claim.
- **VERIFIED (checks):** TypeScript typecheck, production build, accounting/metadata, curve, local review, live dependency, and desktop/mobile browser checks passed. Screenshots are in `apps/trade-testnet/evidence/checkpoint-1/`.
- **NOT ESTABLISHED:** a real external wallet transaction in this checkpoint, broad wallet compatibility, security audit, production readiness, liquidity, or profitable exchange economics.

## Checkpoint 2 progress — partial

- **VERIFIED (commit `7169e5f`, pushed to `origin/main`):** the proof route accepts only the registered Gate 2 Pudge market; requires same-origin JSON; bounds request bytes, RPC calls, recovery history, execution time, request rate, and concurrency; validates the current custody output, canonical creator transaction, chain anchor, and native proof before returning it. Temporary files are private and removed after use.
- **VERIFIED (recovery):** owner proof history can be cached by market and owner, revalidated against live custody state, and incrementally extended with confirmed indexer successors. A chain-anchor change or conflicting history invalidates the cache; the bounded canonical collector rebuilds it. Native replay still checks the full history. Persistent cache storage is enabled by `ROVEKO_PUDGE_PROOF_CACHE_DIR`; without it, only a small process-local cache is used.
- **VERIFIED (commit `888b0f3`, pushed to `origin/main`):** the registered RVK market snapshot is written atomically to the configured checkpoint directory and reloaded after a separate Node process starts. Before reuse, the service rechecks Pudge genesis, canonical market producer and issuance, all six code dependencies, the previous chain anchor, current live market/custody Cells, script identities, metadata binding, curve totals and quotes, and tip stability. When the saved singleton has successors, only canonical successor lineage is traversed and verified before trade events and current state are appended. Invalid or reorganized anchors fall back to the existing full recovery path.
- **VERIFIED (read-only public Pudge):** an owner proof for the registered public Gate 2 owner returned the 7-token balance and current custody root. No wallet was used and no transaction was signed or broadcast.
- **VERIFIED (measured):** one local public-Pudge run measured 17.7 seconds cold and 8.9 seconds in a separate process with a saved market checkpoint. Earlier samples were 5.1/2.0 seconds and 4.6/6.3 seconds. RPC timing varied substantially, so no stable market-load speedup is established. Owner proof timings were 26.8 seconds for a cold persistent checkpoint, 18.0 seconds after a separate process restart with the saved owner checkpoint, and 5.3 seconds warm in process. The previously recorded owner-proof figure was about 24.4 seconds. Sub-second proofs are not achieved.
- **VERIFIED (checks):** typecheck, production build, indexed market-successor anchor/reorg fixtures, accounting/metadata, bounded collector append/stale-anchor fixture, endpoint request-security checks, and native Buy/Sell proof-transition checks passed.
- **NOT ESTABLISHED:** persistence on a selected production host, trusted reverse-proxy client-IP handling, externally reachable remote proof testing, market-service successor recovery against an actual public trade, live reorganization handling on a changing chain, or sub-second owner proofs. No hosting account or domain was selected or authorized.

The recorded starting timings were cold market 7–13 seconds, warm market about 2.4 seconds, owner proof about 24.4 seconds, and arithmetic quotes 96–141 ms. The new market checkpoint has not established a repeatable speedup, and arithmetic quote latency was not remeasured here.

## Next milestone

Complete Checkpoint 2 by validating durable host storage and trusted proxy configuration, remeasuring cold and warm behavior on one controlled environment, testing incremental market recovery after a confirmed successor and reorg/conflict invalidation, and exercising the endpoint from an authorized remote origin under its configured bounds. Then proceed to Checkpoint 3. The current code permits only the existing registered market; reusable multi-market registration belongs to Checkpoint 4.

## Superseded public Pudge snapshot

- **VERIFIED (read-only public RPC):** Pudge genesis is `0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606`. Code hash `0x53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f` was deployed at `0x1805b0fda22fd144dced70963cb8396d778b6cba2eb7325c81290f615c070dd8:0`. Market initialization transaction is `0x9fadc8cf7bc2b1af4350da6f24c120a770c5394122ecfe7ea92cf80fa7706ddd`.
- **VERIFIED (read-only public RPC, 2026-11-17):** the 8 transaction records in the protected local archive were all returned as committed. `M.verifyDeployment` and `M.recover` confirmed the deployed code and current market. Current market Cell is `0x3fa9dd0155936e0dacc9bf5e57a4785c3d6d66191a7560f1ff5ec6a6b04954f3:0`; recovered state is phase 1, 2 slots, minimum 12,500,000 shannons, goal 25,000,000 shannons, P=25,000,000, B=20,000,000, count=2.
- **VERIFIED (owner-reported public acceptance; transaction commitment checked read-only):** the owner reports one wallet-approved Buy and Sell followed by chain-state recovery. The raw public transaction history and receipts are preserved in `C:\Users\timot\Desktop\2026\CKB\_RovekoMigrationArchive_20261117\external-records\TradePudgeSecrets\wo14-public-transaction-history.json`. The records do not label each trade action, so this migration does not assign individual hashes to Buy or Sell. No transaction was signed, broadcast, or repeated during consolidation.
- **VERIFIED (source/configuration):** `apps/trade-testnet/public/pudge.json` now identifies the confirmed code outpoint and enables its existing reviewed public signing path. This records the deployed contract; it is not a production-readiness claim.
- **UNIMPLEMENTED / NOT ESTABLISHED:** broad external-wallet compatibility, independent public chain acceptance for additional wallets, security audit, production readiness, liquidity, and business viability. Serving application routes does not establish complete UX or public-chain acceptance.

## Superseded active product milestone

The next task is consumer-product integration: automatic public market loading without manual verification; one clear Buy/Sell action with wallet approval and automatic status tracking; real price history and curve charts; consistent, readable trading UI; real Portfolio and Activity screens; and removal of technical/debug interfaces from normal trader workflows. Do not redeploy contracts or repeat completed public transactions during that work.

## Historical protocol research state

The 2026-11-15 product and protocol notes below are retained as historical evidence and must not override the public Pudge checks above. WO04-E1 remains PARTIAL MECHANISM with critical proof remaining; canonical Ethereum consensus/finality on CKB is UNIMPLEMENTED.

---

# Historical current state update — 2026-11-15

## Roveko baseline

- **VERIFIED:** PR #3 merged into `main` at merge commit `74cc12d4002c5459f4240e698dfe1ea9218cc818`. The working baseline for the Pudge owner-acceptance milestone was `af9cbfc070ea2ee74cdfc912ef3ee3d724e1d6bd`; use `main` for ongoing Roveko development.
- **VERIFIED:** the merge contains the latest Roveko UI and protocol implementation. A focused promotion audit is recorded in [MAIN_PROMOTION_AUDIT.md](MAIN_PROMOTION_AUDIT.md); two imported symlink entries need platform-aware handling, and GitHub reported no status checks for PR #3.
- **VERIFIED (private-node browser acceptance):** one disposable owner completed Launch, Discover, buy, sell, Portfolio, and Activity on one isolated `ckb_dev` chain. Launch, buy, and sell committed as real native transactions; Portfolio reconstructed 7 units and Activity recovered the launch/buy/sell hashes and amounts from committed history.
- **VERIFIED (read-only `/v2` recovery):** after the committed buy/sell history, `/v2` recovers current inventory `1993`, internal custody `7`, and owner entitlement `7`, then shows the same values after reload. The check submitted no transaction and left the chain tip unchanged. The summarized result is [trade-recovery.json](../apps/trade-testnet/evidence/v2-trade-recovery-1794764545869/trade-recovery.json); raw receipts, logs, and screenshots remain in the preserved timestamped local evidence directories.
- **VERIFIED (focused checks):** TypeScript typecheck and fixture-gate, local-manifest, transaction-layout, and lineage tests passed after the recovery fix. This is local integration evidence, not a production security audit.
- **AUTHORIZED, NOT YET VERIFIED:** a narrowly scoped owner-operated acceptance may use only official CKB Pudge Testnet, Pudge testnet CKB, and the existing Roveko contract architecture. Every transaction requires individual owner review and approval in the connected browser wallet; signing and broadcast remain separate owner actions. No automatic signing/broadcast, private-key extraction/import, fixture credentials, mainnet transaction, or unattended deployment is authorized.
- **UNVERIFIED:** public Pudge deployment, market identity, transactions, external-wallet flow, independent public-chain verification, liquidity, security review, and production readiness. The public manifest's `code: null` remains no evidence of a deployed market.

## Roveko application status

- **VERIFIED (source tree):** `apps/trade-testnet` contains Discover, Portfolio, Activity, and Launch routes plus private-chain local market discovery and wallet-mediated trading flows. Outside explicit local fixture mode, sample Discover rows remain demo fixtures, not live data.
- **DERIVED (source inspection):** the default app client is configured for public CKB Pudge testnet RPC, and the source includes wallet-mediated transaction signing and submission paths. This describes code behavior, not a verified public deployment or successful public transaction.
- **UNVERIFIED:** current public Pudge code identity and availability; a complete deployment, initialization, trading, withdrawal, and recovery lifecycle on Pudge; external-wallet compatibility; independent public-chain verification; security review; maker commitments; and profitable exchange economics.
- **UNIMPLEMENTED:** independent authentication of public RPC observations and a production-grade validation of the full product workflow. Local mock-RPC, disposable-chain, and protocol-lab results do not close these gaps.
- This authorization does not establish public acceptance, production readiness, liquidity, or business viability. Do not advance dependent stages until each preceding public transaction is canonically confirmed and reconciled.

The notes below preserve protocol-research state. Historical experiment conclusions remain context only and are not evidence that the Roveko public Pudge product workflow has been verified. The active task pointer is [NEXT_CODEX_TASK.md](NEXT_CODEX_TASK.md).

---

# Historical rebuild pointer — 2026-11-01

WO05–WO08 comprehensive native reconstruction is isolated in labs/rebuild on rebuild/wo05-wo08. Read REBUILD_WO05_WO08_STATUS.md, TRADE_CAPABILITY_REGISTRY.md and WO09_READINESS.md for current evidence and limits. Substantial compact/hybrid, clearing, commitment/revocation, launch/quote/economic and DAO proofs are preserved; arbitrary-history authenticated recovery/LO-01 remains unresolved/blocked. Full recovery/readiness is not claimed and no WO09 implementation has begun.

The original WO01–WO04 foundation state below is preserved as historical context. Do not resume WO04 cross-chain implementation under the rebuild mission.

---

# Historical project state — October 30, 2026

## Goal
Find whether native CKB can support a safer, faster, more capital-efficient trading business than available alternatives. Candidate customer jobs: one-off native-asset delivery, and repeated funded-session trading. No customer demand, maker commitments, executable competitive quotes, or profitability have been proven.

## Proven locally in research labs
- WO01: isolated CKB concurrency/mempool behavior with independent cells and dependency chains.
- WO02: native CKB/EVM escrow trades; exposed dangerous leaked preimages and claim/refund races. Do not use as production architecture.
- WO03: six inconsistent exit outcomes in a simplified independently adjudicated two-leg model; 19 contract cases, 103 EVM transaction receipts, 9,565 modeled states. This is **not** a Perun exploit.
- WO04 partial: actual native CKB funded session, 100 alternating signed updates, independent local CKB exit. Foreign-chain exit consistency not established.
- WO04-E1: 12 CKB transactions, 24 isolated-EVM receipts, 30 named defensive/result cases; four terminal outcomes and one reserved during outage. CKB verified real account/storage proofs RELATIVE to a controller-selected EVM execution root. Two CKB reservations shared read-only checkpoint. No foreign finality authentication.

## Central unproven security obligation
CKB must authenticate a sufficiently finalized, canonical external execution state root without trusting whoever submits it, before source storage proofs may authorize actual principal payouts. E1 currently trusts the root chosen by the devnet controller.

## Measured E1 cycle economics
- Direct proof settlement averaged ~442,403.5 CKB-VM cycles per trade.
- Shared read-only checkpoint consumption averaged ~49,594 cycles each.
- One checkpoint publication cost ~2,064,388 cycles.
- For two settlements, shared path totaled ~2,163,576 cycles vs ~884,807 direct proxy. Batching is not already cheaper at N=2; rough modeled cycle crossover ~6 with exclusions.
- Fixed fixture fees did not fall merely because cycles fell. Real proof, retention, and maker economics unmeasured.

## Next experiment (WO04-E2 candidate)
1. Reconstruct and compile E1 from this repository; verify results and explicitly label lack of consensus verification.
2. Compare actual ways to authenticate a finalized EVM execution root on CKB (correct light-client updates, succinct proof of same predicate, or security-explicit optimistic protocol) with executable measurements.
3. Wire an authenticated root into E1's existing payout/refund verifier, with incorrect-chain, stale, malformed, unfinalized proof cases.
4. Independently consider Ethereum zero-slot non-inclusion refund after immutable deadline to remove customer EVM `open` transaction. This is **NOT IMPLEMENTED**.
5. Compare independent direct proofs with shared checkpoint cost and recovery, not just CKB cycles.

No need to rerun WO01–WO04 historical experiments unless one targeted regression is necessary.

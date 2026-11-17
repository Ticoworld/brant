# Current state update — 2026-11-17

## Roveko product rebuild status — 2026-11-17

- **VERIFIED (implementation):** the active app now has Discover, Market, Portfolio, Activity, and Launch routes using the pinned donor's trading-panel hierarchy and responsive behavior, translated to Tailwind v4. The public product routes no longer expose the old `/v2`, `/claims`, `/fixture`, `/experience-fixture`, or R7 demo pages. The R7 research APIs remain separately gated.
- **VERIFIED (checks):** production build, TypeScript typecheck, market route parser, snapshot restore/rejection checks, and the anonymous Playwright acceptance matrix passed. The browser run covered 5 routes × 2 viewport sizes × 2 locales (20 captures), reported no page errors or horizontal overflow, and is preserved at `apps/trade-testnet/evidence/roveko-ui-transplant-2026-11-17/browser-acceptance-1794901948874`.
- **VERIFIED (persisted cache restart):** cold full-history market recovery took 58,288 ms. After a clean production-server stop and restart, the persisted snapshot was loaded, reconstructed, and revalidated against the live deployment, current market Cell, and state root in 7,342 ms. Subsequent UI checks used the recovered market. This verifies restart recovery; the revalidation still performs public RPC reads and is not an always-fast or signing cache.
- **VERIFIED (current product identity):** the UI registry names `Pudge backed-claim market`, identity `0x3d313a3ddcc655d2fd30344b0d97d0bdf845da2ca33bc067c783cf8ad63d30a6`, initialized by `0x9fadc8cf7bc2b1af4350da6f24c120a770c5394122ecfe7ea92cf80fa7706ddd`. The deployed `TCM0002` contract and `lib/pudge/market.ts` implement backed claims (contribution, activation, redemption, paid assignment, refund, close), not fungible-token minting or a bonding curve. The UI therefore correctly shows a backed-claim market with no invented token identity, price history, volume, or token balance.
- **VERIFIED (public transaction history):** the protected archive's committed transition chain contains deployment `0x1805b0fda22fd144dced70963cb8396d778b6cba2eb7325c81290f615c070dd8`, initialization `0x9fadc8cf7bc2b1af4350da6f24c120a770c5394122ecfe7ea92cf80fa7706ddd`, contribution operations `0xc043f3ba7521dd9d5c27d3c558647c96cdc962d1e078a157ad282f591eda9226`, `0x20ccf5427ea835baa51a010974ad8010833849c3b97e168ac733817729cf6d48`, and `0x01d506c096e52a90eec5f6dbabe70b4d9ff79a4f3e70a95e99c3ac58165ce6cf`, refund `0x3d096e6c74ddc787d44568d5e60710d30203d9626b3ce2f009590ba48c629c16`, activation `0x14454445224c004844954e4a713c32ef54f7c199120239a2b496574b967a80a1`, and paid claim assignment/current market Cell `0x3fa9dd0155936e0dacc9bf5e57a4785c3d6d66191a7560f1ff5ec6a6b04954f3`. These are backed-claim operations, not token Buy/Sell swaps. The owner-reported Buy/Sell labels are not assigned to individual hashes in the archive.
- **DERIVED (source inventory):** `apps/trade-testnet/lib/v2-engine/curve.ts`, `transaction.ts`, `review.ts`, `pudge-manifest.ts`, and the associated proof/lineage/recovery modules contain a separate token curve and transaction path. These components are not the deployed `TCM0002` market and are not wired into the active product routes.
- **UNIMPLEMENTED:** the intended live fungible-token bonding-curve market and identity, wallet-backed token Buy/Sell flow against that market, real token price history, durable Activity, and production-grade Portfolio remain incomplete. No transaction was signed or broadcast and no deployment was performed during this rebuild.

## Roveko public Pudge baseline

- **VERIFIED (read-only public RPC):** Pudge genesis is `0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606`. Code hash `0x53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f` was deployed at `0x1805b0fda22fd144dced70963cb8396d778b6cba2eb7325c81290f615c070dd8:0`. Market initialization transaction is `0x9fadc8cf7bc2b1af4350da6f24c120a770c5394122ecfe7ea92cf80fa7706ddd`.
- **VERIFIED (read-only public RPC, 2026-11-17):** the 8 transaction records in the protected local archive were all returned as committed. `M.verifyDeployment` and `M.recover` confirmed the deployed code and current market. Current market Cell is `0x3fa9dd0155936e0dacc9bf5e57a4785c3d6d66191a7560f1ff5ec6a6b04954f3:0`; recovered state is phase 1, 2 slots, minimum 12,500,000 shannons, goal 25,000,000 shannons, P=25,000,000, B=20,000,000, count=2.
- **VERIFIED (owner-reported public acceptance; transaction commitment checked read-only):** the owner reports one wallet-approved Buy and Sell followed by chain-state recovery. The raw public transaction history and receipts are preserved in `C:\Users\timot\Desktop\2026\CKB\_RovekoMigrationArchive_20261117\external-records\TradePudgeSecrets\wo14-public-transaction-history.json`. The records do not label each trade action, so this migration does not assign individual hashes to Buy or Sell. No transaction was signed, broadcast, or repeated during consolidation.
- **VERIFIED (source/configuration):** `apps/trade-testnet/public/pudge.json` now identifies the confirmed code outpoint and enables its existing reviewed public signing path. This records the deployed contract; it is not a production-readiness claim.
- **UNIMPLEMENTED / NOT ESTABLISHED:** broad external-wallet compatibility, independent public chain acceptance for additional wallets, security audit, production readiness, liquidity, and business viability. Serving application routes does not establish complete UX or public-chain acceptance.

## Active product milestone

The consumer-product rebuild is a truthful partial implementation. Do not repeat the completed deployment/initialization/owner-acceptance milestone or claim that the current backed-claim deployment is a fungible-token exchange. Before token trading can be completed, the project needs a verified fungible-token bonding-curve deployment and identity, then a separately scoped integration and owner-approved transaction milestone. Keep the existing `lib/v2-engine` token mechanisms distinct from the currently deployed backed-claim contract.

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

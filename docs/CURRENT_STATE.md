# Current state update — 2026-11-15

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

# Current rebuild pointer — 2026-11-01

WO05–WO08 comprehensive native reconstruction is isolated in labs/rebuild on rebuild/wo05-wo08. Read REBUILD_WO05_WO08_STATUS.md, TRADE_CAPABILITY_REGISTRY.md and WO09_READINESS.md for current evidence and limits. Substantial compact/hybrid, clearing, commitment/revocation, launch/quote/economic and DAO proofs are preserved; arbitrary-history authenticated recovery/LO-01 remains unresolved/blocked. Full recovery/readiness is not claimed and no WO09 implementation has begun.

The original WO01–WO04 foundation state below is preserved as historical context. Do not resume WO04 cross-chain implementation under the rebuild mission.

---

# Current project state — October 30, 2026

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

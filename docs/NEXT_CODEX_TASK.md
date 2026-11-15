# Completed milestone: Roveko local product integration

## Objective

Prove one complete customer journey in the existing Roveko application against a privately controlled isolated CKB node. This is a local product-integration milestone, not a public launch or a claim that Roveko is ready for public trading.

## Acceptance

Using one disposable owner and one fresh private CKB node, run the application through these routes:

1. **Launch:** build and verify the pinned current market code, deploy it only to the fresh private node using the existing workflow, then create and initialize one market.
2. **Discover:** find that market from verified private-chain state and open it in the application.
3. **Trade:** buy and sell through the existing transaction review and wallet-signing path. Both transactions must commit on the private node.
4. **Portfolio:** show the owner's verified post-trade holdings from reconstructed chain state.
5. **Activity:** show the committed launch and trade transactions with their real hashes and correct actions/amounts.
6. Reload the application and recover the same verified market, holdings, and history from chain data. A local-storage record alone is not proof of state.

Use native transfers and actual committed Cells; do not substitute mock balances or mock RPC for this acceptance. Preserve raw transaction receipts, reproducible commands, versions, and browser evidence in a new evidence directory. Classify each conclusion as VERIFIED, DERIVED, HYPOTHESIS, or UNIMPLEMENTED.

## Boundaries

- Work in the existing Roveko checkout on `main`. Do not change branches, delete worktrees, or disturb either preserved stash or WO15.
- Reuse existing pinned contract code and the current market implementation. No new contract features, fee model, Arena work, or unrelated UI redesign.
- Use only a locally controlled isolated CKB node and disposable test keys. No public Pudge or UTXO Global signing, funding, deployment, or broadcast is authorized by this task. No mainnet, public testnet, or real assets.
- Preserve all existing source and historical evidence. Write new outputs only to a fresh evidence directory.
- The public Pudge deployment and trading journey remains UNVERIFIED. Do not represent local results as public-chain, security, liquidity, or business validation.

## Environment and verification

First record the actual operating system, Node/npm versions, pinned native tool versions, browser, required binaries, available disk, and whether a private CKB node can be started. Do not relabel old receipts as a fresh run. If a required tool or network dependency is unavailable, record the exact command and error and keep the implementation result separate from the unrun acceptance.

Run focused typecheck and production build checks after edits. Run the integrated browser/native acceptance only when its pinned binaries, private node, and disposable fixtures are available. Preserve all outputs; do not overwrite earlier evidence.

## Follow-on gate

Only after this local acceptance is complete should a separately scoped task address the physical UTXO Global and public Pudge journey. Correct the repository's authorization scope first and require explicit approval for any concrete public transaction. User demand, maker commitments, liquidity, security, and profitable economics remain unproven.

## Acceptance result — 2026-11-15

- **PASS (VERIFIED):** a single disposable owner completed Launch, Discover, Buy, Sell, Portfolio, Activity, and recovery on the same isolated private CKB node. The committed launch transaction is `0x5068a444fcac73731a1f16e654528b5931c51330a581100a9b1efe31c519773c`, Buy is `0x3a73b382f8925b978ba63940792f72618a993f6aaf2330f584d336808cc48e3b`, and Sell is `0x2e245d58ac6e1244af31aeb7f3c98d30c4866c4e9e4fb7a1088e9115231317f9`.
- **VERIFIED:** after Buy/Sell, `/v2` follows the current market successor to its custody successor and uses the same committed-history owner recovery as Portfolio. The read-only browser regression recovered inventory `1993`, internal custody `7`, and owner entitlement `7` before and after reload; zero transactions were submitted and the chain tip did not change.
- **VERIFIED:** TypeScript typecheck and the fixture-gate, local-manifest, transaction-layout, and lineage tests passed after the recovery change.
- Evidence and failed diagnostic attempts remain preserved in their timestamped directories under `apps/trade-testnet/evidence`. The focused passing result is [trade-recovery.json](../apps/trade-testnet/evidence/v2-trade-recovery-1794764545869/trade-recovery.json); full receipts and screenshots remain in the local evidence directories.
- Public Pudge deployment, code identity, transaction lifecycle, external-wallet compatibility, liquidity, security, and business economics remain **UNVERIFIED**. No public Pudge or UTXO Global transaction is authorized by this local acceptance result.

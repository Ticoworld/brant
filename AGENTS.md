# Codex engineering rules for Roveko and CKB research

## Purpose
Develop Roveko from the authoritative `main` branch while preserving the independent CKB protocol research labs. Security, accurate product claims, and maker economics matter more than feature count.

## Current canonical state
- `main` is the active Roveko development branch. The existing Roveko checkout is the development baseline; preserve other worktrees, branches, and stashes.
- **VERIFIED:** the single-owner local Roveko journey completed Launch, Discover, Buy/Sell, Portfolio, Activity, and reload recovery against one isolated private CKB node. The focused `/v2` recovery evidence is in `apps/trade-testnet/evidence/v2-trade-recovery-1794764545869`; this does not establish public-chain readiness.
- **AUTHORIZED, NOT YET VERIFIED:** a narrowly scoped public acceptance milestone may use only official CKB Pudge Testnet and Pudge testnet CKB with the existing Roveko architecture. Each transaction must be reviewed and individually approved by the owner in the connected browser wallet before signing, and separately approved by the owner before broadcast. `public/pudge.json` with `code: null` remains no evidence of a deployed market.
- Mainnet transactions, private-key extraction/import, fixture credentials, unattended signing or broadcasting, and deployment without individual owner approval are prohibited. Do not represent public acceptance as complete without canonical transaction and recovery evidence.
- See `docs/CURRENT_STATE.md` for evidence labels and `docs/NEXT_CODEX_TASK.md` for the active milestone.
- WO04-E1 is PARTIAL MECHANISM, CRITICAL PROOF REMAINING.
- E1's EVM account/storage proofs are checked against a controller-selected execution root; canonical Ethereum consensus/finality on CKB is **UNIMPLEMENTED**.
- WO04 funded-session implementation exists but is incomplete; splice attempt failed due to a dependency import; cross-chain exits not established.
- WO03 demonstrated mixed exit allocations in an intentionally simplified two-adjudicator EVM lab, not an exploit of Perun.
- WO02's raw original ZIP was truncated; its reports here are historical only.

## Rules
- Read docs/CURRENT_STATE.md and docs/NEXT_CODEX_TASK.md before modifying source.
- Keep independent labs and historical evidence intact. Do not delete, rewrite, or overwrite prior results.
- Do not overwrite historical execution evidence, rewrite prior results, or pretend tests ran.
- For local tests, use only a privately controlled isolated CKB node and disposable test keys. For the separately authorized Pudge acceptance milestone, use only official CKB Pudge Testnet; do not sign or broadcast automatically, and do not proceed until the owner has reviewed and approved that specific transaction in the connected browser wallet. Never use mainnet, extract/import private keys, or commit credentials.
- Keep wallet validation, transaction verification, canonical confirmation, reconciliation, and recovery safeguards. Never advance a dependent deployment/initialization/trading stage before the prior transaction is confirmed and reconciled.
- Prioritize one decisive missing proof at a time; preserve raw traces and independently rerunnable tests.
- Make every claim distinguish VERIFIED, DERIVED, HYPOTHESIS and UNIMPLEMENTED.
- Explicitly test conflicting payouts, stale roots, wrong chain/contract, proof withholding, expired intents, and fees in a safe own-contract test environment.
- A signature, a Merkle branch, an `eth_getProof`, or a controller-selected root is not proof of Ethereum consensus/finality.
- Prefer canonical source/version pinning over relying on changed upstream head revisions.
- Don't delete existing code or substitute synthetic balances for native chain transfers.
- Preserve security of the original participants and the project: never output or commit secrets; fixture keys MUST stay limited to isolated testing.
- Do not equate a working proof component with a profitable exchange business.
- When blocked by cloud setup/network policy, produce a reproducible environment report and bounded next step rather than making unsupported claims.

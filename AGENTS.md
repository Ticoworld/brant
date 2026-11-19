# Codex engineering rules for Brant and CKB research

## Purpose
Develop Brant from the authoritative `main` branch while preserving the independent CKB protocol research labs. Security, accurate product claims, and maker economics matter more than feature count.

## Current canonical state
- `C:\Users\timot\Desktop\2026\CKB\trade` is the authoritative checkout on `main`, tracking `origin/main`. Keep Brant in this folder and repository.
- **VERIFIED (read-only public-chain checks, 2026-11-17):** Pudge genesis is `0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606`; code hash `0x53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f` is deployed at transaction `0x1805b0fda22fd144dced70963cb8396d778b6cba2eb7325c81290f615c070dd8:0`; the market initialized and `M.verifyDeployment` / `M.recover` verified the live market state. The public manifest records that deployment.
- **VERIFIED (owner-reported public acceptance; transaction commitment checked read-only):** one wallet-approved Buy and Sell and subsequent chain-state recovery were completed. The protected local migration archive preserves the exact public transaction records and raw receipts. The 8 saved Pudge references were reported committed by public RPC. This migration did not sign, broadcast, or redeploy.
- **VERIFIED (local private-chain acceptance):** the single-owner Roveko journey completed Launch, Discover, Buy/Sell, Portfolio, Activity, and reload recovery against one isolated private CKB node. Evidence is in `apps/trade-testnet/evidence/v2-trade-recovery-1794764545869`; it is separate from public-chain evidence.
- Public Pudge acceptance does not establish broad external-wallet compatibility, a security audit, production readiness, liquidity, or profitable exchange economics. Do not use mainnet, extract/import private keys, commit credentials, or sign/broadcast without the owner's individual wallet approval.
- `docs/CURRENT_STATE.md` records evidence and limitations. `docs/NEXT_CODEX_TASK.md` points to the controlled public Pudge alpha; do not restart the completed deployment/initialization/Buy/Sell acceptance milestone.
- WO04-E1 is PARTIAL MECHANISM, CRITICAL PROOF REMAINING.
- E1's EVM account/storage proofs are checked against a controller-selected execution root; canonical Ethereum consensus/finality on CKB is **UNIMPLEMENTED**.
- WO04 funded-session implementation exists but is incomplete; splice attempt failed due to a dependency import; cross-chain exits not established.
- WO03 demonstrated mixed exit allocations in an intentionally simplified two-adjudicator EVM lab, not an exploit of Perun.
- WO02's raw original ZIP was truncated; its reports here are historical only.

## Rules
- Read docs/CURRENT_STATE.md and docs/NEXT_CODEX_TASK.md before modifying source.
- Keep independent labs and historical evidence intact. Do not delete, rewrite, or overwrite prior results.
- Do not overwrite historical execution evidence, rewrite prior results, or pretend tests ran.
- For local tests, use only a privately controlled isolated CKB node and disposable test keys. Public-chain reads must remain read-only unless a new, specific owner-approved milestone authorizes a transaction. Never use mainnet, extract/import private keys, or commit credentials.
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

# Codex engineering rules for CKB Trading Opportunity

## Purpose
Build and experimentally validate protocol mechanisms for native CKB trading with assets delivered on other chains. Security and maker economics matter more than feature count.

## Current canonical state
- WO04-E1 is PARTIAL MECHANISM, CRITICAL PROOF REMAINING.
- E1's EVM account/storage proofs are checked against a controller-selected execution root; canonical Ethereum consensus/finality on CKB is **UNIMPLEMENTED**.
- WO04 funded-session implementation exists but is incomplete; splice attempt failed due to a dependency import; cross-chain exits not established.
- WO03 demonstrated mixed exit allocations in an intentionally simplified two-adjudicator EVM lab, not an exploit of Perun.
- WO02's raw original ZIP was truncated; its reports here are historical only.

## Rules
- Read docs/CURRENT_STATE.md and docs/NEXT_CODEX_TASK.md before modifying source.
- Keep independent labs intact; build new experiments on branches / separate new directories.
- Do not overwrite historical execution evidence, rewrite prior results, or pretend tests ran.
- Use only privately controlled, isolated devnets and disposable test keys. No mainnet, externally funded testnets, real assets, or public deployment. No real credentials committed.
- Prioritize one decisive missing proof at a time; preserve raw traces and independently rerunnable tests.
- Make every claim distinguish VERIFIED, DERIVED, HYPOTHESIS and UNIMPLEMENTED.
- Explicitly test conflicting payouts, stale roots, wrong chain/contract, proof withholding, expired intents, and fees in a safe own-contract test environment.
- A signature, a Merkle branch, an `eth_getProof`, or a controller-selected root is not proof of Ethereum consensus/finality.
- Prefer canonical source/version pinning over relying on changed upstream head revisions.
- Don't delete existing code or substitute synthetic balances for native chain transfers.
- Preserve security of the original participants and the project: never output or commit secrets; public fixture keys MUST stay limited to isolated testing.
- Do not equate a working proof component with a profitable exchange business.
- When blocked by cloud setup/network policy, produce a reproducible environment report and bounded next step rather than making unsupported claims.

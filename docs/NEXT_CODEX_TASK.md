# Active milestone: Pudge Testnet owner acceptance

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

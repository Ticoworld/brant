# Owner recovery review — 2026-11-01

## Verdict

Known self-created fixture recoveries VERIFIED. Security against arbitrary forged lineage or untrusted recovery packages UNPROVED. Upstream A2 order-confusion finding LO-01 UNRESOLVED. No reproduction or correction of LO-01 was executed in this rebuild. The upstream report is reference evidence, not a fresh attack result.

## Ordinary source inspection

- `native/src/recover.cjs` selects supplied input cells whose supplied lock hash equals the selected public fixture role and creates a full-transaction sighash signature. It does not fetch chain inputs, verify supplied metadata against live cells, authenticate ancestry, constrain payout intent or choose between competing successors. It is a signing worker for trusted harness packages, not an independently secure recovery client.
- `native/src/run.cjs` constructs the master and authentic order together, retains exact outpoints and tracks successors directly from its own committed fills. Its wrong-key and rewritten-reference tests are narrow real VM rejections for those transactions.
- `vendor/ickb/contracts/limit_order/src/entry.rs` groups encountered orders/masters by metapoint, checks allowed mint/melt/match configurations and preserves order info/value. These checks apply when the script executes; they do not establish that every cell bearing that output lock was authenticated at creation. The pinned CKB execution model does not execute output locks as authorization checks.
- Upstream `ICKB-Audit-Report.md` at c951927e35fb5d4a13e28c5e55687d49cea7ca05 identifies LO-01 as known/live. Reviewed contract source last changed at 454cfa966052a621c4e8b67001718c29ee8191a2. A copy is preserved in `labs/rebuild/reference/ICKB-UPSTREAM-SECURITY-REVIEW.md`, under upstream MIT license. Its specific phantom-order/order-stranding tests were not run here and no fix was ported.

## Non-sensitive validation

`review-lineage.cjs` reads the known harness event history without signing or sending transactions. For its own recorded mint outputs it verifies the same-transaction master type, distance and padding. For its own match outputs it finds one known predecessor with the same master reference, asset type and order info. Removing required history is detected offline. This is a consistency check over controlled records, not a general chain provenance authenticator and not a guard wired into recover.cjs.

Native wrong-signature rejections establish wallet authorization in tested flows. They do not establish that an owner cannot be induced to sign the wrong transaction. A recovery signature binds the submitted payout; it does not prove that the payout or lineage matches the owner's intent.

## Required next proof

Before using arbitrary discovered A2 orders for WO09, specify a recovery policy rooted in independently retained authenticated mint transactions and intended owner/asset/payout; verify current live cells and continuous lineage before signing; explicitly distinguish an incomplete-history refusal from valid recovery. Independently validate that policy and the upstream confusion boundary in a permitted isolated test workflow. Do not label this as a corrected contract or a secure recovery client until those specific checks pass.

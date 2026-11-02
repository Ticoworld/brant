# Failed hypotheses and boundaries

1. **“Zero marginal Cell means zero cost.”** Rejected. Existing capacity is capital; fees, VM execution, wallet inputs and liquidity remain. New normal output still needs capacity.
2. **“An immutable root can pay arbitrary exits once.”** Incomplete: immutable leaves repeat. Change root and exits contend; add nullifiers and per-user state returns. Model counterexample only, no vault execution.
3. **“Tiny principal exits by itself.”** Rejected for a new normal61-CKB output with principal below61. Needs existing recipient Cell, supported ACP, sponsor, aggregation or weaker off-chain credit.
4. **“A signature is a resting order.”** Rejected: spent inputs stale a draft; no cell reservation, fill or admission guarantee.
5. **“Fiber/rollup/channel is a generic claim system.”** Not established. Payment routing, programmable conditionals, durable liabilities and independent close are distinct properties.
6. **“Transferable E1 beneficiaries are ready.”** Unresolved and quarantined. E2 does not validate or rename that correction.
7. **“A 32-byte root alone proves cheap independent exit.”** Rejected as an incomplete design claim. Liquid Cells' tested script requires an authenticated proof path, a nullified successor root, exact accounting and a key-derived payout. The shared anchor still serializes exits, archived DA is needed to reconstruct proofs, and sub-floor balances do not have unilateral standard-Cell payout. The upstream CKB-VM tests passed, but private-chain recovery has not been exercised.

Harness/native result is limited to a local whole-body complete-fill xUDT/CKB exchange. No fee is measured. No failed native transaction is relabelled as a pass.

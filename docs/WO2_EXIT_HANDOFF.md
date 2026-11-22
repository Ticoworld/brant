# Independent withdrawal handoff

The application recovery CLI can prepare a withdrawal for a private CKB 0.210.0 fixture and consume the signed RPC transaction from a separate signer. Use Node 22 with `--experimental-strip-types`. Run with the application server stopped.

1. Run `collect-blocks` from the initialization transaction with both market scripts and the owner lock hash. Use the canonical full-block bundle as `--bundle`.
2. Run `prepare-withdrawal` with `--node`, `--bundle`, `--owner-lock`, `--funding-outpoint`, and a new `--out`. The owner file contains only the public lock script. Review the artifact's network, inputs, destination, quantity, occupied capacity, change and fee. Amounts are in shannons.
3. Give the artifact's `transaction` to the isolated-chain signer. Export the signed RPC transaction. The owner signature belongs in the first standard-lock group witness at index 2. The extra TMS1 witness must remain byte-for-byte identical.
4. Run `submit-signed-withdrawal` with the same arguments, a fresh `--out` and `--signed` pointing to the signed RPC transaction. The command reconstructs the review, verifies the CCC signature and executes signed `estimate_cycles` before submission. Use `--mine` only on the disposable private node.
5. If submission returns an uncertain result, reconcile the hash in the saved report with `verify-withdrawal`. Recollect canonical history before any further preparation. After commitment, verify the owner entitlement is exhausted for a full withdrawal.

The archived native receipt recorded a signed estimate of `0x2062fa` cycles. The public unsigned estimate reported standard-lock failure at funding input 2. That input needs a recoverable 65-byte secp256k1 lock signature over the raw transaction hash, the zeroed first group witness and the extra witnesses, including TMS1. Empty witness bytes cannot satisfy the funding lock. A fresh signed run is still required to qualify this handoff.

## Future owner-operated Pudge acceptance

This procedure requires separate authorization and a working standalone UTXO Global adapter.

1. Stop Brant. Run the lab CLI's read-only Pudge collection/replay and `prepare-public-withdrawal` for the registered market. Check current custody and marker outpoints, live dependencies, current entitlement, destination lock and selected plain funding Cell. Use the new review's values.
2. Check output 0 is the custody successor with preserved capacity, reduced xUDT amount and the new root. Output 1 recreates the custody marker at the same capacity. Output 2 is an owner-locked xUDT Cell with 142 CKB occupied capacity for the standard 20-byte lock and current token type. Output 3 returns the remaining capacity to the owner, with a minimum of 61 CKB. At the CLI's 0.01 CKB fee cap, the funding Cell must hold at least 203.01 CKB. Check the reviewed fee against current fee policy before approval.
3. Have the owner approve the exact reviewed transaction via UTXO Global. Verify the returned signature, transaction hash and untouched TMS1 witness locally. Estimate VM cycles using the signed transaction. Under the separate authorization, submit only the approved hash and resolve any uncertain response by querying that hash.
4. Fetch the full canonical block and committed transaction independently. Verify the spent predecessors, custody root and resulting owner-locked xUDT. Start recovery again from initialization and confirm the withdrawn entitlement cannot be spent again.

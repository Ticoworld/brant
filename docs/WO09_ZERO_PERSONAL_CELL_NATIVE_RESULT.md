# Native zero-personal-Cell result — 3 November 2026

**PARTIAL ADVANCE.** An isolated fully CKB-backed claim pool executes owner-authorized funding, transfers and recovery with no personal user Cell inputs. It does not provide unconditional small standalone L1 withdrawal, a two-asset DEX or production security qualification. Existing financial Merkle contracts are unchanged.

Current preferred evidence: `labs/wo09-unified/capacity-access/evidence/native-1793681058034`. Twenty-six committed native CKB0.210.0 transactions across two actually funded markets, twenty-five independently verified Ed25519 user signatures, both markets closed with zero liabilities. `independent-verification.json` replays actual UTXOs, exact fees, roots, old/new records and user signatures using Node/OpenSSL independently of the on-chain Zig verifier. All signed transactions and rejected submissions remain in compressed raw RPC logs.

Three fresh Ed25519 identities and separate future secp recipient keys are generated in memory. Private keys are not preserved. Full canonical disposable-chain UTXO scans establish zero personal receiving Cells for all three before/after enrollment and Alice/Bob during initial trading. Funding comes from an identified real standard-secp input; claim liabilities rise by actually deposited CKB. Alice initially receives1CKB, Bob5, Carol70. This is native-backed claim transfer, not an unfunded database balance or asserted multi-asset swap.

The shared lock/type covenant authenticates each Merkle transition plus direct witness signatures. User messages bind a fixed protocol tag, executing script hash (including code and market identity), declared chain/genesis domain, raw transaction hash and canonical full operation witness with signature slots zeroed. Public keys, paths, balances, nonces, outputs, fees, dependencies and spent outpoints are bound. Standard sponsor input signatures do not substitute for user authorization. Witness verification uses Zig0.14.1 `std.crypto.sign.Ed25519`; custom lock cryptography is allowed by the VM, but this adapter still needs independent security review.

The funding key is disabled in the runner during owner recovery; the cooperating recipient/fee-provider key is separately disabled during input-free trading. No Trade server or privileged operator signature exists in this design. Fresh child processes reconstruct proofs from committed RPC history. The evidence proves no such signing key/input is needed for the tested operations; it does not simulate a public-network outage, censorship or reorg.

## Actual accepted cases

- Genuine external funding to each key-only owner, without its personal Cell input.
- Alice→Bob and Bob→Alice funded-claim transfers; users pay bounded actual fees from their own pool claims, without a personal fee Cell.
- Fresh public-history reconstruction after unrelated root updates, followed by successful owner-authorized transfers.
- Exact owner-authorized merging into an independently controlled recipient's actual funded/secp-signed Cell. This is a cooperative external payment route, not automatically cash owned by the original claimant afterward.
- Carol withdraws a sufficiently large claim into a new ordinary Cell, then actually spends it with her secp key.
- Prepaid fee reserve is deliberately exhausted through an authorized high-fee transfer. Later claim-paid trading still commits; principal is not silently charged by the operator.
- Another provider voluntarily contributes61CKB to make Bob's small withdrawal a funded ordinary Cell. That extra capacity is an **irrevocable gift**, not a demonstrated recoverable/reusable lease. It is not available if that provider refuses/disappears.
- Remaining owner settles, then designated capacity funder recovers the empty pool's cushion under its own signature.

## Rejections and limitations

Actual native failures include invalid user signature82, public-key substitution80, arbitrary root46, capacity drain with unchanged state33, cross-market signature replay82 against another genuinely funded market, stale proof/intent, repeated consumed inputs/withdrawals, and closure with outstanding claims32. Raw resolver, covenant and policy errors are preserved separately.

Tiny direct output passes `estimate_cycles` but native admission rejects `InsufficientCellCapacity(Outputs[1])`. Zero-fee valid script execution separately fails relay policy; one run requires at least1,108shannons for the1,104-byte transfer. These are not contract rejection PASSes. Claim-paid10,000-shannon transactions do commit after the prepaid fee budget is exhausted.

The first run failed after code deployment because the node had no `get_cells` indexer method. Corrected absence validation reconstructs the actual canonical live UTXO set by scanning committed blocks. This environment failure is preserved at `native-1793680470645`, not counted as a protocol failure or a successful owner-authorization experiment. The first complete16-transaction run `native-1793680522541` is also preserved.

Binary:48,752bytes, SHA256 `5097f45ba10565837ee7ef7d82b31bc8dbb332272c19255f8da9466f6f19d81e`. Code Cell occupies48,793CKB in this deployment; shared vault has144bytes data and282CKB minimum occupied capacity, plus exact customer principal and optional separate fee reserve. Capacity funder cannot reduce that immutable cushion or close while liabilities remain.

Measured three-owner transfer:1,104bytes,11,328,884cycles in the expanded run; another rebuilt transfer11,401,360cycles. Two Ed25519 owners sign; both covenant roles execute. Standalone large withdrawal949bytes/5,783,474cycles. These are complete native transactions, not a scalar crypto benchmark. No1,000/10,000-user native scale result is claimed for this new signature covenant; economics at those counts are modeled.

## Additional final adversarial requalification

Run `native-1793681058034` completes26committed native transactions and both markets close. It additionally proves that signatures for one financial change cannot authorize a different otherwise-valid change, and that the capacity funder cannot reduce the immutable cushion while keeping liabilities. Bob also spends his gift-funded ordinary output with a real secp signature. Fresh missing-history simulation now requires its exact intended failure reason.

Preserved negative-test debugging: `native-1793680925288` reached the global fee limit31 before the intended immutable-cushion33 rule because the test turned removed cushion into an oversized fee. The corrected attempt sends that removed amount to the funder's real change output while adding/signing the funder's input, so actual fee stays within bounds and immutable-cushion33 is genuinely reached. A transient JavaScript duplicate-variable syntax failure is retained in its console log; it was not native evidence. Neither wrong-error failure is labeled a security PASS.

Separate0.5CKB initial-Alice run `native-1793682981911` also completes26native transactions and25 independently verified Ed25519 signatures, with both markets empty/closed. This is the exact native-balance case corresponding to a$1position at hypothetical$2/CKB, not a market price claim. All original provider-key and exit limitations remain.

Final recovery-driven qualification: `native-1793683642752` completes26committed transactions and25 independently verified owner signatures with0.5CKB initial Alice funding. Before recovery the runner deliberately deletes its tree and vault cache. A fresh process discovers the latest matching live vault by scanning canonical public blocks (market code/ID only), reconstructs records/configuration/proofs from committed history, and supplies the actual next transaction builder state. Owner-authorized transfers then commit with original funding key absent. This supersedes the weaker earlier observation that a child could return proofs while the builder still retained cached state. Controlled missing-history failure applies to this implemented reconstruction routine; it is not deletion of all public copies or proof that another archive/block retrieval could never recover them.

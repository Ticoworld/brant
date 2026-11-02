# WO09-E3 bounded recipient-paid fee experiment

TECHNICAL: ADVANCE (bounded CKB-testtool result). COMMERCIAL: UNPROVED. Sponsor-funded fallback is preserved unchanged in recipient_merge.rs and its earlier evidence. The new isolated variant is recipient_merge_bounded_fee.rs, applied by prepare-bounded-fee-derivative.py. Upstream checkout, baked Groth16 key and checkpoint rules are unchanged.

## Rule and reasoning

A claimant supplies one canonical secp, untyped, empty-data Cell. Recipient input uniqueness remains strict. A matching output preserves lock/type/data. Existing full-claim sponsored merging still works. A discounted payout is accepted only with exactly two total inputs and two total outputs: one continuing anchor and one recipient. Compute F = sum(input capacities) minus sum(output capacities), in u128 arithmetic. Require 0 <= F <= 1,000,000 shannons (0.01 CKB), F <= authenticated claim b, and recipient_output = recipient_input + b - F.

Inherited force-exit validation requires anchor capacity/total to fall by exactly b, nullifies precisely that leaf, preserves other entitlements and keeps last_epoch. Hence, with this two-by-two topology, the sole recipient shortfall can only be the actual miner fee; no third destination exists. The recipient's actual canonical secp signature commits to all input outpoints, outputs, data and dependencies, thereby authorizing the exact fee, and cannot be reused after a fee change. The fixed cap limits even an intentionally signed wallet transaction. No new witness field or signature scheme is introduced. Claim principal is never used twice. Fees greater than claim cannot reduce the prior wallet principal.

This deliberately narrow construction is simpler to reason about than permitting arbitrary additional fee inputs/outputs or aggregating recipient signature groups. No uniqueness rule was relaxed. A separate sponsor can still use the original exact-increase path, but cannot impose a discounted payout through this fee mode with extra inputs/outputs.

## Execution

25 cases in labs/wo09-e3/evidence/bounded-fee-vm-1793634662957: 10 accept, 15 reject. Actual secp code/dependencies execute in CKB-testtool 0.13.2. Constructed three-owner Keccak SMT state contains claims 0.1, 1 and 100 CKB. No state is described as a Groth16-created checkpoint. Tests load the newly compiled variant under its own data-hash identity in constructed context Cells. Binary SHA-256 b7e32a8b4e93994771dcc8da268f8bc8059eadb69d8329d633d8b26cf5f9687f; size 118,184 bytes; pinned Rust/lower-atomic build log retained.

Both 0.1 and 1 CKB claims accept fees 0, 1, 1,000 and 1,000,000 shannons. The VM runner independently sums input/output capacity and reports the same fee. Recipient input starts at 100 CKB. At a 10,000-shannon fee, replacement is exactly 100.0999 or 100.9999 CKB. No second fee signer is required.

Two additional measured fee-point tests in practical-fee-1793634743178 accept 10,000 shannons each, with 8,968-byte transactions and 10,005,020 / 10,022,050 cycles. This fee exceeds the size-based threshold for the saved node setting of 1,000 shannons/KB. That comparison is analytical: no node relay is claimed. Zero/1/1,000-shannon successes are VM policy tests; these fees can be below relay policy.

At cap+1: anchor type error 67. A 1,000-shannon claim with 1,001 fee rejects at 67, independently exercising fee>claim while remaining below the absolute cap. Fee==claim accepts: this consumes the whole tiny claim in fees and is economically useless, despite conserving the existing wallet. Wallets must disclose net benefit.

Missing recipient authorization: Inputs[1].Lock error -2. Invalid signature or a fee changed after signing: recipient Lock error -31. Extra destination or discounted payout with additional input/output: anchor type error 67. Wrong recipient or ambiguous matching owner inputs: 67. Other claimant liability alteration: 63. Duplicate old claim proof against successor: 62. Sponsor-funded full-claim fallback accepts under the new variant (specific regression required for this extension).

No fresh native-chain confirmation was run: /tmp remains constrained (~384 MiB available), and offline execution resolves the immediate hypothesis without node/prover resource pressure. Existing sponsored native tiny-claim result remains the separate stronger lifecycle evidence for that earlier binary. There is no proof that the fee variant is production-safe, integrated in ordinary wallets, censorship-resistant or commercially preferred.

## Comparison and freeze

Sponsored variant: full claim arrives, two wallet signers, fee funded by external sponsor; a 9,214-byte comparable test consumes 11,680,176 cycles. Recipient-paid variant: net claim arrives, one wallet signer, 8,968 bytes, about 10.0 million cycles. Recipient Cell and anchor still need their full existing capacity. At an equal 1,000-shannons/KB hypothetical relay threshold, 246 bytes save only 246 shannons (0.00000246 CKB). This is a useful fee-sponsor independence improvement, not a solution to retail capital requirements.

Freeze both tested variants. Next emphasis is the absence of a funded recipient Cell, real liquidity/service availability and product-level capital accounting. New local Groth16 proving, broader signature-group relaxation and fee micro-optimization are unjustified here.

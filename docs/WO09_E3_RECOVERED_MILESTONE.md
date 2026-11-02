# WO09-E3 recovered functional evidence

Recovered from the working filesystem after remote checkpoint 54542286f6dc8f25594e8946e80640fb7d171f2f. No evidence directory was invented or replaced. Validation script: labs/wo09-e3/scripts/verify-recovered.cjs. It checks saved native transactions against raw compressed RPC responses, deployed binary SHA, root-history checkpoint hashes, recipient identity, capacity changes and sponsor fee. With VM_RUNNER configured it re-executes every saved fixture in the completed VM run. Recovery validation re-executed 21 cases successfully.

## Genuine fresh-chain result

Evidence: labs/wo09-e2-capacity/evidence/e3-genuine-fixture-merge-1793632183354. Eight transactions are recorded as committed: derivative deployment, experimental always-success anchor-lock deployment, legitimate zero-total anchor plus funded deposit, four genuine published Groth16 fixture checkpoints, and the final merge exit. The derivative was deployed under its new data-hash script identity; no existing anchor was overwritten or migrated. Published proofs remain compatible with unchanged baked verifier/pool policy.

Exit: 0xc7c052cf9d0071c15b3221aecd8a5159b4a0bebdf1633f9ef4c0fee634f414e1.

Claim: exactly 1,000 shannons (0.00001 CKB). Owner role 1 signs its recipient input; independent sponsor role 2 signs its fee input. Recipient capacity increases from 10,000,000,000,000,000 to 10,000,000,000,001,000 shannons. Anchor capacity and pool total each fall by 1,000 shannons. Remaining pool total is 9,999,599,000 shannons. Sponsor pays exactly 1,000,000 shannons (0.01 CKB). Duplicate spending of the consumed anchor is rejected in the recorded real node trace. No operator signature is used, but the anchor lock remains a disposable always-success fixture, not production authorization.

This is not a native 0.1 or 1 CKB checkpoint account. Those balances were tested separately in constructed VM states. The tiny native claim used a vastly overfunded disposable genesis wallet; it does not establish realistic wallet acquisition costs or economic attractiveness. The 0.01 CKB fixture fee is 1,000 times the 0.00001 CKB claim and is not a competitive fee estimate.

## Contract-level results

Evidence: labs/wo09-e3/evidence/merge-vm-1793632167062. Actual canonical secp code and dependencies are loaded from the private-chain genesis; the VM executes both recipient and sponsor locks plus the derivative type script. Keccak SMT states contain Alice 10,000,000 shannons, Bob 100,000,000 shannons and Carol 10,000,000,000 shannons. Existing recipient Cells hold 100 CKB; sponsor Cells hold 1,000 CKB. Successful Alice/Bob outputs hold exactly 100.1/101 CKB. No new recipient Cell is created; a prior Cell is consumed and replaced. Additional per-owner persistent payout capacity is zero, conditional on already owning the suitable funded Cell. Anchor cushion is 500 CKB.

Accepted Alice/Bob transactions consume about 11.7 million VM cycles. Missing recipient signature rejects at Inputs[1].Lock with secp error -2; invalid recipient signature rejects there with -31, while sponsor remains signed. Underpayment, overpayment, changed identity/data/type and ambiguous output cases reject at anchor type error 67. Invalid nullification and altered unrelated liability reject at type error 63. Recipient-paid fee attempt on the original derivative rejects at type error 67: current exact-delta policy still requires separate fee funding.

Six transactions in two owner orderings (Alice/Bob/Carol and reverse) are accepted with roots rebuilt after each nullification and final accounting sum zero. LIMITATION: context snapshots are constructed independently and reset synthetic outpoints. These results show bounded VM acceptance of each successive root/accounting state, not a live-cell transaction chain, stale-anchor contention handling, or proof-backed three-owner checkpoints. Synthetic anchors are never described as Groth16-created state.

## Retained failures and unexecuted additions

The first VM run includes a malformed ambiguous-output fixture with negative sponsor change; it failed JSON Uint64 decoding before script execution. The completed run corrected sponsor funding. The expanded script adds further stale-proof, overflow and ambiguous-input cases, but its next run failed before executing these tests because the CKB node did not start. Preserve those additions as UNEXECUTED, not passing tests.

Node-startup evidence: labs/wo09-e2-capacity/evidence/e3-merge-vm-1793632219946. The saved exception is fetch failed/ECONNREFUSED. /tmp was separately measured full (4.9 GiB mount); the error alone does not prove disk exhaustion was the sole cause of node failure. The Rust VM-runner build also explicitly reported ENOSPC. /workspace had about 4 GiB available. A build-cache removal command was rejected by execution policy; no deletion occurred. An attempted reversible move placed a prior single-hart target cache under work/e3-build-cache; inspect what remains before further moves. No source or research evidence should be deleted to free space.

## Verdict and next experiment

Recipient merging: TECHNICAL ADVANCE for the tested sponsor-funded, pre-funded-wallet path; COMMERCIAL UNPROVED. Real tiny-claim redemption is now demonstrated for one published fixture balance. Neither funded-cell-free recovery nor self-funded fees are solved. No claim of production security, unconditional censorship resistance or comprehensive adversarial coverage.

Next decision-changing experiment: use the existing saved genesis/code data to run a fully stateful three-owner UTXO sequence and same-anchor contention/rebuild tests without starting another private node. Then isolate a recipient-paid fee construction with explicit conservation and fee bounds. Preserve the sponsor-funded fallback. No new SP1 proving, WO09-E1 beneficiary work or A2 LO-01 work is needed.

## Subsequent offline stateful validation

Evidence: labs/wo09-e3/evidence/merge-vm-offline-1793634220350. Runner: labs/wo09-e3/scripts/test-recipient-merge-offline.cjs. This reuses recovered genesis and code Cells and starts no node. Unlike the earlier reset-outpoint snapshots, the stateful track maintains a live ledger, removes consumed inputs, derives successor outpoints from transaction hashes, and supplies only current Cells to CKB-testtool. Both three-owner orderings complete. A preconstructed competing transaction fails resolution with UNKNOWN_INPUT after the first anchor spend; a transaction reconstructed against current root/outpoints then passes. The VM runner reports UNKNOWN_INPUT before script execution by context-cell lookup; this is not claimed as a consensus-node rejection or a lock-script error. Last owner leaves zero pool accounting total and precisely 500 CKB anchor capacity.

Expanded cases also reject ambiguous matching inputs and overflowing recipient capacity at type error 67, stale proofs and duplicate old proofs against the successor at type error 62. Original exact-delta self-paid-fee case still rejects. These results do not qualify a corrected fee construction.

Setup failure: RPC dep_group was initially carried into the SDK field as a value rather than SDK depGroup. Transaction serialization rejected it before VM execution; correcting the representation permits testing without weakening validation. The failure console is preserved separately.

Storage: the unused /tmp/liquid-cells-e2-noa derivative source/cache was reversibly moved to ignored work/e3-build-cache/previous-noa-source-and-cache, preserving its contents. /tmp then had approximately 388 MiB free and /workspace 3.6 GiB. No deletion, new build, new node or SP1 download was needed for this milestone. Avoid further node/prover work without additional resource review.

The old summary's statement that contexts reset refers to its original/static cases; the separate stateful track and recorded stateful transaction hashes supersede that limitation for the bounded VM UTXO tests only.

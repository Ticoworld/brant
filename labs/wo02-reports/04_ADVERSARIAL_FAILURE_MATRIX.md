# Adversarial failure matrix

The final runs contain **74 scenarios: 63 primary, 10 extra and one focused re-inclusion repair**. A completed scenario does not mean the protocol is safe: eight scenarios deliberately finish with principal loss, four named counterexamples and four late-watcher losses. No passing-test count is used as a security verdict. Scenario counts are deliberately selected cases, not measured failure probabilities.

## Observed boundaries

EVM claims succeeded at T-1 and reverted at T/T+1 in both directions. Extra tests executed actual refunds at T-1/T/T+1: before T reverted; at/after T succeeded. Each boundary result includes the actual mined block timestamp, not just a wall-clock sleep. CKB hash claims remained executable after refund eligibility. Refund spends used the exact signed H in since and never committed below H. At tip H-1, H and H+1, first-submitted claim/refund candidates were tested independently, with the opposite same-fee spend rejected by the node. Pool order is not a consensus guarantee: another miner or fee policy can select differently. Exact committed heights and error messages are in per-case steps.

## Principal-loss counterexamples

1. **Expired EVM disclosure, both directions.** Bypassing the client guard submits a real EVM claim containing the secret after T. It reverts and pays nothing. The other party can read the preimage from transaction calldata, claim CKB, then refund its own EVM token. The CKB funder loses principal and receives no token. This is verified in final balance deltas, not inferred from a diagram.
2. **Conventional reversed chain orientation.** In the baseline token-source-first B arrangement, EVM funds refund after the longer cutoff; an unspent CKB destination remains hash-claimable after its shorter refund-eligibility height. With the CKB funder offline/not having committed its refund, the EVM funder gets its tokens back and claims CKB. This falsifies hard-expiry assumptions, not every HTLC protocol with an adequately bounded watcher.
3. **Watcher delay.** For the repaired orientation, delay CKB observation while blocks advance after successful EVM payment. Tested delays 0,20,25,26 blocks allowed the token funder to obtain CKB. At delays 27,28,29,30, a competing CKB refund submitted first was admitted and committed, leaving the token funder without counter-asset. The smallest tested losing delay was 27 blocks; 26 was tested and recovered. This depends on this exact height schedule and pool policy, not a seconds-based SLA.
4. **Deep EVM rollback.** After token claim/revelation and CKB payout, revert EVM to the funded pre-claim snapshot and refund tokens. The CKB transfer persists. This is an explicit counterexample outside the selected no-deep-reorg assumption. It does not estimate real-world reorganization likelihood.

## Repairs actually executed

The disclosure client refuses a late first reveal before broadcasting; separate trades then recovered both escrows. Funding/secret orientation is fixed by chain, not customer buy/sell direction: CKB first and longer, EVM second with strict expiry. Correctly funded successful directions and refused-expiry cases use that arrangement. It moves maker-first capital exposure into B rather than eliminating it.

The first client implementation checked matching EVM funding for every operation and thereby blocked a legitimate CKB refund after wrong funding. Failure evidence is preserved in historical/refund_validation_failure. The repair restricts matching-funding checks to claim/disclosure operations. Both refunds remain possible for actual wrong-amount/recipient/hash EVM funding, and the rerun exercised each path. This is a client repair, not a claim that a contract prevents every incorrect deposit.

A later run encountered a missing outpoint in an exported package. Its records are preserved in historical/artifact_persistence_failure. Writes now use temporary-file rename, run directories are unique, and the independently authorized recovery package is exported after funding. The exact origin of the unexpected earlier file contents was not conclusively established. The final run's package hashes/outpoints were independently checked. This repair does not establish recovery from arbitrary local data loss.

## Malicious input coverage

Each direction tested real CKB rejection of wrong/malformed secrets, wrong hash construction, wrong recipient, underpayment, extra outputs, non-empty payout data, and wrong refund since. EVM wrong secret, early refund, duplicate funding ID and repeated claim reverted. Mutated signed packages for wrong chain, asset, escrow, amount, signature, recipient and old outpoint were rejected by the client. The immutable token prevents selecting a different token in fund; an arbitrary production token behavior matrix was not tested.

Actual EVM escrows funded with a wrong amount, recipient or hash were accepted as those funders' own transactions, but refused by the disclosure client and independently refunded. The contract does not interpret an opaque terms digest as a proof of agreed foreign payment. Quote replay is rejected by signature/digest binding, EVM trade-ID state and exact CKB outpoint consumption; there is no global CKB order registry. A separately funded duplicate CKB cell is another allocation, not a second credit for one input, and was not modeled as free liquidity.

## Failure and process coverage

Coordinator processes were killed and private databases removed before funding, after CKB funding, after EVM funding, before disclosure, after EVM claim, before CKB claim and during the recovery phase in both directions. The scenario named during_secret kills the coordinator immediately before the independent disclosure command; it does not by itself prove an in-flight crash. A separate delayed-inclusion case stopped EVM mining, broadcast the actual claim, killed the coordinator, observed no receipt, then mined and completed recovery. Lost CKB claim responses were reconciled from a pre-written hash journal in both directions. Extra tests also discarded actual EVM claim responses and reconciled receipts/logs in both directions.

Source-only and both-funded abandonment recovered without coordinator keys/database. EVM and CKB zero-fee admission failures were exercised. A watcher with its gas balance forcibly set to zero could not execute an EVM claim; restoring test gas allowed a new process to continue. CKB recovery fee bumping is not implemented: the exact-principal, fixed-reserve shape has an explicit adequate-fee assumption.

Local EVM snapshots removed funding before disclosure, which the client refused. CKB truncation removed funding, detached transactions were removed from the pool, disclosure was refused and the EVM escrow refunded. These are controlled local rollback tests. CKB competing forks, multi-peer propagation, actual transaction-flood congestion and EVM consensus-finality machinery were not reproduced. Pending inclusion and fee starvation are specific injections, not a complete congestion benchmark.

## Complete result index

| Case | Observed family/outcome | Raw result |
|---|---|---|
| 1 | SUCCESS_A_before_source_claim | `evidence/runs_1793329663335/001_happy_A/result.json` |
| 2 | SUCCESS_B_before_source_claim | `evidence/runs_1793329663335/002_happy_B/result.json` |
| 3 | SUCCESS_A_before_funding | `evidence/runs_1793329663335/003_death_A_before_funding/result.json` |
| 4 | SUCCESS_A_after_source_funding | `evidence/runs_1793329663335/004_death_A_after_source_funding/result.json` |
| 5 | SUCCESS_A_after_destination_funding | `evidence/runs_1793329663335/005_death_A_after_destination_funding/result.json` |
| 6 | SUCCESS_A_before_secret | `evidence/runs_1793329663335/006_death_A_before_secret/result.json` |
| 7 | SUCCESS_A_during_secret | `evidence/runs_1793329663335/007_death_A_during_secret/result.json` |
| 8 | SUCCESS_A_after_destination_claim | `evidence/runs_1793329663335/008_death_A_after_destination_claim/result.json` |
| 9 | SUCCESS_A_during_recovery | `evidence/runs_1793329663335/009_death_A_during_recovery/result.json` |
| 10 | SUCCESS_B_before_funding | `evidence/runs_1793329663335/010_death_B_before_funding/result.json` |
| 11 | SUCCESS_B_after_source_funding | `evidence/runs_1793329663335/011_death_B_after_source_funding/result.json` |
| 12 | SUCCESS_B_after_destination_funding | `evidence/runs_1793329663335/012_death_B_after_destination_funding/result.json` |
| 13 | SUCCESS_B_before_secret | `evidence/runs_1793329663335/013_death_B_before_secret/result.json` |
| 14 | SUCCESS_B_during_secret | `evidence/runs_1793329663335/014_death_B_during_secret/result.json` |
| 15 | SUCCESS_B_after_destination_claim | `evidence/runs_1793329663335/015_death_B_after_destination_claim/result.json` |
| 16 | SUCCESS_B_during_recovery | `evidence/runs_1793329663335/016_death_B_during_recovery/result.json` |
| 17 | ABORT_SOURCE_ONLY_A | `evidence/runs_1793329663335/017_no_destination_A/result.json` |
| 18 | ABORT_BOTH_REFUNDED_A | `evidence/runs_1793329663335/018_both_offline_A/result.json` |
| 19 | ABORT_SOURCE_ONLY_B | `evidence/runs_1793329663335/019_no_destination_B/result.json` |
| 20 | ABORT_BOTH_REFUNDED_B | `evidence/runs_1793329663335/020_both_offline_B/result.json` |
| 21 | EVM_BOUNDARY_A_-1 | `evidence/runs_1793329663335/021_evm_boundary_A_-1/result.json` |
| 22 | EVM_BOUNDARY_A_0 | `evidence/runs_1793329663335/022_evm_boundary_A_0/result.json` |
| 23 | EVM_BOUNDARY_A_1 | `evidence/runs_1793329663335/023_evm_boundary_A_1/result.json` |
| 24 | EVM_BOUNDARY_B_-1 | `evidence/runs_1793329663335/024_evm_boundary_B_-1/result.json` |
| 25 | EVM_BOUNDARY_B_0 | `evidence/runs_1793329663335/025_evm_boundary_B_0/result.json` |
| 26 | EVM_BOUNDARY_B_1 | `evidence/runs_1793329663335/026_evm_boundary_B_1/result.json` |
| 27 | CKB_BOUNDARY_A_-1_claim | `evidence/runs_1793329663335/027_ckb_boundary_A_-1_claim/result.json` |
| 28 | CKB_BOUNDARY_A_-1_refund | `evidence/runs_1793329663335/028_ckb_boundary_A_-1_refund/result.json` |
| 29 | CKB_BOUNDARY_A_0_claim | `evidence/runs_1793329663335/029_ckb_boundary_A_0_claim/result.json` |
| 30 | CKB_BOUNDARY_A_0_refund | `evidence/runs_1793329663335/030_ckb_boundary_A_0_refund/result.json` |
| 31 | CKB_BOUNDARY_A_1_claim | `evidence/runs_1793329663335/031_ckb_boundary_A_1_claim/result.json` |
| 32 | CKB_BOUNDARY_A_1_refund | `evidence/runs_1793329663335/032_ckb_boundary_A_1_refund/result.json` |
| 33 | CKB_BOUNDARY_B_-1_claim | `evidence/runs_1793329663335/033_ckb_boundary_B_-1_claim/result.json` |
| 34 | CKB_BOUNDARY_B_-1_refund | `evidence/runs_1793329663335/034_ckb_boundary_B_-1_refund/result.json` |
| 35 | CKB_BOUNDARY_B_0_claim | `evidence/runs_1793329663335/035_ckb_boundary_B_0_claim/result.json` |
| 36 | CKB_BOUNDARY_B_0_refund | `evidence/runs_1793329663335/036_ckb_boundary_B_0_refund/result.json` |
| 37 | CKB_BOUNDARY_B_1_claim | `evidence/runs_1793329663335/037_ckb_boundary_B_1_claim/result.json` |
| 38 | CKB_BOUNDARY_B_1_refund | `evidence/runs_1793329663335/038_ckb_boundary_B_1_refund/result.json` |
| 39 | MALICIOUS_INPUTS_A | `evidence/runs_1793329663335/039_malicious_A/result.json` |
| 40 | MALICIOUS_INPUTS_B | `evidence/runs_1793329663335/040_malicious_B/result.json` |
| 41 | FUNDED_TERMS_REJECTED_amount | `evidence/runs_1793329663335/041_wrong_funded_amount/result.json` |
| 42 | FUNDED_TERMS_REJECTED_recipient | `evidence/runs_1793329663335/042_wrong_funded_recipient/result.json` |
| 43 | FUNDED_TERMS_REJECTED_hash | `evidence/runs_1793329663335/043_wrong_funded_hash/result.json` |
| 44 | COUNTEREXAMPLE_SECRET_IN_REVERTED_TX_A | `evidence/runs_1793329663335/044_late_disclosure_unsafe_A/result.json` |
| 45 | REPAIR_REFUSE_LATE_REVEAL_A | `evidence/runs_1793329663335/045_late_disclosure_guard_A/result.json` |
| 46 | COUNTEREXAMPLE_SECRET_IN_REVERTED_TX_B | `evidence/runs_1793329663335/046_late_disclosure_unsafe_B/result.json` |
| 47 | REPAIR_REFUSE_LATE_REVEAL_B | `evidence/runs_1793329663335/047_late_disclosure_guard_B/result.json` |
| 48 | COUNTEREXAMPLE_REVERSE_CKB_NO_EXPIRY | `evidence/runs_1793329663335/048_naive_reverse_orientation/result.json` |
| 49 | WATCHER_DELAY_0_WATCHER_CLAIMED | `evidence/runs_1793329663335/049_watcher_delay_0/result.json` |
| 50 | WATCHER_DELAY_20_WATCHER_CLAIMED | `evidence/runs_1793329663335/050_watcher_delay_20/result.json` |
| 51 | WATCHER_DELAY_25_WATCHER_CLAIMED | `evidence/runs_1793329663335/051_watcher_delay_25/result.json` |
| 52 | WATCHER_DELAY_26_WATCHER_CLAIMED | `evidence/runs_1793329663335/052_watcher_delay_26/result.json` |
| 53 | WATCHER_DELAY_27_CKB_FUNDER_REFUNDED_AFTER_TOKEN_PAYMENT | `evidence/runs_1793329663335/053_watcher_delay_27/result.json` |
| 54 | WATCHER_DELAY_28_CKB_FUNDER_REFUNDED_AFTER_TOKEN_PAYMENT | `evidence/runs_1793329663335/054_watcher_delay_28/result.json` |
| 55 | WATCHER_DELAY_29_CKB_FUNDER_REFUNDED_AFTER_TOKEN_PAYMENT | `evidence/runs_1793329663335/055_watcher_delay_29/result.json` |
| 56 | WATCHER_DELAY_30_CKB_FUNDER_REFUNDED_AFTER_TOKEN_PAYMENT | `evidence/runs_1793329663335/056_watcher_delay_30/result.json` |
| 57 | LOST_RESPONSE_RECOVERED_A | `evidence/runs_1793329663335/057_lost_response_A/result.json` |
| 58 | LOST_RESPONSE_RECOVERED_B | `evidence/runs_1793329663335/058_lost_response_B/result.json` |
| 59 | DELAYED_INCLUSION_RECOVERED | `evidence/runs_1793329663335/059_delayed_inclusion/result.json` |
| 60 | FEE_ADMISSION | `evidence/runs_1793329663335/060_underpaid_fee/result.json` |
| 61 | REORG_FUNDING_REFUSED | `evidence/runs_1793329663335/061_evm_rollback_funding/result.json` |
| 62 | COUNTEREXAMPLE_DEEP_EVM_REORG | `evidence/runs_1793329663335/062_evm_deep_rollback_claim/result.json` |
| 63 | REORG_CKB_FUNDING_REFUSED | `evidence/runs_1793329663335/063_ckb_rollback_funding/result.json` |
| 64 | EVM_LOST_RESPONSE_A | `evidence/runs_1793330098602/001_evm_lost_response_A/result.json` |
| 65 | EVM_LOST_RESPONSE_B | `evidence/runs_1793330098602/002_evm_lost_response_B/result.json` |
| 66 | EVM_REFUND_BOUNDARY_A_-1 | `evidence/runs_1793330098602/003_refund_exact_A_-1/result.json` |
| 67 | EVM_REFUND_BOUNDARY_A_0 | `evidence/runs_1793330098602/004_refund_exact_A_0/result.json` |
| 68 | EVM_REFUND_BOUNDARY_A_1 | `evidence/runs_1793330098602/005_refund_exact_A_1/result.json` |
| 69 | EVM_REFUND_BOUNDARY_B_-1 | `evidence/runs_1793330098602/006_refund_exact_B_-1/result.json` |
| 70 | EVM_REFUND_BOUNDARY_B_0 | `evidence/runs_1793330098602/007_refund_exact_B_0/result.json` |
| 71 | EVM_REFUND_BOUNDARY_B_1 | `evidence/runs_1793330098602/008_refund_exact_B_1/result.json` |
| 72 | CKB_ZERO_FEE_REJECTED | `evidence/runs_1793330098602/009_zero_ckb_fee/result.json` |
| 73 | WATCHER_FEE_RESERVE_RESTORED | `evidence/runs_1793330098602/010_watcher_no_gas/result.json` |
| 74 | REPAIR_EVM_REINCLUSION_AFTER_CKB_PAYMENT | `evidence/runs_1793330656201/001_claim_reinclusion_repair/result.json` |

## Focused post-payment re-inclusion repair

One additional case rolled back an EVM claim after CKB payment while the destination deadline remained open. The old live-source check refused recovery. The final client verified the committed CKB payout and public witness from a supplied transaction hint, then re-included the EVM claim successfully. Report 05 documents this transition. The extra case is included in the 74-row index. The deep-reorg/expired-refund loss remains unresolved.

## What remains unresolved

A universal bound linking CKB block-height advance, EVM timestamp/inclusion, confirmation tails, watcher downtime and future fee requirements is not established. The 8-block and 10-second client guards are experimentally exercised local budgets, not production-calibrated universal bounds. Deep rollback and out-of-budget monitoring demonstrate genuine losses. No proof assistant, exhaustive state-space exploration or independent contract audit was performed. The final classification therefore remains safety unresolved.

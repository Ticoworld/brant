# Executed channel-boundary evidence

**VERIFIED:** 19 named contract cases, 103 transaction receipts cross-checked against captured RPC, comprising 93 successful transactions and 10 deliberately rejected transactions. 6 cases end with inconsistent allocations, including the dishonest-attestor control. These selected adversarial cases are not failure probabilities.

Runtime: Ganache/v7.9.2/EthereumJS TestRPC/v7.9.2/ethereum-js; Node v24.22.1; Solidity 0.8.30+commit.73712a01.Emscripten.clang; chain ID31338; Shanghai execution, optimizer200. Private Ganache in-process EVM, controlled public test keys and WO03TEST ERC20. Both logical assets use the same controlled token in separate funded contracts. No real stablecoin, native CKB channel execution, independent-chain clock or reorg experiment occurs in this round. This is a focused contract test of adjudication semantics. WO02 remains the actual CKB/EVM exchange evidence.

## Result matrix

| Case | Observed result |
| --- | --- |
| hidden_certificate_fixed_alice_victim | INCONSISTENT_FINAL_STATES |
| hidden_certificate_fixed_bob_victim | INCONSISTENT_FINAL_STATES |
| hidden_certificate_restart_alice_victim | INCONSISTENT_FINAL_STATES |
| hidden_certificate_restart_bob_victim | INCONSISTENT_FINAL_STATES |
| eager_watch_cannot_upgrade_expired_X | REJECTED |
| eager_all_leg_watch_with_start_skew | INCONSISTENT_FINAL_STATES |
| public_update_both_legs | CONSISTENT |
| closed_cannot_upgrade | REJECTED |
| newer_state_restarts_window | RESTARTED |
| wrong_signature | REJECTED |
| wrong_context_replay | REJECTED |
| allocation_overfunded | REJECTED |
| old_version | REJECTED |
| participant_cannot_impersonate_attestor_false | REJECTED |
| honest_attestor | CONSISTENT_TRUSTED_CONTROL |
| duplicate_follower_release_false | REJECTED |
| participant_cannot_impersonate_attestor_true | REJECTED |
| dishonest_attestor | INCONSISTENT_FINAL_STATES |
| duplicate_follower_release_true | REJECTED |

All state signatures bind a common context containing both adjudicator addresses, token, participants, chain ID and unique session serial. The contract verifies both signatures, allocation bounds and increasing versions. Wrong signature, context replay, over-allocation, old state, expired update and duplicate payout were rejected. Sixteen retained state signatures were independently recovered offline.

## Stronger counterexample: active monitoring of both legs

The old state was registered on both contracts. Their locally started deadlines were X=1793337319 and Y=1793337324 in development-chain timestamp units. New-state publication on Y occurred at 1793337320, after X's update cutoff and before Y's. The attempted X upgrade reverted. X closed at version0/Alice50; Y closed at version1/Alice40. Alice's combined allocation was therefore (50,40), while the signed alternatives were (50,50) and (60,40). Bob gained ten modeled token units beyond either consistent alternative. All transfers are actual EVM token transfers, with native gas paid separately. No real-world clock bound is inferred.

The simpler four cases exercise each signature ordering, old/new leg selection and fixed/restarting timeout variants. A malicious last signer can keep the complete certificate private. A UI acknowledgement does not remove its enforceability. The eager-monitor case matters more than leaving the other leg unregistered.

## Repair controls

With an honest designated test attestor, the follower released the projection of the sealed anchor outcome. A participant could not impersonate the attestor. With a dishonest attestor, the follower accepted a contradicting outcome. Both controls paid actual tokens. This proves what the contract checks, including its trust assumption. It does not prove consensus-proof verification or independent recovery without the attestor.

## Finite exhaustive model

9,565 reachable abstract states and 16,094 transition edges were enumerated over windows2/3/4 and horizon12, with and without eager all-leg disputes, fixed and restarted deadlines. All twelve parameter configurations contain a counterexample. An honest watcher reacts within one modeled tick to publicly available certificates. This is exhaustive only over that finite transition system, not over arbitrary protocols or consensus histories.

The anchor abstraction enumerates72 outcome/delay/proof/refund cases. Sound proof with no independent refund produces no mismatching paid outcome by construction of its verification rule, but an absent proof leaves funds locked. Independent refund reintroduces mismatches. This is a model result with an assumed verifier, not proof of an implemented trustless repair.

## Actual gas ledger

| Operation | Minimum gas | Maximum gas |
| --- | ---: | ---: |
| deploy_TestDollar | 423,304 | 423,304 |
| deploy_PortfolioLeg | 752,297 | 752,333 |
| approve | 44,246 | 44,258 |
| fund | 77,390 | 77,456 |
| register | 74,941 | 129,027 |
| close_old_X | 56,744 | 56,744 |
| close_hidden_new_Y | 56,754 | 56,754 |
| eager_close_old_X | 56,744 | 56,744 |
| eager_close_new_Y | 56,754 | 56,754 |
| close_consistent_X | 56,744 | 56,744 |
| close_consistent_Y | 56,754 | 56,754 |
| close_z_X | 56,744 | 56,744 |
| close_z_Y | 56,754 | 56,754 |
| deploy_SealedFollower | 516,121 | 516,121 |
| anchor_close_old | 56,744 | 56,744 |
| follower_release | 99,110 | 119,034 |

The selected consistent session used 2,229,668 gas, including 1,504,654 gas for its two per-session contract deployments. Its nondeployment operations used 725,014 gas. Contract funding was supplied by Alice from her isolated test supply; the experiment does not implement safe two-party channel opening. One signer broadcasts all test transactions to simplify contract-level fault control. Separate production wallet processes and coordinator-death recovery were not re-proven for this new channel design.

Raw transaction requests, receipts, logs and RPC responses are saved in evidence/transactions.json and evidence/rpc.json. Full compiler input/output, bytecode, signed states and hashes are included. The JavaScript µWS native extension was unavailable under Node24; Ganache used its JavaScript fallback. No throughput or timing benchmark is claimed.

## Evidence limits

There is no CKB adjudicator implementation, foreign-finality verifier, unbiased network timing measurement, production audit, exhaustive channel security proof or observed business profitability in WO03. The lab does not execute Perun contracts. Four Perun source files were inspected and pinned by Git blob identity; do not present these lab counterexamples as an exploit of Perun. WO01's65 and WO02's3,001 saved checksum entries still match.

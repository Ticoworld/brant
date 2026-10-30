# Recovery, defensive cases and limits

A separate executable process retrieved source proofs from the isolated EVM node and submitted CKB transactions from retained public packages. It loaded no participant signing keys or coordinator database for settlement. Fixed outputs let any caller perform settlement. Alice's earlier funding signature and Bob's EVM delivery authorization remain the asset authorizations.

The coordinator process was terminated and its test database removed before checkpoint creation and recovery. The checkpoint proof was supplied by the driver after independent source retrieval; no claim is made that consensus authentication survives an absent controller. A different process independently constructed shared membership information and individual account/storage proofs.

## Actual case ledger

| Defensive case | Observed result |
| --- | --- |
| reservation_identity_cannot_recreate | REJECTED |
| reservation_identity_duplicate_outputs | REJECTED |
| wrong_amount | REJECTED |
| wrong_recipient | REJECTED |
| wrong_token | REJECTED |
| wrong_trade_id | REJECTED |
| repeated_EVM_fill | REJECTED |
| filled_cannot_expire | REJECTED |
| reverted_payment | REJECTED |
| expired_payment_attempt | REJECTED |
| repeated_expiry | REJECTED |
| checkpoint_wrong_root | REJECTED |
| checkpoint_outdated_height | REJECTED |
| checkpoint_malformed_proof | REJECTED |
| coordinator_terminated_database_removed | EXECUTED |
| consume_immutable_checkpoint | REJECTED |
| conflicting_refund_for_filled_trade | REJECTED |
| wrong_CKB_recipient | REJECTED |
| wrong_CKB_amount | REJECTED |
| proof_reused_for_another_trade | REJECTED |
| wrong_checkpoint_identity | REJECTED |
| outdated_execution_proof | REJECTED |
| two_independent_shared_checkpoint_admissions | ACCEPTED_BEFORE_MINING |
| duplicate_CKB_settlement | REJECTED |
| batch_relayer_unavailable | REJECTED |
| consumed_read_dependency | REJECTED |
| shared_checkpoint_remains_live_after_all_consumers | LIVE |
| no_authoritative_unfilled_outcome_yet | REJECTED |
| external_source_unavailable | REJECTED |
| source_outage_leaves_pending_funds_reserved | LIVE_NO_FALSE_REFUND |

## Safety established within the tested boundary

The external contract rejected duplicate delivery, delivery after closure, incorrect terms and expiry of a filled trade. A reverted token transfer left the trade OPEN with no terminal leaf. Explicit later expiry produced the unfilled result. The contract made FILLED and EXPIRED_UNFILLED mutually exclusive on its one executed history.

CKB rejected mismatched status, trade proof, recipient, principal, checkpoint identity and outdated/malformed proof inputs. A conflicting refund for the filled trade could not use its batch proof. Spent reservation inputs could not settle twice. Unique reservation creation checks rejected recreation and duplicate outputs. These are tested cases, not exhaustive correctness/security proofs.

## Recovery when the batch publisher is absent

One filled trade had no published batch checkpoint. The shared recovery attempt did not settle. Its separate-process direct path retrieved an account/storage proof against the retained bootstrap and paid Bob. Another trade recovered Alice's unfilled principal after a3600-second development-time jump. Its commitment remained terminal and usable; no independent CKB time-based choice was introduced.

An OPEN trade had no authoritative unfilled outcome even after its deadline. The recovery process refused to invent one. When the external EVM process was deliberately stopped, another recovery attempt failed and native funds remained live/reserved. The experiment did not restart that node to prove resumed recovery. In production, anyone could call expire once source progress resumes, but the resulting root must then be authenticated and published. E1's immutable fixed-root fixture cannot supply verified future root updates.

## Unresolved assumptions, stated plainly

1. **Foreign canonical finality:** bootstrap stateRoot was chosen by the experiment controller. Neither the CKB scripts nor a sound light-client update authenticated its canonicality/finality. A fabricated or orphaned initial root is outside the demonstrated guarantee. A signature, root immutability, own-node check or two dev descendants does not close this gap.
2. **Proof/data availability:** source access, retained public packages and historic trie data are required. Unlimited outage/data loss can lock native principal. A batch publisher can be replaced only when authenticated root/data/fees remain obtainable.
3. **Fee-funded liveness:** each native reservation fixes100,000shannons of close fee. There is no general sponsorship or fee-bump path. A market that will not include that fee violates the tested inclusion assumption. Recovery has no new participant-key requirement but still needs source RPC availability.
4. **Parser/script correctness:** the custom RLP/trie/SHA256/reservation code is unaudited and not exhaustively fuzzed. Inline-node/branch parsing is bounded; only the encountered concrete proof paths and selected malformed cases were executed. No production security claim follows.
5. **Checkpoint lifecycle:** immutable checkpoint/boot capacity remains locked. Safe retirement and authenticated historical-root reconstruction are future work.
6. **Real assets and chains:** the controlled ERC20 is not a production stablecoin. L2 sequencer/DA/finality models and issuer risks require different explicit adapters.

## Alternative B, strongest defensible version

An optimistic outcome relay can share expensive checks only if it has a sound executable fraud-proof path against authenticated foreign history. It must specify which canonical fact proves a proposal false, data disclosure, challenger access, censorship/inclusion bounds, bond denomination and compensation rules. With no honest included challenge, a false proposal may pay; economic deterrence is not cryptographic truth. A bond without canonical root verification still lacks the decisive predicate. E1 did not implement this alternative and does not claim it defeated the missing-root problem.

## Proof/refund paradox

Authoritative EXPIRED_UNFILLED removes the specific choice between a finalized external fill and a separate native timeout refund, conditional on correct canonical outcome authentication. It transfers the unresolved liveness dependency to foreign progress, expiration inclusion, proof availability and native inclusion. It does not permit an honest refund during unlimited foreign unavailability. No mathematical impossibility of every alternative protocol is asserted; a compensation/credit alternative changes who bears loss and needs its own funded enforceable claims.

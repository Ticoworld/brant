# WO09-E3 research question tree

Status: IN PROGRESS. Baseline fetched and verified at cdea29af4deb97b2bd028e56af89c41fd81f8d94. No E3 native success is claimed.

## Q1: Can three independently funded owners completely exit?

OBSERVE: Existing published checkpoints give one large claimant and dust accounts. Reusing them cannot establish the required three-owner baseline.

ASSUMPTION: Published fixtures are the only usable checkpoint source.

WHY: They are convenient, but this is an environment limitation rather than a consensus rule.

ALTERNATIVE: Generate legitimate distinct deposits with the pinned sequencer, prove several new transitions using the upstream CPU Groth16 host, and verify the guest key against the anchor's baked verifier key before submission.

SOURCE: Liquid-Cells 47492b51673c94635ab23de2c55477625e94ccbf, crates/sp1-host/src/bin/prove_one.rs. It accepts arbitrary sealed checkpoint inputs and requires guest vkey 0x00213af5b4cc8922754e5b8ee7e610de703d4cb17fabb0a187c95c37fe67c1e8. Guest source uses SP1 6.2.3 with pinned k256/sha3 precompile forks. Existing contract compilation does not establish guest compilation or proving availability.

EXPERIMENT: Offline host Cargo dependency resolution.

RESULT: Exit 101, missing sp1-sdk in the isolated cache. Exact stderr is preserved under labs/wo09-e3/evidence/prover-metadata.stderr. No guest ELF was found in the pinned checkout. This is a setup failure, not a failed financial mechanism or proof of impossibility.

ELSE: Populate the pinned host/guest dependencies, obtain the matching SP1 guest compiler, build the guest and confirm its verifier key. Then generate new checkpoints; never substitute an invented anchor root or disable proof verification. Available workspace disk was approximately 4.2 GiB and available memory 4.1 GiB during inspection; measure actual proving requirements before committing to local execution.

COUNTEREXAMPLE: A newly built guest with a different verifier key cannot validate against the pinned anchor. Preserve that mismatch if encountered.

NEXT NATIVE TEST: Three independently controlled balances above payout occupancy, several checkpoints, chain-only replay, first owner exit, stale second-owner transaction, fresh successor proof, second owner exit, final owner exit. Check outstanding total and anchor cushion after every transaction.

Technical: REVISE environment. Commercial: UNPROVED.

## Q2: Can a tiny claim increase an existing owner's Cell?

HYPOTHESIS: An isolated derivative can require the owner's signed recipient input, preserve lock/type/data, and enforce the exact capacity increase while nullifying the account. Fees must come from separately measured inputs. No derivative has been implemented yet. Official ACP must be inspected and executed independently before any equivalence claim.

## Q3: Can a live censoring operator suppress the silence exit?

DERIVED: Checkpoints update last_epoch, while exits preserve it. Repeated accepted checkpoints may keep the silence threshold ahead of an excluded claimant. Native exclusion, permissionless proving economics and any forced-inclusion mechanism remain UNIMPLEMENTED.

## Q4: Can Alice act with neither a funded Cell nor a willing counterparty?

UNRESOLVED: Independent ownership does not supply fee liquidity or output capacity. Reserve, claim-sale and channel alternatives must account for actual funders and refusal conditions. No E3 small-claim success or commercial winner is asserted.

## Recovered functional milestone (supersedes initial Q2 implementation status)

OBSERVE: All 21 saved VM cases were independently re-executed. Sponsor-funded 0.1 and 1 CKB merges pass with actual secp authorization. WHY: The derivative checks the increase in an existing owner Cell rather than demanding a tiny standalone output.

NATIVE RESULT: New derivative deployment, four published Groth16 fixtures and a genuine 1,000-shannon claim merge are recorded committed. Raw-RPC evidence checks match hashes, exact delta and sponsor fee. See WO09_E3_RECOVERED_MILESTONE.md.

COUNTEREXAMPLE: A recipient paying the fee from the same Cell fails the exact-delta predicate, error 67. ELSE: A separately constrained, signed fee rule needs a new experiment. Do not infer that the signature alone makes any relaxed accounting safe.

MULTI-OWNER LIMIT: Root-transition VM snapshots succeed in both orders but reset input outpoints. NEXT QUESTION: Can a stateful resolver preserve all owner entitlements while rejecting the actual stale anchor, then accept rebuilt proofs and UTXOs?

ENVIRONMENT: /tmp is a separate full 4.9 GiB mount. The saved startup error is ECONNREFUSED; ENOSPC is independently recorded for compilation. Resource diagnosis must distinguish those observations. Continue VM verification using saved cells without node startup.

## Stateful VM follow-up

IF recovered script/genesis Cells are available, a new CKB node is unnecessary for constructed-state VM execution. Offline test now maintains a UTXO ledger with real successor transaction hashes. Both three-owner orderings and stale competing-anchor rejection/rebuild pass, with final total zero and 500 CKB cushion preserved. This supersedes the prior reset-outpoint limitation for the new stateful track, but not for genuine three-owner checkpoint creation.

WHAT FAILED: dep_group/depGroup representation mismatch blocked SDK serialization, then was corrected without changing contract rules. No VM result was assigned to that failed serialization.

NEXT QUESTION: Can a claimant with one existing Cell safely pay a bounded fee while still enforcing exact claim conservation? Current derivative rejects the tested self-paid fee case; sponsor-funded fallback stays frozen. Censorship while checkpointing, ordinary-wallet recovery, ACP and no-funded-Cell recovery remain separate unresolved research directions.

## Q2b: Can the only recipient Cell fund the fee?

OBSERVE: Original exact-delta merging rejects self-paid fees. WHY: It demands the whole claim as a capacity increase. ASSUMPTION TO CHANGE: An external payer is always available.

WHAT IF: Restrict discounted merging to anchor+recipient only, compute actual total fee, cap it at 0.01 CKB and at the claim value, and require actual whole-transaction recipient secp authorization. EXPERIMENT: 25 VM cases plus two 10,000-shannon fee-point cases. RESULT: 0.1 and 1 CKB accept with one signer; over-cap/excess-claim fees, changed signatures, extra destinations and altered claims reject. No new native-chain result. See WO09_E3_RECIPIENT_PAID_FEES.md.

COUNTEREXAMPLE: A 1,000-shannon claim can be entirely consumed by a permitted 1,000-shannon fee. Correct accounting is insufficient for useful value recovery. ELSE: Wallet net-value disclosure and product economics matter. The one-funded-Cell condition persists; freeze the successful fee mechanism and prioritize the no-funded-Cell question rather than optimizing 246 bytes.

## Economic gate after Q2b

Measured fee-mode size reduction is 246 bytes versus sponsored merging; starting wallet capacity persists. WHAT IF an LP/channel pays instead? Pinned EGRESS source has an OFF SHA-256 compatibility feature and receiver-side operator-loss limitation. No actual route or buyer was demonstrated. RESULT: account ownership and spendable-value recovery remain distinct. Freeze both merge variants; do not polish their fees further. Costs for 12 principal/price scenarios are modeled with unmeasured lifecycle terms explicit in WO09_E3_CAPITAL_AND_COST_COMPARISON.md. Next decisive question is an actually funded destination/payment route with enforceable counterparty recovery, not another byte saving.

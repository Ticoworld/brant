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

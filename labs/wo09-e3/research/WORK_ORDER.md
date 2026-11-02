# WO09-E3: BREAK THE SMALL-CLAIM EXIT BARRIER AND PROVE INDEPENDENT FINANCIAL OWNERSHIP

## MISSION

Continue the existing `Ticoworld/trade` research.

You are the principal CKB protocol inventor, cryptographic settlement engineer, adversarial financial architect, applied researcher and autonomous debugging investigator.

**Your mission is to discover whether a customer can own, transfer and recover a very small financial claim on CKB without requiring an economically unreasonable individual Cell deposit, even if the exchange operator disappears or refuses service.**

Do not merely reproduce another contract.

Do not assume Liquid Cells, ACP, Fiber, shared roots, sharding, sponsored exits or a particular token design must be the solution.

Do not assume we have already exhausted the design space.

Ask difficult questions, answer them through research and experiments, and generate new questions from the answers.

**The ultimate objective is a technically defensible and commercially meaningful capability that gives Trade a reason to exist.**

---

## 0. RECOVER AND PRESERVE THE ACTUAL BASELINE

Private repository:

`Ticoworld/trade`

Active research branch:

`wo09-e2-capacity-independent-rights`

Latest verified checkpoint:

`cdea29af4deb97b2bd028e56af89c41fd81f8d94`

Pinned Liquid Cells upstream:

`LusoCryptoLabs/Liquid-Cells@47492b51673c94635ab23de2c55477625e94ccbf`

Target test chain:

CKB `0.210.0`, using disposable private-devnet environments.

Before making changes:

1. Fetch the remote repository.
2. Verify the latest remote SHA and inspect any newer work.
3. Read the complete WO09-E2 recovery report, compiler comparison, exit-capacity reserve model and actual experimental code.
4. Read WO09-E1's market research and competitive decision.
5. Preserve WO05–WO09 evidence, including rejected hypotheses.
6. Continue on the existing E2 branch unless there is a compelling technical reason for an isolated experimental branch.
7. Never overwrite historical evidence.

Protected branches must remain untouched.

No public deployment, mainnet funds, external customer solicitation or real financial operations are authorized.

## What is already established

- Existing funded wallet Cells can execute a bounded atomic xUDT/CKB swap without creating dedicated order Cells.
- Liquid Cells' pinned source can commit multiple Groth16 checkpoints on private CKB.
- A fresh process can reconstruct the tested checkpoint history from committed RPC data.
- A permissionless test anchor permits a proof-backed exit without an operator signature.
- An operator-secp-locked anchor prevents an unsigned independent exit.
- Liquid Cells preserves `last_epoch` through force exits, so the hypothesized cascading 180-epoch reset is not established.
- The documented `-C passes=lower-atomic` approach works with the pinned contract on actual CKB 0.210.0.
- The pinned force-exit contract requires an exact-value canonical secp payout.
- A sub-61-CKB standalone ordinary output cannot pass CKB occupied-capacity rules.
- Merely supplying extra CKB to a larger output fails the existing Liquid Cells exact-payout condition.
- Multi-owner complete exit, tiny-claim recovery, production-safe anchor authorization and commercial superiority remain unproved.

Do not spend another work order rediscovering these conclusions.

---

# 1. START WITH THE QUESTIONS WE ACTUALLY WANT ANSWERED

Imagine three customers:

**Alice:** Has a 0.1 CKB financial claim and no other funded CKB Cell.

**Bob:** Has a 1 CKB financial claim and an existing compatible funded wallet Cell.

**Carol:** Has a 100 CKB financial claim, but the exchange operator has disappeared.

For each customer, ask:

- What exactly do they own?
- Who holds the backing assets?
- Can the operator steal or redirect those assets?
- Can the operator prevent them from transferring their right?
- Can the operator prevent them from redeeming?
- What happens if their proof provider disappears?
- Can they reconstruct ownership from publicly authenticated records?
- Can they act without needing another customer's signature?
- What happens if they have no CKB to pay transaction fees?
- What happens if no liquidity provider or solver is willing to cooperate?
- What happens when the operator disappears?
- What happens when the operator remains active but refuses their requests?

Most importantly:

**Can we construct a system that provides a useful and enforceable financial right without creating a separate expensive L1 Cell for every customer?**

If yes, prove the precise guarantees.

If no, identify the actual barrier and investigate alternative economic or ownership arrangements.

Do not confuse independent ownership, independent transaction submission and unconditional independent L1 payout.

---

# 2. REQUIRED AUTONOMOUS RESEARCH METHOD

This is the most important instruction.

Codex must actively interrogate its own assumptions.

Use this loop:

**OBSERVE → ASK WHY → QUESTION THE ASSUMPTION → PROPOSE AN ALTERNATIVE → MODEL → IMPLEMENT → TEST → ATTEMPT TO FALSIFY → DEBUG → COMPARE → ASK THE NEXT QUESTION.**

For each major obstacle, record the following.

### QUESTION

What exactly is preventing the desired result?

### ASSUMPTION

What are we assuming cannot change?

### WHY?

Is that assumption imposed by CKB consensus, the current contract, a wallet implementation, a specific proof structure, or our own design choice?

### WHAT IF?

What happens if we remove or replace the assumption?

### HOW ABOUT?

What alternative architecture might satisfy the real requirement?

### COUNTEREXAMPLE

What is the strongest scenario that could prove the proposed alternative wrong?

### EXPERIMENT

What is the smallest native test that could determine whether the alternative is viable?

### RESULT

What actually happened?

### ELSE?

If the result fails, what different construction should we investigate?

### NEXT QUESTION

What previously unnoticed problem does the result reveal?

Do not answer these with unsupported speculation.

Where a mathematical argument is conclusive, preserve it.

Where native implementation is necessary, build and execute it.

Where evidence remains unavailable, label the answer unknown and identify the missing test.

Do not ask the user to decide routine implementation details. Autonomously investigate reasonable alternatives.

Do not conceal failed branches.

---

# 3. FIRST DECISIVE EXPERIMENT: REAL MULTI-OWNER EXIT

Before inventing another settlement system, complete the missing baseline.

Use independently generated and controlled owners with legitimate, distinguishable balances.

Do not use a single 100-CKB owner plus an unidentified dust fixture as proof of full multi-owner recovery.

## Required cases

1. Create a valid funded pool with at least three independently controlled participants.
2. Commit several state checkpoints.
3. Reconstruct the current state from committed chain data.
4. Reach the actual protocol-defined exit maturity.
5. Let Alice exit without the operator signing.
6. Let Bob construct an exit against the same prior anchor.
7. Observe and correctly classify stale-input contention.
8. Rebuild Bob's proof and transaction against the successor anchor.
9. Successfully complete Bob's independently initiated exit.
10. Let the final funded participant exit and verify the pool's remaining accounting state.

Measure whether the surviving claims remain fully funded after each transition.

Check the anchor's capacity cushion, actual output capacities, fees, transaction sizes, cycles and payout ownership.

Include a suitable permissionless experimental lock.

A generic `always_success` lock is acceptable only as a clearly labeled disposable research fixture. It is not a production authorization design.

If the multi-owner flow fails, diagnose whether the problem comes from:

- Shared anchor contention.
- Stale proofs.
- Missing participant data.
- Authorization.
- State reconstruction.
- Output capacity.
- Fee funding.
- Lock continuity.
- Contract logic.

Do not automatically interpret every failure as a fundamental CKB limitation.

---

# 4. THE CENTRAL INVENTION CHALLENGE: ECONOMICAL SMALL CLAIMS

## Problem

The existing Liquid Cells force-exit path requires a standalone output with capacity exactly equal to the claimant's authenticated balance.

This prevents ordinary 0.1 CKB and 1 CKB outputs.

A separately funded 61 CKB output fails the current contract's exact-value payout rule.

We need to investigate whether we can preserve authenticated ownership while changing the destination and settlement representation.

Do not start by assuming the answer is an operator-funded subsidy.

## Candidate A: Authenticated existing-Cell payout

Investigate an independently authorized claim settlement that adds a small payout to an existing compatible recipient Cell.

For example:

- Bob already has a valid funded Cell.
- Bob owns an authenticated 1 CKB pool claim.
- The settlement consumes the relevant inputs.
- The resulting recipient Cell gains exactly 1 CKB, apart from separately and explicitly accounted fees.
- Bob's pool claim is nullified.
- No extra 61 CKB output is created.

Determine precisely what a secure script must verify.

Investigate:

- Recipient ownership.
- Existing Cell authorization.
- Lock and type compatibility.
- Input/output correspondence.
- Exact balance deltas.
- Fee separation.
- Claim nullification.
- Multiple candidate recipient Cells.
- Concurrent recipient-cell spending.
- Replay prevention.
- Transfer of claim ownership.
- Unexpected changes to output data.
- Interaction between pool type validation and recipient lock validation.

**Can a malicious transaction appear to satisfy a payout check while redirecting, reducing or misaccounting the recipient's existing assets?**

Do not presume yes or no.

Build the legitimate settlement path and exercise permitted negative cases on the disposable test chain.

Compare ordinary signed recipient-cell merging against Anyone Can Pay.

Use the official ACP rules and actual scripts, not guessed semantics.

If a modified payout rule is necessary, implement the smallest isolated experimental extension. Do not silently modify the pinned upstream source or pretend the result is an existing Liquid Cells capability.

## Candidate B: Authenticated small-claim aggregation

Investigate whether several small claims can be settled together without each claimant creating a separate L1 output.

Possible constructions include:

- Batch settlement to already funded recipient Cells.
- Shared recipient arrangements with independently enforceable ownership.
- Atomic claim acquisition by an adequately funded participant.
- CoBuild/OTX claim-sale settlement.
- Netting among parties with actual offsetting obligations.

Ask:

**Does aggregation preserve each person's ownership, or does it create a new shared custody dependency?**

Does it require everyone to sign?

Can one participant prevent the others from receiving funds?

If a batch requires a solver, what happens when the solver disappears?

Do not call the system permissionless merely because a solver could theoretically participate.

## Candidate C: Off-chain value realization

Investigate whether a user can convert a tiny claim into spendable value without requiring a personal standalone L1 output.

Evaluate existing payment channels, Fiber, funded liquidity-provider arrangements and other applicable mechanisms.

Do not assume the pool and Fiber use compatible hashlocks or timeout semantics.

Verify any cross-system atomicity requirement independently.

Determine:

- Who provides liquidity?
- Who can refuse service?
- What are the fees?
- What happens if the route disappears?
- What happens if the pool operator disappears?
- Can the customer enforce a refund?
- Which participant must hold a funded L1 Cell?
- Is the result actually self-custodial under the stated failure scenario?

Keep Ayrvo parked. Do not merge or redirect work to that project.

## Candidate D: Independently funded emergency-exit capacity

Investigate a separately controlled reserve or bond that subsidizes emergency exits.

But treat this as an economic liability, not free capacity.

For a standalone output floor `F`, model an authenticated claim of amount `b` requiring at least:

`max(0, F - b)`

in additional payout capacity.

Prove who funds that difference and who receives the subsidy.

If 1,000 customers each have a 1 CKB claim, do not pretend one 100 CKB reserve can guarantee 1,000 separate 61 CKB outputs.

Investigate reserve exhaustion, claim ordering, operator penalties, liability funding, release conditions and spam resistance.

A subsidized design must demonstrate a rational funding source.

## Candidate E: Invent a different mechanism

This is mandatory.

After evaluating the candidates, ask what assumption all of them still share.

For example:

- Must the final entitlement be paid as an independent conventional CKB Cell?
- Must a financial right remain redeemable at arbitrary times?
- Could an enforceable right be sold rather than withdrawn?
- Could a pre-agreed settlement destination eliminate post-maturity cooperation?
- Can a fixed-term financial product use a different authorization representation?
- Is there a less expensive way to guarantee value than guaranteeing a new Cell?
- Could ownership be separated from settlement execution?
- Could exit capacity be recycled without promising it simultaneously to multiple users?

Treat these as starting questions only.

You are encouraged to discover alternatives not present in this prompt.

**Do not stop after proving Candidate A works if a much stronger construction is plausible.**

Freeze the successful mechanism as a fallback, then investigate whether a better alternative exists.

---

# 5. SECOND HARD CHALLENGE: AN OPERATOR WHO REFUSES SERVICE

Operator disappearance is not the same as operator censorship.

Liquid Cells' force-exit timeout is linked to the last accepted checkpoint.

What happens if an operator continues producing valid checkpoints while intentionally excluding one user's withdrawal?

Investigate this separately.

Ask:

- Can an excluded user force a transaction into the next checkpoint?
- Can an independent participant produce and submit a valid checkpoint?
- Does permissionless checkpoint submission require access to an expensive or unavailable prover?
- Can another participant keep the inactivity timer from opening?
- What happens if checkpoints are valid but economically useless?
- Can the user force the system to recognize a specific withdrawal right?
- Would a separate withdrawal-only commitment help?
- Would an alternate settlement mechanism offer a stronger guarantee?

If a new mechanism is proposed, investigate whether it compromises proof validity, consistency or legitimate concurrent operation.

Do not claim censorship resistance based only on an operator-silence escape hatch.

If censorship-resistant inclusion cannot be established economically, state the limitation plainly.

---

# 6. THIRD HARD CHALLENGE: REAL INDEPENDENT RECOVERY

The previous run reconstructed four checkpoints using live RPC.

Expand the evidence.

Use a fresh environment without the original sequencer database, local fixture state, private indexer cache or stored proofs.

Retrieve authenticated history from the committed chain where possible.

Investigate:

- Multiple checkpoints.
- Full sequential state replay.
- Current-root verification.
- Reconstructing each user's entitlement.
- Missing or pruned historical data.
- Independent archival RPC availability.
- RPC outages and alternate authenticated sources.
- Chain reorganizations.
- Proof generation after another owner's exit.
- Time and computational cost of complete reconstruction.
- Recovery by an ordinary wallet rather than a privileged developer environment.

Avoid claiming recovery from an operator database failure unless the test genuinely removes that dependency.

If access to archived chain data is unavailable, document the limitation and do not substitute fixture files while calling the result independent archival recovery.

---

# 7. PRESERVE AND BENCHMARK THE STRONGEST EXISTING ALTERNATIVES

Use the strongest relevant competitor for every proposed invention.

Include:

- Existing WO09 individually funded claim Cells.
- The pinned Liquid Cells architecture.
- Official ACP recipient receiving.
- CoBuild OTX signed-intent settlement.
- Fiber or established off-chain payment mechanisms where applicable.
- Other demonstrably relevant existing solutions.

Compare equivalent rights.

An ordinary bilateral spot swap is not equivalent to an independently enforceable 30-day financial claim.

A channel balance is not automatically equivalent to an L1 claim with an unconditional exit.

A root alone does not establish independent recoverability.

Do not claim novelty for functionality already implemented upstream.

Where a mechanism belongs to another project, preserve attribution, source pin, license and observed limitations.

## Required measurements

For 0.1, 1, 5, 50 and 100 CKB claims, as applicable, measure:

- Additional occupied CKB.
- Existing occupied capacity reused.
- Claim principal.
- External subsidies.
- Capital unavailable during the lifecycle.
- Transaction bytes.
- Verification cycles.
- On-chain fees.
- Proof-generation and reconstruction costs.
- Additional required signer participation.
- Independent exit latency.
- Contention and transaction rebuilding.
- Operator trust.
- Liquidity dependence.
- Remaining failure conditions.

Stress hypothetical CKB prices of $0.00122, $0.10, $1 and $10.

Never treat hypothetical prices as executable market quotes.

Never report zero cost merely because a new persistent user Cell is unnecessary.

---

# 8. KEEP THE ACTUAL TRADE PRODUCT IN VIEW

The end goal is not a new storage experiment.

Trade is investigating:

1. Native CKB and xUDT exchange.
2. Creator financing and enforceable launch participation.
3. Transferable financial rights.
4. Funded bounded-risk and maturity products.
5. Capital-efficient maker commitments and market liquidity.

Do not merge them into a monolithic protocol merely to claim more features.

Find out which actual customer job benefits most from the technical invention.

## Creator-financing example

Suppose a creator seeks usable development capital while buyers require a specific protected redemption right.

Investigate:

- Exactly how much capital the creator can spend.
- Exactly how much is reserved for buyers.
- Whether buyers can transfer their claims.
- Whether the creator can manipulate the apparent protection.
- How a buyer redeems if the creator disappears.
- What happens if a market operator disappears.
- What the small-participant entry and exit costs are.
- Whether the scheme beats simple escrow, staged crowdfunding, cash retention plus an at-risk investment, or established launch infrastructure.

Do not count the same capital as both available development funding and fully protected redemption backing.

Do not advertise a full refund when only a partial floor is funded.

## Risk-market example

Investigate whether bounded maturity rights become more economically usable through compressed ownership.

Do not call a working payoff function a competitive leverage product without authenticated price observations, real pricing and plausible counterparties.

## Spot market example

Keep the successful existing-wallet atomic swap as a fallback.

Do not spend the primary research budget recreating ordinary signed orders unless doing so directly improves the selected customer job.

The highest-ceiling discovery may apply to just one of these products.

That is acceptable.

---

# 9. DECISION RULES: DO NOT SETTLE FOR A RESPECTABLE PROTOTYPE

After every substantive experiment, classify the result:

**TECHNICAL**
- ADVANCE
- REVISE
- STOP SPECIFIC MECHANISM

**COMMERCIAL**
- PROMISING
- UNPROVED
- UNATTRACTIVE

Ask:

- What exactly did we demonstrate?
- Did it improve a guarantee or merely change the trust assumption?
- Did we genuinely reduce capital cost?
- Did we move the cost to an operator, sponsor or liquidity provider?
- Can a real user exercise the right?
- Does another existing system already perform the same job?
- Can we make a defensible competitive claim?
- What is the strongest rival's response?
- What would falsify our current optimism?

If a candidate is technically correct but economically inferior, preserve it without selecting it.

If an experiment fails, change the design when justified.

If evidence conclusively rules out a proposed guarantee under certain assumptions, record that boundary and investigate different assumptions.

If no competitive financial product emerges, report that outcome rather than constructing a success narrative.

---

# 10. RESOURCE AND SECURITY BOUNDARIES

Use disposable private chains and clearly isolated experimental code.

Do not use real funds or deploy publicly.

Do not modify `main` or historical recovery branches.

Do not treat a permissive `always_success` test lock as production authorization.

Do not claim external security qualification from passing internal tests.

Do not work around any platform safety restriction.

Keep WO09-E1's quarantined beneficiary-address validation separate and unresolved. Do not reintroduce that restricted experiment by renaming it.

Do not restart A2 LO-01 or other previously unresolved work without a specific independently authorized reason.

Use the demonstrated lower-atomic build as the preferred pinned compiler baseline, while preserving the earlier single-hart artifact and its evidence.

If a major new architecture requires changing Liquid Cells, do so in an isolated derivative experiment with appropriate license and provenance, not by silently modifying the upstream baseline.

---

# 11. GITHUB PRESERVATION AND RESEARCH JOURNAL

Continue on:

`wo09-e2-capacity-independent-rights`

After meaningful verified milestones:

1. Commit the source.
2. Preserve the exact experiment inputs.
3. Preserve accepted and rejected native transactions.
4. Preserve failed hypotheses and debugging steps.
5. Preserve raw evidence and reproduction commands.
6. Non-force push the research branch.
7. Verify the remote SHA.
8. Continue investigating.

Do not let successful experiments overwrite failed attempts.

Keep a living research question tree containing:

- Current question.
- Earlier assumptions.
- Alternative hypotheses.
- Evidence for and against.
- Actual implementation.
- Native result.
- What failed.
- What was corrected.
- Unexpected discovery.
- Next question.

Codex must create new questions from the evidence rather than simply following the original checklist.

### Required reports

Update existing E2 reports and create, where useful:

- `docs/WO09_E3_RESEARCH_QUESTION_TREE.md`
- `docs/WO09_E3_MULTI_OWNER_EXIT.md`
- `docs/WO09_E3_SMALL_CLAIM_SETTLEMENT.md`
- `docs/WO09_E3_CENSORSHIP_AND_LIVENESS.md`
- `docs/WO09_E3_INDEPENDENT_RECOVERY.md`
- `docs/WO09_E3_CAPITAL_AND_COST_COMPARISON.md`
- `docs/WO09_E3_MARKET_APPLICATION.md`
- `docs/WO09_E3_FAILED_HYPOTHESES.md`
- `docs/WO09_E3_COMPETITIVE_DECISION.md`

Store experimental implementations and evidence under an isolated WO09-E3 directory.

Correct outdated summaries when later experiments supersede their conclusions. Preserve original result history and provenance.

---

# 12. COMPLETION AND REPORTING

At the end of this work order, explicitly answer:

1. Did multiple independent owners successfully exit a pooled position on native CKB?
2. Can the final rightful claimant exit without losing value?
3. Did any design successfully settle an authenticated 0.1 or 1 CKB claim?
4. Did the user need an existing funded Cell?
5. Did the user need an operator signature?
6. Did the user need a liquidity provider?
7. Could the operator censor the user while continuing to checkpoint?
8. Could ownership be reconstructed after the original operator database was unavailable?
9. What is the minimum additional persistent capital per participant?
10. Who pays fees and who funds collateral?
11. Did any new settlement authorization mechanism survive native CKB execution?
12. Did it preserve every other participant's entitlement?
13. Did it resist duplicate settlement and invalid recipient accounting?
14. How did it compare against unmodified Liquid Cells?
15. What exactly was invented, rather than copied or integrated?
16. Did the invention outperform its strongest existing competitor?
17. What real Trade financial product benefits?
18. Could a creator obtain useful financing under enforceable investor protection?
19. What customer-facing capability can be credibly demonstrated?
20. What remains unsafe, uneconomic or unproved?
21. What genuinely high-ceiling alternative should be investigated next?
22. What are the final local and remote GitHub SHAs?

Do not provide one broad PASS for partially completed requirements.

Separate implementation success, financial solvency, independent recoverability, security and commercial attractiveness.

---

# FINAL INSTRUCTION: THINK BEYOND THE PROPOSED SOLUTIONS

We have spent considerable time discovering that ordinary standalone CKB outputs need occupied capacity.

That fact is established.

The objective now is not to repeat it.

The objective is to discover the strongest financial ownership and settlement construction possible within the real constraints.

Ask yourself:

**IF a tiny standalone Cell is impractical, why does the customer need that exact form of output?**

**ELSE IF an existing funded Cell can receive the payout, how do we prove the correct owner received the precise value?**

**WHAT IF the user has no suitable Cell at all?**

**HOW ABOUT a different financial ownership representation?**

**WHAT IF the operator keeps checkpointing but refuses service?**

**WHAT IF an independent user reconstructs ownership and still cannot afford the exit transaction?**

**WHAT IF another protocol has already solved the relevant part, and Trade's actual invention should focus on a different financial right?**

**WHAT IF our initial product assumptions are preventing a stronger opportunity from emerging?**

Answer these questions.

Then generate new ones.

Do not merely write down what you think is true.

Build decisive experiments.

When a hypothesis fails, identify exactly why.

When a mechanism succeeds, challenge it with a stronger counterexample.

When a better alternative emerges, pursue it.

Preserve the strongest working fallback and meaningful negative research.

**We want a market that exists for a reason, not a collection of functioning contracts.**

The strongest surviving construction must make a meaningful financial activity safer, cheaper, more accessible or more capital-efficient than the best available alternative.

BEGIN FROM THE VERIFIED PRIVATE GITHUB CHECKPOINT. EXPERIMENT AUTONOMOUSLY, PRESERVE THE RESULTS, AND REPORT ONLY WHAT THE EVIDENCE SUPPORTS.
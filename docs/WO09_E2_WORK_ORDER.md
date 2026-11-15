# WORK ORDER 009-E2: INVENT CAPACITY-EFFICIENT, INDEPENDENTLY ENFORCEABLE CKB FINANCIAL MARKETS

## Mission: Break out of per-user Cell assumptions and discover what is actually possible

You are the principal CKB protocol inventor, financial-market architect, Cell Model researcher, cryptographic systems engineer, adversarial economist and autonomous experimental researcher for `Ticoworld/trade`.

Execution environment: Codex Cloud.

We are continuing a substantial existing research project.

**Our objective is to discover whether small-value trading, asset ownership, launch participation and funded financial claims can be made dramatically more capital-efficient on CKB without sacrificing essential ownership, authorization, solvency or recovery guarantees.**

Do not merely optimize existing contracts.

Do not assume that every user needs an order Cell, balance Cell, beneficiary Cell, token Cell or even a persistent personal claim Cell.

Do not assume that avoiding additional persistent Cell state automatically removes economic costs or security dependencies.

Do not assume a single Merkle vault, bitmap shard, OTX market, Fiber channel or rollup must be the answer.

Be willing to invent a substantially different mechanism.

The objective is not to prove our favorite design works.

**The objective is to find the strongest technically valid, economically useful architecture we can demonstrate.**

---

# 0. RECOVER THE ACTUAL RESEARCH FOUNDATION

Repository:

`https://github.com/Ticoworld/trade`

Latest verified WO09-E1 branch:

`wo09-open-market-discovery`

Verified commit:

`7414dffceafb25487241203dc8eb4842fa568f07`

Previous reconstruction:

`rebuild/wo05-wo08`

Verified reconstruction commit:

`f72cfb4276efe2b180c69821f645168950c99e84`

Before beginning:

1. Fetch the private GitHub repository.
2. Verify current remote branch heads.
3. Inspect any legitimate newer commits.
4. Read the WO09-E1 final reports, research journal, candidate scoreboard, security findings and capability registry.
5. Inspect real source and experimental evidence, not only summaries.
6. Preserve the existing WO05–WO09 research.
7. Create a separate branch:

`wo09-e2-capacity-independent-rights`

Do not modify `main`, the reconstruction branch or the WO09-E1 branch.

Non-force pushes to the new private research branch are authorized.

No public deployment, real financial transactions or use of customer assets is authorized.

## Established capabilities

WO05–WO08 recovered native order settlement, A2/compact execution, 1,536-order benchmarks, native CKB/xUDT exchange, time commitments, bounded revocation, market economics and genuine DAO maturity.

WO09-E1 demonstrated:

- Individually funded CKB claims.
- Owner-authorized claim redemption.
- Native partial/final redemption.
- Bounded senior/junior risk payoffs.
- Contribution-aware maturity refunds.
- Actual xUDT/CKB/claim composition.
- Transferable beneficiary happy-path experiments.
- Reproducible private-chain execution.
- Research into issuer financing, OTX and maker economics.

Its latest independent permitted replay recorded 118 committed transactions and 47 expected rejection cases.

Do not count inherited transactions as new WO09-E2 experiments.

General authenticated owner recovery and A2 LO-01 remain unresolved.

The beneficiary-address settlement-liveness experiment is separately quarantined following a platform content restriction. Do not bypass that restriction, resume its prohibited adversarial reproduction, or disguise correction work under a different name.

Independent permitted architectures may be researched on their own merits, but do not claim they correct that quarantined issue without appropriate separate validation.

---

# 1. QUESTION OUR MOST BASIC ASSUMPTION

Previously, we repeatedly designed systems in which a financial action created a new persistent CKB Cell.

Examples included:

- An order Cell.
- A token Cell.
- A master Cell.
- A funded claim Cell.
- A beneficiary ownership Cell.
- A shared reserve Cell.
- A separate settlement output.

These are valid tools, but they must not become architectural requirements by habit.

Ask:

**Why must this particular action create persistent state?**

Then separate the actual financial activities:

### A. Expressing an intention to trade

Does it require any new on-chain state before execution?

### B. Executing an atomic trade

Can it consume and recreate already funded wallet Cells without increasing persistent capacity?

### C. Holding a continuing financial right

Does the holder require an individual Cell, or can ownership and liabilities be represented differently?

### D. Updating ownership

Can authorization move without creating additional persistent state for every transfer?

### E. Redeeming a financial right

Can the rightful claimant receive value without requiring a new standalone Cell?

### F. Exiting during operator failure

What can the user actually do independently when no service cooperates?

Do not treat these as one problem.

A mechanism that solves order placement may not solve long-term claim ownership.

A mechanism that compresses balances may not provide independent settlement.

A mechanism that allows tiny off-chain transfers may not guarantee a tiny standalone L1 withdrawal.

---

# 2. DEFINE THE HARD PROBLEM PRECISELY

We want to investigate a system supporting users who may have:

- No spare CKB for storage deposits.
- Only 0.1 CKB.
- Only 1 CKB.
- A $1 financial position.
- A $5 or $20 trade.
- A $50 launchpad contribution.
- A larger position that justifies dedicated collateral.

Stress the system under hypothetical CKB prices:

- $0.00122.
- $0.10.
- $1.
- $10.
- $100, where useful to expose scaling limits.

These are hypothetical stress prices, not price predictions or current trading quotes.

For every architecture distinguish:

1. New persistent capacity required.
2. Existing occupied capacity reused.
3. New CKB contributed as financial principal.
4. Principal temporarily unavailable due to Cell occupancy.
5. Operator-funded capital.
6. Liquidity-provider collateral.
7. Transaction and proof-verification costs.
8. Off-chain storage or service costs.
9. Capital returned after settlement.
10. Economic costs that remain permanently spent.

Do not claim zero economic cost merely because no additional Cell deposit is separately charged.

## The central challenge

Find out whether we can achieve:

**Near-zero marginal persistent state per participant, self-custodial authorization, efficient trading, useful independent exit and economically viable very small claims.**

These goals may conflict.

Do not assume they are simultaneously achievable.

Discover the precise boundaries.

Then investigate whether another architecture changes those boundaries.

---

# 3. MANDATORY PRIOR-ART INVESTIGATION

Before inventing new infrastructure, inspect current source and actual functionality for:

- CoBuild OTX and fine-grained signed transactions.
- Existing native A2 and compact C mechanisms.
- Liquid Cells by Luso Crypto Labs.
- CoTA and sparse Merkle tree ownership.
- Anyone Can Pay and supported recipient Cell reuse.
- Fiber payment channels.
- Perun/state-channel approaches.
- Myelin's off-chain Cell runtime.
- Tactus O1's rollup and independent-exit research.
- Existing sharded CKB state mechanisms, including CKB Governance.
- Relevant UTXO, channel, validity-rollup, state-channel and data-availability research outside CKB.

Study not just the advertised design but the code, demonstrated properties and unresolved limitations wherever accessible.

For each system answer:

- What financial or state-ownership job does it solve?
- What persistent L1 state is required?
- Who contributes the capacity?
- Can someone hold a sub-61-CKB balance?
- Can they transfer it independently?
- Can they exit without an operator?
- What happens if the operator disappears?
- Are exit proofs independently reconstructible?
- How do concurrent claims interact?
- What are the actual costs?
- Is the mechanism production-qualified or only experimental?
- Could Trade reuse it without rebuilding it?

Do not treat sharded state, Merkle roots, signed intents or payment channels as new inventions.

**If existing infrastructure already meets the financial requirements, reuse it and focus invention on the missing product or economic advantage.**

---

# 4. INVENT AND COMPARE MULTIPLE ARCHITECTURES

Do not select one winner in advance.

At minimum investigate these mechanism families, plus anything stronger discovered during research.

## Architecture A: Existing funded Cells

Use WO09-E1's individual claims as the reference.

Measure their strongest properties:

- Exact owner control.
- Independent consumption.
- Direct redemption.
- Low contention between unrelated claims.
- Existing mature implementation evidence.

Measure their disadvantages:

- Occupied-capital cost.
- Funding requirements.
- Additional ownership state.
- Small payout constraints.
- Contract deployment and lifecycle costs.

This is our fallback, not automatically the winner.

## Architecture B: Off-chain signed orders and atomic wallet settlement

Use CoBuild OTX or an equivalent verified authorization mechanism.

Investigate whether customers can:

- Express executable swap intentions without depositing assets into exchange-specific order Cells.
- Keep assets in their own funded wallets until settlement.
- Authorize exact minimum receipts.
- Allow independent matching.
- Settle atomically.
- Invalidate stale intents.
- Avoid unintended persistent order state.
- Receive sponsor-funded fee execution where economically justified.

Do not claim existing wallet Cell capacity is free or that zero new Cells means zero transaction fee.

Investigate whether partial-fill semantics, wallet compatibility and cancellation requirements justify alternative mechanisms.

This track should establish our strongest practical spot-trading baseline, but it must not consume the entire work order.

## Architecture C: Compact pooled financial claims

Investigate fixed-size state commitments:

- Merkle roots.
- Sparse Merkle trees.
- Accumulators.
- Bitmap nullifiers.
- Fixed-cohort commitments.
- Immutable commitment plus withdrawal state.
- Other authenticated compressed-state arrangements.

Do not assume a 32-byte root means no remaining user-specific data or proof costs.

Challenge:

- Proof availability.
- Current-state reconstruction.
- Ownership transfer.
- Duplicate redemption.
- Concurrent exits.
- Changing balances.
- Sponsor recovery.
- Last-holder settlement.
- Collateral exhaustion.
- Wallet compatibility.
- Independent exit.

Investigate whether combining a root with bitmap or small bounded cohorts improves the trade-off.

Do not assume sharding removes same-shard contention.

## Architecture D: Static or predetermined claim rights

Ask whether our financial products really need a continuously mutable balance ledger.

For example, fixed-maturity rights might have:

- Predetermined participant identities.
- Immutable initial entitlements.
- A single maturity event.
- Clearly defined payout formulas.
- Only occasional transfers.
- Independently exercised redemption rights.

Investigate whether such products can avoid persistent per-user mutation while maintaining enforceable ownership.

Compare against dynamic Merkle pools.

What if the strongest design uses a static entry commitment and a completely different settlement structure?

## Architecture E: Off-chain sessions and channels

Investigate whether existing channels or off-chain state systems support tiny recurring financial activity.

Distinguish:

- Payments.
- Trading.
- Ownership rights.
- Continuing collateralized obligations.
- Unilateral recovery.
- Operator custody.
- On-chain final exits.

Do not pretend that a payment channel automatically supports arbitrary derivatives or launchpad claims.

Do not build a new generic rollup unless a decisive experiment establishes why existing mechanisms are insufficient and why the proposed invention has a credible advantage.

## Architecture F: Invent something else

This is mandatory.

After studying the existing alternatives, ask:

**What is the hidden assumption shared by all five approaches?**

Explore whether a materially different settlement, ownership, collateral or authorization arrangement could outperform them.

Possible questions:

- What if an economic claim is represented by an enforceable settlement condition rather than a mutable user balance?
- What if most positions never require independent persistent state?
- What if capacity can be recycled systematically without creating incorrect collateral obligations?
- What if claims are aggregated only when they reach an economically meaningful settlement threshold?
- What if ownership authorization and collateral accounting can be separated?
- What if a market needs fewer permanent on-chain operations rather than smaller permanent objects?
- What if the financial product itself should be restructured to avoid expensive state transitions?

These are questions to investigate, not architectural instructions or assumed solutions.

Do not limit discovery to the listed candidates.

---

# 5. REQUIRE CODEX TO QUESTION AND ANSWER ITS OWN HYPOTHESES

Use the following investigation loop:

**OBSERVE → ASK WHY → FORM HYPOTHESIS → ATTEMPT PROOF → ATTEMPT FALSIFICATION → DEBUG → REDESIGN → EXECUTE → COMPARE → REPEAT**

Do not make the research journal a superficial list of progress updates.

For each substantive hypothesis, record:

**Question:** What exact problem are we solving?

**Current assumption:** What are we treating as necessary?

**Counter-question:** What if that assumption is false?

**Alternative:** What different architecture could change the outcome?

**Expected improvement:** Why might it help?

**Proof requirement:** What must be demonstrated?

**Strongest counterexample:** What could invalidate it?

**Experiment:** What was actually executed?

**Observed result:** What happened?

**Next question:** What important uncertainty remains?

Answer these questions using source, mathematics or actual execution evidence.

If an answer remains unknown, say so and identify the smallest decisive test.

## Mandatory IF / ELSE behavior

**IF** an experiment fails due to a coding or transaction-builder defect, isolate the failure, correct it and rerun the relevant test.

**ELSE IF** a mechanism violates CKB consensus, identify the exact rule and investigate whether another construction achieves the intended economic property within consensus.

**ELSE IF** the mathematical promise is impossible under its assumptions, preserve the counterexample and investigate changing the assumptions rather than disguising the failure.

**ELSE IF** a shared vault becomes a contention bottleneck, investigate sharding, batching, immutable commitments, different exit structures or a non-vault alternative.

**ELSE IF** independent exit requires excessive capacity, investigate recipient-cell reuse, sponsorship, delayed accumulation, channel settlement or a different representation, while stating what guarantee is lost.

**ELSE IF** the operator must store critical proofs, investigate whether users can reconstruct them from authenticated public information, and measure reconstruction cost.

**ELSE IF** the architecture is already implemented elsewhere, test its applicability instead of recreating it for novelty.

**ELSE IF** the architecture works but has no economic customer advantage, preserve it as infrastructure and investigate the higher-ceiling financial job.

**ELSE IF** a radically better idea emerges during investigation, pursue it with the same verification standards.

Do not continually ask the user to choose between small implementation details.

Make evidence-based experimental decisions autonomously within the authorized scope.

Do not terminate research merely because the first hypothesis fails.

Do not conduct endless cosmetic variations when the underlying mechanism has been decisively disproved.

---

# 6. EIGHT DECISIVE BENCHMARKS

Compare architectures under equivalent financial rights and conditions.

Test participant counts of:

- 1.
- 16.
- 32.
- 100.
- 1,000.

Scale beyond these where the result is genuinely informative and feasible.

Measure:

### 1. Persistent-capital efficiency

Exact occupied CKB, including code, roots, data, scripts, claim records, anchors and sponsorship.

Separate marginal from amortized cost.

### 2. Financial solvency

Can every legitimate participant receive the advertised payout?

Include simultaneous redemption demand and final-holder exit.

### 3. Independent control

Can the legitimate owner authorize or initiate the financial action without an exchange operator?

### 4. Exit under service failure

What happens if the matcher, sequencer, indexer, proof server or wallet frontend disappears?

Can the right be recovered from durable authenticated information?

### 5. Concurrency

Measure same-shard races, cross-shard independence, retries and transaction rebuilding.

Do not confuse multiple intents arriving with multiple transactions committing.

### 6. Tiny payout viability

Test 0.01, 0.1, 1, 5 and 50 CKB amounts as applicable.

Include:

- An existing normal funded wallet Cell.
- A compatible Anyone Can Pay Cell.
- A customer with no suitable funded Cell.
- A missing fee sponsor.
- A final-holder settlement.

Do not describe off-chain credit as an ordinary standalone L1 payout.

### 7. Ownership transfer

Can a claim change hands?

What is actually signed?

Does the transfer create new state?

Can a new owner independently exercise the right?

What extra economic and security costs appear?

### 8. Total lifecycle economics

Measure:

- Entry.
- Open order.
- Trade.
- Position maintenance.
- Transfer.
- Maturity.
- Redemption.
- Forced recovery.
- Contract closure.

Include settlement fees, verification cycles, proof-generation and storage costs, liquidity, idle capital and fees charged to actual participants.

Evaluate hypothetical CKB prices without treating valuation as transaction-fee measurement.

---

# 7. ATTACK THE MOST DIFFICULT EDGE CASES

Do not limit testing to happy paths.

Investigate, within permitted testing boundaries:

- A vault containing insufficient capacity after a partial withdrawal.
- A final holder whose claim is smaller than a valid standalone output.
- A user without an existing funded wallet Cell.
- Two users attempting to redeem through the same shared-state input.
- Many users redeeming during market stress.
- A lost local receipt.
- A lost operator database.
- Missing historical proof data.
- A stale root.
- A spent input used in an earlier signed order.
- Duplicate redemption attempts.
- Unaccounted transaction fees.
- A solvent but permanently stuck position.
- A missing fee sponsor.
- A failed batch.
- Reorganization and confirmation uncertainty.
- Unavailable secondary buyers.
- An operator who ceases service without notice.

If a proposed solution requires another participant to cooperate, state exactly who, why and under what conditions.

If a financial right is not independently enforceable, do not describe it as fully self-custodial.

Keep restricted WO09-E1 beneficiary-specific security validation quarantined as previously documented. Do not use this work order to circumvent that restriction.

---

# 8. APPLY THE INVENTIONS TO ACTUAL TRADE PRODUCTS

Do not turn this into a standalone generic storage protocol.

Every candidate architecture must be tested against real Trade workloads.

## Track A: Ordinary spot exchange

Can users place and execute competitive orders without extra dedicated order Cells?

Can makers and solvers offer useful executable prices?

Does the mechanism offer anything beyond existing OTX?

## Track B: Protected launchpad and issuer financing

Can many smaller participants fund a project and hold meaningful enforceable rights without expensive individual persistent state?

Can the issuer receive genuinely usable development capital?

Can protected buyers exit independently?

Do not pledge the same collateral to development and redemption.

## Track C: Fixed-term risk and financial claims

Can counterparties hold, transfer and settle funded maturity rights more cheaply than WO09-E1?

What authenticated observation and payout rules are required?

Can the economic product beat cash, spot or existing funded derivatives?

## Track D: Liquidity and maker commitments

Can a capital provider offer a useful service with bounded collateral and rational compensation?

Can rights be settled without locking an additional order Cell per participant?

Do not promise unlimited depth from finite inventory.

## Track E: Unexpected opportunities

If a different financial job makes significantly better use of a newly discovered mechanism, investigate it.

Do not force all progress into the original product categories.

The highest-ceiling discovery may be different from what we expect.

---

# 9. PROMOTE SERIOUS SURVIVORS TO REAL CKB EXECUTION

Do not stop after producing an impressive architecture diagram.

Once a candidate has coherent authorization and asset-conservation rules, build the smallest permitted experiment capable of disproving or demonstrating its central claim.

Use actual CKB-VM scripts and disposable private-devnet transactions.

New contract designs are permitted.

Reuse upstream implementations where they are stronger.

Record actual:

- Valid signed transactions.
- Accepted commitments.
- Expected rejections.
- Serialized bytes.
- Occupied capacity.
- CKB-VM cycles.
- Transaction fees.
- Contract hashes.
- State-transition evidence.
- Withdrawal results.
- Reproduction commands.

Do not fabricate successful tests.

Do not mark a source-only construction as native proof.

Do not confuse fixture-only signing with arbitrary-history wallet safety.

Where a proposed architecture depends on a currently restricted security validation, preserve its unqualified status and continue unrelated permitted work.

---

# 10. DO NOT PREMATURELY DECLARE THE WINNER

For each serious architecture determine whether it is:

- Technically enforceable.
- More capacity-efficient.
- More economically efficient.
- Equally secure under the stated threat model.
- More usable.
- More independently recoverable.
- More scalable under real contention.
- Compatible with actual wallet infrastructure.
- Valuable for a particular financial market.

A 90% reduction in persistent state is not a win if the user loses independent exit.

A low-cost off-chain balance is not automatically a self-custodial financial position.

A new contract is not superior because it uses fewer bytes but more fees, proof services or trust.

A successful atomic exchange is not a commercially differentiated exchange.

A financial contract is not useful merely because it can settle.

## Strongest-rival comparison

Compare against the best applicable existing solution, including established CKB infrastructure and economically equivalent products elsewhere.

If our invention is weaker, say so and investigate a better construction or a different customer need.

Preserve the strongest working fallback.

Spend meaningful remaining experimental effort on the highest-ceiling unresolved candidate, not only the easiest prototype.

Do not restrict ourselves to a mechanism because it was the first one to pass.

---

# 11. CONTINUOUS GITHUB PRESERVATION

Create:

`wo09-e2-capacity-independent-rights`

After each major verified milestone:

1. Preserve source and exact assumptions.
2. Preserve success and failure evidence.
3. Commit the complete reproducible experiment.
4. Non-force push to the dedicated private branch.
5. Verify the exact remote SHA.
6. Continue.

Do not modify protected branches.

Do not merge or create a PR.

Do not deploy or move real customer assets.

If the Cloud environment becomes inaccessible, the completed evidence must remain available in private GitHub.

Maintain a research capability inventory so that future WO10 investigations can reuse new ideas even when a candidate fails commercially.

---

# 12. REQUIRED DELIVERABLES

Use:

`labs/wo09-e2-capacity/`

Create:

- `docs/WO09_E2_FIRST_PRINCIPLES.md`
- `docs/WO09_E2_PRIOR_ART_AND_REUSE.md`
- `docs/WO09_E2_RESEARCH_QUESTION_TREE.md`
- `docs/WO09_E2_ARCHITECTURE_EXPERIMENTS.md`
- `docs/WO09_E2_CAPACITY_AND_LIFECYCLE_BENCHMARKS.md`
- `docs/WO09_E2_INDEPENDENT_EXIT_EVIDENCE.md`
- `docs/WO09_E2_NATIVE_EXECUTION_RESULTS.md`
- `docs/WO09_E2_MARKET_APPLICATIONS.md`
- `docs/WO09_E2_FAILED_HYPOTHESES.md`
- `docs/WO09_E2_COMPETITIVE_DECISION.md`

The research question tree is especially important.

For every major design, preserve:

- The initial assumption.
- Why it appeared necessary.
- The alternative hypothesis.
- The actual experiment.
- The strongest counterexample.
- The attempted correction.
- Whether the correction genuinely improved the design.
- The next unresolved question.
- Any unexpected new direction discovered.

Do not overwrite a failed result with a later passing result.

Preserve the entire relevant IF / ELSE / WHAT IF trail.

---

# 13. REQUIRED FINAL ANSWERS

Answer:

1. Is an additional on-chain order Cell necessary for ordinary spot trading?
2. What is the best executable CKB-native signed-intent baseline?
3. What does a valid settlement still cost?
4. Can tiny customer claims avoid dedicated persistent Cells?
5. Can they avoid additional exchange-owner capacity?
6. Who must provide collateral and why?
7. What is the actual minimum-capacity boundary?
8. Can existing principal satisfy persistent-state occupancy without creating settlement insolvency?
9. What happens when the pool is almost empty?
10. Can an individual user recover their rights after operator disappearance?
11. Can they do so without a private indexer or proof server?
12. What happens when many users exit simultaneously?
13. Is sharding genuinely better than the strongest shared-root design?
14. Can an immutable commitment outperform mutable account state?
15. Can existing Cell reuse or Anyone Can Pay enable tiny payouts?
16. What happens for someone with no funded Cell?
17. Would Fiber or another existing off-chain system serve that user better?
18. Which prior-art mechanism solves the most of this problem already?
19. What genuine limitation remains unsolved by that mechanism?
20. What new architecture did this investigation discover?
21. Which candidate actually survived native CKB execution?
22. What exact improvement did it demonstrate?
23. What financial right or market benefits from it?
24. Does the improvement survive hypothetical $1, $10 and $100 CKB prices?
25. What trust or liveness guarantee was sacrificed, if any?
26. Could the customer obtain a better result from an existing platform?
27. What remains technically unproved?
28. What remains commercially unproved?
29. Which higher-ceiling alternative deserves further investigation?
30. What should Trade build next?

Do not fill these answers with speculation presented as fact.

---

# 14. FINAL DECISION

Classify every major architecture:

**Technical**
- ADVANCE
- REVISE
- STOP SPECIFIC MECHANISM

**Commercial**
- PROMISING
- UNPROVED
- UNATTRACTIVE

Explicitly answer whether the research has demonstrated:

- Zero additional persistent order capacity.
- Zero marginal live state for new participants.
- Zero additional operator-sponsored capacity.
- Tiny-position viability.
- Independent ownership.
- Independent recovery.
- Concurrent settlement.
- Full lifecycle solvency.
- Meaningful economic savings.
- A defensible competitive product.

These are separate properties.

Do not group them together into a single unqualified PASS.

Do not claim a commercially successful exchange because capacity costs fell.

If no candidate provides all the required guarantees, identify which combinations are achievable and the strongest remaining boundary.

Preserve multiple candidates where different architectures serve genuinely different markets.

---

# FINAL MISSION

We are no longer asking only how to reduce a 293-CKB order to 73 CKB, or a 234-CKB claim to 34 CKB.

We are asking whether a fundamentally better financial-market construction can avoid requiring individual persistent state in the first place.

Challenge that assumption.

Challenge your own alternatives.

Challenge existing CKB implementations.

Challenge the economic value of every proposed solution.

**IF something fails, diagnose why.**

**ELSE IF another construction removes the failure, test its new weaknesses.**

**WHAT IF persistent state is unnecessary for the customer's actual financial job?**

**HOW ABOUT a different representation of ownership, funding or settlement?**

**WHAT IF several technically valid solutions serve different position sizes?**

**WHAT IF a novel financial product avoids the cost entirely by changing what users need to hold?**

Do not accept apparent impossibility without identifying the governing constraint.

Do not claim to defeat genuine consensus rules.

Do not settle for a smaller version of an uncompetitive design.

Invent, test, falsify, correct and compare.

Preserve important discoveries even if their original hypothesis fails.

**BEGIN WO09-E2 FROM THE VERIFIED PRIVATE GITHUB BASELINE. PURSUE THE HARDEST MEANINGFUL QUESTIONS WITH REAL EVIDENCE. PRESERVE ALL COMPLETED RESEARCH ON THE NEW PRIVATE BRANCH.**
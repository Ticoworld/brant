# WORK ORDER 009-MASTER: DISCOVER AND PROVE A UNIFIED CKB-NATIVE FINANCIAL MARKET

## Mission: Build the strongest operator-independent, capital-efficient financial market that the evidence supports

You are the principal CKB protocol inventor, financial-market architect, cryptographic engineer, adversarial systems researcher and autonomous experimental investigator for `Ticoworld/trade`.

We are continuing WO09, not restarting the research or prematurely moving to WO10.

We have working components across several research branches. The purpose of this work order is to determine whether they can become one genuinely useful financial product, preferably with a simpler and more capital-efficient architecture than the current individual-claim and Liquid Cells approaches.

**The central invention hypothesis is a directly validated, operatorless pooled CKB market covenant.**

Instead of operating an off-chain balance system that periodically submits Groth16-proven checkpoints, investigate whether market formation, claim ownership, secondary transfer and redemption can be enforced directly by ordinary CKB transactions and CKB-VM scripts.

This could remove the need for an SP1 prover, checkpoint operator and 180-epoch inactivity escape from a specific class of financial markets.

However:

**This is a hypothesis to test, not an architecture whose superiority has already been established.**

Do not assume it is optimal.

Do not assume all financial products belong in one contract.

Do not force an implementation to satisfy invented performance numbers.

Investigate alternatives, challenge the design and preserve the strongest evidence-backed result.

Our ultimate objective is not a clever contract.

**It is a financial product that customers and creators have a concrete reason to use, that is economically superior for its intended job and that does not require unnecessary trust or occupied CKB capacity.**

---

# 0. RECOVER AND PROTECT EXISTING WORK

Private repository:

`https://github.com/Ticoworld/trade`

Verified research references:

### WO05–WO08

Branch:

`rebuild/wo05-wo08`

Commit:

`f72cfb4276efe2b180c69821f645168950c99e84`

Contains native settlement, batch-clearing, iCKB/DAO lifecycle and other preserved trading research.

### WO09-E1

Branch:

`wo09-open-market-discovery`

Commit:

`7414dffceafb25487241203dc8eb4842fa568f07`

Contains funded launch claims, issuer-financing models, bounded senior/junior maturity contracts, transferable-right experiments, security findings and competitive research.

Its source does not establish a complete production-ready launchpad or leverage platform.

### WO09-E2/E3

Branch:

`wo09-e2-capacity-independent-rights`

Commit:

`4fb3a5ffe836da332816440504167df009768eea`

Contains Liquid Cells reproduction, proof reconstruction, operatorless experimental exits, existing-Cell payouts, sponsored native tiny-claim settlement and bounded recipient-paid fee tests.

The recipient-paid variant passed CKB-testtool, but not a fresh native-chain lifecycle.

Commercial competitiveness remains unproved.

## Before doing anything

1. Fetch the repository and verify current remote heads.
2. Inspect legitimate newer commits if any exist.
3. Read the E1 competitive decision and E2/E3 evidence reports.
4. Inspect real contracts, not just summary documents.
5. Preserve all existing experiments, successful and failed.
6. Verify the current base is clean before branching.
7. Create a new isolated branch:

`wo09-unified-breakthrough`

If it already exists, inspect and reconcile its history rather than overwriting it.

Base it on the latest verified E3 research, importing only the specific E1 code and models actually required.

Do not blindly merge experimental directories or duplicate incompatible dependencies.

Do not modify:

- `main`
- `rebuild/wo05-wo08`
- `wo09-open-market-discovery`
- `wo09-e2-capacity-independent-rights`

Commit and non-force push verified milestones to the new private branch.

No mainnet deployment, public release, customer funds or paid external infrastructure is authorized.

---

# 1. RECOVER THE REAL PRODUCT OBJECTIVE

Before designing another contract, answer:

**Why should Trade exist?**

Potential customer jobs include:

### Protected creator financing

A creator receives genuinely usable development capital.

Participants receive explicitly funded financial rights that cannot simply be withdrawn or erased by the creator.

Those rights may be redeemable, transferable or settled under predefined conditions.

### Native financial risk markets

CKB holders obtain funded downside protection or bounded upside exposure without relying on discretionary exchange liquidation.

### Native trading and liquidity

Traders exchange assets atomically with minimal unnecessary persistent capacity and competitive execution economics.

These may eventually complement one another.

But do not assume a launchpad, exchange and derivatives platform should all be built as one giant protocol.

**Select the strongest initial customer job based on financial logic, implementation feasibility, competition and evidence.**

Protected creator financing is our leading candidate for this particular experiment because it may avoid an external price oracle.

It is not automatically the commercial winner.

Do not claim token-price protection when the actual guarantee is denominated in CKB.

---

# 2. INVESTIGATE THE OPERATORLESS MARKET VAULT HYPOTHESIS

## Initial idea

A CKB Market Vault contains pooled collateral and compact state commitments.

Users own authenticated claims committed in a Merkle tree or another provably correct data structure.

Ordinary CKB transactions directly enforce the market's financial state transitions.

An owner can request redemption without an exchange operator's signature, provided all legitimate financial and maturity conditions are met.

Potential benefits:

- No individual dedicated claim Cell for every participant.
- No SP1 checkpoint prover for direct L1 transitions.
- No mandatory 180-epoch operator-inactivity wait.
- No operator signature for ordinary permitted redemptions.
- Existing wallet Cells reused for small payouts.
- Explicit native collateral accounting.
- Reusable market code across cohorts.

These are potential properties, not presumed achievements.

## First-principles questions

Ask:

1. Why did Liquid Cells need Groth16 in its particular architecture?
2. Which of those reasons disappear when every relevant market transition occurs directly on CKB?
3. Which advantages of off-chain state execution disappear too?
4. Does direct L1 validation really improve total lifecycle cost?
5. Could a smaller fixed-cohort structure outperform a global Merkle vault?
6. Could an immutable commitment plus bounded redemption state be safer?
7. Can the same financial right be represented without dedicated user Cells?
8. How do users obtain current proofs after other participants modify the shared root?
9. Can one shared Cell handle realistic competing transactions?
10. Does an operatorless market require a fundamentally different customer experience?

Generate further questions from actual findings.

## Mandatory architecture comparison

Investigate at least:

**A. Direct root-committed Market Vault**

Authenticated participant rights and directly verified L1 state updates.

**B. Fixed-cohort or sharded claim covenant**

Independent smaller pools intended to reduce contention and limit the state affected by each transaction.

**C. Existing individual funded claim Cells**

The WO09-E1 fallback, with independent ownership and higher capacity requirements.

**D. Existing Liquid Cells pooled state**

The E2/E3 fallback, with Groth16 checkpointing and its established liveness trade-offs.

**E. A materially different architecture**

Investigate any stronger representation of collateral ownership or enforceable financial rights discovered through research.

Do not choose Architecture A merely because this prompt begins with it.

The strongest solution may be a combination that uses different architectures for different markets.

---

# 3. AUTONOMOUS INVENTION AND DEBUGGING RULE

This is a core requirement.

Use the following loop:

**OBSERVE → WHY → ASSUMPTION → IF → ELSE → WHAT IF → HOW ABOUT → MODEL → EXECUTE → FALSIFY → REDESIGN → RETEST.**

For every major question, record:

### OBSERVE

What did the experiment or source actually show?

### WHY

What mechanism caused that result?

### ASSUMPTION

What condition are we treating as unavoidable?

### WHAT IF

What happens if that assumption is changed?

### HOW ABOUT

What alternative design might avoid the limitation?

### COUNTEREXAMPLE

What is the strongest way to break the proposed solution?

### EXPERIMENT

What exact native transaction or model can distinguish success from failure?

### RESULT

What genuinely passed or failed?

### NEXT QUESTION

What new question emerges from the result?

## IF / ELSE requirements

**IF** a contract fails because of a wiring, serialization or transaction-builder error, correct it and retest.

**ELSE IF** CKB consensus rejects a proposed state transition, identify the governing rule and investigate a different construction within consensus.

**ELSE IF** a mechanism reduces storage but introduces an expensive proof or serialization bottleneck, measure the complete trade-off.

**ELSE IF** the global Vault causes excessive contention, investigate cohort sharding, batching or independent claims.

**ELSE IF** proof updates depend on a private indexer, investigate public-data reconstruction or a different representation.

**ELSE IF** one user's ownership transfer can compromise another's claim, redesign the ownership mechanism before adding more market features.

**ELSE IF** the proposed mechanism already exists elsewhere, compare and reuse rather than claiming originality.

**ELSE IF** a candidate technically works but is economically inferior, preserve it as a fallback and investigate a higher-ceiling candidate.

**ELSE IF** a significantly better architecture emerges, pursue it with the same validation standards.

Do not stop at the first error.

Do not continue repeating a conclusively disproved approach.

Do not fabricate confidence when evidence is incomplete.

Do not require user approval for ordinary reversible research decisions.

---

# 4. DESIGN A CORRECT POOLED CLAIM REPRESENTATION

Before implementing the financial product, define the state machine mathematically.

## Candidate state

A Market Vault might contain:

- Unique market identifier.
- Market type and version.
- Current authenticated claims root.
- Market lifecycle status.
- Total outstanding backed liabilities.
- Explicit protected reserve.
- Remaining units or entitlements.
- Financial terms.
- Maturity or deadline constraints.
- Authorized market configuration.
- Capacity cushion ownership and closure policy.

A nullifier bitmap is optional.

Do not include one automatically if changing the authenticated root to a redeemed-leaf state already prevents duplicate redemption.

If using a bitmap, account for its actual byte growth.

A bitmap covering 1,000 claims requires at least 125 bytes, not zero bytes.

Investigate whether a fixed-size commitment to spent rights is more economical and secure.

## Required security invariants

Prove:

1. Every claim corresponds to an actual funded entitlement.
2. No one can manufacture an unbacked claim.
3. No claim can be redeemed twice.
4. A claim cannot be reassigned without proper authorization.
5. Reserve liabilities cannot exceed available, spendable backing under the defined rules.
6. Creator proceeds cannot consume the protected reserve.
7. A participant cannot modify another owner's entitlement.
8. Fees and capacity differences cannot disguise unauthorized withdrawals.
9. The pool cannot close while unpaid valid liabilities remain.
10. Final settlement returns residual capital only to parties entitled to receive it.

Use exact integer/shannon arithmetic.

Check rounding, overflow, zero balances and final-claimant handling.

If different participant classes have different payout formulas, use the sum of actual outstanding liabilities, not an oversimplified single floor-per-token formula.

---

# 5. SOLVE THE DATA-AVAILABILITY AND PROOF-UPDATE PROBLEM

A 32-byte root alone is not enough for independent ownership.

Every participant must be able to determine:

- Their current entitlement.
- The current owner.
- Whether the right was transferred or redeemed.
- The proof needed for a permitted settlement.
- Which current root is live.

Investigate at least two approaches:

### Full authenticated participant data in published transaction witnesses

Market creation and state changes publish enough information to reconstruct the committed records.

Measure witness bytes, verification cycles and history-replay costs.

### Incrementally verifiable state changes

Each transition publishes the affected leaf, authorization and necessary Merkle proof.

A third party can reconstruct the current state by replaying authenticated transitions.

Measure the complexity of keeping proofs fresh after unrelated changes.

## Mandatory experiment

Start with three owners.

After Alice redeems, Bob must reconstruct a valid proof against the new root without requesting cooperation from Alice or an exchange operator.

Repeat after ownership transfer, partial settlement and simultaneous attempted redemptions.

Then test missing local receipts and a missing private indexer.

If no public or independently recoverable proof path exists, do not claim operator independence.

Do not mistake a locally generated proof for independently recoverable state.

---

# 6. BUILD THE SMALLEST VALID DIRECT COVENANT

Only after the basic invariants are coherent, implement the minimum direct-C​KB Market Vault needed to falsify or prove the architecture.

Prefer an isolated contract under:

`labs/wo09-unified/`

Reuse correct existing code where appropriate.

Preserve source attribution and licenses.

## Performance

Investigate:

- RISC-V binary size.
- Link-time optimization.
- Dead-code elimination.
- Symbol stripping.
- Existing code dependency reuse.
- Cryptographic library size.
- VM-cycle cost.

Targets such as a binary below 25 KB or Merkle validation below 5 million cycles may be explored.

**Never treat them as guaranteed.**

Measure the actual release binary and occupied capacity.

Do not assume static elliptic-curve tables or missing optimization flags explain Liquid Cells' full binary size without inspecting its real build.

Do not strip symbols or change compiler flags in a way that conceals reproducibility problems.

Do not optimize away authorization checks.

## Authorization

Investigate a permissionless covenant lock or another enforceable lock/type design.

Do not use an `always_success` fixture as a production security mechanism.

The contract must prevent unauthorized spending, unauthorized contract replacement, arbitrary value extraction and unjustified closure.

Validate the entire transaction structure, not merely one claimed Merkle proof.

---

# 7. PRIORITY PRODUCT: PROTECTED CREATOR FINANCING

Build one narrowly defined product before attempting the entire exchange.

## Illustrative financial terms

Suppose participants contribute:

`100,000 CKB`

Illustrative protection structure:

- `80,000 CKB` backs specified buyer redemption rights.
- `20,000 CKB` may become creator-usable funding before fees.

This is a test configuration, not a universal recommended ratio.

Investigate the actual creator and buyer incentives.

## Required lifecycle

### A. Market creation

The creator specifies funding goals, rights, protections, deadlines and distribution rules.

The transaction establishes unique market identity and valid initial state.

### B. Participant enrollment

Multiple independent owners contribute funded assets.

Verify that each contribution is properly authorized and credited exactly once.

Commit the participants' rights without automatically creating separate persistent claim Cells.

Measure the real consumed inputs, generated outputs and change Cells.

Do not claim zero per-user capacity if a participating wallet must fund new outputs or additional state.

### C. Creator funding

After specified funding conditions are satisfied, release only genuinely usable creator proceeds.

The protected reserve remains enforceable.

Do not allow the same CKB to back a redemption guarantee and be spent on development.

### D. Protected ownership

Participants possess precisely specified redemption entitlements.

These rights must remain enforceable if the creator stops participating.

### E. Redemption

A legitimate holder submits the required proof and authorization.

The covenant:

- Checks the exact entitlement.
- Enforces financial maturity or redemption rules.
- Nullifies the redeemed right.
- Updates remaining liabilities.
- Pays the authorized recipient.
- Preserves the remaining reserve.

Test existing-Cell merging for tiny claims and standalone payout where financially valid.

Do not assume the E3 self-paid fee mechanism is already proven in the new contract or on the native chain.

### F. Final closure

After every valid obligation is fulfilled, close the pool according to an explicitly authorized rule.

Return residual capacity to its rightful contributor or designated recipient.

Measure the complete closure transaction.

Do not silently award the remaining capacity cushion to the last claimant.

---

# 8. THE CENTRAL SECONDARY-TRADING CHALLENGE

This deserves separate attention.

A launchpad without a real secondary market may be just another crowdfunding platform.

But trading the launched token is not equivalent to transferring its protected redemption entitlement.

## Question

If Alice owns a protected position and Bob buys it:

**What exactly does Bob acquire?**

Investigate whether the financial right is represented by:

- An authenticated owner record in the Market Vault.
- A separate token whose ownership correctly controls redemption.
- An independently transferable claim.
- An atomic assignment combined with a buyer payment.
- Another enforceable mechanism.

Do not simply issue an xUDT and assume its holder automatically owns a redemption claim stored under someone else's key.

## Required demonstration

Alice owns a valid funded claim.

Bob offers actual consideration.

One authorized atomic transaction:

1. Debits the buyer's real payment source.
2. Pays Alice the agreed consideration.
3. Transfers the exact financial entitlement to Bob.
4. Updates or consumes the old ownership authorization.
5. Prevents Alice from redeeming after the transfer.
6. Allows Bob to redeem under the applicable terms.
7. Preserves all other participants' rights.

Measure whether this can occur without creating new per-user persistent claim Cells.

Investigate CoBuild OTX if flexible off-chain signed orders offer a useful execution advantage.

Do not call an ordinary whole-transaction signature an OTX implementation.

If secondary transfer cannot be demonstrated safely, explicitly narrow the product to non-transferable funded participation until a stronger mechanism exists.

Do not claim instant secondary liquidity merely because a transfer transaction is valid.

There must be an actual buyer, maker or executable quote.

---

# 9. TEST FLOOR INCREASES WITHOUT MANUFACTURING VALUE

The protected financing proposal includes a possible rising redemption floor.

Investigate this carefully.

A higher CKB-denominated floor requires sufficient backing for all remaining eligible rights.

The floor must not increase solely because a new variable is written into a Cell.

Possible real funding sources include:

- Explicit issuer contributions.
- Fees actually received.
- Genuine surplus collateral.
- Redeemed liabilities released under valid rules.
- Other authenticated external funding.

Determine whether a claimed floor increase is consistent with every existing entitlement.

Test differing claim sizes, ownership classes, partial redemptions and rounding.

If the generic ratchet is too complicated or economically inferior, keep a fixed, fully funded floor as the working product.

**A simple solvent product is better than an impressive-looking insolvent one.**

---

# 10. OPERATORLESS EXECUTION AND CONTENTION

A permissionless Market Vault may eliminate the need for an operator signature, but it does not eliminate shared-input contention.

Every transition consuming the same Vault Cell conflicts with transactions built against its previous state.

## Mandatory tests

- Two users redeem against the same root.
- Alice commits first.
- Bob's stale transaction fails.
- Bob reconstructs the current proof.
- Bob resubmits successfully.
- Another participant transfers a right while a redemption is pending.
- Several independent markets operate simultaneously.
- A transaction submitter disappears.
- A fee payer disappears.
- A user has no current proof service.

Investigate whether one large pool, smaller independent cohorts or another structure produces the best real user experience.

Measure rebuild costs and realistic transaction throughput.

Do not claim zero contention.

Do not claim instant finality.

Do not claim every permitted exit can land in the next block.

The meaningful guarantee is that no privileged exchange operator can arbitrarily veto an otherwise valid settlement under the protocol's stated conditions.

Prove that guarantee, including adverse but valid concurrent activity.

---

# 11. TEST THE HARDEST FINANCIAL EDGE CASES

Use actual native CKB transactions when permitted and feasible.

At minimum investigate:

- Unauthorized creator reserve withdrawal.
- Unsupported new claim issuance.
- Duplicate redemption.
- Invalid Merkle inclusion.
- Invalid leaf transition.
- Wrong current root.
- Wrong owner signature.
- Fee deductions greater than permitted.
- Incorrect recipient capacity.
- Unauthorized transfer.
- Transfer followed by stale-owner redemption.
- A missing recipient funded Cell.
- A participant with only 0.1 CKB.
- A participant with only 1 CKB.
- A final redemption leaving insufficient Vault capacity.
- Incorrect reserve ratchet.
- Conflicting settlement requests.
- Pool shutdown while rights remain outstanding.
- Malformed state witness.
- Missing historical proof data.
- Overflow and rounding failures.
- An attempt to replace or bypass the covenant's code identity.

Preserve exact rejection causes.

Do not count a malformed test fixture as an adversarial contract rejection.

Do not label a CKB-testtool acceptance as a committed native-chain transaction.

Respect previously documented platform restrictions. Keep the quarantined WO09-E1 beneficiary-specific validation and A2 LO-01 unresolved, and do not recreate those prohibited cases by renaming them.

Independent, permitted validation of this new mechanism is allowed within the authorized research scope, but it must not be misrepresented as closing those prior security restrictions.

---

# 12. DO NOT FORCE THE RISK MARKET INTO THE LAUNCH CONTRACT

Once the basic pooled financial-rights mechanism is demonstrated, evaluate whether it can also support bounded senior/junior maturity products.

Reuse the E1 mathematical models and authenticated payout assumptions.

But do not combine oracle-dependent risk settlement with an oracle-free creator-financing design merely to advertise two products.

A risk market must establish:

- Fully funded complementary payoffs.
- Correct rights for both participants.
- Enforceable maturity.
- Authentication of required price observations.
- Delayed or conflicting observation rules.
- Outage/refund behavior.
- Rational counterparty compensation.
- Real liquidity or willingness to quote.

If the protected launch works and the risk market does not, preserve the launch result independently.

If risk markets reveal a stronger customer advantage, preserve that finding and explain whether the product direction should change.

One reusable primitive is useful.

One gigantic contract containing unrelated financial rules is not automatically useful.

---

# 13. REAL NATIVE-CHAIN EVIDENCE

Do not stop at architecture diagrams or compilation.

Use CKB-testtool for focused state-machine and authorization tests.

Then use an isolated disposable CKB 0.210.0 environment for decisive end-to-end cases, subject to the resource and safety limits of the workspace.

## Minimum native acceptance demonstration

The smallest credible unified demonstration is:

1. Deploy the new covenant.
2. Create a funded market.
3. Enroll at least three independently controlled participants.
4. Commit their authenticated financial rights.
5. Release only the allowed creator funding.
6. Execute one legitimate protected redemption.
7. Execute one legitimate ownership transfer with actual consideration, if the chosen architecture supports it.
8. Execute a small existing-Cell redemption.
9. Reject attempts to reuse consumed rights.
10. Complete final lawful settlement and pool closure.

Use valid balances, adequate capacity, actual signatures and verified transactions.

Do not substitute hand-authored current-state roots for evidence of legitimate market formation.

If the final accepted architecture differs from the initial direct-vault idea, adapt the acceptance tests to its actual security model.

## Resource limits

Previously, the Codex Cloud environment suffered low disk availability and could not run a new SP1 proving setup.

A direct CKB-VM covenant may avoid that particular proving dependency.

Do not assume it avoids all build, VM or transaction resource constraints.

Inspect actual free space before running large builds.

Preserve source, logs and evidence.

Do not delete unrelated files or circumvent platform restrictions.

Reuse verified caches when safe.

If native-chain execution is blocked, preserve completed VM evidence and explicitly classify native qualification as blocked rather than inventing success.

---

# 14. ECONOMICS: MEASURE THE COMPLETE MARKET, NOT ONLY THE CLAIM ROOT

Compare at:

- 3 participants.
- 16 participants.
- 100 participants.
- 1,000 participants.

Use native execution wherever feasible.

Use explicit analytical extrapolation where the full workload has not been executed.

Do not label models as benchmarks.

## Measure

- Contract binary bytes.
- Actual code-Cell occupied capacity.
- Vault occupied capacity.
- Capacity cushion.
- Dedicated participant Cells, if any.
- Marginal state growth per additional participant.
- Entry transaction bytes and cycles.
- Transfer bytes and cycles.
- Redemption bytes and cycles.
- Actual fees and fee assumptions.
- Witness size.
- Root-update cost.
- Proof reconstruction cost.
- Contention and rebuild cost.
- Residual closure cost.
- Capital tied up throughout the lifecycle.
- Creator proceeds.
- Buyer protected backing.
- Required liquidity.
- Cost of optional indexing and relaying.

Stress hypothetical CKB prices:

`$0.00122`, `$0.10`, `$1`, `$10`.

These are valuation scenarios, not market predictions.

## Compare against

1. WO09-E1 individual native claims.
2. Liquid Cells E2/E3.
3. Fixed-cohort or sharded claims.
4. Simple funded escrow and staged financing.
5. CrowdCell and other applicable launch infrastructure.
6. Equivalent ordinary spot holdings or cash retention.
7. CoBuild OTX where actual signed-order flexibility is relevant.

Do not compare unrelated products as though they provide identical financial guarantees.

## Critical question

If users already have funded wallet Cells, is the direct pooled architecture materially more efficient than individual claims?

If users have no funded wallet Cells, what additional funding or service do they actually require?

If we must maintain an expensive shared contract, what utilization is necessary to justify its deployment?

If direct L1 updates become expensive at high activity, would Liquid Cells or another off-chain construction be economically superior?

Do not hide the trade-offs.

---

# 15. COMPETITIVE AND CUSTOMER VALIDATION

Before calling the unified system a product winner, identify the strongest applicable alternatives.

Use current official documentation, source code and real market evidence where available.

Research:

- Existing CKB fundraising and distribution.
- CrowdCell and relevant crowdfunding rivals.
- Existing exchange and RFQ infrastructure.
- Reserve-backed token structures.
- Existing protected-launch designs.
- Any CKB products with enforceable redemption rights.
- Whether likely creators actually need this financing structure.
- Whether buyers value the proposed protected floor enough to accept reduced upside, complexity and fees.

Ask:

**Why would a serious creator choose Trade?**

**Why would a serious buyer choose Trade?**

**Why would an actual market maker provide bids?**

**Which guarantee can no simpler competitor provide at comparable cost?**

Do not call a product competitive because it is implemented in Rust, uses a Merkle root, runs on CKB or has extensive tests.

Do not invent issuer commitments, liquidity quotes or user demand.

Where access to real counterparties is unavailable, provide a concrete validation plan and classify commercial demand as unproved.

---

# 16. AVOID ANOTHER RESEARCH DEAD END

The purpose of this work order is to reach the highest useful conclusion, not maximize commits or experiment count.

Use staged decisions within this single work order.

## Gate A: Architecture validity

Can a direct covenant enforce funded claims and valid root transitions without privileged operator control?

If no, diagnose and compare alternatives.

If yes, preserve the working base.

## Gate B: Independent customer control

Can unrelated customers authorize entry, transfer where supported, and redemption without surrendering control to an operator?

If no, identify exactly what cooperation is required.

If yes, preserve the evidence.

## Gate C: Economic advantage

Is the resulting full lifecycle materially more capital-efficient, reliable or useful than the strongest existing option?

If no, preserve the implementation and investigate a higher-ceiling construction.

If yes, proceed to the flagship lifecycle.

## Gate D: Complete product demonstration

Can one defined creator-financing market execute from creation through closure with correct ownership, actual usable creator proceeds and enforceable backing?

If no, preserve the working stages and report the missing dependency.

If yes, qualify that precise product hypothesis.

**Do not claim a complete product from passing Gate A alone.**

## Gate E: Commercial relevance

Is there credible evidence that an actual customer would prefer this arrangement to existing alternatives?

If no, classify commercial competitiveness as unproved.

If yes, document the evidence and the remaining operational and security requirements.

---

# 17. PRESERVE EVERYTHING ON PRIVATE GITHUB

Use the dedicated branch:

`wo09-unified-breakthrough`

Commit and non-force push after meaningful verified stages.

Store material under:

`labs/wo09-unified/`

Required reports:

- `docs/WO09_MASTER_RECOVERY_AND_BASELINE.md`
- `docs/WO09_MASTER_FIRST_PRINCIPLES.md`
- `docs/WO09_MASTER_RESEARCH_QUESTION_TREE.md`
- `docs/WO09_MASTER_ARCHITECTURE_DECISION.md`
- `docs/WO09_MASTER_STATE_AND_SOLVENCY_MODEL.md`
- `docs/WO09_MASTER_NATIVE_EXECUTION.md`
- `docs/WO09_MASTER_OWNERSHIP_AND_TRANSFER.md`
- `docs/WO09_MASTER_SECURITY_AND_FAILURES.md`
- `docs/WO09_MASTER_LIFECYCLE_ECONOMICS.md`
- `docs/WO09_MASTER_COMPETITIVE_DECISION.md`
- `docs/WO09_MASTER_FAILED_HYPOTHESES.md`
- `docs/WO09_MASTER_FINAL_REPORT.md`

Keep source, real binaries, relevant binary hashes, tests, raw transaction evidence and reproduction instructions.

Preserve useful failure branches even if the architecture changes.

Do not push secrets, production keys or private wallet data.

Verify every remote SHA after pushing.

Do not create a PR or merge protected branches.

---

# 18. REQUIRED FINAL VERDICT

At the end, answer:

1. Did we eliminate the need for Groth16 in the selected market architecture?
2. Did we eliminate privileged operator checkpoint signatures?
3. Can individual customers enforce permitted redemptions independently?
4. Does the system retain any hidden operator, archive or proof-service dependency?
5. Can participants enter without creating dedicated persistent claim Cells?
6. Who funds existing wallet capacity?
7. What is the actual shared-state capital requirement?
8. How are claims authenticated and reconstructed?
9. Can rights transfer atomically with real consideration?
10. Can the seller still redeem after transferring?
11. Can 0.1 and 1 CKB claims settle safely?
12. Has the fee-paying settlement path been confirmed on a real chain?
13. What happens during same-vault contention?
14. What happens when the final holder exits?
15. Can the creator access useful financing without touching protected backing?
16. Does the floor remain solvent across all tested lifecycle events?
17. Did any floor ratchet produce a genuine funded improvement?
18. What contract binary size and VM cycles were actually measured?
19. Did we reduce total capital cost compared with E1 and Liquid Cells?
20. Did we improve the actual user experience?
21. What does the strongest rival already do better?
22. What remains technically unsafe or unproved?
23. What remains commercially unproved?
24. What is the strongest genuinely new Trade capability demonstrated?
25. Is there sufficient evidence to make this the flagship Trade product?
26. What should be built or validated next?
27. What are the verified private GitHub commit SHAs?

Classify the outcome:

### Technical
- ADVANCE
- REVISE
- STOP SPECIFIC MECHANISM

### Commercial
- PROMISING, EVIDENCE INCOMPLETE
- UNPROVED
- UNATTRACTIVE

### Product
- END-TO-END RESEARCH DEMONSTRATION
- PARTIAL RESEARCH DEMONSTRATION
- ARCHITECTURE NOT YET VALIDATED

Do not claim mainnet readiness without independent security qualification, realistic wallet integration and remaining lifecycle validation.

---

# 19. FINAL AUTONOMOUS INSTRUCTION

Do not treat this prompt as a rigid script that forces a preconceived architecture to win.

Challenge it.

Ask:

**WHY does this financial right need a dedicated Cell?**

**WHAT IF a directly validated Merkle commitment is sufficient?**

**WHAT IF the Merkle root becomes a contention bottleneck?**

**HOW ABOUT independent fixed cohorts?**

**WHAT IF ownership transfer is more expensive than redemption?**

**WHAT IF a token holder cannot prove that they own the promised backing?**

**WHAT IF the protected reserve is safe but the creator receives too little funding to make the product attractive?**

**WHAT IF a simpler financing structure beats our complex contract?**

**WHAT IF the right solution uses our native settlement work but does not require a shared Vault at all?**

**WHAT IF our biggest advantage comes from changing the financial product rather than the storage architecture?**

Develop answers.

Test the strongest plausible corrections.

Invent new mechanisms when necessary.

Preserve successful fallbacks.

Do not declare impossible merely because the first design fails.

Do not declare a breakthrough merely because a contract compiles or a transaction commits.

We are prepared to undertake significant engineering research.

But the work must serve the actual product.

**The objective is to create a CKB-native financial market with a real reason to exist: credible creator financing, enforceable participant rights, rational capital requirements and useful trading or redemption opportunities.**

Pursue the strongest evidence-backed solution, even if it differs radically from our starting architecture.

BEGIN FROM THE VERIFIED PRIVATE GITHUB BASELINE.

CREATE THE ISOLATED WO09 UNIFIED RESEARCH BRANCH.

QUESTION, INVENT, EXECUTE, FALSIFY, CORRECT, COMPARE AND PRESERVE.

COMPLETE THE STRONGEST END-TO-END FINANCIAL LIFECYCLE THE EVIDENCE AND ENVIRONMENT ALLOW, WITHOUT FABRICATING RESULTS OR SACRIFICING SECURITY.
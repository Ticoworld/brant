# WO09 master research questions

## Q1: Does a directly validated vault need a succinct prover?
OBSERVE: Existing E3 exit predicates run directly, while Liquid Cells checkpoints prove off-chain transition batches. WHY: Different workloads. WHAT IF every narrow market transition publishes and validates its own state change? ALTERNATIVES: bounded explicit cohort, mutable tree, immutable root plus spent bitmap. EXPERIMENT: exact integer liability model. RESULT: modeled transitions conserve obligations and designated cushion; this is not native contract validation. NEXT: valid native formation of a small explicit cohort and independent redemption, then compare a root representation.

## Q2: Can a single global floor stand in for all liabilities?
COUNTEREXAMPLE: floor(sum contributions*ratio) differs from sum(floor(each contribution*ratio)). RESULT: executable one-shannon example produces 2 versus 0. REDESIGN: sum actual promised rights; specify minimum useful participation and rounding. NEXT: bounded on-chain encoding and overflow checks.

## Q3: Who owns final cushion?
ASSUMPTION TO REJECT: The last holder receives leftover vault capital. MODEL: K is explicitly owned separately; six exit orders preserve it and closure returns it to its contributor. NATIVE STATUS: not executed. NEXT: verify authorized closure cannot occur before liabilities are zero.

## Q4: Is protected creator funding useful?
Example contributions total 21.1 CKB; 16.88 remains backing and 4.22 gross is creator-usable before fees. This is financial consistency, not creator demand. Strong rival: simple escrow/staged finance/cash retention. Commercial evidence remains absent. NEXT: measure real full lifecycle before selecting flagship.

## Q1 native follow-up

Direct three-record covenant now compiles to 15,136 bytes and committed a full bounded native lifecycle: funded formation, three separately signed enrollments, reserve-preserving creator release, partial redemption, paid assignment, new-owner redemption and designated-funder closure. No Groth16, always-success vault lock or operator checkpoint is used. Nine intended negative cases reject. This supports direct validation for this narrow market; it does not qualify mutable-root/bitmap versions or commercial economics. Code Cell 15,177 CKB and vault 378 CKB are real additional capital costs. NEXT: preserve baseline; expand refund/fee/identity tests; reconstruct current state from committed RPC in a fresh process; compare bounded records against root representations and smaller financial products.

## Snapshot and availability experiment

WHAT IF a full authenticated snapshot replaces both explicit live records and Merkle proofs? Native lifecycle succeeds with the same financial transitions. WHY: bounded deterministic state can be hashed and fully validated directly. RESULT: 208 CKB saved per three-member vault; 248 CKB more code publication; 280 more bytes per ordinary transition. Fresh process reconstructs after another holder's redemption and after paid assignment using the latest transaction witness. COUNTEREXAMPLE: without that witness, the 32-byte root does not reveal the records. Explicit live state remains the availability fallback.

## Maturity, refunds and independent markets

Actual early script and future-since node submissions reject; after real block maturity the same financial request executes. Pre-activation refund and re-enrollment succeed without creator cooperation. Two disjoint markets commit independently signed entries in the same block, then separately refund/close. Same-market UTXO conflicts remain. These bounded observations do not establish adversarial network throughput or universal censorship resistance.

## Stop/revise decision

Comparative capacity/witness economics justify stopping global explicit-array expansion. Freeze successful bounded financial variants; no commercial winner or omnibus market is selected. Further kernel polishing or feature accumulation is not a substitute for creator budget, buyer preference, availability and liquidity evidence. The full financial Merkle alternative and realistic large-user workloads remain unproved.

## Integrated Merkle acceptance gate

OBSERVE: Full financial Merkle lifecycle committed on the native node with 298 CKB live vault, 17,408-byte binary. WHY: each published old/new leaf and path validates a specific permitted transition, while global counters track exact deltas from funded creation. No full unrelated records are republished for individual actions. COUNTEREXAMPLE TESTS: wrong sibling and superficially valid totals with arbitrary root reject. NEXT: fund and authorize large batches, rebuild current proofs from public transactions in a fresh process, and test genuinely funded optional increases before claiming scalability or a ratchet.

## Funded increases and archival counterexample

Native sale-funded increase passes: buyer separately pays seller, adds 0.001 CKB to Carol's backing and pays miner fee. Unfunded increase rejects. No global ratio is needed; original minima and exact remaining shannons are conserved. A heterogeneous-units ratio model underpays a promised minimum; keep fixed default and optional explicit funded additions only.

Fresh child retrieves Bob's right and current proof after unrelated updates using public committed history. Controlled withholding of one enrollment prevents recovery. This confirms a history availability dependency, not a private-indexer requirement or universal archive guarantee.

## Scaling debug findings

Duplicated funding inputs are rejected by the native resolver as Dead rather than a literal Duplicate error. The corrected negative test asserts the outpoints are identical and that the real funding Cell remains live before/after rejection. A separate full 16-owner run completed but the next market's builder used the consumed pre-closure funder Cell. Fix: adopt the returned funder wallet successor. Preserve both failed-run logs and the valid 16-owner transactions; neither failure is classified as a covenant exploit or successful wrong-error negative case.

## Scale result and unexpected witness boundary

Complete financial Merkle lifecycles now execute natively for 16,100,1,000 actual funded owners, including every remaining redemption and final closure. Ordinary individual actions publish paths and old/new leaf only; 1,000-owner payload is 440 bytes, complete redemption 1,254 bytes / about 2.04M cycles.

WHY the first 100 batch failed: standard secp error -22 is a 32,768-byte per-witness bound. The 32,816-byte payload exceeded it. REDESIGN: bounded signed chunk framing; covenant concatenates up to four chunks and validates exact payload. No root/owner/funding check removed. Further false assumption: configured max_tx_verify_cycles 70M is not demonstrated to be a hard admission cutoff; larger batches actually commit without changing config. Official CKB source queues larger work. Preserve both failed predictions and successful commitments.

WHAT IF smaller batches win? Same-target native test shows seven <=16-owner batches use about 209M cycles vs315.5M for one100 batch, with6% more bytes and seven shared-state transitions. Select batch size by coordination, latency and fee/cycle trade-offs; no universal100 batch optimum.

## Integrated scale resolved; new economic/availability gate

OBSERVE: configured complete 3/16/100/1,000-owner native financial markets close after all liabilities are paid. WHY: leaf transitions and exact capacity deltas jointly enforce ownership and funding; archive replay updates stale paths. WHAT IF dust remains? Actual 2-shannon admission yields a script-valid refund that cannot meet observed relay fee without wallet-principal loss. CORRECT: isolated immutable minimum contribution/goal/residual policy; all scaled lifecycles re-executed, old binary/evidence retained. New concern: no owner-compulsion rule exists, so lost keys/refusal can still hold cushion indefinitely.

WHAT IF outsider-funded gifts churn proofs? Default configured flags prohibit donations and sale-topup extras. Optional explicitly enabled version executes real funded increases and preserves rejection of substituted owners, resurrection and unpaid increases. Enabled mode still permits paid root churn; no starvation guarantee.

WHAT IF the cash floor has no incremental buyer value? Keeping 80% cash and making a 20% at-risk grant offers the same cash protection without vault/code/archive overhead. A valuable differentiated creator benefit or conditional financial payoff must justify this architecture. No launched token/equity/upside is presently authenticated. NEXT: specify and economically falsify that benefit, buyer/LP incentives and archive costs before another product implementation. Do not substitute more small fee optimizations for this gate.

Current classifications and all twenty requested answers: `WO09_MASTER_MERKLE_DECISION.md`. No WO10 started. Quarantined beneficiary/LO-01 work remains unresolved and untouched.

## Product/payoff discovery — 3 November 2026

OBSERVE real public builder budgets and payment/onboarding complaints; WHY they do not imply a buyer wants a refund-floor instrument. MODEL the same-benefit cash-retention counterfactual, exact cash-or-asset/call identity, milestone information gap,80%floor funding constraints and operator/channel capital separation. RESULT: reject undifferentiated cash-only financing and unbacked/double-counted promises; retain provider-authorized conditional scarce reservations and earned-merchant-balance recovery as distinct discovery leads. Neither has actual Trade price/terms/LP/archive validation.

NEXT DECISIVE GATE is independent priced customer/provider evidence, not another storage contract or native rerun. `WO09_MASTER_PRODUCT_SELECTION_GATE.md` records MORE CUSTOMER EVIDENCE REQUIRED; `WO09_MASTER_NEXT_DECISIVE_EXPERIMENT.md` is the unsent, unactioned validation plan. Full source registry, model counterexamples, complete hypothetical offer cards and operating-scale sensitivity are isolated under `labs/wo09-unified/product-research`. No new native/security qualification or WO10 is implied. Quarantined E1/LO-01 work remains untouched.

## Final capacity hypothesis — 3 November 2026

OBSERVE: prior market authenticates owners through personal normal-input Cells. WHY: application convention, not universal consensus rule. WHAT IF capacity provider funds shared storage but owners sign directly in witnesses? NATIVE: isolated custom Ed25519/Merkle pool accepts genuinely funded key-only rights and exact owner-authorized transfers. Stronger alternative: fees come directly from authenticated claims, so fee-sponsor disappearance/exhaustion does not stop those transactions. PUBLIC-HISTORY recovery works; withheld history stops it explicitly.

COUNTEREXAMPLE: a valid script estimate for a tiny ordinary payout still fails native occupied-capacity validation. A61CKB gift enables an actual independently spent output but is neither guaranteed nor automatically reusable sponsor capital. All requested dollar-position/price pairs are below the41CKB structural output minimum. RESULT: PARTIAL ADVANCE, preserve optional A+B capability, keep unconditional small ordinary withdrawal unproved/conditional. Stop this bounded capacity workstream and return to Trade trading/execution/liquidity comparisons under explicit settlement/capital guarantees. No service/crowdfunding pivot or WO10. See `WO09_FINAL_CAPACITY_DECISION.md` and five companion reports.

## 2026-11-03 continuation: original trading/liquidity mission

Frozen capacity investigation remains PARTIAL ADVANCE. New isolated actual CKB/xUDT exchange, stronger direct-wallet/published-A2 rival evidence, storage-only economic thresholds and next unresolved market questions are recorded in `WO09_TRADING_MARKET_DECISION.md` (Q1–Q11). Initial native milestone was privately verified at `0fbf94aacafa1a952c7200ba1471746b75203368`. Earlier financial/capacity metrics are not relabelled as qualification of the new exchange contract. No commercial superiority or live maker liquidity is established; preserved A2/direct execution remains the baseline.

## 2026-11-03 actual native inventory follow-up

The November2 iCKB CCC release prompted direct published-SDK mainnet pool/book reads.18resolved groups were all fulfilled;24pool deposits yielded0current wallet-ready deposits. Real new-order output/maturity calculations are simulations, not observed bids/asks. RUSD code/Cells were independently verified, but current UTXOSwap market reads returned403. Exact30quote/45maker scenarios and source evidence are in `labs/wo09-unified/inventory-discovery`. Decision: **STOP this particular quote-unsubstantiated maker/adapter opportunity**, preserve the settlement stack; reopen only for a measurable funded native quote and paid customer gap. See `WO09_NATIVE_INVENTORY_DECISION.md`. No current data supports an adapter, new exchange or renewed capacity optimization; no signing/funding/trading occurred.

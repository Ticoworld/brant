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

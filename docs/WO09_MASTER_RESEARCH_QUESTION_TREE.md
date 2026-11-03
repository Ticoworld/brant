# WO09 master research questions

## Q1: Does a directly validated vault need a succinct prover?
OBSERVE: Existing E3 exit predicates run directly, while Liquid Cells checkpoints prove off-chain transition batches. WHY: Different workloads. WHAT IF every narrow market transition publishes and validates its own state change? ALTERNATIVES: bounded explicit cohort, mutable tree, immutable root plus spent bitmap. EXPERIMENT: exact integer liability model. RESULT: modeled transitions conserve obligations and designated cushion; this is not native contract validation. NEXT: valid native formation of a small explicit cohort and independent redemption, then compare a root representation.

## Q2: Can a single global floor stand in for all liabilities?
COUNTEREXAMPLE: floor(sum contributions*ratio) differs from sum(floor(each contribution*ratio)). RESULT: executable one-shannon example produces 2 versus 0. REDESIGN: sum actual promised rights; specify minimum useful participation and rounding. NEXT: bounded on-chain encoding and overflow checks.

## Q3: Who owns final cushion?
ASSUMPTION TO REJECT: The last holder receives leftover vault capital. MODEL: K is explicitly owned separately; six exit orders preserve it and closure returns it to its contributor. NATIVE STATUS: not executed. NEXT: verify authorized closure cannot occur before liabilities are zero.

## Q4: Is protected creator funding useful?
Example contributions total 21.1 CKB; 16.88 remains backing and 4.22 gross is creator-usable before fees. This is financial consistency, not creator demand. Strong rival: simple escrow/staged finance/cash retention. Commercial evidence remains absent. NEXT: measure real full lifecycle before selecting flagship.

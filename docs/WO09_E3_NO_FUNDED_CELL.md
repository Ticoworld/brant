# WO09-E3 customer without a funded recipient Cell

Status: analytical/source findings; no new channel, ACP, claim-sale or retail service execution. COMMERCIAL UNPROVED. No unconditional spendable-value recovery is claimed.

## Conditional boundary

For a claimant with a sub-61-CKB claim, no compatible funded Cell, no other funded inputs and no outside contribution, ordinary canonical-secp spendable L1 payout cannot be constructed: the claim is less than the new Cell's occupied capacity and fees consume additional value. This is conditional on conventional L1 output form; it does not prohibit compressed ownership, transfer, off-chain delivery or a different product. No-fee transaction submission also requires relay/miner inclusion, not only script validity.

An authenticated account can represent small ownership without a personal Cell. Moving that ownership is a different right: pinned Liquid Cells transfers require owner authorization plus checkpoint inclusion/proving. Operator disappearance or active censorship can prevent cooperative transfer acceptance until another compatible prover/sequencer acts. Existing force_exit fixes payout to the account owner's canonical secp key. The new merge still requires a funded Cell under that same key. A buyer's unrelated wallet is not an accepted replacement for it.

## Alternatives and actual cost bearers

| Alternative | Capital / service provider | Refusal or liquidity condition | Recovery after operator loss |
|---|---|---|---|
| Owner's existing secp Cell | Owner already holds >=61 CKB in suitable form | Owner can sign; history, maturity and chain access required | Tested sponsored native merge; self-fee VM only |
| Gift/sponsored new owner Cell | Sponsor supplies >=61-b CKB plus fees | Sponsor must be willing; subsidy is real value delivered | Possible only with changed funding/payout arrangement; no new unconditional guarantee tested |
| ACP receiving | Someone pre-funds compatible recipient capacity | Recipient must already have ACP Cell or sponsor funds one | Not tested with derivative; current derivative restricts canonical secp, so ACP needs distinct validation |
| Claim sale to funded buyer | Buyer supplies price and settlement liquidity | Buyer willing; seller still needs a usable payment destination | No independent post-operator-loss sale mechanism proved; pool transfer inclusion remains a dependency |
| LP pays a channel balance | LP/router supplies outbound channel liquidity; channel peers fund openings | Actual route, compatible hashlock, payment capacity and fee quote required | No live route demonstrated; pinned pool swap has documented receiver-side recovery limitation |
| Omnibus recipient service | Service owns receiving Cell and backs customer ledger | Custody/trust or another independently enforced claim layer | Shared output alone does not prove customer control; may simply move original recovery problem |
| Wait/aggregate own account above output floor | Customer accumulates enough actual value | Time, added value and account inclusion needed | Not useful arbitrary-time recovery for a fixed small claim; fees still need funding |

Pinned source evidence: Liquid-Cells 47492b51673c94635ab23de2c55477625e94ccbf docs/EGRESS.md. Deployed in-pool leg uses Keccak hashlocks; SHA-256 Fiber compatibility is a staged feature that changes the guest key and is OFF in the deployed guest. The document explicitly describes receiver force-claim limitations during operator loss and that small force-refunds inherit the output floor. Therefore a working in-pool HTLC or swap coordinator is not evidence of an independently recoverable Fiber payment. No new prover or external route was provisioned here.

## Higher-ceiling question

Could an already-funded buyer or merchant accept a precommitted fixed-term right and deliver useful value through an actually funded channel, while retaining enforceable recovery if the pool operator disappears? This changes the settlement form rather than creating an underfunded L1 Cell. The decisive experiment needs an actual compatible route, authenticated claim acquisition, fee quote and failure/refund tests for both sides. It must preserve buyer recovery after operator loss; otherwise it merely prices the buyer's exposure. No such counterparties or routes are currently demonstrated.

A claim acceptable for goods/services may be useful without personal L1 cash, but then delivery/merchant refusal is a product dependency. A customer already owning CKB wallet capacity is a more credible near-term target than universal no-capital retail onboarding. Neither is demand validation.

TECHNICAL: REVISE no-funded-Cell path; retain existing-wallet ADVANCE. COMMERCIAL: UNPROVED. Next research should pursue actual liquidity and enforceable rights, rather than inventing fee savings as a substitute for funded delivery.

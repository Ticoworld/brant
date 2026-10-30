# Repairs and the strongest alternative

## Repairs established inside this experiment

**Keep chain settlement orientation fixed while customer direction reverses.** CKB is always the longer-lived first allocation; the CKB funder holds the secret and claims the strictly expiring EVM destination. In direction A Alice funds CKB first; in direction B Bob funds it first. Both directions actually executed. The baseline reversed sequence produced a late-claim/refund counterexample. This repair avoids assuming hard CKB claim expiry but does not make all timing schedules safe.

**Control first disclosure.** Verify funded terms, code/network identities, selected depths and remaining budgets before signing/broadcasting a preimage-bearing transaction. Expired EVM claims leaked usable secrets despite reverting. The repaired client refused disclosure and recovered both escrows in separate cases. This is a necessary client obligation. The CKB contract cannot distinguish a secret learned through successful payment from one learned through a failed transaction.

**Refund independently of incorrect counterparty funding.** A wrongly funded destination should block disclosure, not the owner's valid source refund. The first validation structure failed here; the repair was implemented and tested. Do not silently treat a validation error as an instruction to recreate the trade.

**Distinguish first disclosure from public-secret recovery.** After CKB has paid, an open EVM escrow may need its removed claim re-included. The repaired client can validate the committed CKB payment/witness and use that evidence to resume without requiring a still-live CKB escrow. The test preserved the baseline refusal and demonstrated the repaired payment. It does not rescue an already refunded/expired EVM escrow.

**Reconcile ambiguous sends.** Compute and retain hashes before broadcasting; query chain state after lost responses. Both CKB and EVM loss-of-response paths were exercised. Unique directories and atomic package writes reduce accidental artifact loss; loss of all private secret state is still outside the proof.

## What these repairs do not solve

No hard claim expiry was added to CKB. `since` is still a lower bound. A source refund can win after sufficient watcher delay. Secret knowledge is irreversible even when a payment reverts or is reorganized. A strict destination cutoff plus a client margin needs enforceable assumptions about relative progress and inclusion, not merely two numerical deadlines.

The fixed CKB close fee cannot be increased under this narrow one-input/one-output contract. Fee sponsorship would require another transaction shape. A careless multi-escrow generalization can allow one output to satisfy several obligations, so the repair must explicitly account for all escrow groups and sponsorship. It is not equivalent to allowing arbitrary additional inputs and hoping each script independently conserves principal.

A committee signature, sequencer promise or generic bond is not automatically a repair. It must identify the funded obligation, prove the breach and provide a claim path. Introducing an oracle for whether an external payment failed reintroduces trust and clock assumptions. A proof of successful foreign payment may be useful, but refund races and proof inclusion still require time/headroom/dispute analysis.

## Stronger protocol frontier

A CKB script that verifies sufficiently final EVM payment evidence could replace bare preimage knowledge as the release condition. This directly addresses a failed-claim secret leak: no successful payment proof, no CKB release. It requires a correct foreign-consensus/finality verifier or an explicitly trusted attestation system. A late payment proof can still race a refund, so a refund-request/challenge state with a bounded proof window may also be required. That adds latency, capital occupancy, proof/data costs and watcher obligations. It is an unimplemented candidate, not a demonstrated secure protocol.

Adaptor-signature or private-relay approaches may change when information becomes observable, but a payment being signed or privately submitted is not a proof it will be irreversibly included. They require a protocol-level argument and implementation tests, not a cryptographic label. Private relays can improve operations without making the venue unconditionally trustless.

## Portfolio-channel scenario using the same assumptions

Consider the same two participants executing 100 alternating $1,000 exchanges during one funded session. Each has native assets allocated in its home-chain adjudicator. A correct common portfolio state changes both allocations; both parties retain the signed state and unilateral recovery data. If inventory is balanced over the session, native capital can be reused for repeated trades without creating two new escrows per fill. If flow is one-way, the receiving allocation depletes and external replenishment is still necessary.

Escrow's measured local EVM work was 310,512 gas including per-trade approval. One hundred repeats of that fixture structure would consume about 31,051,200 gas, ignoring allowance reuse and unrelated optimizations. A hypothetical 350,000-gas channel opening/closing envelope would amortize to 3,500 gas per trade over 100 trades, or 35,000 over ten. **The 350,000 figure is an explicit modeling assumption, not a measured Perun/Fiber result.** CKB channel funding/dispute costs were not measured. This comparison shows the potential ceiling, not a proven 89-fold production efficiency advantage.

Capital is not a virtual ledger credit. Funded channel allocations must cover worst-case enforceable outcomes. One bilateral session can reuse capital as its balances turn over, but 100 different users may require separate allocations or a correct virtual-channel/reallocation mechanism. Maker switching is constrained by where the customer's capital is funded. A common hub root can restore contention/failure concentration. Collateral cannot back several incompatible simultaneous exits.

Fast repeated execution is meaningful only if the signed state yields a consistent unilateral outcome across both chains. A shared version number or two independent balance updates are insufficient. A last signer withholding a completed state, old-state disputes on one chain, late state revelation on the other, and different finality/dispute windows must all be covered by the selected protocol. WO02 did not audit or implement that construction. Existing Perun research/prototypes may supply reusable components; it would be wrong to either declare them sufficient or declare them broken from this escrow experiment.

## Comparison of the best plausible versions

| Property | Repaired per-trade escrow | Correct funded portfolio channels |
|---|---|---|
| First use | Two chain allocations/funding checks per trade | Session opening/funding overhead |
| Repeated execution | More chain operations and pending exposure | Signed funded updates can remove per-fill L1 wait |
| Capital reuse | Reuse only after obligations resolve; net residual flow helps | Repeated balanced updates reuse allocations |
| Maker switching | Compete before each uncommitted allocation | Needs safe funded reassignment or extra liquidity |
| Independent exit | Per-trade refunds/claims, explicit timeout risks | Latest state, data and dispute mechanism on both chains |
| Main risk | Secret-disclosure/inclusion/refund coordination | Cross-chain state consistency and asymmetric unilateral exits |
| Current evidence | Actual contracts, both directions, adversarial losses and repairs | Concrete scenario/model only; protocol proof unestablished |

Independent inventory lanes remain useful for per-trade concurrency. Netting remains useful for compatible opposing flow. Neither should be lost merely because D was provisionally tested first.

## Next decisive work

The next high-ceiling experiment should test the exact atomic-update and unilateral-exit semantics of a supported funded CKB/EVM portfolio-channel construction. Use the same two independently controlled parties and assets, deliberately withhold the last signature and dispute old/new states asymmetrically. Measure funding/close/dispute costs and real capital reassignment. If no supported correct construction exists, first specify the protocol and counterexamples rather than build a channel trading UI.

A foreign-payment-proof/refund-challenge escrow is the strongest alternative repair for occasional conversion. Compare its proof cost and occupancy against the channel experiment. Do not expand this simple escrow into an SDK, wallet integration or production service before either path establishes a meaningful security/economic advantage.

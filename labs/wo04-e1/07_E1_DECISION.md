# E1 founder decision

**PARTIAL MECHANISM, CRITICAL PROOF REMAINING.**

E1 executed real native CKB payouts/refunds governed by real external terminal outcome proofs, but only relative to a controller-selected execution-root checkpoint. A foreign-consensus verifier was not implemented. Calling this end-to-end authenticated settlement without a trusted operator would be false.

## Answers to the decision questions

1. **Can CKB safely distinguish finalized external payment from failed payment?** It checked real account/storage proofs and correctly distinguished the tested terminal outcomes relative to the supplied root. It did not authenticate that root as canonically finalized foreign history. Global finalized-payment safety remains unproved.
2. **Can one external contract decide both outcomes?** Yes, on the tested EVM history. FILLED was recorded only after exact delivery; expired-unfilled closed the fill opportunity. Duplicate/conflicting later transitions reverted. No independent native timeout made another choice.
3. **Cheapest defensible authentication?** Not established for the complete system. Direct proof checking and shared checkpoint consumption are measured. A checkpoint can amortize execution-proof work, but it still needs a sound consensus-authenticated root. Optimistic bonds do not supply that fact by themselves.
4. **Can multiple native transactions read one checkpoint?** Yes. Two independent reservation spends were admitted before mining and used the same read-only checkpoint without consuming it. The final run included both in one block; another retained run used adjacent blocks. This is not a throughput benchmark.
5. **Can an individual recover without the batch publisher?** Yes in the fixture, once the trusted bootstrap exists: a separate keyless settlement process obtained individual EVM account/storage proofs and paid the fixed native beneficiary. It cannot manufacture authenticated roots if the root authority or source data is unavailable.
6. **Measured costs?** Shared close about49,594cycles/376bytes; individual close averaged442,403.5cycles across two proof paths; shared checkpoint publication2,064,388cycles/1,919bytes. Each native close paid0.001 CKB fixed fee. Bootstrap/checkpoint retained700 CKB. Complete gas/fees/bytes are in06 and evidence/costs.json. Foreign consensus verification cost remains unknown.
7. **Important failure?** An absent/unavailable source or unavailable authenticated new root leaves an OPEN reservation locked. Initial false/orphaned roots are not excluded by the on-chain implementation. Fixed fee reserves and immutable retention are additional liveness/economic limits.
8. **Stronger than WO02?** The authoritative outcome semantics address preimage-as-payment and independent refund-choice failures at the design level. Complete end-to-end security superiority is not demonstrated because the new canonical-root requirement is missing.
9. **Shared foundation for both products?** Potentially, at the authenticated fact/commitment interface. Express delivery uses exact terminal payment/unfilled facts. Portfolio exits need unique finalized full allocation, session/collateral epoch, all asset obligations and correct adjudicator. A root attesting EVM payments cannot automatically attest the earlier CKB-authoritative portfolio session. Different anchor/proof directions may be required.
10. **Precise next experiment?** Authenticate a real finalized execution stateRoot on CKB from a pinned Ethereum light-client bootstrap and a valid consensus update, including fork/domain, sync-committee verification, finality branch and execution-header inclusion. Test wrong chain/fork, insufficient finality, replayed old update, malformed branches, withheld data and permissionless recovery. Then connect that accepted root to this existing E1 execution-proof interface. Measure total CKB cycles/bytes and update/retention cost. If direct validation is impractical, test one correctly specified compressed proof of the same predicate. An arbitrary BLS signature or hardcoded checkpoint is not a pass.

## What actually completed

The final run has12 committed CKB transactions,24 EVM receipts and30 named defensive/result cases. Four terminal trades settled; a fifth OPEN trade remained reserved during source outage. A separate offline verifier checked five MPT proofs, all five terms/reservation bindings and observed native payouts. Native source plus compiled artifacts, exact versions, public recovery packages, raw records and costs are preserved. Prior WO04 remained unchanged. No splice repair, public deployment or real-money transfer occurred.

The unique reservation script was improved after a measured fixed TYPE_ID overhead was identified. The final cheaper script passed the same suite plus identity-recreation/duplicate-output tests. This is an engineering improvement with an unaudited extra script, not a cryptographic finality breakthrough.

## Commercial decision

Do not start a production exchange or claim a sustainable business. At the tested two-trade batch, shared publication plus consumption used more cycles than the direct-proof proxy. A simplified larger-batch envelope breaks even around6trades, but larger batches and consensus-verifier costs are unmeasured. Fixed paid fees did not fall when cycles fell. Native-only customer EVM-gas friction, quote optionality, proof waiting and permanent capacity retention remain material.

Keep the tested primitive as a fallback for the next finality experiment. Preserve the portfolio-channel branch as a separate higher-ceiling candidate for repeated execution. A future system may share authenticated foreign-header infrastructure across both, but needs distinct application predicates and enforceable recovery. No universal shared-root or liquidity-creation claim is justified.

## Evidence versus assumptions

VERIFIED: recorded execution, conditional native allocation checks, real execution-state proofs, shared read dependencies, selected rejected cases, separate-process recovery and observed source-outage lock.

DERIVED: if a sound canonical finalized root is supplied and the parser/source code is correct, mutually exclusive terminal commitments can determine native payout versus refund without an independent native timeout.

HYPOTHESIS: production finality verification/retention can be compressed or amortized enough for competitive delivery and perhaps funded trading.

UNIMPLEMENTED/CRITICAL: foreign consensus/finality verification and verified root advancement; audited parser/scripts; arbitrary-outage recovery; production stablecoin integration; larger-batch execution; executable competitive route prices and profitable maker demand.

# Research question tree

## H0: Every trade needs an order Cell

Why: on-chain state makes maker terms visible/reserved. What if false: sign a whole-body off-chain intent and keep assets in funded wallets. Experiment: a four-input/four-output xUDT/CKB swap committed using two existing wallets and two existing asset Cells. Counterexample: only a complete bilateral fill; no partial fills, OTX fragments or fill guarantee. Spent inputs make drafts stale. Next: equivalent CoBuild workload.

## H1: A Merkle root removes per-user capacity

Why: a root is smaller than N Cells. What if immutable: same leaf can claim twice. Mutate root on each exit: shared spend contention. Add per-user nullifier: per-user state returns. Shard: only separates cross-shard traffic. The upstream Liquid Cells alternative binds an authenticated leaf, nullifies it in the output root, and pays to a key-derived lock. Trade ran 49 pinned upstream host STF tests, then 24 CKB-testtool cases against a single-hart build, and committed one actual private-devnet deposit/checkpoint/owner-exit lifecycle. The first upstream binary passed CKB-testtool but failed on CKB 0.210.0 with an A-extension instruction; the successful lifecycle uses a disclosed dependency patch isolated to one-hart CKB-VM. The pool has no individual balance Cell, but requires one mutable anchor per pool/shard; direct exit emits a normal payout cell, so sub-floor exits require counterparty liquidity. A fresh child process reconstructed the owner proof using the committed checkpoint fetched through live local CKB RPC, without fixture/sequencer files as inputs. Next: test archival retrieval and complete history replay, then competing/final exits and operator/database loss.

## H2: Tiny principal funds its own output

Why: the user already contributes value. CKB occupied-capacity rule: ordinary 61-CKB output cannot be funded from 0.01 CKB alone. Else reuse an existing compatible cell, ACP after exact validation, or a sponsor. Without those, accumulate or credit off-chain and disclose weaker immediate L1 exit. Native ACP/tiny payout remains untested.

## H3: Channels are universal accounts

Fiber/Perun/Myelin amortize L1 transitions. What if the customer needs arbitrary derivatives? Payment routing does not define/collateralize continuing claims. Closing still needs state recovery and capacity. Source study only; no E2 channel execution.

## H4: Static cohort commitment avoids mutation

Fixed entry terms need no balance updates. Transfer still needs authenticated owner authority; one-time payout needs consumed state. Per-user exits restore per-user Cells; a shared consumed root restores contention. No static cohort contract executed. Preserve as a high-value next experiment, not a presumed solution or validation of quarantined E1 beneficiary logic.

## H5: Signed maker quotes create free liquidity

No new order Cell, but no reservation either. Spent inputs stale the quote; maker bears idle capital/adverse selection; fills need matching assets. Model is inherited; no new SLA.

## Finding

Four existing cells can support a complete bilateral swap with zero additional persistent cells when both users already hold compatible funded wallets/assets. Entrants, tiny standalone L1 payouts, partial-fill orders, continuing claims and independent vault exits remain separate.

## IF / ELSE / WHAT IF: pinned pooled-claim alternative

**Question:** Can pooled state provide a meaningful independent exit without one persistent Cell per user? **Assumption:** a root or README is insufficient; the contract must authenticate ownership, consume the claim and conserve payout. **Alternative:** reuse Liquid Cells' existing sparse-tree/anchor implementation rather than inventing a second vault. **Experiment:** pin commit `47492b51673c94635ab23de2c55477625e94ccbf`; run 49 default-feature host STF tests; run 24 CKB-testtool tests against a single-hart binary; then execute its fixture genesis deposit, proof-backed checkpoint, and 180-epoch owner exit on CKB 0.210 private devnet. **Observed:** the chain committed four transactions and rejected tampered DA, early exit and wrong payout. A fresh child process fetched the committed checkpoint transaction through live local CKB RPC, rebuilt the full-depth proof from its published DA, and matched the proof root to the live anchor. **Failure/debugging:** the first binary contained unsupported `lr.d`; a malformed witness signer lost the type witness; the following anchor draft encoded 128-bit totals in the wrong half. Each failure was retained and corrected before the valid run. A separate hypothesis that the fixture deposit was below occupied capacity was false: 10,000,000,000 shannons exceeds the 9,300,000,000 occupied floor. **Strongest counterexample:** the tested owner had 99.99899 CKB, above the 61-CKB payout floor; archival retrieval, RPC-outage/operator-loss recovery, complete history replay and competing/last exits remain untested. The successful build uses a single-hart `bytes 1.11.1` compatibility patch and is not an upstream fix. **Conclusion:** retain Liquid Cells as the strongest pool comparator and preserve the spot swap fallback; do not claim its upstream binary is node-compatible or that the product is commercially superior. **Next question:** can a fresh environment retrieve and replay full checkpoint history from archival RPC, then let two owners exit safely from the same anchor?

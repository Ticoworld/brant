# Research question tree

## H0: Every trade needs an order Cell

Why: on-chain state makes maker terms visible/reserved. What if false: sign a whole-body off-chain intent and keep assets in funded wallets. Experiment: a four-input/four-output xUDT/CKB swap committed using two existing wallets and two existing asset Cells. Counterexample: only a complete bilateral fill; no partial fills, OTX fragments or fill guarantee. Spent inputs make drafts stale. Next: equivalent CoBuild workload.

## H1: A Merkle root removes per-user capacity

Why: a root is smaller than N Cells. What if immutable: same leaf can claim twice. Mutate root on each exit: shared spend contention. Add per-user nullifier: per-user state returns. Shard: only separates cross-shard traffic. The upstream Liquid Cells alternative binds an authenticated leaf, nullifies it in the output root, and pays to a key-derived lock. Trade ran the pinned upstream host STF suite (49 tests) and 24 CKB-VM cases under an ISA-checked RISC-V build; the exact compiler deviation and logs are preserved. The pool has no individual balance Cell, but requires one mutable anchor per pool/shard; direct exit emits a normal payout cell, so sub-floor exits require counterparty liquidity. No Trade private-chain pool/exit was executed. Next: reproduce from checkpoint DA and a genuine epoch timeout on disposable private devnet, then test conflicting/final exits and recovery with the operator absent.

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

**Question:** Can pooled state provide a meaningful independent exit without one persistent Cell per user? **Assumption:** a root or README is insufficient; the contract must authenticate ownership, consume the claim and conserve payout. **Alternative:** reuse Liquid Cells' existing sparse-tree/anchor implementation rather than inventing a second vault. **Experiment:** pin commit `47492b51673c94635ab23de2c55477625e94ccbf`; run 49 default-feature host STF tests and 24 CKB-VM tests against unmodified upstream tests and contract, using the documented checksum-pinned Zig adapter. **Observed:** inclusion, nullification, owner-derived payout, epoch gate, capacity/accounting checks and withdrawal-output binding passed the selected tests. The wider ISA trial passed too, but ELF inspection found extra F/D attributes; a clean rebuild removed them and all 24 passed again. The first runner invocation omitted isolated `RUSTUP_HOME`, and a cached build initially obscured the ISA change; both were corrected and preserved. **Strongest counterexample:** sub-61-CKB direct payout is not unilateral L1 exit, and all exits consume one anchor; chain DA reconstruction and operator-loss recovery were not run on private devnet. **Conclusion:** reuse advances to independent integration testing; no new vault design is justified yet. **Next question:** do real epoch timing, archival DA reconstruction, transaction fees, and shared-anchor contention meet the Trade market's needs?

# Research question tree

## H0: Every trade needs an order Cell

Why: on-chain state makes maker terms visible/reserved. What if false: sign a whole-body off-chain intent and keep assets in funded wallets. Experiment: a four-input/four-output xUDT/CKB swap committed using two existing wallets and two existing asset Cells. Counterexample: only a complete bilateral fill; no partial fills, OTX fragments or fill guarantee. Spent inputs make drafts stale. Next: equivalent CoBuild workload.

## H1: A Merkle root removes per-user capacity

Why: a root is smaller than N Cells. What if immutable: same leaf can claim twice. Mutate root on each exit: shared spend contention. Add per-user nullifier: per-user state returns. Shard: only separates cross-shard traffic. Experiment: exact arithmetic for N=1,16,32,100,1000; no vault contract. Status DERIVED, not native proof. Next: compare one-time exits and DA against Liquid Cells' implemented force exit.

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

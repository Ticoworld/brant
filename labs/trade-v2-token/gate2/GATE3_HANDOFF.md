# Gate 3 Handoff

Gate 3 should add a fast coordinator around the existing Gate 2 transaction format without changing the authorization and custody rules as a throughput shortcut.

## Stable Gate 2 Interfaces

- TMS1 witnesses authenticate sorted owner updates against an old root and a new root. The current native batch operation supports at most 16 independently authorized owners in one custody transaction. The recovery verifier can replay the committed witness history and reconstruct current owner proofs.
- A market/custody transition consumes the current market inventory, market marker, custody cell, and custody marker outpoints and creates one successor for each lineage. The transaction remains contended on those shared outpoints even when it updates 16 owner leaves.
- Offline seller authorization binds the chain genesis, market, asset, custody script, seller, seller revision, quantity, minimum proceeds, payout lock, and order id. An order fill survives unrelated root changes; seller cancellation increments the seller's revision. The current message has `Expiry: none`.
- Independent recovery starts from the public initialization transaction and reads committed transaction witnesses from canonical full block history. It does not depend on the coordinator database or cached proofs.

## Gate 3 Required Experiments

1. Queue several authorized buyers and sellers that contend for the same market and custody singleton outpoints. Record arrival order, deterministic sequencing, rejected/replaced stale transactions, and the exact transaction selected for each step.
2. Support multiple buyer authorizations in one deterministic batch while showing each buyer's signature and funding input is independently checked by the native scripts. Preserve each order's price bounds and require reauthorization when the current curve quote exceeds its signed limit.
3. Simulate coordinator outage before signing, after signing, after submission, and after confirmation. Recover solely from canonical chain history and public signed intents; never treat a solver cache as authoritative state.
4. Run competing solvers and delayed/reordered orders. Measure fairness, confirmed throughput, queue latency, replacement fees, witness size, VM cycles, and sustainable maker economics. A 16-owner update is not evidence that shared-cell contention has been removed.
5. Make expiry policy explicit. Until a covenant-enforced not-after mechanism is proven, relay expiry only removes an order from relay availability; owners must use revision cancellation to invalidate an already signed order.
6. Revalidate orders and queued transitions after a reorganization. Wait for the configured confirmation policy before treating an operation as operationally final; the contract cannot prevent a consensus reorganization.

## Boundaries

- Do not add the unresolved 80% purchase-price protection to maker quotes. Gate 2 has a solvency counterexample showing the reversible curve alone cannot provide that individual floor.
- Do not claim queue throughput from VM cycles or batch size alone. Include the serialized shared-state transaction, confirmation interval, and conflicts between otherwise valid buyers.
- Keep recovery independent of the relay and make every accepted settlement reconstructible from committed witnesses.

## Starting Evidence

- 1,024-owner sell-down and same-lineage rebuy: `evidence/native-replay-1024-selldown-20261111b/`; 1,100 committed transactions, 1,096 custody transitions, 11 CKB aggregate fees. The 1,024 owner sells are sequential spends of shared market/custody singleton outpoints and do not demonstrate contention-free throughput.
- Combined canonical accounting replay and raw block RPC history: `recovery/evidence/scale-1024-selldown-20261111/`.
- Gate 2 native two-market and proof attacks: `security/evidence/native-smt-1794427785208/`.
- 1,024-owner native recovery: `evidence/native-1794410154147/recovery-acceptance.json`.
- Native SMT attacks and positive control: `security/evidence/native-smt-1794411243401/`.
- Offline order lifecycle: `orders/evidence/native-1794396855738/`.
- Current closure verdict and remaining Gate 2 blockers: `GATE2_RESULT.md`.

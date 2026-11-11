# Trade V2 Gate 2 handoff: scalable xUDT custody

**Status:** implementation-ready experimental design; not yet implemented or proven. Gate 2 follows a Gate 1 **PARTIAL** verdict and must not treat this handoff as security approval.

## Objective and boundary

Adapt the proven WO15 R6/R7 ownership and offline-intent mechanisms to Trade's genuine fixed-supply xUDT market while preserving the current market/custody singleton lineage, curve buy and sell, external withdrawal/redemption, new-owner enrollment, and full sell-down. Support substantially more than eight owners. Gate 3 owns hot-cell contention, competing solvers, relay resilience, and throughput economics. No UI, public deployment, or real funds are in scope.

The current 8-record custody format is a useful executable reference, not a scalable solution. A 32-byte root alone is insufficient: the contract must prove that every ownership transition preserves the relationship between all entitlements and the xUDT amount actually held by custody.

## What the existing R6/R7 source establishes

Inspect `labs/wo15-merkle-intent/r7/merkle_intent.c`, its R6 predecessor, tests, and replay code before reusing code. R7 is a fixed-index binary Merkle tree (capacity at most 1,024) with domain-separated leaf/node hashing. Leaves commit a vault id, u64 index, owner lock hash, principal, backing, and revision. Its singleton separately stores aggregate principal/backing/count. A transaction supplies old-leaf proofs against the input root, then applies changed leaves in sequence and checks output aggregates. It rejects duplicate indices in one update batch and uses widened arithmetic.

R7 is a financial-claim tree, not xUDT custody. Its siblings are hashes without authenticated subtree sums; its aggregate state is not a proof of the sum of every leaf. It does not enforce globally unique owners at distinct indexes, xUDT supply conservation, or the equality of leaf entitlements to native xUDT in a custody cell. Reuse the proven hashing, proof parsing, offline signing, and reconstruction patterns only after adapting and independently testing those missing invariants.

## Proposed state and conservation proof

Use a sparse Merkle map keyed by the 32-byte owner lock hash. The key itself is the owner identity, so one owner cannot be assigned multiple indexes. Domain-separate every hash by a fixed tag, tree version, market script hash, xUDT Type Script hash, custody script hash, and genesis identity. Store a singleton containing the root, total entitlement, version, and the existing market/custody lineage links.

Each leaf commits `(owner_hash, balance, revision, active)`; a zero-balance owner remains as an authenticated tombstone with a monotonically increasing revision. A deleted leaf must not reset revision or allow an old order to become valid. If bounded storage eventually requires tombstone compaction, it needs an explicit epoch/revocation scheme that makes all prior signatures unverifiable; simple deletion is forbidden.

Establish the invariant at genesis/initialization: canonical empty-tree root, total entitlement `0`, and actual custody xUDT amount `0`. For each transition:

1. Check input singleton root/total and lineage against the input market and custody cells. Check input xUDT Type Script identity and `input custody xUDT amount == input singleton total`.
2. Require changed owner keys to be unique and canonically ordered. Verify every old leaf against the input root (or a rigorously specified sequential intermediate root). Treat absent keys as canonical zero/revision-zero leaves only when first enrollment rules permit it.
3. Verify owner authorization and revision for each operation. Compute signed balance deltas with checked wide arithmetic; no negative leaf balance or total is permitted. Increase revision for every state-changing owner action, including a return to a prior balance.
4. Apply changes to the authenticated input root only. Reject a supplied “new root” that is not exactly the result of those updates.
5. Require `output total = input total + sum(deltas)` and independently require `output custody xUDT amount == output total`. Preserve the exact xUDT Type Script and market/custody singleton identity.

By induction, the authenticated root commits all unchanged leaves, the transition authenticates all changed leaves, and the singleton total changes by exactly the proven deltas. Starting from the checked empty state, `total == sum(all leaf balances)` remains invariant. Matching the total to actual input and output xUDT amounts then proves `sum(entitlements) == actual custody xUDT` at every valid transition. This is a proof strategy to implement and test, not an established result.

An authenticated sum tree is an alternative if native VM cost and proof size are acceptable: each internal node must commit both child hashes and checked child sums; every updated path must verify both; and the root sum must still equal the actual custody xUDT amount. Hash-only sibling paths plus an unauthenticated claimed aggregate are not sufficient. Gate 2 should prototype both approaches only as needed to choose using native evidence.

Operation deltas are fixed by the transaction type:

| Operation | Entitlement delta | Actual custody xUDT delta |
| --- | ---: | ---: |
| Curve buy / enrollment | `+q` for buyer | `+q` |
| Peer transfer | seller `-q`, buyer `+q`; total `0` | `0` |
| Curve sell-back | seller `-q` | `-q` |
| External withdrawal | owner `-q` | `-q` |

The market script must bind those deltas to the same curve quantity/price and reserve movement it validates today. No JavaScript-only assertion may substitute for the native xUDT and contract checks.

## Owner-authorized intents and replay protection

Keep offline orders independent of the current root/outpoint so a valid order survives unrelated owners' root changes. Sign a canonical message binding genesis, market, complete xUDT Type Script hash, custody, owner key, leaf revision, quantity, minimum payout, payout script, order id, optional buyer, and expiry. The transaction must prove the signed owner leaf against the current root and require its current revision to equal the signed revision. Any balance change, revocation, transfer, enrollment reset, or tombstone operation increments the relevant revision or epoch. Bind domain/version tags in both tree hashing and message signing.

Use separate schemas for owner-signed withdrawal/sale intent and relayer-submitted execution. The relay may transport proofs and choose transaction timing but must not choose a payout recipient or authorize a state transition. Expiry and cancellation need native tests; a website must not be required to reconstruct an owner proof or submit an owner-authorized withdrawal.

## Multi-leaf updates and witness reconstruction

First implement a canonical sorted-key multiproof, or a sequential-proof format that proves each update against the current intermediate root. Reject duplicate keys, ambiguous encodings, omitted leaves, reordered/noncanonical proof nodes, and arithmetic overflow. Tests must compare the on-chain root with a separate reference implementation and include disjoint and overlapping paths, adjacent keys, repeated owner keys, absent leaves, and mixed positive/negative deltas.

Define a versioned proof package containing the transaction, input/output singleton state, changed leaves, multiproof, relevant headers/transactions, and enough authenticated history to reconstruct the current root from initialization. Emit or archive these packages independently of the Trade website. A second implementation must reconstruct the root and entitlement totals from the package and compare them with chain data. Test recovery after relay loss, missing recent packages, and conflicting package sources. If an owner cannot reconstruct a proof, owner-controlled withdrawal is not established.

## Native implementation sequence and acceptance criteria

1. **Data model/reference oracle:** specify canonical leaf, node, empty leaf, tombstone, and proof encodings. Write independent update/reconstruction logic and adversarial vectors. Freeze format/version before contract integration.
2. **Native conservation cell:** implement empty initialization and one-owner enrollment/withdrawal against real xUDT. Prove owner authorization, root update, checked total, actual custody amount, fixed xUDT Type Script, and lineage on disposable CKB 0.210.0.
3. **Operations:** port curve buys, existing-market enrollment, peer movement, curve sell-back, and external withdrawal. Prove the delta table above and complete sell-down with the existing economic loop.
4. **Orders and revisions:** prove unrelated-root order survival, changed-owner stale rejection, revocation, expiry, replay rejection, cross-market/domain separation, payout binding, and offline owner reconstruction/submission.
5. **Scale and proof availability:** exercise batches of 1, 3, 8, 32, 128, and a justified larger target; measure serialized witness bytes, cycles, fee, occupied capacities, and proof-generation/reconstruction time. Verify total custody equality after every transition and after full sell-down/re-enrollment.
6. **Independent replay:** preserve raw native transactions and witnesses. A verifier independent of the transaction builder reconstructs all changed leaves and totals and checks real xUDT movements. Run CKB VM on newly compiled pinned binaries, plus historical Gate 1 verifiers.

Gate 2 cannot pass unless it demonstrates: substantially more than eight unique owners; no duplicate owner/index allocation; exact xUDT type and supply conservation; valid multi-leaf updates; entitlement total equal to actual custody on every committed transition; safe tombstone/revision behavior; independent proof reconstruction; and owner-authorized withdrawal without the website. Report proof size/cycle/fee costs. Gate 3 still owns contention and solver recovery.

## Explicit limitations and roadmap

- The current bounded curve remains reversible for its tested fixture; it does not provide an individual 80% purchase-price floor. Protection is **NOT IMPLEMENTED** unless a separately funded reserve and its solvency are independently proven.
- Gate 2 scales custody proofs; it does not prove low contention, a fault-tolerant relay, durable order delivery, solver recovery, real maker participation, demand, or profitable execution. Those stay in Gate 3/5.
- Gate 4 remains the minimal browser journey with owner-controlled testnet wallets, only after native safety/scaling gates. No UI or public deployment is authorized by this handoff.
- This architecture is a proposal derived from inspected R7 mechanics. Native feasibility and security are unimplemented until the acceptance evidence above exists.

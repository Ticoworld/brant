# Fixed-depth indexed tree prototype

This isolated prototype evaluates a depth-10 (1,024 slots) and depth-12 (4,096 slots) account tree. Each leaf commits to slot, owner lock hash, balance, revision and active/tombstone status. A canonical multi-proof includes only sibling subtree hashes outside the updated frontier, in bottom-up/ascending-node order. Old and new roots are both independently reconstructed from the same proof, including overlapping paths.

## Duplicate-owner prevention

A fixed slot tree alone cannot prove that one owner has not been assigned another slot. This prototype therefore adds an owner-keyed Nervos sparse Merkle registry mapping each domain-separated owner key to exactly one slot. Every updated owner proves registry membership; every enrollment proves registry non-membership and updates the registry. Repeated owner keys are rejected, and the registry value is canonical (`slot + 1` in the first two little-endian bytes, remaining bytes zero). The regression `duplicate_owner_cannot_claim_two_slots` rejects the same identity assigned to slots 0 and 1. Tombstone retention must preserve the registry entry and revision; slot reuse is not allowed by this prototype.

This makes uniqueness authenticated, but it adds a second root, a second proof verification, owner/slot rows, and a sparse registry proof. Monotonic slot allocation is not treated as uniqueness evidence.

## Comparable witness sizing

`benchmarks/size-matrix.json` contains 48 deterministic workloads: depths 10 and 12, owner populations 1, 3, 8, 32, 128, 1,024, and 1, 3, 8, 16 changed leaves. Where updates exceed existing owners, remaining leaves are valid new-owner enrollments. It reports:

- `fixed_tree_witness_bytes`: fixed-tree header + per-leaf old/new data + compact fixed-tree multiproof.
- `owner_keyed_smt_witness_bytes`: one owner-keyed CSMT transition with 12-byte TMS1 header, 96-byte old/new rows and its compiled CSMT proof. This is the direct SMT-only comparator for the same generated owners and changes.
- `dual_tree_witness_bytes`: fixed-tree witness plus 96-byte owner-to-slot registry update rows and the registry CSMT proof.

Synthetic owner identities are generated deterministically. Both CSMT proofs are checked against old and new roots using the pinned Rust library; the fixed-depth old/new multiproof roots are reconstructed independently by the prototype. The bytes exclude transaction-level Molecule witness framing, signatures, market/order extras and other scripts, and are not a complete transaction size.

## Commands and current boundary

From the repository root:

```powershell
cargo test --locked --offline --manifest-path labs/trade-v2-token/gate2/fixed-tree/Cargo.toml
cargo run --locked --offline --manifest-path labs/trade-v2-token/gate2/fixed-tree/Cargo.toml -- bench
```

**No CKB-VM cycle, contract-size, capacity or fee result is claimed.** This prototype is a host-side proof construction and byte comparison, not an integrated market/custody script. A fair native measurement requires a complete CKB 0.210 transaction path that authenticates both roots, exact xUDT deltas, wallet authorization and the fixed-tree/registry transition. The current Gate2 native harness integrates the SMT owner tree; adapting its singleton payload, witness parser and transition verifier to a second root is required before `estimate_cycles` is comparable. Historical R7 cycles cover a different financial-claim script and are not used here.

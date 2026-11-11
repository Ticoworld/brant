# Fixed-depth comparison findings

## Result

The fixed-depth design is viable only as a two-tree design if it must enforce one slot per owner. The fixed slot tree authenticates owner state by index; the second Nervos CSMT authenticates owner-key → slot. A transaction must verify both old roots, compute both new roots, bind the registry slot to the exact old/new slot leaf, and update both roots atomically. An append-only `next_slot` counter by itself does not prove uniqueness.

For the same generated owner set and changed owner set, the 48-row off-chain matrix found the dual-tree witness larger than the owner-keyed SMT-only witness in all 48 cases. The fixed tree alone was smaller in 30 cases, but that representation has no authenticated owner uniqueness and is not an acceptable custody design. Depth 12 was strictly larger than depth 10 for all tested rows; one changed leaf adds 64 proof bytes (two extra siblings). These are bytes, not native cycle measurements.

Representative depth-10 rows:

| Owners before → after | Changed leaves | Fixed only witness | Owner-keyed SMT witness | Fixed + owner registry witness |
|---:|---:|---:|---:|---:|
| 8 → 8 | 1 | 404 B | 278 B | 670 B |
| 8 → 8 | 8 | 784 B | 813 B | 1,585 B |
| 8 → 16 | 16 | 1,296 B | 1,621 B | 2,905 B |
| 128 → 128 | 1 | 404 B | 443 B | 835 B |
| 128 → 128 | 8 | 1,680 B | 2,073 B | 3,741 B |
| 128 → 128 | 16 | 2,736 B | 3,737 B | 6,461 B |
| 1,024 → 1,024 | 1 | 404 B | 542 B | 934 B |
| 1,024 → 1,024 | 8 | 2,352 B | 3,166 B | 5,506 B |
| 1,024 → 1,024 | 16 | 4,176 B | 5,659 B | 9,823 B |

Each workload uses the same deterministic identities, slots, balances, revisions, update selection, and domain hash for all three sizes. When update count exceeds the old population, the remainder are new-owner enrollments. Owner selection is spread across the current slot set, not a favorable contiguous range. Full data is in `benchmarks/size-matrix.json`.

The direct sparse map wins in this comparison because it binds each position directly to the domain-separated owner key and needs one root. The fixed tree's shallower sibling path can save bytes in some multi-owner cases, but the second proof and row encoding cost more than those savings. This prototype therefore does not justify replacing the current owner-keyed SMT direction.

## Security boundary

The map prototype uses `H(TRADE-V2-OWNER-SLOT-REGISTRY-v1 || domain || owner-lock-hash) → slot+1`. `domain` stands for a canonical hash over genesis/network, market script hash, xUDT Type Script hash and custody-marker Type Script hash. Leaf and node hashes also include this domain. The benchmark uses a deterministic test-domain fixture and verifies that changing it changes fixed roots and registry roots.

Enrollment must prove old registry non-membership and an empty old slot, then bind the new registry value to the new slot leaf. An existing owner's old registry value must agree with the old slot leaf; the successor registry value must agree with the successor slot leaf. Relocating an owner would require a multiproof that clears the old slot and installs the same entitlement/revision at the new slot in one transaction. Tombstones must remain in the registry and preserve revision history; this prototype does not reuse a tombstoned slot.

The host regression rejects duplicate owner IDs assigned to two slots, duplicate or reordered slot updates, truncated proofs, out-of-range slots and cross-domain root reuse. Rust and the pinned CSMT library verify registry proofs; the fixed multiproof verifier reconstructs old and new roots. This is not an on-chain uniqueness proof and it does not prove contract enforcement of cross-tree bindings.

## Native measurement blocker

No fixed-depth CKB contract was compiled or executed, so no CKB-VM cycles, ELF size, occupied capacity, transaction fee or native proof acceptance is claimed. The root Gate2 harness verifies the one-root owner-keyed SMT path. To get a comparable native measurement, the fixed-tree prototype must be integrated into the singleton and custody transition, with two roots in state, two proof parsers/verifiers, cross-tree slot/owner checks, exact xUDT delta checks and committed transaction fixtures. A microbenchmark of only the Merkle hash loop would omit the mandatory registry proof and would not be a fair custody result. R7's financial-claim cycles are unrelated and are not reused.

## Reproduction

```powershell
cargo test --locked --offline --manifest-path labs/trade-v2-token/gate2/fixed-tree/Cargo.toml
cargo run --locked --offline --manifest-path labs/trade-v2-token/gate2/fixed-tree/Cargo.toml -- bench
```

The pinned sparse-merkle-tree dependency is the adjacent vendored v0.6.1 source. The prototype is isolated from the Gate2 market/custody C files and does not replace the existing implementation.

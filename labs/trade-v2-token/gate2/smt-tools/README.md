# Trade V2 SMT off-chain proof tool

This is an isolated Gate 2 reference/proof-generation utility. It uses the vendored Nervos `sparse-merkle-tree` 0.6.1 source at commit `ad555350c866b2265d87d2d7fbd146fbc918bfe5`. `Cargo.lock` pins the complete Rust dependency graph. This tool is **off-chain only**: it does not prove CKB-VM compatibility, contract enforcement, or entitlement conservation in a committed transaction.

## Deterministic interface

Run from this directory:

```sh
cargo run --locked -- proof input.json output.json
cargo run --locked -- proof - - < input.json
cargo run --locked -- bench benchmark.json
cargo run --locked -- proof examples/one-transition.json examples/one-transition.out.json
cargo test --locked
```

Input JSON uses lowercase 32-byte hashes, canonical decimal strings for balances/revisions, no unknown fields, and this shape:

```json
{
  "domain": {
    "genesis_hash": "0x<64 lowercase hex digits>",
    "market_script_hash": "0x<64 lowercase hex digits>",
    "xudt_type_script_hash": "0x<64 lowercase hex digits>",
    "custody_marker_type_hash": "0x<64 lowercase hex digits>"
  },
  "op": 2,
  "owners": [
    {"owner_lock_hash":"0x<64 lowercase hex digits>","balance":"5","revision":"0","active":true}
  ],
  "updates": [
    {"owner_lock_hash":"0x<64 lowercase hex digits>","balance":"4","revision":"1","active":true}
  ]
}
```

Initial market creation is the only absent-owner transition at revision `0` (`op: 0` starts from an empty tree and creates one leaf). First enrollment after initialization uses revision `1`; subsequent updates, including reactivation from a tombstone, advance the existing revision by exactly one. A live entry has positive balance; a tombstone has zero balance, `active:false`, and nonzero revision. A tombstone is represented by a nonzero committed leaf value; only a never-used owner maps to the SMT's zero value. Duplicate owner identities/update keys and derived-key collisions are errors. Updates and output rows use the tree crate's `H256` canonical ordering.

The key matches `gate2/smt_transition.h`: CKB-personalized Blake2b-256 of `TRADE-V2-XUDT-OWNER-KEY-v1 || market_script_hash || xudt_type_script_hash || genesis_hash || custody_marker_type_hash || owner_lock_hash`. The tree node hasher also uses CKB's `ckb-default-hash` Blake2b personalization. The 32-byte value matches the C header: balance as LE u64 in bytes 0–7, revision as LE u64 in 8–15, status byte 16 (`1` active, `2` tombstone), and zero padding through byte 31. All-zero value means non-membership only.

Input `op` is the native header operation code: init 0, buy 1, batch buy 2, transfer 3, curve sell 4, withdraw 5, deposit 6, cancel 7, order fill 8. `proof` output includes roots, checked u64 entitlement totals, sorted changed entries, compiled native SMT proof bytes, and verification of both old and successor leaf sets. The proof bytes follow `CompiledMerkleProof` and are generated once against the old tree, then verified with old/new values. Rust tree updates independently compute the successor root. With the crate's `smtc` feature enabled, the same old/new leaf sets, roots and proof bytes are also passed to Nervos's C `smt_verify` implementation compiled for the host. This is a host CSMT check, not CKB-VM execution.

`contract_witness.hex` is emitted in the exact envelope currently defined by `gate2/smt_transition.h`: `TMS1`, version, op, update count, reserved zero, LE u32 proof length, sorted `owner32|oldValue32|newValue32` entries, then compiled SMT proof. The off-chain tool does not prove the contract's operation-specific balance/capacity economics.

`bench` emits a deterministic 24-row matrix for owner counts 1, 3, 8, 32, 128, 1,024 and update counts 1, 3, 8, 16. `benchmarks/size-matrix.json` is the captured output. When updates exceed existing owners, rows include unique new-owner enrollments; output reports owners before and after. Owner lock hashes are deterministic synthetic fixtures for byte sizing only, not wallet scripts or CKB transactions. The matrix includes compiled proof and full contract-witness bytes, not timing or CKB-VM cycles.

## Limits

The CLI generator and Rust library are not independent implementations, although the compiled proof is checked by the vendored host C verifier as well. Unit tests compare generated roots with both full library-tree roots and CSMT proof verification, check deterministic serialization, and reject malformed revision/duplicate-owner requests. CKB-VM execution, xUDT transition commits, contract operation authorization, and independent recovery remain to be implemented and measured. Totals here are derived from input JSON; only a native transaction can establish equality to actual custody xUDT.

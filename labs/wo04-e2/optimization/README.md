# BLS profiling and authenticated missing-signer subtraction

This is an additional bounded E2A milestone. The original full-participation source, fixtures, binaries' recorded hashes and evidence remain unchanged. **This is not yet a persistent Ethereum light client or an authorized E1 payout publisher.** The partial verifier retains the earlier fixed, host-reference-authenticated committee context boundary; the new bootstrap certificate is an independently tested on-chain component, not a claim that rotation is solved.

## Executed results

| Genuine captured participation | Affine, separate Miller loops | Affine, simultaneous Miller loop | Witness bytes | Transaction bytes |
| --- | ---: | ---: | ---: | ---: |
| 512/512 | 68,086,633 | 62,530,288 | 1,561 | 1,911 |
| 511/512 | 70,669,448 | 65,113,103 | 1,995 | 2,345 |
| 510/512 | 73,159,556 | 67,603,211 | 2,429 | 2,779 |

All three simultaneous-pairing transactions were actually estimated, submitted and committed on separate fresh loopback CKB v0.210.0 devnets with the **unraised 70,000,000-cycle transaction-verification policy**. No extra input/type scripts were omitted from those node estimates. Output policy was `passthrough` for custom lab scripts; this preserves script verification, and is not a mainnet admission/economic claim. The smallest margin is 2,396,789 cycles, not proof that future trust-state scripts also fit.

Code cells for the optimized 512, 511 and 510 builds are respectively 131,744, 131,752 and 131,752 bytes. Under the exact untyped empty-args lock shape used in the lab, derived minimum code-cell capacities are 131,785 / 131,793 / 131,793 CKB. The 104-byte root-data output occupies 145 bytes, hence 145 CKB minimum capacity; actual node fixtures deliberately allocate much more from disposable genesis cells. Witness bytes are transaction bytes, not retained cell storage. Code deployment fees and full client-state capacity economics are not measured.

A separate capacity-boundary run (`src/capacity_node.cjs 510`) then committed the 510/512 predicate with a **145-CKB** root output and a **131,793-CKB** genesis verifier-code cell. Reducing the root output to **144 CKB** failed node verification with `InsufficientCellCapacity(Outputs[0])`. A separate change output conserved the disposable input capacity; this version was 2,868 transaction bytes. This tests the root storage boundary; no below-minimum code-cell deployment transaction was tested. Full data/error records are in evidence/capacity-510.json.

## Profiling and affine encoding

`contracts/partial.c` is new code; `../contracts/update.c` is untouched. Profiling uses `ckb_current_cycles()` around each stage and emits deltas at the end. Instrumented totals include measurement/debug overhead; production totals in the table use noninstrumented builds.

For the full-participation vector:

| Stage | Compressed input / separate loops | Affine input / separate loops | Affine / simultaneous loop |
| --- | ---: | ---: | ---: |
| Witness/context/committee commitment | 33,592 | 33,592 | 33,592 |
| SSZ finality/execution/signing domain | 628,354 | 628,354 | 628,354 |
| G1 parsing, curve/canonical checks, binding | 513,322 | 20,794 | 20,794 |
| Aggregate G1 subgroup validation | 2,282,642 | 2,282,642 | 2,282,642 |
| Empty missing-member path | 913 | 913 | 913 |
| G2 parsing, curve/canonical checks, binding | 1,049,023 | 44,181 | 44,181 |
| Signature G2 subgroup validation | 2,972,993 | 2,972,993 | 2,972,994 |
| Hash-to-G2 and affine conversion | 9,354,034 | 9,354,034 | 9,354,035 |
| Miller loop(s) | 32,301,373 | 32,301,373 | 26,877,673 |
| Final exponent/equality | 20,409,862 | 20,409,862 | 20,277,237 |
| Output-data binding | 10,133 | 10,133 | 10,133 |

The machine-readable per-vector records in evidence/profiles.json are authoritative for precise profiling deltas. Tiny differences between builds reflect code layout and instrumentation. The compressed benchmark deliberately carries the same dual-representation witness to isolate CPU cost, not a claim of minimal compressed witness size.

Supported `blst_p1_deserialize` / `blst_p2_deserialize` parse canonical uncompressed affine coordinates and perform curve/encoding checks. The program serializes back to the same uncompressed bytes and recompresses to the **exact authenticated compressed key**. The supplied signature's compressed and affine forms must likewise agree. Infinity is rejected. G1/G2 subgroup checks are separate and explicit: on-curve is never treated as subgroup membership. Affine witnesses saved about 1.5 million cycles at full participation, not tens of millions, and did not by themselves make both partial vectors fit.

The simultaneous Miller loop verifies `e(H(message), participant_pk) * e(signature, -G1) == 1`, followed by final exponentiation. Both input points are validated, hash-to-G2 is computed in the VM with the original POP ciphersuite, and the negative generator is a trusted library constant. No witness-supplied pairing target, pairing lines or precomputed Miller data is accepted. It is the same BLS predicate, with shared loop arithmetic. No 45-million-cycle result was achieved.

## Only missing members are processed

The new format starts with the original compact header/proof prefix and carries aggregate key, actual participation bits, compressed signature, canonical affine aggregate/signature, then zero, one or two missing-member records. Each record is:

`index:uint16LE || compressed_key:48 || affine_key:96 || SSZ_siblings:9*32`.

The SSZ leaf is the 48-byte public key's two-chunk root. The proof binds the leaf to exactly `512 + index` under the 512-key vector root. That vector root and the committee aggregate key are bound to the authenticated committee SSZ root. Each index must be in range, strictly increasing, and point to a zero bit. The number of records must equal the number of zero bits. Thus the records cover *exactly* the absent positions; duplicates, extra members, omitted members and wrong proof indices cannot change the signing set. Repeated public-key values at different legitimate committee indices remain legal; duplicate indices are rejected.

The aggregate key and each missing point are subgroup-validated, then the missing points are subtracted. The result is therefore in G1 by closure; a redundant subgroup check on the result is unnecessary, but infinity is still rejected. The signature receives its own G2 subgroup check. **No 512-key scan, decompression loop, subgroup loop or full-key witness occurs on this path.** This bounded implementation supports at most two missing positions and rejects larger sets.

Fixtures come from the same pinned Helios historical mainnet sequence: update index 2 is 511/512 with missing index 42; update index 3 is 510/512 with missing indices 198 and 480. The existing host reference authenticates all preceding committee transitions and each genuine signature before generating these contexts. No synthetic positive signature was substituted. Later committee contexts are still host-authenticated, as in the original harness; they are **not yet anchored through on-chain rotation**.

## Negative tests

The debugger suite observes the expected outcomes for 78 runs: 18 positive/profile executions and 60 deliberately invalid cases. Rejected cases include modified keys/proofs, incorrect or duplicate indices, bitfield disagreement, invalid/noncanonical affine points, affine/compressed commitment mismatch, infinity, altered signatures, substituted headers/outcomes and substituted output data. An explicitly constructed canonical **on-curve but non-subgroup G2 point** is rejected at the subgroup check (16). A different genuine, subgroup-valid signature is rejected at the pairing equation (17), not merely at decompression.

Node tests also reject altered missing-member material and output substitution. Raw script exits, runner exits, cycle counts, profiles, sizes and node rejection errors are preserved under evidence/.

## Reusable, bootstrap-authenticated committee component

`contracts/committee.c` is an immutable constructor type script. It authenticates the bootstrap beacon header against the original fixed checkpoint, authenticates the current committee root at gindex 54, validates the exact canonical aggregate point and its subgroup, and creates a 264-byte certificate. The certificate binds the committee root, public-key vector root, compressed/affine aggregate, period, checkpoint and format version. Any spend or mutation is rejected by the type script even if its lock would permit spending.

`contracts/reuse.c` accepts only a dependency with the expected constructor code hash, `data2` hash type, empty args and certificate format. Because that exact point was subgroup-validated by the enforced immutable constructor and cannot change, repeated reads safely avoid repeating its subgroup test. Canonical deserialization and compressed binding remain checked. **A merely host-labeled cell would not establish this invariant.** Genesis must itself be trusted, as with any CKB application; the lab does not inject certificate cells into genesis.

The actual node constructor transaction, including its ordinary input lock, cost 2,533,936 cycles and 1,137 bytes. Two independent committed reuse transactions each cost 27,347 cycles and 283 bytes. Forged bootstrap, substituted certificate data, wrong constructor identity and attempted certificate consumption were rejected. The certificate remained live. Its occupied minimum capacity is 338 CKB under the tested lock/type shapes; the lab allocated 1,000 CKB.

This authenticates only the bootstrap-period committee. It does not authorize next committees, update versions, enforce global monotonic trust state, or publish a finalized execution root. It is not used to launder the later host-selected harness contexts into authenticated on-chain committees. Rotations must be authorized by the old committee's verified update and correct next-committee/finality relationships, and cache identity/version/chain policy must be connected to a persistent state cell. **No certificate transaction or reuse probe authorizes an E1 payout.**

## Staging and decision

The tested complete single-committee cryptographic predicate now fits in one transaction for all three participation levels. A two-transaction BLS split was therefore not required or implemented in this milestone. The constructor-plus-reuse tests above are committee caching, **not** staged finality verification or proof of two-transaction atomicity. Chained BLS admission, interrupted BLS execution and BLS recovery are unimplemented and unclaimed. If complete trust-state overhead exceeds remaining headroom, any staging design still needs an unforgeable restricted intermediate identity and exact binding to state version, committee, bitfield, message and update before it could publish a root.

A succinct proof may eventually help generalized participation, newer forks and trust-state economics; none was implemented or benchmarked here, and these results do not establish that it is better than the working direct predicate. The next executable priority remains persistent authenticated committee rotation, chain/fork/freshness policy, and E1 root-publisher identity, with the cached validated-point invariant carried through those transitions.

## Reproduce

Use the previously pinned dependencies in the E2 README (Zig 0.14.1, blst v0.3.15, py-ecc 8.0.0, CKB 0.210.0, debugger 1.1.0 and locked Node SDK). No new dependency or reference download is needed. On this x86_64 Linux cloud machine:

```sh
cd labs/wo04-e2/optimization
bash src/reproduce.sh
```

The script checks the preserved fixture manifest, builds a host-only blst serialization helper, revalidates the captured chain, builds separate RISC-V variants, runs valid/invalid vectors, launches and stops fresh loopback-only devnets, then summarizes results. Local RPC/P2P ports 19224/19225 must be available. Cloud sandbox process/network permission may be needed for node startup. To retain the committed milestone's evidence exactly, reproduce in a disposable full repository copy with the same ignored dependencies. The original E2 fallback is neither rebuilt nor overwritten by this script.

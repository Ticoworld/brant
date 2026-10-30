# WO04-E2A progress — 2026-10-30

**VERIFIED: executable historical mainnet Capella reference verification and a CKB-VM single-committee finality predicate. UNIMPLEMENTED: complete on-chain trust-state lifecycle.**

Branch: `wo04-e2a-finality`, based on `ce7f27ec0d6657645e3198b0ea6a5831171003d0`. No WO01–E1 source, reports or evidence were modified. No public deployments, public-chain transactions, real assets or production keys were used.

## Actual implementation

`labs/wo04-e2/src/reference.py` validates the following linked predicate on actual captured mainnet fixture data:

1. The bootstrap beacon header's SSZ root equals the fixed checkpoint independently specified in the pinned upstream Helios test, and its execution payload is included in its body.
2. The current sync committee is included at generalized index 54 in that header's state root.
3. Each update uses the authenticated current or next committee for its signature period, with slot ordering, strict supermajority and relevance/replay checks. Updates outside Capella or beyond the next committee period fail closed.
4. The next committee is authenticated at gindex 55; when finalized state crosses a period, the store rotates to the previously authenticated committee. Mutations are applied only after successful verification.
5. Sync-committee BLS signatures use `DOMAIN_SYNC_COMMITTEE`, Ethereum mainnet genesis validators root, Capella fork version and the attested beacon header signing root. The fork is checked at signature_slot - 1.
6. The finalized beacon header is authenticated at gindex 105 under the signed attested header's state root. The Capella execution payload header is authenticated at gindex 25 under the finalized header's body root. Its state_root is the resulting execution root.

The pinned captures are Helios commit `2af9b41887e069144ee56cd710f3ddca195473f8`, not invented fixture signatures. Official consensus specifications v1.5.0 are pinned at `b5c3b619887c7850a8c1d3540b471092be73ad84`. Details, licenses, checkpoint source and SHA256 integrity records are under E2 fixtures/references.

**Trust assumption:** historical checkpoint `5afc212a7924789b2bc86acad3ab3a6ffb1f6e97253ea50bee7f4f51422c9275` is trusted. It is not independently refreshed for current weak subjectivity, and source provenance alone does not prove canonicality against a long-range attack today. Bootstrap trust is explicit and fixed; we do not supply an arbitrary new payout root for every update.

## Executed reference results

- Seven valid updates (six committee updates plus finality update) passed from the fixed bootstrap. Authenticated final beacon slot: **7109344**. Execution state root: `0x226f5ff47ab3725b5a4a3afc74b1e79e4aa3a29704561eccce590e58900baec3`.
- `python -m unittest discover -s tests -v`: eight test methods passed, including eleven deliberately invalid mutations inside the invalid-update test. Wrong checkpoint, altered bootstrap committee, signature, low participation, finality branch/depth, execution state root/branch, next committee, period jump, unsupported fork, slot ordering, malformed bits, incorrect genesis domain, replay, unknown rotated committee and future signature were rejected as applicable. Invalid updates were checked to leave trust state unchanged.
- This is a finalized-only subset, not complete consensus-spec conformance, a production audit or fresh live-chain synchronization. Nonfinalizing/optimistic updates, force-update heuristics, all subsequent forks and live time sourcing are deliberately unimplemented.

## Actual CKB-VM results

The C harness checks committee commitment, participation, signature-domain construction, BLS verification, finality proof, finalized execution-header inclusion and E1-format output binding. Its initial committee and time/previous-slot context are pinned from the *host-verified* chain; CKB does not yet authenticate bootstrap and rotation itself.

| Executed construction | Result / cycles |
| --- | --- |
| Default 32-bit portable blst, full committee | Exceeded 3.5-billion test cap; completed at **5,737,123,129** with an explicitly enlarged debugger-only cap |
| 64-bit portable limb arithmetic, selected keys | PASS, **1,531,997,991** |
| 64-bit limbs, committed aggregate minus absent keys, full per-key checks | PASS, **1,521,561,813** |
| Witness-loaded general path with E1 output binding | PASS, **1,521,605,981** |
| Compact all-512-participating path, duplicate subgroup checks retained | PASS, **74,958,474**, failed 70-million cap |
| Compact all-512 path, duplicated checks removed while core checks retained | PASS, **69,703,714**, including witness and output binding; passed 70-million cap |

The rv64 portability change uses native 64-bit limbs with unsigned 128-bit intermediates instead of the upstream fallback's 32-bit limbs. The full-participation construction authenticates the aggregate key via its committee SSZ branch and requires every bit. It never treats a signer-selected aggregate as trusted. blst's core routine calls both public-key and signature subgroup checks with flags enabled; eliminating duplicate calls preserves those checks.

General witness: **25,816 bytes**, transaction **26,166 bytes**, code cell **140,496 bytes** in the recorded build. Compact witness: **1,272 bytes**, transaction **1,622 bytes**; see fast-transaction-size.json for code-cell bytes in the final build. No code-deployment transaction fee/capacity benchmark is claimed.

The noncompact instrumented VM run measured an empirical **50,672-byte stack write watermark**, including startup/main frame. This is sentinel-based write-watermark instrumentation, not exact resident-memory accounting; instrumentation prewrites a 512-KiB stack area. ELF segment sizes are recorded separately in binary-metrics.json. Successful debugger/node runs respect the VM's configured memory limit; exact peak total resident VM memory was not measured. The compact implementation has not been given a separate memory-watermark result.

Debugger tests rejected altered committee commitment, signature, finalized state root, participation bits and substituted E1 output data for both witness encodings. Raw runner exit and script exit are recorded separately. The full-participation path deliberately rejects a missing signer rather than silently claiming the aggregate still represents the selected set.

## Isolated CKB node acceptance

`node src/devnet.cjs` initialized its own loopback-only devnet using verified CKB v0.210.0, with disposable genesis cells and the actual compiled compact verifier. `estimate_cycles` returned 69,703,714. The 1,622-byte transaction was accepted with the unraised **70,000,000** tx-verification policy and committed in block 4:

`0x13626a4561317def9b7fbff49abdfc91590ef9c5e64108571878cfb94ee35198`

`send_transaction` used the `passthrough` output-policy mode for the custom lab lock; script verification was retained. The fresh dev spec has its own permissive development block limits and no public-chain economic constraints. This is actual local admission/commitment, not mainnet acceptance. A first attempt could estimate/submit but not mine because the custom block assembler was disabled; the supported `--ba-advanced` option corrected that. The script stops its own node after the run.

Only **296,286 cycles** of the 70-million script budget remain in this fixture. Additional trust-state logic, input/output scripts, other forks or different witnesses may exceed practical admission constraints. General partial-participation verification is still far above this policy.

## E1 boundary and remaining blocker

The exact E1 interface is `boot+32` in the 104-byte bootstrap cell consumed by `prove()` in checkpoint.c and settlement.c. E2 produces and CKB-checks that same data layout, with an explicit mainnet domain and the authenticated historical execution root. The saved E1 Ganache account/storage proofs cannot be reused under that root. No Ganache root was relabeled as Ethereum PoS finalized, and no E1 principal payout has been demonstrated against an E2-authenticated publishing cell.

**The remaining implementation obstacle is the CKB-enforced trust-state lifecycle:** validate bootstrap from a justified checkpoint, authenticate current/next committees in persistent state, rotate them atomically, prevent state replay/rollback/substitution, enforce fork schedule/chain/time policy and authorize the resulting immutable root cell by a type identity that E1 can require. The current VM context is a fixed host-authenticated committee, not that lifecycle. Historical Capella success also does not implement Deneb/Electra or a current weak-subjectivity acquisition policy.

The next bounded engineering step is to implement and adversarially test that state-cell transition around the working signature/root predicate, with measured overhead and a correct later-fork path. Partial participation needs a separately tested authenticated aggregate-minus-missing-members construction or another equivalent full predicate before claiming general affordability. No succinct proof or committee cache design is claimed as executed.

## Reproduction and preservation

Commands and pinned dependencies: `labs/wo04-e2/README.md`. Captured/derived fixtures, output logs, size/cycle metrics and devnet admission are committed under that directory. Builds and live node data remain separate from historical evidence. `MIGRATION_SHA256SUMS.txt` is unchanged and remains usable for all 200 imported records.

No automatic merge into main is authorized or performed. Branch push and draft-PR creation results are reported by the task's final response.

## Publication result

Implementation checkpoint `72caab9` was pushed successfully to `origin/wo04-e2a-finality`. Draft pull-request creation was attempted with `gh pr create --draft --base main --head wo04-e2a-finality` and failed before PR creation with the exact error:

```text
Post "https://api.github.com/graphql": Forbidden
```

This affects review publication, not the executed engineering checks. The draft description is preserved in `labs/wo04-e2/PR_DESCRIPTION.md`; no PR number or URL is claimed. GitHub's branch review entry is https://github.com/Ticoworld/trade/pull/new/wo04-e2a-finality. No merge was attempted. A bounded credential-pattern scan of new E2 material found no unexpected credential signatures.

## Subsequent milestone: BLS profiling and real missing-signer subtraction

Implementation checkpoint: `377f5ac` on the same E2 branch. The original 69,703,714-cycle fallback and all earlier E2 evidence remain byte-identical; the new work lives entirely in `labs/wo04-e2/optimization/`. Its README, source, pinned/derived fixtures and evidence contain the full stage profiles and reproduction commands. The complete reproduction script was executed successfully, including fresh reference checks, debugger tests and all isolated-node tests.

### 1. Performance optimizations actually demonstrated

Canonical affine witnesses parsed with supported blst deserializers saved approximately 1.5 million cycles at full participation. Exact round-trip affine encoding and recompression to the authenticated compressed key are enforced. Curve checks do not replace subgroup checks. Combining the two pairing terms with `blst_miller_loop_n`, followed by final exponentiation/equality, saved a further approximately 5.56 million cycles relative to separate loops. No witness-supplied precomputed pairing data is accepted. No 45-million-cycle result was achieved.

The decomposed compressed benchmark is an equivalent explicit-call implementation (69,582,200 cycles), not an instrumentation rewrite of the preserved 69,703,714-cycle fallback core call. Its costs include G1 parsing/curve/canonical checks 513,322; G2 parsing/curve/canonical checks 1,049,023; G1 subgroup 2,282,642; G2 subgroup 2,972,993; hash-to-G2 9,354,034; separate Miller loops 32,301,373; final exponent/equality 20,409,862; SSZ/finality/domain 628,354; output binding 10,133. Profiling overhead is excluded from the production totals below. Exact per-vector profiles are retained in optimization/evidence/profiles.json.

### 2. Genuine partial participation passed

| Real captured update | Missing indices | Production cycles | Witness bytes | Transaction bytes | Local node result |
| --- | --- | ---: | ---: | ---: | --- |
| 512/512 finality | none | 62,530,288 | 1,561 | 1,911 | accepted and committed |
| 511/512 update index 2 | 42 | 65,113,103 | 1,995 | 2,345 | accepted and committed |
| 510/512 update index 3 | 198, 480 | 67,603,211 | 2,429 | 2,779 | accepted and committed |

These are the original mainnet Capella captures, reference-verified from the pinned bootstrap and preceding updates. Missing keys are authenticated at their exact SSZ vector indices and must cover exactly the zero bits. Only those missing points are parsed/subgroup-checked/subtracted; there is no full-key scan. The aggregate and each missing point are validated in G1, so subtraction stays in G1 by group closure. The signature is separately validated in G2. At most two missing positions are supported by this bounded implementation.

The debugger suite recorded 78 expected outcomes: 18 valid/profile executions and 60 negative executions. Modified keys/proofs, incorrect/duplicate indices, bitfield disagreement, noncanonical/invalid points, inconsistent affine/compressed encodings, infinity, altered signatures and substituted outcomes/output data were rejected. A canonical on-curve point outside G2 was rejected specifically at the subgroup check. A different genuine, subgroup-valid signature was rejected at the pairing equation. Raw results are in optimization/evidence/results.json.

### 3. Single-transaction feasibility and staging

All three optimized predicates were estimated, submitted and committed on fresh loopback-only CKB v0.210.0 devnets at the unraised 70,000,000-cycle policy, including every script in each tested transaction. Custom output policy was `passthrough`, with script verification retained. Node negative estimates also rejected tampered missing-member proofs/material and output substitution. Smallest remaining headroom is **2,396,789 cycles** for 510/512. This is actual lab admission, not a claim of public-chain acceptance or of room for all future trust-state scripts.

A BLS two-transaction split was not needed for these tested predicates and was not implemented. Chained/interrupted/recovered **staged BLS verification is untested and unclaimed**. The committee certificate below is not a staged finality proof and cannot publish a finalized outcome. If complete client-state overhead exceeds the remaining budget, restricted intermediate-cell identity and binding to the exact trust version, committee, message, bitfield and update remain mandatory before attempting staging.

Under the tested untyped empty-args code-cell shape, derived minimum code capacities are 131,785 CKB (512) and 131,793 CKB (511/510), and the 104-byte data output occupies 145 CKB. These are occupied-byte capacity calculations; code deployment fees and complete-client economic viability were not benchmarked. Binary hashes/sizes and exact transaction sizes are recorded separately.

### 4. Security guarantees and reusable authentication actually implemented

The optimized harness retains the prior host-reference-authenticated committee context boundary. Its BLS signature, committee membership/bitfield, finality/execution-header and output-binding predicates execute in CKB-VM. The context is not yet a CKB-enforced mutable light-client state. No Ganache root has been relabeled as Ethereum finalized, and no principal payout has been demonstrated against a complete E2 publisher.

An additional immutable **bootstrap committee certificate** now authenticates its header against the fixed historical checkpoint and its current committee against the header's state root, validates the exact aggregate point including subgroup membership, and binds committee root, key-vector root, compressed/affine aggregate, period, checkpoint and version in a typed cell. Every creation executes that proof. Its type script forbids any subsequent consumption/mutation. A read-only consumer checks the certificate constructor's exact code hash/hash type/args and can safely reuse the subgroup-validated point without repeating that subgroup test; canonical parsing and compressed binding remain checked. A host-named cell alone does not establish this invariant.

Actual node measurements, including all scripts:

- Authenticated constructor: **2,533,936 cycles**, 1,137 transaction bytes.
- Two independently committed reuse transactions: **27,347 cycles**, 283 bytes each.
- Forged bootstrap, substituted certificate, wrong constructor identity, and attempted consumption/mutation failed node script verification. The certificate remained live.
- Zero finalized execution roots were published by the constructor or reuse probes. The 264-byte certificate has a derived minimum capacity of 338 CKB under the tested shapes; the disposable lab allocated 1,000 CKB.

### 5. Remaining complete-finality and rotation gap

The certificate authenticates only the bootstrap-period committee. It does **not** authorize later committees, and it is not used to launder the later harness contexts into on-chain authenticated state. Persistent trust-version ownership, atomic committee rotation, old-committee authorization of next-committee proofs, monotonic finality/replay/rollback policy, current weak-subjectivity acquisition, later forks, live time policy and E1 publisher type identity remain incomplete. The original historical checkpoint's weak-subjectivity limitation remains explicit. These performance results do not complete Ethereum finality authentication for a live CKB payout system.

### 6. Direct verification versus succinct proofs

Direct, authenticated missing-signer verification is now demonstrated below the tested policy for 512/511/510 participation, so a succinct proof is not established as a better path by these results. No succinct prover or verifier was implemented. Complete state transitions, broader participation and newer forks may change the economic decision and must be measured. The next executable priority is connecting authenticated reusable committee state and correct rotation to this working predicate, while retaining the proven checks and measuring added overhead.

The existing draft PR #2 is the user-designated review target. GitHub API metadata access still returns `Post "https://api.github.com/graphql": Forbidden`; this did not block implementation or Git branch publication. No merge is authorized or attempted.

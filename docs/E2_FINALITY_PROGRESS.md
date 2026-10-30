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

A subsequent capacity-boundary test committed the 510/512 predicate with a 145-CKB root output and a 131,793-CKB genesis verifier-code cell. A 144-CKB root output failed node verification with `InsufficientCellCapacity(Outputs[0])`. With its additional change output this test transaction was 2,868 bytes; the original single-output size measurements above remain preserved. Details: optimization/evidence/capacity-510.json. This is a tested root storage boundary, not a measured code-deployment fee or a below-minimum code-cell rejection test.

## WO04-E2B — complete bounded on-chain trust-state chain

**VERIFIED:** the actual seven historical Capella updates advanced a CKB-enforced, persistent light-client state through five committee-period rotations. This replaces host-selected committee context for this bounded chain. **NOT CLAIMED:** live current-fork Ethereum synchronization, a fresh weak-subjectivity anchor, arbitrary participation, or genuine E1 principal settlement.

New implementation: `labs/wo04-e2/rotation/`. The 69,703,714-cycle fallback, E2A optimizations and historical labs/evidence remain unchanged. Detailed source/layout/security/reproduction documentation is in the new directory's README. Existing E2B checkpoints and diagnostic attempts are preserved; final measurements use the shared-program implementation.

### 1. Actual seven-update chain

The sequence is exactly **511, 512, 511, 510, 512, 512, 512**. No invented lower participation was used. Every row below is an actual CKB transaction accepted and committed with the unraised **70,000,000-cycle** policy, including every input lock/type and authorized-root type script in that transaction.

| Index | Participation | State version | Finalized beacon slot | Period | Cycles | Transaction bytes |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 511 | 1 | 7069376 | 862 | 63,177,960 | 3,614 |
| 1 | 512 | 2 | 7070047 | 863 | 60,792,733 | 3,530 |
| 2 | 511 | 3 | 7078240 | 864 | 63,372,308 | 3,964 |
| 3 | 510 | 4 | 7089280 | 865 | 65,863,876 | 4,398 |
| 4 | 512 | 5 | 7094272 | 866 | 60,792,733 | 3,530 |
| 5 | 512 | 6 | 7104096 | 867 | 60,792,733 | 3,530 |
| 6 | 512 | 7 | 7109344 | 867 | 60,719,806 | 3,530 |

Update 0 learns the authenticated next committee and retains the newer bootstrap finality. It cannot publish its older finalized outcome. Updates 1–6 each publish a new authorized root. Final execution root: `0x226f5ff47ab3725b5a4a3afc74b1e79e4aa3a29704561eccce590e58900baec3`. The smallest measured headroom is **4,136,124 cycles**.

The driver proposes transactions but does not supply an authoritative replacement committee. Each signing certificate must match the actual input state's authorized current/next root, period and lineage. Each new next commitment is checked at the correct SSZ branch under the BLS-signed attested header. Both attested and finalized execution-header branches are checked. All successor state bytes are computed and checked by the CKB script, not accepted from a host context file.

### 2. Identity, continuity and replay

A custom type script enforces the canonical Type-ID construction using the serialized **44-byte first CellInput** and **8-byte little-endian global output index**, with CKB-personalized BLAKE2b. The Type-ID helper is supplemented by custom rules: exactly one continuation, unchanged identity, no deletion, preserved state capacity, fixed genesis/checkpoint/fork policy, version +1, monotonic finalized data and authenticated committee changes. The summary independently reconstructs the Type-ID nonce and full Molecule script hash from actual transaction bytes.

The 280-byte state binds genesis validators root, bootstrap root, version, finalized slot/beacon root, execution root/block number/hash, committee period, current/next commitments, last signature slot and fork policy. Applications pin the full state script identity. Independent valid registries are allowed but cannot become authoritative for another identity; a second constructor/duplicate continuation for the same identity fails.

`signature_slot` is not itself BLS-signed. Besides strict last-slot ordering, this finalized-only mode rejects retimed replays unless finality genuinely advances or a previously unknown next committee is learned. CKB absolute timestamp `since` binds signature time to the input, and native maturity validation provides the upper-time bound. This is not a current-head/maximum-age policy.

### 3. Safe separate committee certification

Transaction A verifies the real BLS/finality predicate and authenticates the next committee SSZ commitment. Transaction B reads that commitment from a live state dependency, hashes the complete 512-key data into the exact commitment, validates the aggregate point and produces an immutable certificate bound to lineage, state program, origin version, period and root. It cannot certify an arbitrary hash from a caller-named registry.

State/certificate/root roles use a single **148,016-byte immutable program**, with disjoint canonical argument lengths and same-program checks, avoiding circular code-hash constants. Actual attacker-created always-success registries with forged state data were tested and could neither mint certificates nor publish roots. This class binding is stronger than merely trusting a state-shaped data buffer.

Bootstrap state creation cost **530,165 cycles / 1,649 bytes**. Initial certification cost **17,424,353 cycles / 25,590 bytes**; subsequent certificates cost **17,424,361 cycles / 25,590 bytes**. A and B were measured and committed separately. No claim is made that summing their work into one transaction meets policy.

The certificate validates the aggregate subgroup and full committee commitment; it does not claim to subgroup-check every member. Every missing member is still explicitly subgroup-checked during updates. Reusing the exact immutable, previously validated aggregate is sound. The same period-867 certificate was actually reused by updates 5 and 6.

Failed/abandoned certification cannot authorize the next period. The test stops CKB after committed update 0, restarts the same database, reloads version 1 and its next commitment from persisted cells, rejects uncertified advancement, then certifies period 863 and completes the chain. Wrong/stale certification and mutation of certificates fail. This is not an incomplete two-stage BLS proof: A already authenticates its own finalized outcome; B only prepares a committee for later updates.

### 4. Authorized root publisher and E1 boundary

Every finality advance requires its correctly bound immutable root output in the same transaction. Valid proof plus withheld root fails. The root constructor independently requires the actual state input/output of the expected program/lineage, version +1 and advanced finality. Failed updates produce no root. Constructor-only publication, caller-selected registries, genuine foreign registries, stale roots/state and record mutation were rejected.

Root arguments bind lineage, program, source state version and finalized beacon root. Data has E1's exact 104-byte layout: `SHA256(genesis_validators_root || state_script_hash)[32] || execution_state_root[32] || execution_block_number_LE[8] || execution_block_hash[32]`. The laboratory reader checks the typed authority/current state before calling the unchanged E1 MPT implementation against bytes 32–63. Its positive authority probe cost **27,609 cycles / 321 bytes**. The saved Ganache account/storage proof failed against this authenticated Ethereum root (MPT error 30).

This is **not** a demonstrated E1 principal payout. A real integration must bind the intended registry/root identity and trade domain in the reservation/settlement flow, and supply Outcome/account/storage proofs from the same authenticated execution history. Existing E1 code/evidence was not rewritten. The diagnostic reader's metadata-only mode is not a principal settlement rule.

### 5. Evidence, capacity and rejection results

The final/reproduction runs each contain **23 committed transactions and 104 real node rejections**: the primary chain, an independently valid registry, a malicious-registry control and authorization probes. Rejections were checked to be native script/context errors, not network failures. Tests include exact Type-ID nonce/index, competing state, state burn/deletion, exact and retimed replay, wrong period, time binding, rollback, bad next proof, absent/wrong/stale/forged certificates, failed-update recovery, class substitution, immutable record mutation, unsupported fork, root withholding and unauthorized publication.

Actual allocated capacity: **1,000 CKB per state/certificate/root cell**. Derived occupied minima for the tested shapes: **386 CKB state, 482 certificate, 282 root**, and **148,057 CKB shared program**. Primary retained protocol data cells total 14,000 allocated CKB (one state, seven certificates, six roots), excluding code/test controls. Fee was 1,000,000 shannons per transaction. Real code deployment fees and economic viability were not measured; immutable records have no reclamation policy.

The code was supplied through genesis, but no protected state, certificate or root was injected. Nodes were loopback-only isolated chains with dummy mining and custom output policy `passthrough`; script verification and the 70-million policy remained enforced. This is not public-network admission or CKB reorg/finality evidence.

Actual serialized transactions, code hashes, committed block/status results and rejection errors: `rotation/evidence/chain-recovery.json` and `chain-verified-reproduction.json`. Compact audited results: `summary-recovery.json` / `summary-verified-reproduction.json`. Full reproduction exited 0. Initial diagnostic attempts (insufficient pool/proposal wait, then an absence test mistakenly placed after certification) remain preserved and are not classified as final verification passes.

### 6. Fork-correct reference test and limits

Official specs/configuration are pinned at v1.6.1 (`5fa6edcca8ab4cf548653e6680b17b9d3e04d225`), and official Electra static/proof fixtures at consensus-spec-tests v1.5.0 (`194a91fd9e6f97118156421aac4c80e6e47a9a7f`). Executed reference tests verify mainnet fork versions/epochs, signature_slot - 1 boundaries, Capella/Deneb indices **54/55/105/25**, Electra/Fulu **86/87/169/25**, and their branch depths.

A 17-field Electra execution-header/LightClientHeader SSZ vector reproduced its independently supplied official hash-tree root; the 15-field Capella interpretation and modified blob gas failed. Official Electra current/next/finality proofs derived a consistent state root and rejected legacy depths/indices. This is structural/config/reference verification, **not** a later-fork BLS-finality run; the random SSZ object is not claimed as canonical chain evidence. Runtime Deneb and later updates fail closed.

Wider participation (more than two missing members), newer-fork runtime headers/branches/domains/rules, additional valid nonfinalizing/timeout update classes and live syncing remain unimplemented. They require executable signed vectors and new measurements, not index changes alone. The conservative root reader accepts only the current state version; general historical-root freshness/retention policy remains future work.

### 7. Remaining live-deployment requirements

The on-chain rotation in this bounded chain is independent of host-selected committees, but begins at the explicit **historical trusted checkpoint**. It was not independently acquired as a fresh weak-subjectivity anchor. A live deployment still needs an independently justified recent checkpoint for the correct active fork, complete modern-fork synchronization, maximum-age/liveness policy, CKB confirmation/reorg handling, storage lifecycle/fees, review/audit and genuine E1 proof/payout integration. Application scripts do not prevent canonical CKB chain reorgs.

Reproduction: `cd labs/wo04-e2/rotation && bash src/reproduce.sh`. Pinned existing dependencies are reused; no live Ethereum endpoint or new package is required. The script uses a new evidence label, preserves earlier milestones, verifies fixture/reference hashes, regenerates and checks the real sequence, compiles, executes the chain with restart recovery, runs fork references and audits actual ancestry/Type-ID bytes. Work remains on the existing E2/PR #2 branch; no merge is authorized or performed.

### Final E2B liveness hardening and latest measurements

The preceding E2B table is preserved as the pre-lock-hardening checkpoint. The **current implementation** additionally fixes the state lock to an empty-argument permissionless role of the same immutable program. A valid updater cannot switch it to a frozen/private lock. The type still enforces all transition rules and capacity conservation. The permissionless role was also created as an attacker-controlled state-shaped type and could not mint certificates or roots; role shape is checked, not just program hash.

Latest actual node result (`rotation/evidence/chain-permissionless.json`): **24 committed transactions, 113 expected script/context rejections**, including seven lock-replacement attacks and two permissionless-role impersonations. The seven genuine primary updates remain `511,512,511,510,512,512,512`, with final state version 7 / beacon slot 7109344 / the same authenticated execution root.

| Update index | Latest cycles, all scripts | Transaction bytes |
| ---: | ---: | ---: |
| 0 | 63,217,075 | 3,614 |
| 1 | 60,831,488 | 3,530 |
| 2 | 63,411,077 | 3,964 |
| 3 | 65,902,659 | 4,398 |
| 4 | 60,831,488 | 3,530 |
| 5 | 60,831,488 | 3,530 |
| 6 | 60,758,561 | 3,530 |

Bootstrap is now **531,319 cycles**; initial/subsequent certification **17,424,399 / 17,424,407 cycles**, respectively. Byte counts and the 27,609-cycle authority probe are unchanged. Worst-case headroom is **4,097,341 cycles**. Shared code size is **148,168 bytes**, with derived code-cell occupied capacity **148,209 CKB**; the state/certificate/root capacities above are unchanged. All state-lock, fee-lock, state-type and root-type scripts are included in these node measurements.

Restart recovery, failed/abandoned certification, genuine unrelated lineage rejection, arbitrary-registry rejection, immutable record protection, rollback, exact/retimed replay, required root publication and wrong-history E1 proof rejection all passed again after this change. Actual transactions, independently audited ancestry/Type-ID construction and capacities are in `summary-permissionless.json`; earlier working checkpoints and measurements remain preserved. Evidence-label guards prevent accidentally overwriting a recorded run.

The final full command workflow was rerun after permissionless-lock hardening with label `release-check` and exited 0. It reproduced all seven reference-verified fixtures, native transitions, restart recovery, 24 commits/113 rejections, and fork-reference results. Audited final results: `rotation/evidence/summary-release-check.json`; raw transactions: `chain-release-check.json`. The measured fee input uses a disposable always-success lock; production funding-lock costs are not included and require their own headroom check.

## WO04-E2C milestone: immutable historical-root settlement adapter

New work is isolated under `labs/wo04-e2/settlement/`; E2B commit
`8eae0f158095bfed327b7b6d3cbab5aa95aadefc` and all preceding lab evidence remain
unchanged. The E1 terminal account/storage proof and exact principal payout rules
now have an adapter that pins E2B's exact bundle code identity, full registry
lineage, source genesis/domain and trade-selected version/block bounds. The old
shared-checkpoint witness mode cannot bypass authentication.

VERIFIED on a fresh isolated CKB node: 26 committed transactions and 108 expected
script/context rejections (`evidence/chain-historical.json`). A diagnostic funded
at version 2 consumed that immutable authorized root after five further finality
advances to version 7, without depending on a spent/live state cell. A second
lineage, caller-created 104-byte cell and history below the funded minimum version
were rejected. Actual principal remained live after empty filled/refund proofs,
checkpoint-mode bypass and the old Ganache proof. This milestone alone is NOT a
positive trade payout. Historical authorization costs 20,990 cycles /357 bytes.

Private PoS infrastructure exploration is ongoing in this milestone. Image pulls
and real local Geth/Lighthouse execution are feasible; real signatures/finality
and same-history terminal storage proofs must still pass before claiming exchange
settlement. See the subsequent executed evidence rather than this checkpoint for
the final E2C result.

## WO04-E2C: actual private-PoS finalized principal settlement — VERIFIED

The bounded positive target is now executed. See
[`E2_SETTLEMENT_RESULT.md`](E2_SETTLEMENT_RESULT.md) for exact trust assumptions,
transactions, fees, capacity, latency, failure recovery and remaining limits.
The new isolated implementation is `labs/wo04-e2/settlement/`.

A real digest-pinned Geth/Lighthouse private PoS network finalized the unchanged
E1 controlled-token fill and unfilled Outcomes expiry. Extracted complete SSZ
state/body commitments matched actual consensus headers; real 512-participant
sync signatures and finality/execution branches passed both Python and native
CKB verification. Exact-block Geth account/storage proofs then paid **1,000
fixture CKB to the maker and 1,000 to the refund recipient** through actual E1
principal logic adapted to the exact typed publisher/registry/source identity.
No controller-selected payout root, mock signatures or arbitrary 104-byte root
was accepted. Bootstrap trust remains explicit and fixed.

Both used the version-1 immutable root after version 2 committed, and survived
real driver interruption/restart with the original funded cells. The execution
blocks 218/280 share a state-root value; their beacon finality, block hashes,
registry version and root-cell identities differ. This is not claimed as changing
application storage between publications. Historical-mainnet root authorization
separately passed across five later updates with different execution states.

Measured native fill/refund: 564,138 /624,993 cycles and 1,872 /2,021 bytes.
Finality/root transitions: 60,832,914 /60,831,584 cycles, each 3,530 bytes.
Successful live workflow: 15 native transactions, 22 native negatives, 7 EVM
receipts. Final complete offline reproduction: 16 native transactions (15 exact
captured plus one additional forged-root control), 26 native negatives, identical
captured transaction hashes/cycles; both principal outputs read independently.
38 raw beacon-state roots and 60 block bodies checked offline; invalid signature,
execution root, finality branch and chain domain rejected for both real updates.

The final reproduction command `E2C_RUN_NAME=offline-final bash
labs/wo04-e2/settlement/src/reproduce.sh` passed. All 570 pre-existing tracked lab
files from 8eae0f1 remain byte-identical. Historical reports/verdicts were preserved.
Private clients stopped; no public deployments, real funds or PR merge.

This demonstrates a controlled Capella proof-gated exchange mechanism. It does
not demonstrate mainnet payout, newer-fork production readiness, independently
fresh mainnet checkpoint acquisition, general participation, economically secure
validator decentralization or a profitable business. Those boundaries and the
remaining proof-availability, reorg, funding-lock/audit and capacity obligations
are explicit in the settlement report.

## WO04-E2D-P0: zero-user-Ethereum-transaction delivery and no-expiry refund — VERIFIED

New isolated lab: `labs/wo04-e2/zero-origin/`. Detailed results and exact costs:
[`E2_ZERO_ORIGIN_RESULT.md`](E2_ZERO_ORIGIN_RESULT.md). E2C remains the original
fallback; all 745 prior tracked lab files from `aa78dac9` remain byte-identical.

Two real user-secp-signed native orders executed on private PoS /isolated CKB.
The maker delivered 100 controlled-USDC units without a user Ethereum `open`,
then recovered the original 1,000 CKB. The unfilled order returned its original
1,000 CKB using actual storage non-inclusion and strictly post-deadline finalized
execution time, with no EVM transaction for that order, including no `expire`.
Customer Ethereum nonce stayed 0; user Ethereum transactions/gas were 0.

The immutable deterministic order binds funding identity, both chain identities,
registry, contract, maker/reimbursement address, token/amount, recipient and
deadline. Present account and exact code hash are required even for refund.
Errors, missing accounts and malformed/truncated proofs never become absence.
Independent py-trie comparison passed 3,602 native parser calls, including the
selected vectors' truncations/bit mutations and inline-node representation cases.

The unchanged 104-byte E2 publisher is paired with a 720-byte SSZ header/time
proof bound to its exact finalized beacon identity, execution root, block/hash
and branch. A later genuine header cannot retime an older root, even with equal
execution state roots. Actual time 1793383513 failed against deadline 1793383582;
time 1793383609 allowed refund. Equality was separately rejected natively.

Core native execution: 8 committed transactions /38 rejected cases. Final
independent reproduction passed 18 native transactions /50 rejected cases,
reproducing all 8 original hashes and cycle counts, plus missing-account,
wrong-code/chain/slot/funding, exact-deadline and forged-root controls. It checked
71 actual beacon states, 103 block bodies, and both real 512-participant BLS /
finality/execution updates, with invalid reference variants. Contract runtime
with constructor immutables independently matched the pinned compiler artifact.

Maker reimbursement: 1,038,250 cycles /2,503 bytes; empty-slot refund: 973,118 /
2,347. User funding: 1,637,091 and 1,645,292 cycles with standard secp locks.
Both root updates remain near 60.83 million, below unchanged 70-million policy.
Actual maker fill: 85,534 EVM gas. Customer delivery 2.538 seconds; maker
reimbursement 275.684 seconds; refund 372.787 seconds in the private 3-second-slot
run. Core EVM receipts including setup fall from E2C's 7 to 4; user opens and the
expiry actor are removed. Fixed test fees, capacity and exclusions are in report.

Pinned DLN and Across public source access succeeded; relevant source-level
lessons and licenses are saved in `DESIGN_LESSONS.md` /`references/`. EVM-side
CKB funding/confirmation authentication remains UNIMPLEMENTED: makers must check
live funded CKB independently; unit unfunded EVM fills are explicitly not swaps.
No reverse trading, staged >2-missing-signer implementation, public deployment,
real funds or PR merge. Private clients stopped after evidence capture.

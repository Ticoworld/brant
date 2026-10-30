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

# Gate 2 Security Closure Result

**Verdict: SECURITY CLOSURE PARTIAL**

This report adds evidence to the preserved Gate 2 record without rewriting it. The branch began at `00e36a318a23014b5fdf2fb9f4f01608ecee3917`, the verified remote Gate 2 head. The validated closure implementation `cd12260cc831ed2cf02633f72f490a887d3a39ab` is an ancestor of that head. A local checkpoint tag, `checkpoint/trade-engine-00e36a3`, preserves the baseline. No contract source was changed in this closure run.

## Verified Foundation

The prior Gate 2 implementation and evidence remain the authoritative source for fixed-supply xUDT, 1,024 authenticated positions, 16-owner batches, 1,096 custody transitions, the 1,100-transaction 1,024-owner sell-down/rebuy journey, full canonical cryptographic/accounting replay, fresh 1,024-owner chain-only recovery withdrawal, and 18 targeted native attacks. The latter included two independently initialized valid markets and cross-market order, custody, inventory, and token substitution attempts. Gate 1 cross-market evidence remains labeled Gate 1 and is not presented as Gate 2 execution.

The 1,024-owner recovery withdrawal is `0x161131587f2fcc84791e18d744e510f90b5d7276b31bdacb9a31bfd76d023da3`, committed in block `0x12f`; CKB-VM estimated 2,263,866 cycles. It delivered one genuine xUDT to the owner's standard lock. Independent replay reconstructed 71 transitions and reconciled owner entitlements with the actual custody amount of 1,030. This was a separate recovery process on the same host, not a separately provisioned physical environment.

## Reproducible Build

A clean rebuild from the committed `00e36a3` source completed in `C:\g2-build-baseline-00e36a3-recheck` using Zig 0.14.1, CKB 0.210.0 tooling, `ckb-system-scripts` `72eb92fca090700dcb398cd8cad8fbd8bad40355`, and secp256k1 `3ffde18a060aaf4df5b81e7d88355f1e99874650`. All six output hashes match the existing Gate 2 build manifest:

| Artifact | SHA-256 |
| --- | --- |
| `custody_smt` | `7db957901242d6c9243f585b393c55d42faad3c7ddd16f1672c1a19ad14d4601` |
| `market_smt` | `b33d7396778340c3d6e66c62897a1dbd1561b32848715106a94d8a077bb7cd1f` |
| `custody_marker` | `cca4552516f372d97377b4e27ebffe1655d4bdeea3535544f36da44ff15aba07` |
| `marker_candidate` | `5941ccbc5ebd47e59811c4c8d8c8ae8d8f19431770fe771cf12b0e88d7bb5f4f` |
| `owner_lineage_candidate` | `661820b1d9ce5b384762e5e67389335c04bb2c34aac7bbcb7cb684e9ea13671b` |
| generated `codes.h` | `29e1ad6c2e231dde98f8e19ba1a4aafb02a41d11d06a838d0d91a2799f5cf01b` |

The source hashes are `market_smt.c` `fa0f0db4f1eb545468deacc2d81e0ebc9a56983e616e3e0727ba6591700b4cfa`, `custody_smt.c` `cac3356341e5197809a03909a7684e9971796fe1e7305c51572cfe5e07734eea`, and the owner-lineage candidate `a10fb1968054c3ad96b5ed4475fb008b27b51a60547394e1f980585c4891cb3e`. The genuine xUDT Type Script used by the fixture hashes to `e9b92e5783f692f6ee99ca20eeda5f3da282e0f4010eb4fbd3db4e3058239349`; its script hash is `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95`.

## New Native Attack Run

The completed run is `security/evidence/native-token-boundaries-1794450855229/`. It used a fresh private CKB 0.210.0 chain and the rebuilt Gate 2 ELFs. The committed issuance control created the maximum supply accepted by the market parameter, `4,294,967,295` units, in transaction `0x8ade039b9a31f76a432f4f662a6cbebb580391b0a9b069aa78080ae905c42ffb` (2 inputs, 3 outputs, `0x19c773` estimated cycles). Other committed controls included initial market purchase `0x734b911ecb7ebf9cbdda6721a948085350d18ab571e0fa639aec4093fc509f33`, genuine xUDT transfers, partial and remaining external withdrawals, and a valid external curve sale `0xdf10aeecec00b3aeb5a8c8e50f7eea2bf310fe9055d4326f5dda31b94e32aebd`. The run summary, exact positive-control references, and complete transaction JSON are preserved beside each attack.

| Attack | Transaction | Positive control | Native result |
| --- | --- | --- | --- |
| Second owner-mode issuance after the configured anchor was consumed | `0xdbf9c43718346d689a93d43b1d91ee135ce2b168a833f8fc5b5e79f5eba603c3` | One-shot fixed-supply issue `0x8ade039b9a31f76a432f4f662a6cbebb580391b0a9b069aa78080ae905c42ffb` committed | `owner_lineage_candidate` `0xf8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53`, `Inputs[0].Lock`, code `4` |
| Alternate xUDT type substituted for market inventory | `0x99cc871d8622254006f4368a8801392759853d938a2244072bb3847fb9c48d43` | Valid Gate 2 initial market purchase `0x734b911ecb7ebf9cbdda6721a948085350d18ab571e0fa639aec4093fc509f33` committed | `market_smt` `0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770`, `Inputs[0].Lock`, code `6` at marker/type identity check |
| Additional zero-quantity xUDT output appended to initialization; occupied capacity funded | `0x6d1e86e79dcf0f8e4f58ee1763c8842c43557fe13514eb8297e9b5ee22263c28` | Valid Gate 2 initial market purchase committed | `market_smt` `0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770`, `Inputs[0].Lock`, code `4` at required transaction-layout check; xUDT inputs and outputs both total `4,294,967,295` |
| Genuine xUDT amount inflated from 3 to 4 without authorized issuance | `0x0ef599b85255101ac7d2c03c4c3e071c39f8913ff73dd5ee68df31dcc05765eb` | Quantity-preserving genuine xUDT transfer `0x30783ef9ae16964338d257a51e8419c471b6298616f599eaf72cb6fb589a7059` committed | Genuine xUDT Type Script `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95`, `Inputs[0].Type`, code `-52` |
| Extra genuine xUDT input added to external curve sale; combined token totals conserved | `0x80853527069d2b4a0f21c0cc7b85770dcab4ad91b22e96917dba1548a5f653b2` | Canonical one-unit external curve sale `0xdf10aeecec00b3aeb5a8c8e50f7eea2bf310fe9055d4326f5dda31b94e32aebd` committed after rejection | `market_smt` `0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770`, `Inputs[0].Lock`, code `23` at the expected-input layout check; xUDT inputs and outputs both total `4,294,967,295` |

All five new attacks are verified native rejections after valid positive controls. The market-script rejections prove the tested market identity/layout boundary; they are not attributed to the xUDT Type Script. The genuine quantity inflation was rejected by the genuine xUDT Type Script itself. The issuer reissue was rejected by the current owner-lineage lock. Full signed transactions, witnesses, VM errors, script hashes, and source/binary identities are in the run directory. Earlier fixture attempts that failed occupied-capacity checks or reused spent control outputs remain preserved locally and are excluded from the completed attack count. The final output-layout attack funds 200 CKB capacity, and the extra-input attack preserves the overall genuine xUDT total. The evidence manifest is `security/evidence/native-token-boundaries-1794450855229/evidence-manifest.json`, SHA-256 `165810321cdb10e300a6ce37a54642dcc2854853ba7056544a9ded62bedc524b`; it lists compact tracked evidence and identifies local-only RPC/event/node files with their byte counts and hashes. The attack runner SHA-256 is `b1ea62f5f172562bc7c0da3f5ace5bb7ec3f78ea240904ae18066875cdf19daa`; the evidence finalizer SHA-256 is `44861af474d109126e9ba55d58b691e874b47e15772f91095ebf5f71ffcd756d`.

The earlier Gate 2 native attack run `security/evidence/native-smt-1794427785208/` remains separate and contains 18 attacks, including forged membership/non-membership claims, invalid leaves and revisions, duplicate/unauthorized ownership, reserve/payout mutations, and cross-market asset/order/state substitution. The earlier two-market fixture under `security/evidence/cross-lineage-1794388569759/` uses Gate 1 binaries and is only historical Gate 1 evidence. The Gate 2 native two-market result is in `native-smt-1794427785208/`.

## Recovery Faults

The new recovery tests are host-level mocked JSON-RPC tests, not CKB-VM execution. `node --test labs/trade-v2-token/gate2/recovery/recover.test.cjs` passed 1/1. `cargo test --locked --offline --manifest-path labs/trade-v2-token/gate2/recovery/Cargo.toml` passed 4/4. Final mocked fault evidence is `recovery/evidence/rpc-faults-1794451011452/fault-results.json`, SHA-256 `d7c5d889599ab81b9a4baf53ea3236539ffec4cc330a513bb664b192b09c5706`. It records missing and conflicting history, tip change during collection, stale proof after concurrent custody change, already-withdrawn retry, incomplete full-block history, and a withdrawal accepted despite a lost RPC response. The client verifies the saved pre-broadcast report against the mock canonical history. None of these cases simulates a real node reorganization.

Recovery depends on an unpruned full-history CKB RPC source with canonical block bodies, transaction witnesses, and current live-cell information. It does not require a Trade-operated backend, but it cannot recover the ownership tree from incomplete history alone. The existing fresh 1,024-owner withdrawal remains the native recovery proof; a separately provisioned machine, actual provider conflict test against live nodes, actual private-chain reorganization, and native interrupted-withdrawal retry are still untested. The report's older `recover.cjs` hash `9ff96ea12d193b1b8887aa197728f2b8e5aec7ed18a4882fc9c446e8ce904891` is stale: the current committed file at `00e36a3` hashes to `d42e5e384d8ad37e9db6a625fd06600704b82e37770f73200c9a37a916d32679`.

## Arithmetic and Capacity Boundaries

The current market script rejects `supply == 0`, `base == 0`, `step == 0`, and `supply > 0xffffffff`. Curve calculations use `__uint128_t`; quantities and Cell capacities are bounded by their 64-bit serialized fields, and the final curve price must fit `uint64_t`. Under the encoded supply cap, a conservative maximum price bound for `base, step <= 2^64 - 1` is `(2^64 - 1) * n * (n + 1) / 2` with `n = 2^32 - 1`, which is below `2^127`. This is an independently checked mathematical bound, not native maximum-value execution.

A later max-supply/funding-limited fixture committed setup and a large funded purchase, then failed while constructing a subsequent owner proof because the fixture reused an existing owner revision. It produced no valid max-quantity attack or capacity-boundary result and is not counted as a pass. Native CKB-VM cases at maximum supported curve quantity, maximum base/step, overflow/truncation, zero quantity, exact occupied-capacity boundary, one-shannon under-capacity, reserve exactly exhausted, reserve exceeded, fee boundaries, revision overflow, tombstone reset/old-order revival, unrelated-owner mutation, and alternate otherwise-valid redemption remain untested by this closure run.

## Security Boundaries and Verdict

- Fixed-supply issuance is enforced by the one-shot owner-lineage script and the xUDT Type Script's quantity conservation. The new attacks reached those intended boundaries for a reissue and direct amount inflation.
- Market and custody singleton uniqueness comes from consuming the current outpoints and recreating script-validated successors. A covenant validates successor layout/state, but it cannot prevent a consensus reorganization or choose which conflicting valid spend becomes canonical.
- Competing spends are subject to node transaction-pool admission and canonical chain selection. This work did not construct a same-singleton two-valid-transaction native race on the Gate 2 security branch; Gate 3 race evidence is reported separately.
- Offline orders have no covenant-enforced absolute expiry. Owner cancellation and revision invalidation are implemented; relay expiry controls only order availability. An already signed authorization can remain valid until its revision changes.
- The 80% individual purchase-price protection remains unimplemented and is not provided by reversible curve pricing.

**SECURITY CLOSURE PARTIAL.** The new native authority/layout/quantity cases pass their targeted security claims, and the full-scale cryptographic replay/recovery evidence is preserved. The exact blockers are native arithmetic/capacity extremes, owner revision/tombstone revival cases not already covered by prior tests, alternate redemption and singleton race evidence on this track, a real reorganization, and recovery from a separately provisioned environment. These gaps are not contract exploits demonstrated by this run, but they prevent a closure PASS.

## Reproduction

The native attack fixture uses disposable credentials and a private CKB 0.210.0 chain. Run from the Gate 2 worktree with the freshly rebuilt ELF directory and pinned native root:

```sh
TRADE_NATIVE_ROOT=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo18-v2-merkle/labs/rebuild/native \
TRADE_GATE2_BUILD_DIR=/mnt/c/g2-build-baseline-00e36a3-recheck \
CKB_BIN=/mnt/c/Users/timot/Desktop/2026/CKB/trade-wo16-launch-v2/labs/rebuild/native/tools/ckb \
node labs/trade-v2-token/gate2/security/native-token-boundaries.cjs

node labs/trade-v2-token/gate2/security/finalize-token-boundary-evidence.cjs \
  labs/trade-v2-token/gate2/security/evidence/native-token-boundaries-1794450855229

node --test labs/trade-v2-token/gate2/recovery/recover.test.cjs
cargo test --locked --offline --manifest-path labs/trade-v2-token/gate2/recovery/Cargo.toml
```

For the recorded 1,024-owner native recovery, use the preserved `recovery/run-scale-recovery.cjs` command in `GATE2_RESULT.md` and keep the full-history private node running as documented there. The 1,100-transaction canonical replay and combined accounting verifier commands are also in that report. No new full-scale chain transcript was generated in this closure run.

## Evidence Storage

The compact attack JSON files preserve the serialized transactions and witnesses and should be committed. The multi-megabyte `rpc.jsonl`, generated event stream, dev-node log, and failed fixture attempts remain at their exact local `security/evidence/native-token-boundaries-*` paths and are not durable remote artifacts. Their checksums are recorded in the closure evidence manifest. No external artifact store or Git LFS backing was available or configured for this run; the report does not claim remote durability for local raw traces.

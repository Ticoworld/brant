# WO04-E2A executable finality checkpoint

**Partial implementation; not a production light client or payout publisher.**

The host verifier validates historical Ethereum **mainnet Capella** light-client captures, including a pinned bootstrap, authenticated committee rotation, BLS signatures, supermajority finality and execution payload/state-root binding. The CKB harness validates one update under a fixed, host-authenticated committee commitment. It cannot safely replace E1's bootstrap publisher yet.

Read `../../docs/E2_FINALITY_PROGRESS.md` for precise implemented/unimplemented links and measured results. Historical E1 code and evidence are unchanged.

## Reproduce

From this directory, with Python 3.12 and Node 24 available:

```sh
bash src/setup.sh
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python src/reference.py
.venv/bin/python src/prepare_vm.py
.venv/bin/python src/build_vm.py
node src/mock_tx.cjs
.venv/bin/python src/run_vm.py
node src/mock_tx.cjs --fast
.venv/bin/python src/run_vm.py --fast
tools/debugger/ckb-debugger --tx-file build/mock-fast-valid.json --script input.0.lock --max-cycles 70000000
node src/devnet.cjs
```

The last command creates a new disposable CKB chain in `/tmp`, binds RPC/P2P to loopback on ports 19224/19225, tests admission/commitment, then stops its own node. It needs the verified CKB v0.210.0 binary and locked SDK under E1's ignored tools/node_modules (see cloud setup report). It never reruns E1 and never uses public-chain funds. Use the cloud executor's supported network/process permissions when its sandbox cannot start child processes or bind local ports. Do not expose these ports publicly.

Builds use Zig 0.14.1 from E2 tools, or the existing identical E1 compiler, with writable `/tmp` caches. Default blst portable arithmetic and the opt-in rv64 64-bit-limb path are both built. `vendor/blst/` preserves Apache licensing and has two documented portability changes, identified in fixture provenance. Python dependencies are exactly version-pinned in requirements.lock. Tools are ignored, not committed.

## Trust and fork boundary

The checkpoint in pinned Helios `ethereum/tests/sync.rs` is the external trust anchor. We verify the captured bootstrap header against that fixed value, not against a checkpoint computed from whatever file the caller provides. Its historical provenance is pinned, but it is **not a fresh weak-subjectivity checkpoint** independently acquired for today's network. Fixture signatures verify under the actual Ethereum mainnet genesis validators root and Capella fork domain. No validator private keys are present or required.

Only Capella is implemented. Deneb and subsequent forks fail closed. The reference verifier is a strict finalized-only subset: it requires supermajority updates and never implements optimistic or forced finalization. This intentionally rejects some spec-valid nonfinalizing updates. Caller-provided `current_slot` in the host tests is fixture time, not an authenticated live clock.

## CKB packet and optimization

`contracts/update.c` pins the 48-byte context generated after authenticating the fixture sequence on the host: committee SSZ root, previous finalized slot and fixture current slot. It is a benchmark context, not an on-chain trust-state cell. The 25,816-byte witness carries signature slot, two beacon headers, fifteen execution-header field roots, execution/finality branches, full committee, aggregate key, participation bits and signature. SSZ field-root compression leaves the actual state root, block number and block hash directly bound into the finalized header. No attacker-supplied execution root is accepted without those links.

The **full-participation** witness replaces 512 member keys with their 32-byte SSZ vector root. The aggregate public key is authenticated as the other child of the committee SSZ root. With exactly 512 participation bits, that committed aggregate key represents exactly the signing set. blst still validates aggregate-public-key and signature subgroups during its core verification. No individual member keys are accepted on this path, so there are no unverified member keys substituted for a subgroup check. Any missing participation bit is rejected. This relies on a *canonical, authenticated Ethereum committee state*; it cannot repair an untrusted committee root.

For partial participation the general path still verifies the 512 keys, selects the participants, and checks the signature. Its 1.52-billion-cycle cost exceeds the imported node's 70-million policy. It is not made cheap by a mere claim of caching.

The compact path fits the numeric policy by only 296,286 cycles (~0.42%). It is not evidence that a complete on-chain light-client update with state-cell/fork handling also fits. There is no succinct proof, verified committee cache registration state machine, or post-Capella implementation.

## Evidence

`fixtures/PROVENANCE.json` pins upstream commits and trust assumptions. `fixtures/SHA256SUMS` covers captured and derived fixtures. `evidence/` contains actual host outputs, debugger outcomes, transaction sizes, compiled-binary hashes, an empirical stack watermark and the isolated node's commitment result. Generated transactions and binaries live in ignored build/. Reproduction writes only E2 evidence and disposable local chain state.

`evidence/e1-root-adapter.json` demonstrates E1's exact byte layout: domain[32], stateRoot[32], little-endian block number[8], block hash[32]. CKB witness tests enforce this output binding. It is **host-verified / single-committee-harness-bound**, not an authenticated persistent root-publishing cell. E1's saved Ganache proofs are from a different chain and are not valid proofs under this mainnet root. No real E1 payout against a finality-authenticated publishing cell has been demonstrated.

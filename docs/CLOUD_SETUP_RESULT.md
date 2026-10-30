# Cloud migration and setup result — 2026-10-30

## Verdict: PARTIAL cloud readiness; migration integrity PASS

Current technical verdict remains **PARTIAL MECHANISM, CRITICAL PROOF REMAINING**. E1 checks execution account/storage proofs relative to a controller-selected Ethereum execution root. It does not authenticate Ethereum consensus/finality. E2 and the zero-slot refund proposal were not implemented in this task.

## Archive and import — PASS

- Uploaded ZIP SHA256: `baa7839df8f5b23a5530bcd5a5cba86708f4182ea87e33e82d17ef74e277dc82` (computed fingerprint; no external archive digest supplied).
- Python `zipfile.ZipFile.testzip()` returned `None`: all ZIP CRC checks passed. Entry paths checked for absolute paths and parent traversal before extraction.
- `sha256sum -c MIGRATION_SHA256SUMS.txt`: all 200 records passed before import and again after setup. The migration manifest remains unchanged.
- Read root README/AGENTS and CURRENT_STATE, PROVENANCE, NEXT_CODEX_TASK. The checkout was unborn and empty, and remote advertised no heads; no bootstrap README needed replacing.
- Preserved separate labs: wo01, wo02-reports, wo03, wo04-partial, wo04-e1. No historical source/report/evidence rewritten.
- E1 includes src/, contracts/ (settlement.c, checkpoint.c, deny.c, reservation.c, proof.h, hash.h, Outcome.sol), package.json, package-lock.json, vendored ckb-c-stdlib, pinned bootstrap/build scripts, config/, build outputs and research reports.

## Sensitive-material review — PASS within bounded static review

Scanned imported text outside generated tools/node_modules for private-key PEM blocks, GitHub token patterns, AWS access-key IDs and API-key patterns; no unexpected signatures found. Reviewed credential-related filenames and references: preserved development keys, Ganache fixtures and CKB genesis configuration are explicitly disposable isolated-chain fixtures. This is not a security audit or proof that arbitrary secrets are absent. No runtime environment credentials were copied into the project. .env, private key files, tools and node_modules are ignored. Fixture keys must never be used on public chains or with real funds.

## Runtime and tool acquisition

- Debian GNU/Linux 13 (trixie), x86_64; approximately 33 GiB RAM and 30 GiB free disk at initial inspection.
- Node v24.19.0; npm 11.9.0; Python 3.12.14; pip 26.2.1. No Node/Python interpreter version pin established by the imported bootstrap. Node package versions are locked.
- Restricted package-manager networking; inherited proxy and TLS trust retained. Shell network operations required approved network access; default sandbox probe could not connect to proxy:8080. Git read then succeeded through the existing configuration.
- CKB v0.210.0 downloaded from the pinned official GitHub release; bootstrap SHA256 assertion passed (`68a94c191109bae172f8dcb71828dbdf0383e2c314e0658743db217472b27bdf`). Binary reports `ckb 0.210.0 (2592ddf 2026-09-17)`.
- `ziglang==0.14.1` installed via pip into ignored tools/python. No Python requirements beyond the compiler package were needed for these checks.
- Original `python3 src/bootstrap.py`: CKB and Zig steps PASS, npm step FAIL: `EBADPLATFORM`, fsevents@2.3.2 wanted darwin, current linux.
- `npm ci --ignore-scripts --omit=optional` also FAIL with the same platform error.
- Isolated validation copy: `npm ci --ignore-scripts --force` PASS, 391 packages installed. This applies a platform override for the original lockfile, retains npm artifact integrity checks and disables lifecycle scripts. Lockfile unchanged. These installed dependencies were also retained under the checkout's ignored node_modules. No dependency vulnerability audit claimed.

## Bounded compilation — PASS

All successful builds ran in `/tmp/e1-validation`, copied from E1, preserving original evidence and build outputs.

Initial build without explicit cache configuration failed with Zig `ReadOnlyFileSystem`. Supported correction:

```sh
ZIG_GLOBAL_CACHE_DIR=/tmp/zig-global ZIG_LOCAL_CACHE_DIR=/tmp/zig-local python3 src/build.py
node src/compile.cjs
```

Both exited 0. Solidity compiler reports `0.8.30+commit.73712a01.Emscripten.clang` (optimizer 200 runs, Shanghai target). Four rebuilt CKB binaries and generated evm.json match imported files byte-for-byte:

| Output | SHA256 |
| --- | --- |
| settlement | 5015a0d203dfce257b97ab462e8efa7a1084205368d917037cc13205b58abd71 |
| checkpoint | 935ef524811ae83df32fe9b7d538889090d56db338b272e61e9cca0fda7baeb0 |
| deny | d714c2a5834dcd5f89d151b02eb7d4d86509e811f6c7ee1bed51232535fbd2ae |
| reservation | cd37cacc6ade47d6788afc254a6da11751b1e87dfeccb1f9e0904957f0366881 |
| evm.json | a25e9e1805b151de1a07893ee74bb89a82e73beaa0bf4b44b0049f1a8296d8a2 |

## Included and absent E1 evidence

Included exactly these ten evidence JSON files: bootstrap, cases, complete, costs, events, final-balances, runtime-identity, source-proofs, trades, verification. These are historical artifacts, not newly executed chain results. The imported original SHA256SUMS manifest is not a complete selective-bundle verification manifest; use the root MIGRATION_SHA256SUMS.txt.

Absent: evidence/rpc raw JSONL transcripts and evidence/build.json; other extensive duplicate historical build/evidence trees and damaged WO02 archive are deliberately excluded per PROVENANCE. The original E1 evidence Library artifact is `libfile_8483a9e9050c8191baceb84a1a818c25`; implementation artifact is `libfile_ee4dda00fa5c81919e61cce29b171989`. Their contents cannot be independently enumerated from this chat, so exact remaining raw-file names and archive equivalence are NOT VERIFIED. No missing files were fabricated.

- Full `node src/verify.cjs`: FAIL / BLOCKED, exit 1, `ENOENT: no such file or directory, scandir '/tmp/e1-validation/evidence/rpc'`. It reaches the raw RPC consistency section; full hashes/receipt/terms/allocation assertions are not claimed as passed.
- Partial saved-fixture check: executed only the unchanged verifier prefix before `const rpc=[];`, via Node Module._compile with its original filename for relative imports. PASS: five MPT/account/storage proofs checked, including account code/storage hashes and slot values against the saved controller-selected state root. This is a partial check, not the full verifier or consensus verification.
- No fresh chains launched, no historical experiments rerun, no public deployment or transactions, no real funds. The historical 12 CKB/24 EVM/30-case counts are not freshly verified here.

## Reusable configuration and remaining work

Saved install_script and start_skill in the environment draft, confirmed `status: saved`, `requires_publish: true`. Installation preserves source/lockfiles and uses the tested platform override; startup directs future tasks to use existing checkouts and temporary validation copies. This does not publish the snapshot or prove fresh-task restoration. Review/save changes in environment settings, then publish the prepared environment.

Compilation and partial offline fixture inspection are available. Full original offline verification remains blocked by omitted raw RPC evidence. Supply the original E1 evidence archive from Library, or authorize a separate isolated fresh reproduction with new output directories; never merge generated runs into historical evidence. Full runtime reproduction was outside this bounded migration check. E2 remains a subsequent engineering task.

Git import and this report are committed together; see Git history for the commit identifier. The migration task's final response records the push result.

# WO15-R6B — IMPLEMENTED AND NATIVE VERIFIED

VERIFIED on disposable CKB 0.210.0 private chains, data1. R5 files and binary are untouched. This candidate replaces only `trade_secp_verify`; candidate.c includes the exact R5 C covenant (the covenant was C, not Zig). No CCC or browser-wallet compatibility is claimed.

## Implementation and diagnosis

R5 uses Zig 0.14.1 EcdsaSecp256k1Sha256. In std/crypto/ecdsa.zig Verifier.verify it finalizes SHA-256, inverts S, separately computes basePoint.mulPublic(z/s) and public_key.p.mulPublic(r/s), adds and converts to affine. It has no official libsecp context. R5 ELF .text is 56,486 bytes; read-only sections total 3,216 bytes. The Zig object .text alone is 35,038 bytes. Large embedded tables were not its size cause. Source and controlled replacement demonstrate the generic verification path was expensive; individual inversion/multiplication cycle shares were not instrumented, and no exact per-operation attribution is claimed.

The adapter uses upstream secp256k1_ecdsa_verify, compressed-key parsing, compact-signature parsing, and one SHA-256 of the supplied 32-byte Blake2b intent digest, exactly as R5. It normalizes S because Zig accepts both S forms whereas libsecp verification requires low S. The official helper initializes a reusable verification context lazily once per VM execution and loads 1,048,576 bytes through ckb_load_cell_data. Lock and type script executions are distinct VM invocations. The existing standard-secp depGroup already supplies the required data Cell. The helper checks its exact data hash: 0x9799bee251b975b82c45a02154ce28cec89c5853ecc14d12b7b8cccfc19e0af4. Successful native verification establishes availability on these private genesis configurations; it does not qualify another chain's dependencies.

Maker lock derivation, domain preimage, economic terms, revision and Merkle checks are the original source, unchanged. This still uses a supplied verified public key, not recoverable-signature wire encoding. It is not yet CCC message signing.

## Provenance and reproduction

System scripts: 72eb92fca090700dcb398cd8cad8fbd8bad40355; secp submodule: 3ffde18a060aaf4df5b81e7d88355f1e99874650. Existing checkout is labs/wo15-r6-secp-upstream, deliberately NOT committed as a nested repository. secp256k1_helper.h is copied from that revision with only its legacy syscall-header include removed; the original covenant supplies modern CKB syscalls. License preserved. SHA256 uses the pinned libsecp implementation.

In WSL, install gcc/autoconf/automake/libtool, use pinned Zig at labs/rebuild/mechanisms/tools/zig-x86_64-linux-0.14.1/zig and existing ckb-c-stdlib. Run bash labs/wo15-merkle-intent/r6/prepare.sh, then bash labs/wo15-merkle-intent/r6/build.sh. prepare checks commit pins, normalizes Windows CRLF, generates upstream tables and data identity, configures 64-bit field/scalar, endomorphism and static precomputation with assembly disabled. The first build used host-generated config with USE_ASM_X86_64 explicitly disabled before RISC-V compilation; captured config is in build/. Generator output is not embedded in ELF: it is loaded from the matched Cell.

Resolved build failures: missing autoreconf (installed autotools); CRLF breaking autogen (normalized upstream text); duplicate runtime symbols (single translation unit); conflicting legacy syscall definitions (adapted helper include). No cryptographic verification was bypassed.

Native commands: node labs/wo15-merkle-intent/r6/run.cjs; COUNT=8 node labs/wo15-merkle-intent/r6/run.cjs --batch; COUNT=50 FIXTURE_FEE=50000 node labs/wo15-merkle-intent/r6/run.cjs --batch. Run sequentially: harness uses localhost port 19224. Evidence is always newly named. node labs/wo15-merkle-intent/r6/verify.cjs performs independent offline replay; summarize.cjs reconstructs actual admitted fees from consumed outputs.

## Results

Binary: 60,336 bytes versus R5 61,032 (696 bytes smaller). Occupied code Cell: 60,377 CKB versus 61,073. SHA256: 7487fea63b23c69d900a0b38164c18d5e8ef5104324b3dd48397783305484b39. CKB code hash: 0xed3ee9872c17e80fecde802d77857725cc8e49de8bbeb8b4b120e8e788620de7.

| Intents | R5 cycles | R6 cycles | Bytes (both) | Admitted R6 fee shannons |
|---:|---:|---:|---:|---:|
| 1 | 29,141,083 | 4,773,156 | 1,284 | 10,000 |
| 8 | 222,179,518 | 22,866,323 | 4,326 | 10,000 |
| 50 | 1,381,100,673 | 134,623,290 | 27,186 | 50,000 |

Cycles are estimate_cycles values for transactions subsequently committed, not block-level instrumentation. R5 figures are preserved historical equivalent workloads, not freshly rerun. See measurements.json for exact committed hashes and evidence paths. Fifty positions use three controlled sellers and one buyer, not fifty independent humans. Initialization overhead is included; it was not separately isolated.

The one-intent transaction 0x15ce472d340c5455dda1d4a54c111a52c5207a00640940cb5ab73592be18fd23 committed using an authorization created before unrelated redemption changed the root. Fresh-process live recovery checked ownership and backing after that sale and the two-maker batch. Independent replay verified 3, 8 and 50 sales respectively across the three runs, including seller signatures and payouts. Historical evidence trusts the private node and archival witnesses, not independent consensus.

All nine intended rejection regressions passed: altered signature (85), wrong maker key (84), wrong network authorization (85), underpaid first/second seller (83), redirected payout (81), duplicate position (45), old authorization after ownership returns (47), and revoked authorization (47). Exact rejection messages are in cases.json. These are rejected VM estimates, not failed committed transactions. Full audit/fuzzing is not claimed.

## Limits and remaining gates

The official helper materially improves cycles (~90.3% reduction for 50) but does NOT achieve the predicted 18,000-CKB code capital. Code capital remains high and deployed code uses the inherited unspendable test lock; do not assume recovery. Vault cushion remains 354 CKB. One shared vault still serializes transitions and stale buyers must rebuild. No public throughput or fee-market claim follows.

CCC/UTXO Global remain UNIMPLEMENTED/UNVERIFIED: this intentionally retains R5 SHA256-over-Blake2b and compact signatures. Genuine installed-CCC message-signing tests require a separate canonical message/wire-format candidate. No physical wallet was accessed. Meaningful browser approval, public deployment, independent security review and commercial economics remain gates. This milestone establishes the replacement native verifier only, not a usable wallet product or architecture decision.

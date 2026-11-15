# WO09-E2 CKB-VM atomic compiler comparison

## Result

The documented Rust `-C passes=lower-atomic` option successfully builds the pinned Liquid Cells
anchor source and the resulting binary executes on the CKB 0.210.0 disposable chain. It committed
the same four published checkpoints and a mature operatorless exit as the isolated single-hart
`bytes` patch. The lower-atomic binary also passed the upstream `forceexit`, `withdrawal`, `anchor`
and `redteam_drain` CKB testtool suites (25 tests total).

Pinned source: `47492b51673c94635ab23de2c55477625e94ccbf`. Toolchain: Rust `1.99.1`, Zig `0.14.1`.
Build flags: `-C target-feature=-a,+forced-atomics -C passes=lower-atomic`; no Cargo dependency or
upstream source patch was applied. The lower-atomic binary SHA-256 is
`f45f99ec74d7f3d511ce93f512465a6b0ae4036477e3405d8f643b552086cf35`. The comparison binary
from the isolated `bytes 1.11.1` single-hart patch is
`04a31bf62a4aff38a2e51c0aace5f2b253828424127336f64e55d29c015ce817`.

## Same-path measurements

Both binaries ran the same transaction generator, published fixtures and CKB 0.210.0 node. All
transaction byte lengths were identical. Cycle counts were nearly identical; the table reports
lower-atomic minus single-hart cycles.

| Transaction | Bytes | Single-hart cycles | lower-atomic cycles | Difference |
|---|---:|---:|---:|---:|
| Genesis checkpoint | 1,370 | 88,260,734 | 88,252,825 | −7,909 |
| Checkpoint 2 | 1,233 | 86,586,042 | 86,586,064 | +22 |
| Checkpoint 3 | 1,233 | 86,708,811 | 86,708,833 | +22 |
| Checkpoint 4 | 1,233 | 86,637,090 | 86,637,112 | +22 |
| Mature force exit | 9,077 | 10,011,321 | 10,005,531 | −5,790 |

The lower-atomic chain evidence is in
`labs/wo09-e2-capacity/evidence/liquid-cells-multicheckpoint-operatorless-recovery-1793624574686/`;
the corresponding single-hart run is in the adjacent `...1793624376320/` directory. The native
rejections were reproduced as well: stale proof error 62, 1,000-shannon ordinary payout rejected
by occupied-capacity validation, sponsored 61 CKB payout rejected by exact-balance rule 67, and
re-use of the spent anchor rejected as an unknown outpoint.

## Decision and limits

For this exact pinned source, Rust toolchain and CKB 0.210.0 VM, `lower-atomic` is the cleaner
compatibility candidate: it avoids a local replacement of atomic types while producing equivalent
observed test and chain behavior. Keep the single-hart dependency patch as a tested fallback until
broader validation clarifies target/compiler coverage. Neither method is production-qualified.
This validation covers the anchor contract and selected contract tests, not every deployed binary,
compiler release, feature combination, cycle limit, concurrency assumption or target architecture.

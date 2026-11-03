# WO09 master architecture decision — preliminary

Updated: bounded explicit-cohort native lifecycle now VERIFIED; see WO09_MASTER_NATIVE_EXECUTION.md. Root/bitmap rivals remain analytical candidates. Commercial UNPROVED. Initial design rationale below remains preserved.

| Architecture | Principal advantage | Decisive unresolved issue |
|---|---|---|
| Mutable Merkle vault | Constant root footprint, logarithmic transition proof | Funded formation, exact update, public replay and contention |
| Small explicit cohort | Full direct state checks; simple public reconstruction | Per-record on-cell capacity and bounded cohort size |
| Individual funded Cells | Independent inputs and owner control | Per-right capacity and small-position economics |
| Liquid Cells | Succinct off-chain batch verification | Prover/inclusion dependency, silence window, pool contention |
| Immutable root + spent bitmap | Stable entitlement proofs after redemptions | Transfer/partial settlement representation and bitmap growth |

Initial implementation candidate: bounded explicit cohort for a narrow fixed-floor product, measured against a root variant rather than assuming the latter wins. This candidate has no tree or proof-provider dependency; state remains fully public in each Cell. It must enforce entire lock/state continuity, formation, authorized contributions, payout, residual owner and closure—not merely an asserted balance sum. Cohort data byte growth must be measured. Do not call this the final architecture before native comparisons.

No direct source imports from quarantined E1 investigations. Future code should reuse only separately reviewed public primitives/runtime and safe financial models, retaining attribution. No PR, merge, protected-branch edit, paid infrastructure or public deployment is authorized.

## Evidence-backed revision

Stop extending explicit arrays toward a single global market: state would grow to 48,234 CKB at 1,000 records under this encoding. Preserve the native explicit three-person cohort for its self-contained live-state availability. Preserve the full-snapshot commitment as a fully executed financial alternative: 170 CKB vault, larger witnesses, and current-witness availability dependency. Native kernel results support logarithmic Merkle update costs and stable immutable membership proofs, but do not yet qualify a financial implementation or arbitrary ownership transfer for those representations.

Neither cold three-person deployment nor code/state byte counts justify a flagship product. The next architecture investment must be driven by realistic cohort size, code reuse, public-data requirements and credible creator/buyer budgets. A complete optimized financial Merkle variant remains a possible research direction, not a reported result. Broader fixed-term risk/oracle markets remain separate; they were not merged into this oracle-free financing test.

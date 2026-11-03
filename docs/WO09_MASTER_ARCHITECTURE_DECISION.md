# WO09 master architecture decision — preliminary

ARCHITECTURE NOT YET VALIDATED. Commercial UNPROVED. No unified covenant has executed in CKB-VM or on a private chain yet.

| Architecture | Principal advantage | Decisive unresolved issue |
|---|---|---|
| Mutable Merkle vault | Constant root footprint, logarithmic transition proof | Funded formation, exact update, public replay and contention |
| Small explicit cohort | Full direct state checks; simple public reconstruction | Per-record on-cell capacity and bounded cohort size |
| Individual funded Cells | Independent inputs and owner control | Per-right capacity and small-position economics |
| Liquid Cells | Succinct off-chain batch verification | Prover/inclusion dependency, silence window, pool contention |
| Immutable root + spent bitmap | Stable entitlement proofs after redemptions | Transfer/partial settlement representation and bitmap growth |

Initial implementation candidate: bounded explicit cohort for a narrow fixed-floor product, measured against a root variant rather than assuming the latter wins. This candidate has no tree or proof-provider dependency; state remains fully public in each Cell. It must enforce entire lock/state continuity, formation, authorized contributions, payout, residual owner and closure—not merely an asserted balance sum. Cohort data byte growth must be measured. Do not call this the final architecture before native comparisons.

No direct source imports from quarantined E1 investigations. Future code should reuse only separately reviewed public primitives/runtime and safe financial models, retaining attribution. No PR, merge, protected-branch edit, paid infrastructure or public deployment is authorized.

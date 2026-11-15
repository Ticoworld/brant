# WO07 exact-outpoint group revocation — native reconstruction

VERIFIED own private chain: group-revocation-1793544982651 has 16 committed transactions (including two code deployments), five specific rejection cases and raw evidence. The separate MIT-derived A2 adapter uses 36-byte args and requires that exact code-cell dependency on mint/match. The node enforces liveness. It preserves ordinary owner melt without gate dependency. This does not modify published A2.

The native run verifies correctly signed omission at mint, omission at fill, substitution and successor rebinding rejected specifically by the adapter (error21), a valid two-order fill committing first, owner cancellation spending the gate, later otherwise-valid fill rejected by dependency resolution, successor cells still live, and owner melt after revocation. These are explicit ordered schedules, not proof that cancellation wins a mempool race or provides passive upper expiry. All arbitrary-history recovery/LO-01 proof remains unresolved/blocked.

A preliminary omission test removed a dependency without re-signing the funding transaction, so its rejection was owner-signature error -31, not a covenant proof. That run is retained but not used for the mint omission claim. The corrected run re-signs mutations and asserts adapter error21. No weakened check or manufactured PASS.

| Two-order lifecycle profile | Published A2 | Source A2, 2-MiB | Gate adapter, 2-MiB |
|---|---:|---:|---:|
| Transactions | 4 | 4 | 6 |
| Serialized bytes | 3820 | 3820 | 4973 |
| VM cycle estimates | 6975602 | 6873318 | 10340553 |
| Fixed fixture fees, CKB | 0.04 | 0.04 | 0.06 |
| Minimum occupied order, CKB | 195 | 195 | 231 |
| Minimum occupied master, CKB | 94 | 94 | 130 |
| Separate gate, CKB | 0 | 0 | 61 |

Included: common inventory issuance, grouped two-order funding, grouped partial fill, grouped recovery, plus gate setup and cancellation when applicable. Code deployment excluded from these totals and measured separately: adapter 42,072 bytes; actual burned code cell occupies 42,113 CKB. Rebuilt source baseline34,528 bytes differs from published34,200 due toolchain/glue; both executed. Original 7-vs-9 historical costs remain separate, not overwritten or forced.

Conclusion: the additional group-cancellation right works in the tested fixture and costs more than ordinary recovery. It is reusable when a future mechanism needs that distinct right, not a cheaper cancellation replacement or corrected LO-01 contract.

# Large-batch comparative execution — measured, not historic-count matching

Two independent private-chain runs compare the reconstructed compact C bid primitive with published A2, same-source/default-heap A2 and same-source/2-MiB A2. Evidence: batch-comparison-1793544998943 and batch-comparison-1793545200384. Native funds and xUDT transfers are real private assets, all completed bid outputs use their actual occupied minimum. CCC/SDK/raw commitment checks pass. Failed funding and estimation attempts are retained, not counted as settlements.

| Full orders | Compact settlement bytes / cycles | 2-MiB A2 settlement bytes / cycles |
|---|---:|---:|
| 32 | 6,139 / 2,662,470 | 10,606 / 3,111,225 |
| 256 | 44,667 / 38,060,391 | 81,166 / 14,809,439 |
| 1024 | 176,763 / 539,682,866 | 323,086 / 59,007,592 |
| 1536, staged run | 264,827 / 1,201,132,536 | 484,366 / 79,923,967 |

At1536, compact uses fewer bytes but about15 times the cycles. It also uses less temporary per-order capacity by paying tokens directly rather than retaining them in an A2 successor/master pair. That is not proof of improved maker delivery-inventory efficiency or commercial returns. Both deliver the same sold CKB principal and token amount; recipient/occupancy/recovery layouts differ. All figures are settlement-only; funding bytes/count/capacity and code occupancy are recorded separately. Fixed fees are fixtures.

The first run failed to bulk-fund1536 A2 orders, even with2-MiB. Stopping there would falsely call it an execution limit. The follow-up funds independent orders in128-order chunks, then commits a single1536-order optimized A2 settlement. Default published/source heaps still fail the tested large settlement workload. No heap error is relabeled an authorization proof, and no tested point is declared an exact maximum. The new C reconstruction reaches1536 rather than the old reported1024; different design, grouping and resource shape justify the difference, not reconstructed historic binaries.

Decision: retain compact as a reusable direct-payout/witness-intent experiment; reuse optimized upstream A2 for strong large native clearing, especially cycle economy. Neither dominates every property. No novel matching engine or commercially superior product is inferred.

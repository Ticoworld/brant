# Integrated financial Merkle comparison

All rows below are actual committed native financial transactions, using the framed 17,488-byte contract. They are not kernel extrapolations. Code Cell capacity is 17,529 CKB; live vault data is 160 bytes and its minimum capacity is 298 CKB for every tested target. It contains financial metadata/counters in addition to the root, so it does not inherit the 170 CKB snapshot footprint.

| Owners | Individual update payload | Complete partial redemption bytes/cycles | Paid assignment bytes/cycles | Closure bytes |
|---:|---:|---:|---:|---:|
| 3 | 184 bytes | 998 / 1,806,401 | 1,244 / 3,467,302 | 464 |
| 16 | 248 bytes | 1,062 / 1,872,623 | 1,308 / 3,539,038 | 464 |
| 100 | 344 bytes | 1,158 / 1,947,042 | 1,404 / 3,614,084 | 464 |
| 1,000 | 440 bytes | 1,254 / 2,038,191 | 1,500 / 3,743,868 | 464 |

Payload includes operation/count, claim index, full authenticated old/new financial leaf and path—not just sibling hashes. Each ordinary redemption uses two inputs and two outputs, actual owner secp authorization and a 10,000-shannon fee. Paid assignment uses three inputs/outputs, actual seller/buyer signatures and a 10,000-shannon fee. The vault lock and type both validate the covenant. Unrelated participant records are not republished.

## Full executed scale

Successful combined run merkle-scale-1793668842445 contains 1,156 committed transactions across setup and three complete markets. Independent offline verification replays actual UTXOs and 2,238 leaf updates, checks every old record/path/root, all counters/capacity equations, final backing zero, designated cushion return and raw committed statuses. It identifies 22 / 106 / 1,015 market transactions for 16 / 100 / 1,000 owners, excluding wallet/code setup. Every outstanding scaled claim is actually redeemed; final closure is not extrapolated.

Native backing/creator gross: 16 owners contribute 2 CKB, back 1.6 CKB and release 0.4 CKB; 100 contribute 12.5, back 10 and release 2.5; 1,000 contribute 125, back 100 and release 25. Each initial position is a 0.125 CKB contribution with 0.1 CKB protected right. A partial right is sold for real test consideration and redeemed by its buyer. Dedicated claim Cell count is zero. Each holder starts with an actually funded 100 CKB test wallet; code, vault cushion and creator-wallet setup are separately funded, never counted as protected backing or creator proceeds.

Measured whole-market wall times for this controlled runner were about 1.95 / 9.72 / 121.17 seconds, including wallet setup, validation, private mining, repeated evidence serialization and local calls. They are not public-network TPS or finality measurements. Peak JavaScript-runner RSS rose to about 118.6 / 229.9 / 393.3 MB. These are host-process peaks, not total node/VM/system peak memory. Isolated node disk stayed within the available disposable resource budget; no SP1 setup or paid service was used.

Initial cold chain replay after complete enrollment/activation: about 72.8 / 92.6 / 346.1 ms; child RSS about 62.7 / 66.6 / 86.9 MB. At 1,000, ten signed batch histories plus creation and activation are replayed. After restart of the preserved node, a completely fresh process reconstructs all 1,015 market transactions through final closure in about 2.53 seconds, RSS/peak about 167.3 MB, and confirms zero backing. That needs historical witnesses from a validating archival source. Controlled missing-history failure is preserved separately.

## Equivalent-right comparisons and limits

Explicit three-person financial covenant: 378 CKB vault and self-contained live records, but state grows with owners. Full-snapshot financial covenant: 170 CKB vault, authenticated full-state witness republication, fewer historical updates needed for cold recovery. At three people it is more capital-efficient than this Merkle variant; Merkle is not a universal winner. At 1,000 a corresponding full-snapshot shape would carry 96,192 old/new state bytes per transition, compared with the actual 440-byte Merkle update. That byte-growth formula is analytical; a complete 1,000-owner snapshot lifecycle was not executed. Standard witness framing would also need adapting there.

Individual funded Cells: derived 150 CKB state/claim capacity under the preserved E1 encoding, with independent UTXOs and no shared-root rebuilding. The Merkle market amortizes live state to 0.298 CKB per right at 1,000, but still needs pre-funded wallets and extra code publication. Bounded cohorts reduce contention across markets at the cost of multiple vault cushions. Existing native disjoint-market evidence applies only to those earlier complete implementations; generalized multi-vault atomic composition remains unsupported by the index-zero vault layout.

Liquid Cells offers off-chain batch execution; this contract executes every financial transition on-chain with no Groth16 or silence window. That is a different throughput/availability trade-off, not proof of universal superiority. Root/bitmap kernel numbers remain separate non-financial benchmarks. Immutable commitments simplify proof freshness but need another ownership/remaining-balance mechanism for equivalent paid transfers and partial redemptions.

No public-liquidity quote, commercial user demand, arbitrary censorship resistance, reorg/archival SLA, standard-wallet integration or external security qualification follows from these results.

## Subsequent configured-policy qualification (current preferred variant)

The unconfigured measurements above remain historical. The configured 17,848-byte binary actually executes the same complete scale workloads, while adding immutable minimum contribution, funding goal and optional-feature controls. Code Cell is 17,889 CKB; live vault is 322 CKB, with 184-byte data. These are measured occupied capacities, not fees.

| Owners | Individual update bytes | Complete partial redemption bytes / cycles | Paid assignment bytes / cycles | First enrollment batch count / bytes / cycles |
|---:|---:|---:|---:|---:|
| 3 | 184 | 1,022 / 1,800,126 | 1,268 / 3,449,953 | 3 / 1,850 / 5,373,998 |
| 16 | 248 | 1,086 / 1,874,846 | 1,332 / 3,560,787 | 16 / 8,256 / 31,198,255 |
| 100 | 344 | 1,182 / 1,948,109 | 1,428 / 3,618,480 | 100 / 58,024 / 315,167,022 |
| 1,000 | 440 | 1,278 / 2,058,451 | 1,524 / 3,724,711 | 100 / 67,624 / 360,655,109 |

All entries are committed native CKB 0.210.0 transactions, including actual standard secp authorization and both covenant roles. They are not standalone testtool or model estimates. Three-owner row uses the funding-goal/refund fixture; larger rows use `merkle-configured-scale-1793671317288`. The 3-owner fixture has 14 committed transactions including refund/re-enrollment; the combined larger run has 1,156, every market closed. Individual redemption: 2 inputs/2 outputs; assignment: 3/3; closure: 2/1 and 464 bytes. Complete market fees: 0.004 / 0.0124 / 0.1114 CKB at 16/100/1,000, excluding shared code/wallet setup. Full run total fees 0.1498 CKB. Fees are actual chosen fees, not claimed minima.

At 1,000 owners a complete enrollment batch of 100 publishes 42,416 update bytes in signed chunks, and costs about 360.7M cycles. One hundred distinct secp groups really execute. A 101-update batch is outside this contract's explicit 100-update envelope and rejects. A 1,000-person single batch was not executed and is not supported by this binary; ten batches are native evidence. No funding-input reuse is allowed.

Configured full run wall time was about 2.00 / 9.61 / 121.48 seconds, host runner peak RSS 118.9 / 219.8 / 386.0 MB. Post-restart closed-market recovery: 1,015 archived transactions, 2.45 seconds, 172.7 MB peak RSS. This measures a local controlled node and child process, not public-network latency or total system peak.

Immutable-root/bitmap kernels retain genuine earlier native measurements but remain limited kernels. An immutable root alone cannot represent changed owners and partially spent minima. A spent bitmap alone cannot express the actual paid mutable ownership lifecycle; adding replacement claim Cells or another mutable map changes capital/proof costs. No equivalent complete financial bitmap implementation was executed. Bounded sharding is the strongest existing direct rival when shared-input contention dominates: disjoint cohorts need separate cushions and histories but can avoid the single shared UTXO. Existing independent-market native evidence demonstrates that bounded distinction, not an arbitrary throughput guarantee.

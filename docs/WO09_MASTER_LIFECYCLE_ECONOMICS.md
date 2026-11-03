# Lifecycle and representation economics

All prices below are hypothetical valuations, not quotes. Actual native financial executions use three records only. Larger financial workloads are analytical, not benchmarks.

| Financial variant | Binary bytes | Code Cell CKB | Vault CKB | Entry/redemption bytes | Small redemption cycles | Paid sale bytes/cycles |
|---|---:|---:|---:|---:|---:|---:|
| Explicit v2 | 15,176 | 15,217 | 378 | 886 | 1,731,362 | 1,132 / 3,415,039 |
| Full-snapshot hash | 15,424 | 15,465 | 170 | 1,166 | 1,804,343 | 1,412 / 3,465,000 |

Explicit closure: 440 bytes, 1,691,629 cycles. Snapshot closure: 928 bytes, 1,741,587 cycles. Financial runs pay 0.0001 CKB per ordinary transaction, plus 0.01 CKB code publication. Code publication occupies separate real CKB; the test code Cell is immutable/unspendable, not a recoverable user fee. Wallet inputs are pre-funded disposable resources; creator wallet setup is 100 CKB funded by Alice, separately disclosed. Generic per-wallet plain Cell floor is 61 CKB; the code does not provide free onboarding. Backing is separate from all occupied capacity.

Native example: contributions 0.125, 1.25, 125 CKB; rights 0.1, 1, 100 CKB; creator gross 25.275 CKB; protected total 101.1 CKB. Creator pays its explicit activation fee. Alice funds and recovers the designated vault cushion at final closure. No residual cushion is awarded to final holder Carol. Returning cushion means reusable capital, not zero opportunity cost. Sale price 0.01 CKB is buyer-funded consideration, not new creator funding.

Cold combined code+one vault capacity: explicit 15,595 CKB, snapshot 15,635 CKB. Snapshot saves 208 CKB per cohort but requires 248 extra code bytes/CKB, so it uses 40 more CKB for one cold cohort and becomes cheaper in locked code+vault capital at two reused cohorts. It adds 280 bytes to a normal financial transition and 488 to closure. This is a real trade-off, not universal superiority.

The preserved E1 funded-claim binary is 14,568 bytes; its ordinary 24-byte claim data with standard owner lock and 32-byte type args occupies 150 CKB per claim before principal. Against that source-level storage baseline, each three-right snapshot cohort saves 280 CKB of per-right storage but adds 856 CKB of code publication, giving an approximate break-even at four reused cohorts (12 claims), excluding differences in transaction fees, wallet setup, residual ownership and code reuse already available elsewhere. This is derived comparable fixed-native-right storage math, not a fresh E1 full-lifecycle benchmark or business return.

Scaling: an explicit N-record market has 96+48N bytes of state, plus 138 CKB lock/type/capacity overhead: 378 / 1,002 / 5,034 / 48,234 CKB for N=3/16/100/1,000. Full-snapshot live state is a 32-byte commitment, but its old+new witness grows as 192+96N bytes: 480 / 1,728 / 9,792 / 96,192. Only N=3 financial variants were compiled and exercised; native kernel measurements below are narrower workloads. Three-member sharding at 1,000 holders requires 334 vaults, not one constant-cost vault.

Native mutable-Merkle and immutable-root/bitmap kernel results (financial validation/closure absent):

| Leaves | Mutable state/proof bytes | Mutable cycles | Immutable state/proof bytes | Immutable cycles |
|---:|---:|---:|---:|---:|
| 3 (padded 4) | 32 / 136 | 1,676,487 | 33 / 104 | 1,676,036 |
| 16 | 32 / 200 | 1,721,127 | 34 / 168 | 1,637,966 |
| 100 (padded 128) | 32 / 296 | 1,713,923 | 48 / 264 | 1,693,202 |
| 1,000 (padded 1,024) | 32 / 392 | 1,769,206 | 160 / 360 | 1,713,954 |

These include a normal fee-payer secp lock but NOT the financial market authorization, sum constraints, metadata or closure. Do not compare their smaller Cells to complete market vaults as equivalent rights. A 1,000-bit bitmap minimally takes 125 bytes; the tested padded tree uses 128 bytes. Kernel creation publishes all leaf digests in a witness, not actual financial records; proof publication is explicit. Kernel code is a disposable benchmark, not a market.

Price stress for cold snapshot code+vault (15,635 CKB): $19.0747 at $0.00122; $1,563.50 at $0.10; $15,635 at $1; $156,350 at $10. Protected principal, wallet capacity, fees and service costs are additional. Shared live vault alone (170 CKB) is $0.2074 / $17 / $170 / $1,700. Actual minimum redemption fee assumption remains separately specified, never inferred from dollar values. At sparse utilization a simpler escrow or existing deployed claims code can be cheaper. Public archival service, relaying, realistic liquidity, spread, operational capital cost, audits and customer acquisition are unmeasured.

Decision: stop scaling explicit arrays as a global market. Preserve explicit cohorts for self-contained current-state recovery. Keep snapshot commitments as the bounded low-live-state alternative, conditional on public current-witness availability and sufficient code reuse. No commercial winner is established; an optimized financial Merkle implementation is not yet comparable evidence.

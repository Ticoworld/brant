# WO09-E3 economic decision gate

Verdict: freeze sponsored exact-claim and recipient-paid bounded-fee merge as working experimental fallbacks. TECHNICAL ADVANCE for existing funded-wallet owners; COMMERCIAL UNPROVED. Stop narrow fee polishing. No unconditional no-funded-Cell recovery capability has been demonstrated.

## Measured exit versus full lifecycle

Fee variant uses one recipient signer and no fee sponsor. Measured examples: 8,968 bytes and about 10.0 million cycles; 10,000 shannons = 0.0001 CKB is paid as actual input-minus-output fee in VM. Sponsored comparison: 9,214 bytes, about 11.7 million cycles, two wallet signers. At an assumed 1 shannon/byte the 246-byte difference is 0.00000246 CKB. The recovered native sponsored experiment paid 0.01 CKB by fixture choice; comparing that arbitrary fee directly to 0.0001 as a mechanism saving would be misleading.

0.1 / 1 / 5 / 20 CKB claims lose 0.1% / 0.01% / 0.002% / 0.0005% to the measured 0.0001 CKB exit-fee choice. At the 0.01 CKB policy cap the corresponding deductions are 10% / 1% / 0.2% / 0.05%. These percentages exclude all other costs. Fixed 0.01 CKB cap is a prototype policy, not an optimal fee recommendation.

Recipient wallet capacity is reusable CKB wealth, not a burnt fee. Maintaining a suitable Cell does tie up a minimum 61 CKB in this ordinary untyped form (derived from consensus occupancy; actual tests used 100 CKB). If a customer already owns a suitable wallet, incremental capacity can be zero. If not, the capacity must come from the customer or an identified funder. Wallet floor/principal ratios are 610x / 61x / 12.2x / 3.05x for these positions. Dollar prices do not change those ratios.

| Principal CKB | Principal USD at $0.10 | At $1 | At $10 |
|---:|---:|---:|---:|
| 0.1 | 0.01 | 0.10 | 1 |
| 1 | 0.10 | 1 | 10 |
| 5 | 0.50 | 5 | 50 |
| 20 | 2 | 20 | 200 |

At these prices, the derived 61 CKB wallet floor is $6.10 / $61 / $610. A 0.0001 CKB exit fee is $0.00001 / $0.0001 / $0.001. These are hypothetical conversions, not executable quotes.

The prototype pool's 500 CKB anchor cushion is separate from financial backing. Allocate 500/N only as an illustrative per-holder capital share, not a user fee. The new binary has 118,184 bytes; a code Cell with the preserved code-lock shape has a derived minimum 118,225 CKB occupancy. Code can be reused by many pools, so per-customer allocation depends on deployment reuse and total beneficiaries. A newly deployed derivative needs an actual funder; assigning its cost zero without specifying reuse is incorrect. Proof generation, archival RPC, proving hardware and entry/circuit costs remain unmeasured.

## Explicit whole-lifecycle scenario, with missing terms

The exact Decimal model at labs/wo09-e3/scripts/model-lifecycle.py produces 12 scenarios in evidence/lifecycle-cost-scenario.json and checks funding/reserve identities. Assumptions: 1,000 holders share a 500 CKB cushion; four checkpoints cost 100,000 shannons each; entry fee is assumed 10,000 shannons, exit fee is the tested 10,000-shannon choice. Modeled paid fees sum to 0.000204 CKB per position. This is an illustrative allocation, not a measured full lifecycle.

Principal + derived wallet capacity + allocated pool cushion is b+61.5 CKB; adding modeled fees gives b+61.500204. Dedicated deployment/code allocation and unmeasured proving/service costs must be added. For 0.1 / 1 / 5 / 20 CKB, gross scenario funding including these modeled fees is 61.600204 / 62.500204 / 66.500204 / 81.500204 CKB. At $0.10 multiply by 0.10; at $1 retain the numbers; at $10 multiply by 10. Model JSON gives each exact conversion. An already-funded customer may reuse the wallet; a shared service may fund anchor/code, but that changes cost bearer, not resource conservation.

Additional full-lifecycle terms: collateral duration/opportunity cost, price risk while capital remains CKB, actual entry and checkpoint fees, prover cost, archive availability, oracle/fixing cost for financial products, liquidity spreads, channel fees and channel opening/closing requirements. They are UNKNOWN, not zero. An illustrative dedicated 61 CKB wallet at 5% annual opportunity cost over 30 days costs about 0.250685 CKB; an existing multipurpose wallet need not have that marginal cost.

## Product and competitor comparison

Compared with pinned unmodified Liquid Cells, the derivative permits tested claim redemption into the owner's existing Cell and bounded self-funded fees, instead of demanding an exact-value standalone output. Keccak SMT, public DA, proof verification, checkpoint machinery and the silence threshold are upstream capabilities, not Trade inventions. The incremental contribution is a constrained payout representation/fee policy plus integration evidence. It is not demonstrated to be novel across all protocols.

Compared with ordinary bilateral wallet settlement, this work addresses continuing pooled financial rights, not merely a spot transfer. Compared with simple individual escrow, compressed rights can avoid one separate occupied claim Cell per right, conditional on existing destination capacity, operator-silence liveness and recoverable history. CoBuild/OTX can authorize flexible settlement but do not by themselves fund a new tiny recipient Cell. ACP can receive into a pre-funded compatible Cell; it does not remove the need for someone to fund it. No direct ACP or Fiber implementation benchmark was run here; no superiority claim against either is supported.

For protected creator financing, protected backing and creator-usable funds must be separate. An illustrative 80% protected floor leaves at most 20% of subscription principal gross for the creator, before costs. For b=0.1 / 1 / 5 / 20 CKB, protected backing is 0.08 / 0.8 / 4 / 16 CKB and gross usable funding 0.02 / 0.2 / 1 / 4 CKB. Full refund plus spending the same funds is impossible without outside backing. Staged escrow and cash retention plus an at-risk grant remain strong simpler rivals. No issuer demand, competitive quote or commercially superior financial right is established.

## Decision

The tested advantage is narrower fee-sponsor independence for holders with existing funded wallets and continuing pooled rights. It does not open economical unconditional onboarding for a user with no funded Cell. That barrier dominates the byte/cycle improvement. Freeze merge mechanisms; prioritize an actual funded delivery route with explicit refusal/refund semantics or a product whose customers already have destination capacity. Do not extend generic fee/topology support without a customer-relevant requirement.

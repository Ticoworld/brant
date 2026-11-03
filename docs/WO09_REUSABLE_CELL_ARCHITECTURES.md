# Reusable-capacity architectures

3 November 2026. A = zero customer-funded storage; B = independently authorized control of funded rights; C = independently spendable external withdrawal when Trade and the original provider disappear. C is conditional on actual asset amount, fees, chain/proof availability and destination structure. Public-network censorship/starvation resistance is not established by any lab here.

| Candidate | A | B | C and capital boundary | Decision |
|---|---|---|---|---|
| Sponsor creates a normal Cell for every customer | Yes for customer | Ordinary key control if genuine customer lock | Large output exists, but sponsor funds61CKB per concurrent owner; an ordinary gift is not enforceably reclaimed/reusable | Valid funded route; fails reusable-onboarding objective |
| Sponsor-owned database balances | Yes | No independent L1 right by itself | Sponsor disappearance/refusal can stop redemption | Reject as replacement |
| Sponsor-owned Cell with freely replaceable root | Yes | No; commitment alone is insufficient authorization | Operator can change claims unless transition proof/owner checks enforce them | Reject |
| Existing Merkle covenant + normal owner inputs | No for fresh users | Existing bounded qualification | Existing-wallet merging; small standalone exit still needs capacity | Frozen fallback |
| **Witness-authorized fully funded shared pool** | **Yes, native tested** | **Yes in tested transitions** | Transfers and claim-paid fees need no operator/capacity-provider signature; small standalone cash still lacks capacity | Best tested **partial advance** |
| Small independent cohorts of that pool | Yes | Same intended rules | More282CKB cushions, independent UTXOs; shared code once, fewer root conflicts across cohorts | Modeled100/1000/10000 use; new1000/10000 scale not executed |
| ACP/existing recipient | A recipient may be funded by someone else | Depends on actual lock/claim authorization | Can credit existing valid funded Cell; recipient availability/ownership and lock conditions matter | Strong cooperative settlement alternative; not zero-capacity exit |
| Funded LP/claim buyer | Yes for seller | Only if owner authorizes actual claim/payment settlement | Requires willing buyer, payment inventory and usable destination; unavailable counterparties are not independent cash recovery | Keep conditional; no bid assumed |
| Fiber/external channel funding | Possible with other-side capital | Channel-specific key/recovery rules | Funding/route/reserves/closing behavior remain; often linear channel capital rather than global shared capacity | Strong high-frequency alternative; no new channel experiment |
| Liquid Cells/off-chain authenticated rights | Possible | Only under qualified checkpoint/exit conditions | Existing E2/E3 proof/anchor/maturity/receiving-capacity limits remain separate | Preserve qualified baseline; do not assume it solves tiny standalone exits |
| Reclaimable leased exit Cell | Sponsor may fund | Needs split principal/capacity ownership covenant | If sponsor can seize user principal at expiry, B fails. If sponsor cannot reclaim until settlement, its capital may stay locked. It is a restricted right, not automatically ordinary user cash | Model only; no safe reusable lease claimed |
| Aggregate all small owners into one output | Yes | Only with a demonstrated continuing shared control mechanism | A shared right is not each owner's separately spendable L1 output; recreates pool/control problem | No automatic C upgrade |

## Chosen experiment and rights

The isolated `capacity-access` pool has no creator, service, launch or matching-engine authority. Sponsor0 funds fixed storage and real deposited CKB, then receives no ability to transfer customer claims. Customers use independent Ed25519 keys; leaves authenticate owner hash, current balance and nonce. Root and total liability change only through specific proved transitions with required owner signatures. At most two leaves change per tested transfer. There is no arbitrary privileged root-update operation.

Sponsor can recover fixed capacity and unused subsidy only after all claims are discharged; current implementation contains no lease-expiry confiscation route. Sponsor insolvency/refusal cannot cryptographically consume existing customers' principal under tested rules. It can prevent **new** deposits/gifts, and its own storage can remain locked indefinitely if owners lose keys or never settle.

Fees may come from a standard external payer, a pre-funded shared subsidy or the owners' authenticated balances. The latter is the useful new result: no personal Cell and no continuing fee-sponsor cooperation is needed for funded claim transfer. Subsidy exhaustion and zero-fee relay rejection are tested; user-funded fees then still work. Shared subsidy can be consumed by authorized trading; it is not an unlimited free service.

This is exact full-transaction authorization, not freely aggregatable OTX offers. A builder/counterparty may refuse to construct or sign a trade. Recovery can bypass the original builder using public history, but shared-input conflicts and repeated root updates still require rebuilding. Direct transfers in the prototype require recipient consent as well as sender authorization; this is a bounded construction, not proof of guaranteed matching or inclusion.

The new Ed25519 adapter adds code/cycles and requires compatible key management/wallet integration. It is not a standard-wallet-ready replacement. Existing typed-asset DEX settlement, multi-asset conservation, private orderflow, audit coverage and economic counterparties are outside this experiment. Preserve the successful capability; do not silently swap it into the established financial covenant.

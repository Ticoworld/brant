# WO01: Engineering frontiers

All observations are as of 29 October 2026. VERIFIED means directly inspected source, direct public record or executed experiment. Reported upstream features are distinguished from reproduced features. DERIVED conclusions state their assumptions. HYPOTHESIS designs have not been implemented. BLOCKED items identify missing proof. Sources and hashes are in the evidence ledger.

## 1. Speed: move authorization, not the definition of finality

VERIFIED, E01–E04: the inspected stable node is CKB v0.210.0, binary identification `2592ddf`, released 17 September 2026. The inspected develop head is `0b0b3e50d8c6fb0a5dab1b79ffcc569d38be14cd`; stable-source claims below use v0.210.0, not unmerged develop work. Consensus defaults use proposal distance 2 through 10. This is a block-distance eligibility window, not a two-block transaction deadline or a deterministic latency SLA.

VERIFIED, X01: locally admitted transactions progressed through pending, proposed and committed under manually generated blocks. The representative transaction was submitted at height 16, proposed in block 18, reported proposed at height 19 and committed in block 20. Template scheduling affected this observed sequence. Neither its wall time nor its block count should be promoted to a mainnet guarantee.

### What we can change

Keep order reception, price discovery, routing and quote updates off chain. Require the maker's final authorization after the taker's signed constraints are known. Persist the complete transaction before acknowledging authorization. Broadcast through independent submitters and expose recovery immediately. Off-chain cancellation can prevent a cooperative maker from issuing a new signature. Once a valid fully signed transaction exists, stopping a service does not revoke it.

OTX can let independently signed fragments be assembled without another wallet round trip. VERIFIED, E05–E06: original CoBuild OTX describes composable signed fragments; a 2026 reference contract workspace and test fixtures now exist. Its implementation explicitly treats parts of the protocol as a community redraft/testbed. WO01 did not compile, audit, deploy or benchmark that workspace. Do not infer production compatibility or signature-cycle costs from its existence.

For a one-off fill, use the least flexible adequate authorization. A fully specified atomic CKB transaction can be co-signed without needing a new OTX standard. Use OTX when independent composition or batch savings justify the extra parser/signing surface. Bind minimum return, permitted assets and fees; do not allow assembly freedom to erase economic constraints.

### The proposed experience

The client should show an indicative quote, then a maker-authorized execution proposal, then node/proposal/commit states. A sub-second target for the first two states is an engineering target, not an observation here. Neither matching latency nor the 120.54 ms local admission batch proves it. Wallet interaction, network RTT, signature generation and durable writes remain unmeasured.

Only an already funded channel or another explicit collateralized claim can upgrade rapid authorization into stronger pre-L1 execution protection. A bonded sequencer needs a non-overlapping obligation allocation, an objective breach predicate, evidence availability and a claim path. A signature plus a generic stake number does not supply these.

## 2. Concurrency: inventory as a set of spend rights

VERIFIED, X01: one cell, 100 competing distinct spends, one admission; 100 distinct cells, 100 admissions. Twenty independent roots each admitted five descendants before mining. A later block contained 197 accepted non-cellbase transactions: one surviving shared-cell spend, 100 independent spends, 95 surviving chained spends and one replacement. Parent and descendants can commit in the same block. This directly disproves the simplistic claim that a mutable CKB lane can execute at most one transition per block.

It does not remove causal dependencies. Replacing a root removed its five descendants in the experiment. A child cannot survive a parent whose output never exists. Multi-peer pool policies and propagation can disagree. Ancestor admission limits are node policy. The stable legacy config clamps the configured count to at least 1,000; our configured 1,000 admitted exactly 1,000 chain members and rejected member 1,001. An example TOML showing 25 is not the effective v0.210.0 limit.

A further source-level boundary matters: `load_header` obtains the creating header only for a committed input/dependency whose header is included in `header_deps`; unconfirmed pool cells have no creation header and return missing. DERIVED: a lane contract that requires each input's creation header for pricing or expiry cannot automatically inherit X01's unconfirmed chaining result. This is a real coupling between clock design and speed. The stable SinceVerifier similarly rejects relative-since evaluation when input commitment metadata is absent. Remove a creation-header requirement only if another safe authorization mechanism replaces it; do not weaken pricing safety merely to admit chains.

### Inventory allocator

Represent a logical maker balance as independently spendable roots plus pending change graphs. Classify each amount as confirmed/free, reserved/unsigned, signed/pending, committed/unconfirmed, risk-final, or refund-locked. An outpoint is allocated at most once for incompatible transactions. A serializable local allocator or a consensus-backed maker service can enforce this for an honest maker; independent clients cannot treat that database as cryptographic exclusivity.

Use small dedicated cells for concurrent firm fills; use bounded chains for low-risk repeated activity; batch compatible orders when netting is available. Cap dependency depth by failure exposure, not merely the node's ancestor ceiling. Reserve fees and required output capacity separately. Never put all transaction fees through one shared fee input: that recreates contention even when the trading inventory is sharded.

| Construction for 100 fills | Independent roots | Pending failure domain | Main tradeoff |
|---|---:|---|---|
| Conflicting fills of one root | 1 | Mutually exclusive fills | Cannot execute all as submitted |
| One 100-link chain | 1 | Up to all descendants | Minimal root fragmentation, large dependency risk |
| Twenty five-link lanes | 20 | Up to five per lane | Moderate fragmentation and inherited failures |
| One root per fill | 100 | One fill, absent shared dependencies | More capacity, preprocessing and stranded change |
| Compatible batch | Depends on inputs | Whole batch | Netting savings, signing/invalid-input blast radius |

DERIVED: 100 traders can interact concurrently through 100 funded roots or through bounded parallel lanes, provided total usable inventory, fees and capacity cover the fills. X01 establishes that pool admission supports those forms, not that realistic exchange contracts sustain any particular TPS.

### Capacity and bottlenecks after sharding

Occupied capacity is a capital reservation, not the transaction fee. Compute it from the actual cell fields. For a conventional 20-byte-argument CKB lock, empty data and no type, the field-byte total is 8 + 32 + 1 + 20 = 61 CKB. A token cell with that lock, a type script with 32-byte arguments and 16 data bytes totals 8 + 53 + 65 + 16 = 142 CKB. A custom escrow needs its own calculation. There is no universal 61-CKB escrow assumption.

For CKB inventory much larger than that minimum, occupied capacity is already inside the balance. Do not add it again as separate capital. Quote-token cells require CKB backing in addition to their token amount. One hundred conventional token cells reserve 14,200 CKB, versus 2,840 for twenty. These are illustrative structures, not deployed exchange cell measurements.

Once conflicts are partitioned, limits move to script cycles, transaction and block bytes, signature parsing, proposal capacity, pool memory, propagation and the inventory allocator. Mainnet limits must be read from a current node's `get_consensus`; devnet's 10-billion-cycle cap is not a mainnet number. WO01 does not estimate realistic trades per block.

## 3. Stale prices: shorten the free option, do not rename it

A public fixed-price authorization backed by a spendable cell is an option until its invalidation is enforced. Cooperative off-chain quote updates do not erase old signatures. CKB `since` establishes not-before conditions; it does not by itself impose a not-after execution time. A transaction falling outside a proposal window can be proposed again. RPC pool expiry is also not consensus expiry.

VERIFIED, E07: Lean Oracle v2 is a current committee-signed pull-oracle implementation, described by its author as live on testnet, with mainnet audit/deployment pending. Source pin: `96916870d16cfc2b93dc731aa61e9411ba2c904d`. Its consumer helper checks identity, committee state and whether a price was published after a supplied lower bound. Its design explicitly assigns freshness to the consumer and notes that scripts cannot read now. We did not run its tests or verify its live feed operation.

DERIVED: comparing a signed price to an attacker-selected historical header can establish a relationship to that header, not freshness at eventual inclusion. X02 provides a counterexample: header time 100, price time 101, inclusion time 1,000; an anchor-relative five-unit check passes despite age 899. Monotonic per-lane prices prevent rollback below the lane's prior state, but do not force the lane to advance when everyone withholds updates. Multiple price cells reduce contention, while independent stale lanes remain a problem.

### Repairs with explicit limits

* Maker signs the exact final transaction last, after taker constraints and current inventory are checked. Maker broadcasts the released signature itself. This reduces the taker's withholding option; it does not prevent taker double-spending, miner censorship or reorganization after a hedge.
* Batch price discovery over a short request collection period, then final maker authorization. This removes serial queue advantage within the admitted batch, but not missing-order censorship or delayed inclusion.
* Use channel states so authorization immediately updates a funded enforceable balance. This changes the settlement domain and adds monitoring, funding and dispute obligations.
* Reserve price oracles for guardrails, settlement benchmarks or products that accept their trust model. Do not use an oracle as a substitute for executable quotes.
* If an absolute short expiry is indispensable, investigate new context/proof machinery or a channel protocol that enforces the relevant boundary. Do not pretend current `since` supplies it.

A maker's minimum spread must cover hedge costs, rebalancing, capital occupancy, failed-hedge unwind and adverse selection. X02 models Gaussian option exposure, with jumps deliberately excluded. It is a sensitivity model, not measured CKB volatility. A sudden 3% move on $10,000 of still-exercisable stale quotes can cost about $300 before offsets; a 30-bps fee cannot repair that.

## 4. Liquidity: use capital often without using it twice

An executable quote consumes inventory or a demonstrably funded claim. Advertising the same $10,000 to 100 takers does not produce $1 million of firm depth. Aggregate display must deduct reservations across all makers' endpoints, channel allocations and pending transactions.

A compact market can exploit: direct opposing flow, cross-venue hedging, reusable free inventory, smaller per-trade escrows, competitive makers and deferred net rebalancing. It cannot count an exchange deposit, an open hedge and an escrow claim as the same available asset. CEX funds can support hedging; they do not appear magically in a self-custodial settlement cell.

X02: sixty $100 buys and forty $100 sells have $10,000 gross notional and $2,000 net imbalance. Eighty percent reduction in external net inventory movement is possible only if the orders are compatible and actually settle. For 100 buys there is no such reduction. On two chains, unrelated conditional escrows are not a single atomic netted transaction. Netting must preserve per-customer claims through a failure.

VERIFIED, E11: iCKB represents a protocol claim backed by DAO deposits, with low-liquidity exit procedures. DERIVED: until a conversion produces usable CKB, it belongs in a reserve tier with a maturity/liquidity haircut, not in executable CKB depth. Do not rely on guaranteed instant redemption or treat DAO yield as a free maker subsidy.

## 5. Native stablecoins elsewhere: separate delivery from bridging

Candidate D exchanges ownership of native assets using two escrows. It does not mint a representation of USDC on CKB. A solver owns CKB on CKB and USDC on a supported external chain. The user owns the opposite source asset. Each amount moves to a trade-specific conditional lock on its home chain. A secret connects the two claims; independent monitoring establishes the conditions before disclosure.

For a user selling CKB: user funds CKB source escrow with the longer recovery horizon; maker waits for its defined CKB risk-finality threshold; maker funds USDC destination escrow with a shorter claim/refund schedule; user verifies finalized destination funding and exact terms; user claims USDC/reveals the secret; maker observes the preimage and claims CKB. User refunds CKB if the maker never funds, subject to the source contract's rules. The reverse direction swaps chain roles and must be evaluated independently.

The preimage proves knowledge of the secret. It does not prove final payment, honest pricing, correct destination or finality. Contract identifiers, amounts, recipient bindings, hash algorithm, chain IDs and deadlines must be checked before reveal. Read-only RPC claims are not payment proofs. Use independently validated inclusion/finality evidence or explicitly disclose the RPC trust assumption.

Timeout budget must include both chains' inclusion and finality tails, clock semantics, monitoring delay, network partitions and refund races. The CKB claim branch may remain valid after a refund becomes eligible unless the contract has an additional valid mechanism to exclude it. A timeout is not necessarily an automatic state transition. Claim-versus-refund safety needs executable contract tests in both directions. No finite timeout survives arbitrary stalls with guaranteed completion.

User offline recovery requires a watcher and backup, not the original relayer. Secret disclosure must not depend solely on a trusted coordinator. Watchers can be replaced, but liveness assumptions and transaction-fee reserves remain. USDC issuer freeze/blacklist risk survives self-custody and must not be mistaken for solver custody risk.

Existing liquidity on Solana or an EVM DEX is an input to solver sourcing, not an atomic direct extension of the CKB transaction. A solver must fund the native destination escrow and carry the hedge/rebalancing exposure. Start the verification with an EVM test deployment because general escrow contract semantics are straightforward to inspect; Arbitrum and Solana adapters still need chain-specific finality and contract reviews.

## 6. Existing infrastructure, narrowly verified

CoBuild supplies a composition model; the 2026 reference supplies inspectable contracts and fixtures. Lucent's public testnet description already combines independent order cells, matching and intended RFQ support. Merely proposing sharded RFQ is therefore insufficient differentiation. Fiber provides channels and swap primitives; its current CCH source discussion describes a fixed-rate wrapped-BTC/Lightning scope and multi-asset expansion work. General CKB/native-USDC execution must not be inferred from repository feature bullets. Perun has CKB contracts and generalized/cross-chain state-channel work. Its L2Trade repository is already a cross-chain trading prototype on Ethereum/Solana. A channel order book is not a new discovery.

Kaze's official account, directly retrieved as public HTML, announced CKB-USDT/USDC swaps on 16 October and native USDC support on Solana/Stellar on 23 October (E10). That verifies announcements, not its swap protocol, quotes, actual execution, custody path or atomicity. Its website supplies no inspected internal mechanism. Do not reverse-engineer an imagined implementation from self-custody marketing.

Historical Vortx, CKBSwap, Nervina, Omiga and bonding-curve work are relevant design context, not evidence of current executable liquidity. This work did not re-audit each project or rely on their failure to choose a design.

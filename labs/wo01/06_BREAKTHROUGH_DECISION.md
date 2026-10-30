# WO01: Founder decision

**Classification: PROMISING BUT UNPROVEN.**

The strongest current business architecture is **a competitive native cross-chain delivery market using segregated maker inventory and independently recoverable per-trade settlement** (candidate D). Native CKB stays on CKB; native USDC stays on a supported external chain. Customers exchange ownership through verified conditional escrows, rather than funding a permanent CKB stablecoin pool or accepting a new wrapped asset.

This is not yet a breakthrough, a proven exchange business or a demonstrated CEX substitute. The meaningful WO01 result is a narrower opportunity and several experimentally established design boundaries. There is enough evidence to justify one decisive settlement experiment, not a full product build.

## 1. Strongest architecture discovered

D connects native CKB holders with competing makers that already maintain two-sided inventory. Quote discovery is off chain; final authorization binds exact amounts, recipients, fees and recovery conditions. Inventory is allocated through independent cells/escrows, with no globally contested pool or shared fee input. Each accepted trade has its own recovery package. Maker inventory remains separate from other makers and from the operator.

The proposed product is direct native-asset delivery from wallet to wallet. It complements external exchanges as hedge/rebalancing venues. It does not attempt to replace Binance's entire matching engine or turn CKB block commitment into sub-second finality.

## 2. Why it could materially outperform prior CKB approaches

DERIVED: independently allocated inputs remove shared-pool input contention for independent fills. X01 verifies the relevant node behavior. Native stablecoin delivery avoids requiring all quote liquidity to be represented as a CKB token. Maker-last authorization reduces the period during which a freely changeable quote becomes an exercisable old authorization. Competitive all-in quotes can expose pricing and recovery differences rather than hiding them in a pool curve.

HYPOTHESIS: these properties jointly produce a materially better customer conversion journey. No measured delivered-price advantage, funding latency advantage or maker profitability has yet established that result. A sharded RFQ screen alone would not beat Lucent's published direction. A cross-chain escrow alone would not beat a mature solver network.

## 3. Strongest alternative

**Candidate C, competitive portfolio-channel sessions**, is the strongest path to rapid repeated funded execution. It could materially shorten per-fill economic exposure and amortize L1 operations. It deserves continued research even though D is easier to validate. The unsolved work is establishing the exact supported cross-chain protocol, unilateral-exit safety, withheld-signature handling, capital reassignment and enough repeat demand to overcome funding/close friction.

Perun's existing channel work and L2Trade prototype mean channel trading is not our invention. If a supported correct implementation already supplies the desired native CKB/stablecoin behavior at good capital utilization, adapting it may be stronger than inventing another protocol. WO01 did not establish that fact. The next decision should remain open to C winning.

Candidate B is the best complementary capital-efficiency mechanism for compatible CKB-native opposing orders. Its netting savings should be applied only in the settlement domains where they are real.

## 4. New infrastructure required

For D: a CKB escrow contract and independent recovery client; external-chain escrow adapter and finalized funding verification; a solver quote/acceptance protocol; a reservation allocator that tracks all in-flight obligations; durable secret/signature recovery; independent watchers; route-comparison and P&L instrumentation. None is a production deliverable in WO01.

Prefer a minimal exact-transaction path before generic OTX for the isolated escrow proof. Adopt OTX only after measuring a genuine composition benefit and confirming wallet/contract compatibility. For repeated sessions, C requires substantially more protocol work: funded multi-asset channel adjudication, safe cross-chain state updates and collateral reallocation.

A custom L2 is not required to test D. F's proof system, data availability and escape machinery are unjustified by present demand evidence, but preserved as an ambitious execution-domain alternative rather than dismissed as impossible.

## 5. Most dangerous technical problem

**Safe claim/refund behavior under asymmetric chain progress, stale state, withheld messages and near-timeout secret disclosure.**

CKB not-before conditions do not automatically provide a hard not-after claim deadline. Eligible refunds do not automatically consume cells. A preimage is not proof of finalized destination payment. Standard-looking HTLC diagrams can hide real claim/refund races, particularly when direction reverses. This needs executable contracts and recovery tests, not another high-level diagram.

C has a related but distinct dangerous problem: one consistent unilateral outcome across chain-specific channel adjudicators, including withheld final signatures and late state revelation. A common version field is not sufficient proof.

## 6. Most dangerous economic problem

**Delivered price may fail after hedge cost, selective abort, capital occupancy and rebalancing.**

In one current Binance spot snapshot, modeled $1,000 execution costs were approximately 15.90–21.67 bps from midpoint before account fees and delivery. Adding an illustrative 10-bps hedge fee already consumes approximately 25.90–31.67 bps. Our scenario with small adverse selection and capital/other costs needs roughly 37–43 bps before fixed overhead and maker profit. Worse adverse selection can push that much higher.

Avoiding custody can justify a premium for some customers; willingness to pay is unverified. A maker can use CEX inventory to hedge, but a CEX's liquidity is not free settlement capital in a customer escrow. A venue can be useful yet too small to sustain a standalone business.

## 7. Strongest competitor

The strongest product benchmark is an established wallet/aggregator offering a native CKB route through multiple professional solvers, backed by a mature escrow and recovery system. 1inch Fusion+ is a strong architecture benchmark, although CKB coverage was not established here. Binance plus stablecoin withdrawal is the funded-trader benchmark. Kaze has already announced CKB/stablecoin swaps, so there is no justified claim that this customer journey is vacant. Its mechanism, quotes and recovery remain unverified.

The strongest alternative execution architecture is a correct funded portfolio-channel system. We must compare against its best plausible version, not against naive pool contention or a broken prototype.

## 8. What was actually verified

* Official stable CKB v0.210.0 was downloaded and executed on an isolated custom devnet. Stable source and current develop metadata were separately captured.
* One hundred conflicting spends of one cell produced one pool admission in the tested fee policy. One hundred independent spends all entered the pool.
* Twenty independent lanes each admitted five unconfirmed chained transitions before mining. Surviving dependencies and independent transactions committed together.
* A higher-fee replacement invalidated all five pending descendants in its lane. Node admission is not execution finality.
* A 1,000-member unconfirmed chain was admitted; member 1,001 was rejected by the configured/effective ancestor limit. This is tested pool policy, not throughput.
* The proposal/commit sequence was checked against actual block bodies. Consensus proposal-window source was inspected.
* Current OTX reference docs, Lean Oracle consumer source and Perun/Fiber repository structures/docs were inspected at captured revisions. Their entire feature sets, deployment health and audits were not reproduced.
* Kaze's official public account HTML contained the dated swap/stablecoin announcements. No internal mechanism or live swap was verified.
* Official Binance public spot depth and ticker were retrieved; snapshot VWAP and sensitivity models were executed and saved.

## 9. What remains hypothetical or blocked

No secure exchange settlement contract, OTX cycle benchmark, cross-chain swap, channel swap, quote-expiry guarantee, independent forced exit, multi-peer congestion test or mainnet latency benchmark was executed. No maker profits, customer demand, native quote depth, business moat or defensible pricing advantage were verified. No sub-second settlement/finality was demonstrated.

The local pool probe used an always-success program. It proves the specific cell/dependency behavior, not that a production transaction carrying 100 signatures and real scripts fits a block or settles with the measured local timing. These limitations materially constrain the verdict.

## 10. Next decisive engineering experiment: WO02, conditional proposal only

**Build a minimal two-way native CKB/test-stablecoin escrow exchange on isolated CKB and EVM development chains, then destroy the coordinator at every state boundary.** This is a bounded protocol experiment, not a full trading product.

Before implementation, write a state-transition table with exact authorization, preimage, claim/refund and chain-time semantics for both directions. Use real CKB script verification and an external-chain test token. No real funds or production deployments. Pin binaries, scripts, compiler versions and asset identities. Use independent user/maker wallets and separate watcher/recovery processes.

Required cases: successful two-way settlement; maker disappears before destination funding; user disappears before/after secret disclosure; response lost after source/destination funding and claims; old/malformed/wrong-recipient escrow; competing spend; parent replacement; fees exhausted; chain stalls of increasing bounded duration; reorganization before each disclosure threshold; claims and refunds at every legal boundary. Reverse direction is a separate test family.

Acceptance: under explicitly bounded outage/finality assumptions, every run either delivers the authorized asset amounts or yields a complete independently executable recovery path, with fees and worst-case capital occupancy accounted for. No false completed/guaranteed labels. Unknown outcomes reconcile without creating another trade. Recovery must succeed after the matcher database is unavailable, using a second client and the preserved package. Produce counterexamples for any failed guarantee rather than silently relaxing the claim.

Measure actual bytes/cycles, on-chain funding/claim/refund stages, capital occupancy, required headroom, client signing work and abort-option exposure. Do not require an arbitrary sub-second L1 result. Then compare its measured delivered economics against firm rival routes and against a scoped C experiment. If safe D needs uncompetitive timeouts/spreads, prioritize C's native cross-chain session proof or change the customer job.

## Explicit continuity check

Are we repeating Remit or Sluice? **The strategic repetition risk is real if the pool probe becomes our stopping point.** I read the current `/Hackathons/HACKATHON_OPERATING_RULES(1).md` record. Remit established a working execution primitive without a sufficiently strong complete product; Sluice established a real liquidity proof and then concentrated on interfaces/packaging while deeper protocol and economic directions remained. Those are the relevant comparisons, not an invented claim that either was a cross-chain trading router.

WO01's concurrency proof is therefore retained as a fallback fact, not promoted into competitiveness. The portfolio-channel ceiling remains a live alternative, the escrow option/refund problems are unresolved, and business superiority is not awarded. The next experiment targets the deeper safety/economic mechanism, not another SDK or polished trading screen. This is a research deliverable, not a product scope freeze.

This is not a hackathon or grant submission; no prize classification is applicable.

## Decision

Proceed to the bounded settlement/recovery experiment if continuing this opportunity. Do not start a full exchange, recruit passive liquidity, announce instant native-stablecoin execution or make public commitments from this evidence.

The important engineering discovery is that CKB's Cell Model supports more flexible concurrency than the one-pool/one-transition-per-block caricature: independent roots, bounded chains and atomic batches can be combined. The important limit is that concurrency does not create commitment, liquidity or competitive economics. The strongest research path now attacks those harder boundaries directly.

**Final classification: PROMISING BUT UNPROVEN.** Evidence ledger: `evidence/EVIDENCE_LEDGER.md`. Reproduction: `experiments/reproduce.md`.

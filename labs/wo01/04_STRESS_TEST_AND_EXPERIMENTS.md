# WO01: Experiments, attacks and repair cycles

## Executed experiment X01: real CKB transaction-pool behavior

Environment: Linux x86_64, glibc 2.39; CKB `0.210.0 (2592ddf 2026-09-17)` official Linux release. Custom isolated devnet, Dummy PoW, no connected peers, full normal script verification of a bundled trivial always-success program. Manually generated blocks. RPC `send_transaction` used `passthrough`, which skips output-policy validation, not consensus/script verification. Trading signatures, OTX, xUDT and production escrow scripts were not present. This experiment tests cell conflicts, dependency admission, replacement and commitment, not secure trading.

Configuration: localhost RPC 18114, P2P localhost 18115, enabled IntegrationTest RPC only for the isolated network; configured max ancestors 1,000; standard generated min fee rate 1,000 shannons/kB and default RBF policy. Devnet cellbase maturity zero, block cycle limit 10,000,000,000 and short development epochs. Exact `ckb.toml`, `dev.toml`, program bytes and reproduction instructions accompany the script. No public testnet transaction or real funds were used.

Method: issue a large genesis test cell, split into 130 independent 100,000-CKB test cells plus change, commit the split, then submit the scenarios below. 20 Python worker threads issued concurrent calls for each 100-request scenario. Individual fees were 10,000 shannons, increasing by one shannon in the shared conflict test so every transaction was distinct but below a successful RBF increment. Twenty lanes then each received five sequential descendants, with no mining during construction. A one-million-shannon replacement targeted one lane root. Four blocks were generated; a separate root then received a long chain until first rejection.

| Scenario | Observed result | Interpretation |
|---|---|---|
| 100 distinct spends, same input | 1 admitted, 99 rejected | One conflicting spend survives this fee policy |
| 100 spends, separate inputs | 100 admitted | No shared-input barrier to admission |
| 20 independent five-link lanes | All 100 admitted before mining | Unconfirmed change can feed subsequent transactions |
| Root replaced with higher fee | Replacement admitted; all five lane transactions rejected | Failure propagates through descendants |
| Commitment | Block 20 included 197 non-cellbase transactions | Independent fills and surviving chains committed together |
| Long dependency chain | First 1,000 admitted; member 1,001 rejected for ancestors | Effective tested policy boundary, not consensus capacity |

Shared scenario elapsed 116.56 ms; independent scenario 120.54 ms. These are single-host batch admission timings with a trivial lock and no peers. They are deliberately not converted into TPS, matching latency or finality. No latency percentiles or statistical confidence intervals are justified by one run.

Block sequence from preserved block bodies: block 17 had no proposals; block 18 had 197 proposals; block 19 had no non-cellbase transactions; block 20 contained all 197 surviving transactions. Proposal-distance eligibility is consistent with commitment at 18 + 2. RPC's pending/proposed labels are not a substitute for inspecting the proposal block itself.

Artifacts: `evidence/node-results.json`, `node-rpc-transcript.json`, `node-commit-blocks.json`, `node-run.log`; `experiments/node_probe.py`. The script starts and terminates its own node. The supplementary block-body read restarted the same database and shut it down after reading. No local node was left running.

## Executed experiment X02: economic and adversarial models

`experiments/market_models.py` uses Python standard library, seed 1001 and 200,000 normal-return samples per volatility/delay pair. It also calculates the closed-form expected positive payoff, so simulation estimates can be checked against an independent analytic value. Assumed daily volatility values 4%, 8% and 16% are scenarios, not estimates of CKB volatility. Returns have zero mean, Gaussian tails and no jumps. Costs and fees are omitted from the option calculation.

A taker can exercise a stale ask only if the later reference price is above the old ask. For spread `s` and normal return `r`, maker adverse-selection loss per quote opportunity is `E[max(r-s,0)]`. This is not loss per filled trade and must not be multiplied by an unrelated realized volume without accounting for exercise selection.

At assumed 8% daily volatility and a 10-bps ask spread:

| Holding interval | Simulated option loss, bps per opportunity | Analytic bps |
|---|---:|---:|
| 1 second | 0.0001 | 0.0001 |
| 30 seconds | 2.2003 | 2.2372 |
| 120 seconds | 7.5532 | 7.5570 |
| 600 seconds | 21.8804 | 21.8948 |

DERIVED under those assumptions: longer exercisable authorizations need larger spreads or another party paying the option cost. This does not prove the maker-last design's post-authorization loss is equal to these values. That design changes who can withhold and requires a separate counterparty/default model.

The same model file executes a stale-header counterexample and a timeout-budget example. With destination deadline 600, source deadline 900, reveal at 599, source claim latency 60 and source stall 400, the source claim misses its modeled refund threshold. Without the stall it succeeds. These are dimensionless scenario seconds and not deployable CKB deadline recommendations; real `since`/clock semantics must replace the simplified model.

Netting and capital occupancy models are in `05_BUSINESS_AND_LIQUIDITY.md`. Re-run the script to regenerate the JSON. It contains no network calls and spends no funds.

## Executed observation X03: live rival depth

Retrieved Binance's official market-data-only endpoint on 29 October 2026, around 21:58 UTC. Raw depth contains lastUpdateId 3392273170, top 100 levels for CKBUSDT. The accompanying 24-hour ticker closed at Unix ms 1793311094201. These are separate requests, not an atomically synchronized feed. All pricing calculations use the one depth snapshot, not ticker last price.

The direct api.binance.com calls returned HTTP 451. Binance's documented public-data domain data-api.binance.vision returned the market data. This is the official documented read-only route, not evidence of account access or trade execution. No API credentials were used. Snapshot-based hypothetical VWAP is not a guaranteed executable fill.

## Two full strengthen, break, repair, recompare cycles: D

### D cycle 1: price commitment and selective abort

STRENGTHEN: independent maker inventory; competitive all-in quote; user source escrow and maker destination escrow; no wrapped assets; client verifies both sides; maker signs/broadcasts only after checking current conditions.

BREAK, market maker and malicious taker: source funding plus destination setup creates a period in which the secret holder can complete favorable trades and abandon unfavorable ones. Maker hedging early risks an orphaned hedge; hedging late risks price movement. Many Sybil requests can occupy inventory. A short UI quote timer does not invalidate a released transaction or escrow. Tight deadlines reduce safety headroom.

REPAIR: do not release transferable firm authorizations before binding the accepted trade; use one funded reservation per exact allocation; limit outstanding per-client and aggregate exposure; price occupancy and adverse selection into the quote; use smaller independent trades; require source funding before scarce destination capital is committed. Investigate a user-funded reservation premium, but only if its forfeiture and refund conditions are objectively enforceable under the actual clocks. No default claim that slashing solves absence-of-payment proof.

RECOMPARE: repaired D reduces casual quote abuse but retains the cross-chain option. C can shorten per-fill exposure after channel funding, at a cost of session lock-in. If D's measured required spread exceeds the delivered rival route, the product has no price case. Safety survives by declining a trade, not by guaranteeing liquidity.

### D cycle 2: coordinator failure and deadline edges

STRENGTHEN: publish script hashes and full recovery packages, run several watchers, allow users to claim/refund themselves, independently validate destination funding and halt quoting when finality/fee tails widen.

BREAK, security researcher and skeptical customer: relayer reveals a secret after seeing an unfinalized or wrong-recipient escrow; client closes after funding; a chain stalls near refund; CKB preimage spend and eligible refund race; issuer freezes destination USDC; operator's database disappears. Unrelated escrows cannot be rescued merely by picking a new solver. A customer may have money safe but unusable for hours.

REPAIR: local verification before disclosure; pin recipient/asset/chain/escrow identity; retain secrets and signed claims before broadcast; enforce directional timeout policies with sufficient measured headroom; independent watcher backups; test actual claim/refund races in both directions; display worst-case lockup before funding. Recoverability is conditional on chain progress, available data and timely observation. Refuse fresh trades when those assumptions are not met. A freeze is asset risk, not something a new bridge should disguise.

RECOMPARE: D retains the clearest one-off native-stablecoin journey. A lacks the quote-asset reach; C may offer better repeat execution but has a harder recovery proof. A polished demo without the failure cases would not establish D's advantage. D remains PROMISING BUT UNPROVEN.

## Two full cycles: C

### C cycle 1: native cross-chain state consistency

STRENGTHEN: both asset allocations are in one signed portfolio state; common replay domain/version; funded chain-specific adjudicators; independent dispute submissions and watchers.

BREAK, exchange architect: separately updating two contracts is not atomic. A final signer can withhold a fully signed state. One party may attempt old-state withdrawal on one chain while using a favorable new state on the other, exploiting different dispute/finality horizons. Common encoding and two signatures alone are insufficient evidence of a correct complete protocol.

REPAIR: select an existing formally specified cross-chain channel construction whose unilateral-exit semantics cover this exact failure, then test its current implementation; otherwise design a conditional pending-update/reveal protocol with explicit dispute coordination and prove it under bounded outage assumptions. Store every released proposal/signature and stop new updates when either chain enters dispute. That monitoring rule alone is not accepted as the proof: pending/withheld signatures must be covered. Conservative alternative: same-chain dual-asset channels and separate cross-chain entry/exit.

RECOMPARE: channel trading remains the only shortlisted path to fast funded repeated execution, but D has a simpler independently inspectable per-trade recovery model. Do not call C superior until asymmetric exits and withheld signatures are covered. Perun's existing research/prototypes are reusable evidence, not proof WO01 has reproduced the desired variant.

### C cycle 2: maker mobility and utilization

STRENGTHEN: virtual-channel routing, multiple maker sessions, a maker inventory view aggregated across funded allocations and separate hubs.

BREAK, LP and competing founder: the customer cannot accept the best maker if capital is locked with another. Funding every maker duplicates capital needs. A virtual channel through one heavily collateralized hub moves contention and insolvency risk to that hub's allocation management. A user who trades once pays setup/close costs with no amortization. A custodian can match the screen experience with fewer steps.

REPAIR: compete makers before session creation; allow only funded executable routes; bounded session sizes; safe cooperative reallocation; several independent hubs; session fees that disclose funding and forced-close costs. Measure the number of repeat trades required to beat D. Reject unbacked aggregate balances and instant maker-switching claims without a safe collateral-transfer path.

RECOMPARE: repaired C may win for frequent traders with stable counterparties. D remains stronger for occasional wallet conversion. The frontier worth funding in research is safe capital reassignment plus unilateral exit, not another channel order book. C remains PROMISING BUT UNPROVEN rather than being abandoned because it requires infrastructure.

## Two full cycles: B

### B cycle 1: netting without hidden custody

STRENGTHEN: signed bounded intents; optimal residual sourcing; atomic per-transaction delivery; uniform directed prices as an auction policy; OTX assembly and conflict-aware partitioning.

BREAK, malicious solver: exclude a better order, route through related maker inventory, claim more surplus, reuse one input across competing solutions or make one customer's invalid input spoil everyone. A contract cannot inspect an off-chain order it never received.

REPAIR: multi-solver quote discovery, signed admitted-order receipts, locally verifiable per-user minima, distinct output attribution, bounded batches and independent partitions, with external individual-route benchmarks. Fairness rules that depend on hidden competition are monitored operating rules unless cryptographically proven; do not label them consensus guarantees.

RECOMPARE: B beats A on capital only when opposite flow and composition savings exceed batch delay and failure overhead. Sparse flow collapses toward A. D wins quote-asset reach; C wins repeated execution potential. Retain B as an optimization, not a precondition for the initial native-stablecoin route.

### B cycle 2: shared state creeps back in

STRENGTHEN: generic settlement script and one convenient global auction/fee/replay counter.

BREAK, performance engineer: the counter is now a globally contested cell; every settlement contends despite separate trader inputs. One large batch can exceed cycle/byte limits. Cancellation flags and one fee sponsor recreate hot roots. Even if chains admit, a bad parent spoils all descendants.

REPAIR: replay protection anchored in consumed outpoints; user-specific remainder identities; independent fee inputs; read-only pinned code dependencies; no mutable auction root in the critical settlement path. A per-partition settlement marker is permitted only if it is not shared between independent transactions. Set bounded batch size from actual contract benchmarks, not X01's trivial-lock batch.

RECOMPARE: the repair fits the Cell Model and preserves independent settlement. It sacrifices universal global sequencing and does not prove canonical batch fairness. Its useful novelty is a disciplined no-global-mutable-state design, but existing CoBuild/solver research makes broad novelty claims unjustified.

## Remaining attack perspectives

| Attacker or evaluator | Strongest unresolved objection | Required evidence |
|---|---|---|
| HFT maker | Our fill is an option on their inventory | Measured hedge/unwind P&L and option budget |
| Malicious taker | Capital griefing and near-timeout claims | Contract-level adversarial state machine tests |
| Security researcher | Cross-chain reorgs and asymmetric channel exits | Correctness argument plus failure injection |
| Passive LP | Strategy loss hidden behind fee APY | Segregated realized P&L and drawdowns |
| Skeptical customer | Binance is simpler or cheaper | Executable all-in route comparisons and repeat use |
| Competing founder | Existing wallet can add our route | Distribution contracts or measurable route/recovery superiority |
| Exchange architect | Shared fee/nonce/oracle root restores contention | Full input dependency graph and realistic settlement test |

## Preserved rejected shortcuts

A single RFQ maker cell has the same input conflict as a pool. A 1,000-deep pending chain exchanges conflicts for inherited failure and is not an execution guarantee. Passive oracle-pegged pools do not obtain current-time freshness for free. iCKB does not create instantly available CKB reserve. A bonding curve cannot manufacture demand for CKB or stablecoin inventory. A generic slashing bond cannot prove absence of payment without an enforceable deadline/evidence protocol. A rollup with unavailable state data is not independently recoverable. A naive two-ledger cross-chain channel update is not an atomic swap. These rejections concern mechanisms, not the feasibility of every stronger repaired design.

## Unexecuted reproducible tests

| Test | Exact scope and observations to record | Status |
|---|---|---|
| Realistic A/B settlement | Build pinned CoBuild contracts; 1/10/20/100 independent secp/OTX intents; xUDT conservation; output theft, fee inflation, wrong asset, partial-fill/replay negatives; record transaction bytes, cycles, dependencies, node admission and commit | BLOCKED in this run: no installed Rust/CKB contract build toolchain; not attempted as a binary benchmark |
| Multi-peer pools | Three v0.210.0 dev nodes, competing broadcasts/fee policies, parent withholding and reorg; capture each node's status and inclusion | UNVERIFIED, specified |
| Source/destination escrow | CKB devnet plus local EVM USDC test token; both directions; fund/claim/refund exact scripts; kill coordinator after each send; claim/refund at every boundary; hold/reorder messages; fee starvation and bounded chain stalls | UNVERIFIED, next decisive engineering test |
| Channel consistency | Pin supported Perun cross-chain contracts/backend; two chains; withhold last signature, close old state on either side, reveal new state at every dispute boundary, restore client on another machine | UNVERIFIED, parallel decision alternative for a later work order |
| Mainnet latency | Read-only observed proposal/commit/finality intervals across current transactions and congestion regimes; no test spending; clock source and sample selection documented | NOT RUN; no mainnet latency claim |
| Forced recovery | Wipe matcher DB after funding; second client rebuilds from package and independent chain data; correct final ownership or refunds without coordinator calls | UNVERIFIED, mandatory acceptance condition for D/C |

These are test specifications, not tests passed. No production deployment or full product code was created.

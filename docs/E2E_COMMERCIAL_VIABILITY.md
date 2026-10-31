# WO04-E2E: commercial gate, recoverable intents and finality authority

Audit date: **31 October 2026** (Africa/Lagos; raw retrieval timestamps are UTC).
Baseline: `7771f6c73fcebf6777e4d4f9c3b562eb797ecc36`, branch
`wo04-e2a-finality`, existing draft PR #2. Historical labs and evidence are preserved.
No public deployment, real assets, new rollup verifier, generalized BLS verifier or ZK system.

**Decision: UNPROVEN for Ethereum L1, Base, Arbitrum and the Linea validity-rollup
candidate. No route qualifies as PROCEED. Freeze further protocol expansion.**
The engineering mechanism does not establish an executable CKB liquidity path, customer
willingness to pay, competitive price, production finality availability or positive
risk-adjusted margin. Missing evidence is not a cheap input or a commercial pass.
A cost model alone cannot justify classifying a route as commercially REJECT either:
without executable quotes and market observations that would overstate our evidence.
Reject deploying these unchanged private-Capella binaries commercially.

## 1. Recovery: bounded implementation and evidence

The new lab is `labs/wo04-e2e-viability/`. It preserves P1A's contracts byte for byte.
The only order-availability change is a **versioned funding witness record**, inserted
before the standard CKB SDK signing call. `WitnessArgs.lock` still contains the ordinary
65-byte secp256k1 signature; `input_type` is absent; `output_type` contains:

```
CKBREC01 [8 bytes] || count:uint32LE ||
  (output_index:uint32LE || canonical_base_terms:536 bytes) * count
```

Indices must be unique and strictly increasing; count is 1..64 and lengths exact.
No optional encodings or unknown versions are accepted. This first profile permits
one standard funding input/group and exactly one WitnessArgs; it does not generalize
funding signing layouts or enable settlement batching. Two identical base orders can
share a funding transaction, but have different actual output indices and Ethereum IDs.

The independent `recover.cjs` process receives **only the funded OutPoint, RPC endpoint
and public chain/authority configuration**. It fetches the committed transaction,
canonical block and live cell, recomputes the raw transaction hash, selects the indexed
record, verifies every included record's actual output commitment, validates canonical
ABI, chain identities, registry, principal and fee reserve, and reconstructs the full
Ethereum order ID from the actual OutPoint. It separately reconstructs CKB sighash-all,
recovers the funding signer and checks the spent standard secp256k1 lock. No fixture
private key or original local order package is needed by this process.

The funding witness is excluded from the raw transaction hash, so there is no circular
funding identity. Standard signing covers it; block witness commitments preserve its
committed bytes. This recovery client relies on its **own validated canonical CKB RPC**;
it is not a CKB light client and cannot authenticate an arbitrary dishonest RPC merely
by checking self-consistent JSON. Adequate confirmations remain necessary.

Record payloads: single order **552 bytes**, twin orders **1,092 bytes**. The present
WitnessArgs profile adds four BytesOpt bytes: signed funding grows **472→1,028 bytes**
(single) and **593→1,689 bytes** (twins), confirmed by the actual signed native transactions below.
The live native node accepted exactly73CKB and rejected72.99999999CKB for the
unchanged32-byte cell. The fee policy remains the explicit fixture **0.01 CKB per transaction**, not an
assertion about mainnet minimum fees. At a hypothetical 1,000 shannons/kB fee rate,
additional 556/1,096 serialized bytes would add roughly 556/1,096 shannons before any
node-specific virtual-size/cycle policy; actual fee-market validation is still required.
Funded cells still have empty data, no type script and a 32-byte lock commitment:
**73 CKB occupied capacity**, principal **100 CKB**, total input **100.01 CKB**.
The principal includes occupied capacity; 73 CKB is not added to 100 CKB.

Actual run and replay results are recorded in the final execution addendum below.
Parser tests already execute 1,130 positive/boundary/rejection checks. Native signature
mutation and recovery failure cases are recorded separately from parser tests.

**Availability limits:** full funding transaction, witnesses, its input history and
canonical containing block must remain obtainable. The current client deliberately
fails if input history is missing, even if a funding record survives. CKB history
pruning, an unavailable RPC, censorship or loss of all archives can defeat recovery.
Maintain redundant validated archival endpoints, immutable block/transaction/witness
backups and an independent off-chain terms backup. Fresh process restart does not
prove universal historical RPC availability. Witness contents publicly expose all terms,
recipients, amounts, deadline and maker identity. This is not encrypted order recovery.
The no-type funding cell does not require this record by consensus: a broken/malicious
funding wallet can still sign absent or incompatible metadata. The producer constructs
and checks consistent commitments; independent recovery rejects inconsistency. This
is an opt-in wallet availability improvement, not a new universal on-chain guarantee.

## 2. Measured engineering inputs versus commercial assumptions

The machine-readable model and CSV contain every component for **$10, $50, $100 and
$1,000**, each at **N=1,5,10,50** trades/root: 64 cases, two explicit endpoint scenarios.
N=5/10/50 are **extrapolations**, not executed batching or demonstrated demand. P1A
executed two settlements sharing each of two roots. Every settlement remains a separate
single-input transaction; destination fills remain one per trade.

| Preserved benchmark | Relevant observations | Commercial interpretation |
|---|---|---|
| E1 | Mean direct settlement 442,403.5 cycles; checkpoint publish 2,064,388, read 49,594 | Controller-selected root; cannot substitute for authenticated finality cost |
| E2C | Fill 564,138 cycles/1,872 bytes; refund 624,993/2,021; intent 518 CKB; seven EVM receipts 1,884,025 gas | Historical always-success CKB wallet fixtures, not current standard signed funding |
| E2D-P0 | Signed funding 1,098 bytes; fill 1,038,250/2,503; refund 973,118/2,347; fill 85,534 gas; intent 642 CKB | Actual 1,000-CKB principal; removal of user EVM open and expiry transactions |
| P1A | Signed twin funding 593 bytes/single 472; fill 1,044,297/2,901; refund 1,011,230/2,830; fill 86,237–103,325 gas | Actual 100-CKB principal, **not $100**; controlled token quantities are not exchange prices |
| P1A shared root | 60,832,914 /60,831,584 cycles, 3,530 bytes; fixed fee 0.01 CKB | One update fee amortized N ways; cycles are not Ethereum-style gas charges |
| Committee setup | 17,424,406 cycles/25,590 bytes | Separate reusable certification, not a per-fill charge |

Actual fixture Ethereum gas prices/ETH fees do not establish public prices. The minimal
controlled token differs from production USDC; its proxy/storage, cold access, blacklist,
approval and recipient state can change gas. The model conservatively uses the measured
P1A fill range as an **unvalidated proxy**, not a production estimate. Maker approval
44,339 gas and contract deployment are separate setup costs, not hidden zeroes. They are
excluded from steady-state marginal fills and must be added to startup capital/payback.
Public deployment gas, CKB code deployment transactions and audit costs are unmeasured.

### Evidence gaps and source snapshots

`evidence/source-index.json` preserves URL, requested quote amount, retrieval timestamp,
HTTP result/error, body hash and response. Bounded read-only requests attempted:

- CoinGecko CKB/ETH spot, Binance CKB/USDT best bid/ask and 100-level order book,
  Coinbase ETH and Etherscan gas: **proxy CONNECT 403**. No observed spot, executable
  depth, source inventory entitlement, gas oracle reading or hedge price was obtained.
- Across suggested fees and LI.FI quote: Ethereum USDC→Base USDC, **100,000,000 raw
  six-decimal units ($100 only assuming USDC=$1)**. Both denied before receiving a quote.
  The LI.FI example address was a public dummy, not a customer or executable acceptance.
  No quotes at $10/$50/$1,000 were obtained. No native-CKB quote was obtained at any size.
- Circle USDC address page, Base/Arbitrum finality documentation and Linea finalization
  page: denied. The candidate known USDC deployments in `usdc-availability.json` are
  explicitly **not freshly authenticated issuer availability or live code checks**.
  Linea native USDC availability remains unconfirmed; bridged USDC must not be substituted.
- Public GitHub primary source succeeded. The pinned source index contains exact commits
  and file hashes. Some initially guessed raw paths returned 404; corrected Git tree
  inspection found the actual implementations. Failed responses remain preserved.

No account balances, exchange access, withdrawal permissions, customer orders, maker
commitments, historical orderbook backtest or executable hedge/withdrawal quote were
obtained. Candidate CKB/USDT centralized exchange access is a hypothesis until an actual
maker demonstrates inventory/rebalancing and destination-native-USDC withdrawals.

### Parameter ranges — HYPOTHETICAL, not observed market data

| Variable | Low endpoint | High endpoint | Evidence/limitation |
|---|---:|---:|---|
| CKB USD price | .001 | .02 | Sensitivity only; no spot fetched |
| ETH USD price | 1,500 | 6,000 | Sensitivity only |
| L1 effective fill gas price | .1 gwei | 50 gwei | Sensitivity only, includes execution-price assumption |
| Fill gas | 86,237 | 103,325 | Measured controlled-token P1A receipts; production validation missing |
| Base/Arbitrum fill all-in fee | $.001 | $.25 | Hypothesis, includes L1 data component; not a live gas estimate |
| Linea fill all-in fee | $.001 | $.50 | Hypothesis; no live proof/finalization fee measured |
| CKB funding + settlement | .02 CKB | .02 CKB | Two actual fixed .01 fixture fees; not minimum fee-market promise |
| Root update | .01 CKB /N | .01 CKB /N | Actual native transition fee, no executed N=50 batch |
| Proof per root + per trade | $.01/N + $.001 | $.50/N + $.05 | Unquoted service/computation budget; not actual invoice |
| Annual capital charge | 5% | 30% | Scenario, not maker borrowing rate |
| Source confirmation allowance | .5 min | 2 min | Hypothesis; no calibrated CKB reorg-loss model |
| L1 reimbursement | 15 min | 45 min | Scenario informed by 12-second slots,32-slot epochs and normal finality; not SLA |
| Base/Arbitrum secure reimbursement | 7 days | 8 days | Conditional fault-dispute resolution horizon; not fast sequencer finality |
| Linea reimbursement | 1 hour | 24 hours | Unverified proof-posting/finalization envelope, no current observed distribution |
| Hedge/spread/slippage allowance | 10 bps | 200 bps | Unknown actual depth/hedge fee; not demonstrated risk coverage |
| Additional source/reorg reserve | 0 bps | 100 bps | Sensitivity only; zero is an optimistic bound, never proof of no risk |
| Recurring operations | $500/month | $10,000/month | Hypothetical total dedicated operation budget, excluding protocol R&D |
| Assumed monthly users for fixed allocation | 10,000 | 100 | Scenarios, not measured adoption; these endpoints heavily affect table |

L1's mainnet-informed normal delay is not the private run's 3-second-slot latency.
Ethereum slots/epochs are confirmed in the pinned consensus-spec v1.5.0 source;
actual current fork compatibility, participation availability and outage tails remain
unproven. The current native verifier rejects more than two missing signers, even
where a standard Ethereum LC update is valid. P1A's real 342/512 capture demonstrated
this gap. We did not generalize BLS verification in E2E.

## 3. Cost and break-even matrix

`evidence/model.json` and `model.csv` include destination, CKB fees, root fees, proof,
inventory, hedge, risk sensitivity, root occupied capital and fixed-operation allocation
**separately for every route/notional/N**. Arithmetic is reproducible with `python src/model.py`.
The endpoints combine multiple uncertain variables; they are **not confidence intervals**.
The L2 rows also exclude unmeasured additional CKB verification costs for their
unimplemented L1-to-L2 finality/state-tree link. Proof budgets do not demonstrate
that link or cap its cost. These are conditional sensitivities, not full upper bounds.

For trade V, shared users N and year fraction t:

```
variable = destination_fee + .02*CKB_USD + .01*CKB_USD/N
         + proof_trade + proof_root/N + V*capital_rate*t
         + V*(hedge_bps + assumed_risk_bps)/10000 + root_carry + fee_reserve_carry
fixed_month = operations + (161562 + 868)*CKB_USD*capital_rate/12
all_in_route = variable + fixed_month/assumed_monthly_trades
customer_native_cost = .02*CKB_USD + fee_reserve_carry
maker_variable = variable - customer_native_cost
maker_all_in = all_in_route - customer_native_cost
maker_break_even_bps = 10000*maker_all_in/V
maker_net_at_quote_q_bps = V*q/10000 - maker_all_in
monthly_trades_to_cover_fixed = ceil(fixed_month/(V*q/10000-maker_variable))
```

The actual user pays funding fees and prepays the settlement reserve in addition
to principal. These .02CKB are included in route cost and shown separately as customer
fees; they are excluded from maker cash-cost break-even/net revenue. Root/proof/infra
charges are provisionally allocated to the maker/operator. The maker fronts approximately
V USDC in this sensitivity model (using full V rather than V less quote spread).
A customer’s effective total cost includes the quoted spread **plus** customer native
fees and any externally charged access/withdrawal fees.

If the denominator is nonpositive there is **no finite break-even volume** at that quote.
The JSON/CSV supplies q=25,50,100,200 bps, including null for this case. Fixed cost
must not be counted again when using the volume formula. Hedge allowance and explicit
risk reserve are not calibrated to catastrophic loss, proof outages or adverse selection.

The code-cell minimum is **161,562 CKB**, shared and reusable; it is not a per-trade burn.
Only its carrying cost enters the recurring allocation. State+certificate minima are
868 CKB. Each immutable retained root adds **282 CKB** locked capital; the actual
fixture overallocated state/cert/roots to1,000 CKB each. The model separately reports
new root locked capital and ongoing annual carrying cost. Its full first-year root-carry expense
is a planning horizon, **not a demonstrated deletion/reclamation time**: the current
root script prohibits spending roots, so retention capital accumulates indefinitely.
At1root/hour,282CKB per root locks2,470,320additionalCKB/year; at1root/day it locks
102,930CKB/year. Those are modeled publication schedules, not measured user demand.
Liquidity planning must fund that growth. No production code-cell reclaim path was
proven. Historical oversized genesis allocations and test-control cells are not a
commercial per-user capital requirement.

A $V order needs about V/CKB_USD CKB principal, plus reserve. The measured100CKB
trade would represent only $.10–$2 under this hypothetical price envelope, not any of
the $10–$1,000 rows. Even the $10 modeled principal exceeds73CKB throughout the
chosen envelope. The 73CKB minimum solves a technical size constraint, not profitability.

Maker all-in break-even bps (low–high; highly assumption-sensitive):

| Route | USD | N=1 break-even bps | N=5 | N=10 | N=50 |
|---|---:|---:|---:|---:|---:|
| Ethereum L1 | 10 | 98.1–134352.1 | 78.8–132598.4 | 76.4–132379.1 | 74.5–132203.8 |
| Ethereum L1 | 50 | 27.6–27110.6 | 23.8–26759.9 | 23.3–26716.0 | 22.9–26681.0 |
| Ethereum L1 | 100 | 18.8–13705.5 | 16.9–13530.1 | 16.7–13508.2 | 16.5–13490.6 |
| Ethereum L1 | 1000 | 10.9–1640.8 | 10.7–1623.2 | 10.7–1621.1 | 10.7–1619.3 |
| Base | 10 | 95.8–103670.1 | 76.5–101916.4 | 74.1–101697.1 | 72.1–101521.8 |
| Base | 50 | 34.8–21026.6 | 31.0–20675.9 | 30.5–20632.0 | 30.1–20597.0 |
| Base | 100 | 27.2–10696.2 | 25.3–10520.8 | 25.0–10498.9 | 24.8–10481.4 |
| Base | 1000 | 20.4–1398.8 | 20.2–1381.3 | 20.1–1379.1 | 20.1–1377.3 |
| Arbitrum | 10 | 95.8–103670.1 | 76.5–101916.4 | 74.1–101697.1 | 72.1–101521.8 |
| Arbitrum | 50 | 34.8–21026.6 | 31.0–20675.9 | 30.5–20632.0 | 30.1–20597.0 |
| Arbitrum | 100 | 27.2–10696.2 | 25.3–10520.8 | 25.0–10498.9 | 24.8–10481.4 |
| Arbitrum | 1000 | 20.4–1398.8 | 20.2–1381.3 | 20.1–1379.1 | 20.1–1377.3 |
| Linea validity | 10 | 86.2–103862.6 | 66.9–102108.8 | 64.5–101889.6 | 62.6–101714.2 |
| Linea validity | 50 | 25.3–21019.1 | 21.4–20668.3 | 21.0–20624.5 | 20.6–20589.4 |
| Linea validity | 100 | 17.7–10663.7 | 15.7–10488.3 | 15.5–10466.4 | 15.3–10448.8 |
| Linea validity | 1000 | 10.8–1343.8 | 10.6–1326.2 | 10.6–1324.0 | 10.6–1322.3 |

`evidence/net-revenue.md` gives a compact N=1/50 comparison at50bps; the full CSV includes
all four N and four quote scenarios. Under the optimistic envelope, $100 L1/N50 yields
about **$0.335 net per trade at50bps**, with about **1,299 trades/month** needed to cover
the assumed fixed costs at that contribution. At $10 the same quote has negative net
at assumed10,000 users/month; even the low-envelope contribution needs about19,583
monthly trades. These are arithmetic possibilities, not supported margins or demand.
The stressed envelope produces negative margins at50bps for every modeled route/size.
At ETH=$3,000 and10gwei alone,100,000gas costs$3:3,000bps on$10,600bps on$50,
300bps on$100 and30bps on$1,000, before inventory/operations/risk. Sharing roots does
**not** amortize that per-fill Ethereum transaction. Neither root N50 nor cheap private
ETH establishes a small-ticket L1 business.

## 4. Route authority, proof availability and rivals

| Route | Immediate user delivery | Safe maker reimbursement requirement | Verdict |
|---|---|---|---|
| Ethereum L1 | Maker fill inclusion; configurable confirmation risk | Working E2 predicate on supported fork/preset, finalized root and exact trade proof; current public fork/liveness not demonstrated | UNPROVEN |
| Base | Sequencer may deliver quickly | Authenticate finalized L1 plus the correct resolved fault-proof/withdrawal output and L2 execution/storage history; a posted claim is insufficient | UNPROVEN |
| Arbitrum | Sequencer may deliver quickly | Authenticate confirmed assertion/dispute resolution and exact L2 history via finalized L1; proposer assertion is insufficient | UNPROVEN |
| Linea validity candidate | Sequencer inclusion is not proven finality | Live proof-verified finalized state, approved verifier/proxy configuration, DA/history, L1 finality and correct L2 storage/header-time proof; none integrated here | UNPROVEN |

Linea was selected as a plausible validity-proven EVM candidate, **not an already
available backend**. At pinned repository commit
`60a8809e93d847da78fd5f6e08b263b3f59b5821`, current source is
[LinethRollupBase.sol](https://github.com/Consensys/linea-monorepo/blob/60a8809e93d847da78fd5f6e08b263b3f59b5821/contracts/src/rollup/LinethRollupBase.sol): `finalizeBlocks` requires a nonempty aggregated proof, matching
parent finalized root, configured verifier, public-input binding including chain
configuration and successful verifier response before the transaction can commit.
`stateRootHashes[endBlockNumber]` is updated inside that atomic proof-gated call.
This distinguishes verification from blob/data/commitment submission. Verifier setters,
proxy/deployment versions, pause controls and recovery operator authority also matter;
`LivenessRecovery.sol` grants operator role after its six-month condition, not a blanket
proof of ongoing availability. **Repository head is not proof of the currently deployed
implementation.** Live finalized transactions, proof calldata, verifier bytecode/storage,
actual delay/cost and proof RPC availability could not be fetched under the network
policy. Thus “actual current proof availability and cost” remain explicitly **unverified**.
We do not relabel missing data as a successful validation. Nor assume Linea's proven
state commitment and RPC proofs match E1's Keccak/RLP MPT format; the required schema,
state tree and execution timestamp bindings require independent validation.

The strongest plausible **native-CKB rival** is an existing centralized exchange:
confirmed CKB deposit → CKB/USDT sale → native-USDC withdrawal on an available network.
It may pool inventory and provide much cheaper amortized delivery, but introduces
custody, KYC, withdrawal policies and network support. Binance CKB/USDT book and market
access were attempted and denied; no current executable depth, withdrawal cost, account
access or matched quote was proven. This is a rival **hypothesis**, not a claimed price win.

For supported EVM routes, Across is a strong solver competitor. Pinned
[SpokePool.sol](https://github.com/across-protocol/contracts/blob/b1c4e86225420df5cb8d03042526622aca80fe61/contracts/spoke-pools/SpokePool.sol)
and [README](https://github.com/across-protocol/contracts/blob/b1c4e86225420df5cb8d03042526622aca80fe61/README.md) show fast relayer
fills, fill deadlines/replay accounting and later Merkle refund execution backed by
its HubPool process. Its admin/upgrade and reimbursement assumptions differ from our
native proof-gated payout. The attempted [Across quote](https://app.across.to/api/suggested-fees) /
[LI.FI quote](https://li.quest/v1/quote) $100 Ethereum-USDC→Base-USDC
requests are **not CKB quotes** and returned no pricing. We cannot claim better fees,
faster fills or risk-adjusted capital efficiency than either rival.

Our demonstrated product distinctions are a native CKB source cell, no customer
Ethereum transaction/gas, exact maker destination transfer, finalized proof-gated
source payout and expiry refund with no EVM expiry transaction. Users still pay CKB
funding fees and wait for proof/finality on refund. Makers still need confirmed source
OutPoint inspection: OutcomesV3 does **not** itself verify CKB funding/confirmations.
These properties may reduce custody/operator trust and onboarding steps, but no user
has demonstrated willingness to pay for them. They do not establish a competitive
advantage over a solver that already hides gas or an exchange that nets withdrawals.

## 5. Permanent finality authority and backend migration audit

Independent source/fixture inventory: `evidence/authority-audit.json`. P1A consumer code
hash is `0xf9181ef8888137c080adfdb0a52ed0347d0493466ec83fac18ce409fa2e1f4ec`.
It embeds publisher code hash
`0x5028bc182d02a5de629e5df443f0b932a6a9f38bd6fdf5451157019390a765e7`.
Funding pins that consumer via lock.code_hash/hash_type=data2 and SHA256 of all536bytes.

| Pinned item | Binding |
|---|---|
| Order domain/chain/contract | ABI0..95: protocol domain, chain ID1337 and exact OutcomesV3 address |
| Ethereum/registry/CKB identity | ABI96..191: genesis validator identity, unique registry script hash, CKB genesis |
| Trading terms | ABI192..479: reserved fundingId=0, maker/refund locks, asset, amount, user/maker, deadline, CKB principal |
| Code/freshness/fee | bytes480..535: exact EVM runtime code hash, minimum root version, minimum execution block, exact fee reserve |
| Unique settlement | Actual consumed OutPoint is added to the first480bytes for full order ID |
| Root role authority | Exact publisher code hash appears both in type.code_hash and root args' registry-code field; type hash role/arg layout enforced |
| Root lineage/version/header | Root args: registry32, publisher32, stateVersionLE8, finalizedBeaconRoot32 |
| Root data104 | SHA256(ethereumGenesis||registry)32, executionStateRoot32, blockNumberLE8, blockHash32 |
| Timestamp |720-byte proof binds beacon header to root args, execution header through body branch, exact state/block identities and timestamp |

The registry is Type-ID-derived using serialized first CellInput and output index,
plus authenticated state transition policy. Built-in uniqueness alone is not enough.
The bundled state/certificate/root roles enforce their separate argument sizes,
committee certificates, monotonicity and root publication. OutcomesV3's immutable
constructor pins ETH_GENESIS, REGISTRY and CKB_GENESIS; block.chainid and its own
address enter the order ID. Replacing the Outcomes address/code changes the committed
order. Its filled mapping is permanent and has no owner upgrade/cancel/clear path.

- **Normal continuation:** supported updates on the same registry publish new roots;
  existing immutable roots remain usable if they meet the order's minimums and the
  correct fill/absence-time predicate. Recovery records do not change authority.
- **Unsupported participation:** fail closed. A later supported update can sometimes
  skip an unsupported one while committee state remains available, as P1A recovered;
  loss of a necessary authenticated rotation can stop progress. No liveness guarantee.
- **Publisher stops:** old roots remain independently usable for fills already present.
  An unfilled trade cannot refund before an authenticated timestamp strictly past its
  deadline. There is no local-clock escape. Permanent publication failure may strand it.
- **Different verified backend:** **incompatible for already funded P1A intents**.
  Different code, registry or root-arg format fails the pinned consumer, even with the
  same104bytes. Equivalent root values do not establish equivalent authority.
- **EIP-8390-like change:** [retrieved EIP-8390](../labs/wo04-e2e-viability/evidence/sources/eip8390.body) is **Draft**, created2026-08-22, title
  “Remove the Sync Committee.” It proposes removing the LC protocol/domain/containers;
  this is neither an activated fork nor independently verified claims about replacement
  ZK feasibility. The existing publisher cannot simply change indices or accept such
  a backend. Historical pre-change roots do not authorize arbitrary future history.

### Smallest secure future version — DESIGN ONLY

A future intent version could pin one immutable **authority adapter** and a unique
continuity state, with an immutable, explicitly enumerated migration predicate. Backend
registration would require a cryptographically verified transition from the previously
finalized authority: old finalized checkpoint, chain/genesis/domain, active backend
program/verifier commitment and version, activation boundary, and a new-backend proof
that extends **that same canonical finalized history**. A mutable operator allowlist
or matching root bytes is insufficient. A full-consensus replacement needs authenticated
validator-set/state commitments and the correct fork transition, not a host-selected
checkpoint. Program/proof-system assumptions must be explicit in the funded version.

One unique state input/output serializes activation; old/new overlap must prove identical
boundary commitments, forbid conflicting roots/rollback/history replacement, and carry
versioned proof schema for finalized beacon/execution header and timestamp. Roots must
identify authority version and authenticated history interval, not a registry name alone.
Independent archival verifiers must reconstruct activation evidence. Proof withheld or
invalid means no new authority; keep prior valid roots and publish an explicit halted
state without granting payout powers to incomplete migration records.

This **cannot retrofit P1A**: its consumer has no adapter hook, mutable registry or
consensual re-lock branch. Already funded orders can migrate only after normal valid
settlement/refund, then voluntary funding under new terms/code. If the original backend
halts before the needed refund root, there is currently no demonstrated safe exit.
A future cooperative cancellation/migration would need to be authorized from inception
and bind the EVM fill history so it cannot double-claim. Not implemented here.

An immutable adapter need not change32-byte intent lock args or73CKB cell occupancy,
but new canonical terms, state/certificate cells, code and dependencies increase
transaction bytes/capital/cycles. Exact costs cannot be quoted before compilation and
node execution. No upgrade registry or adapter was deployed, and no P1A identities changed.

## 6. Product choice and highest-value next evidence

The strongest technically demonstrated architecture remains the existing narrow
CKB-funded intent → maker controlled-token delivery → authenticated finalized storage
proof → native CKB payout, with witness recovery and expiry absence proof. For commercial
candidacy it would need production fork/participation liveness, current native-USDC
behavior, confirmed CKB inventory/hedging and defensible maker pricing. An L2 might lower
execution gas but would add an unimplemented authenticated finality/storage layer and
possibly a much longer inventory cycle. It is not an evidence-supported replacement.

**Freeze protocol expansion.** One highest-value next experiment is a **read-only,
matched quote/inventory feasibility exercise** with an identifiable maker: obtain firm
CKB inventory/rebalancing terms, actual depth and withdrawal access, timestamped $10/50/
100/1,000 native-CKB→native-USDC offers, matched rival exchange/solver routes, gas/proof
availability and allowed quote spreads at realistic reimbursement tails. No public funds
or deployment needed. Proceed with more protocol engineering only if that evidence shows
a positive margin after risk, capital and operations and a user-valued advantage. If
makers cannot quote competitively or source inventory, stop/change direction rather than
build additional settlement backends.

## 7. Execution addendum

**VERIFIED fresh private execution:** `evidence/chain-recovery-final.json` records
13 committed native transactions,91 native rejections,24 injected recovery rejection
cases and four real100CKB settlements: two maker payouts and two independent user
refunds. Five actual Ethereum receipts used **1,673,904 gas** and
**1,673,904,028,972,139 wei** of disposable fixture ETH. Maker fills used103,337 and
86,249 gas; customer Ethereum nonce stayed0. These tiny gas differences from P1A
reflect this run's calldata/state, not a demonstrated production-USDC benchmark.
No Ethereum transaction was sent for either unfilled expiry/refund.

The new private checkpoint was
`0x2af071f59c69e908baf745e72d6a6cb46c874b30495b1c0b575f7283fb5fa5d6`.
Both updates had512actual participants; finalized slots were192 and221. This is a
fresh explicitly configured private chain, **not backend migration for existing P1A
funded orders**. The source contracts remain byte-identical to P1A; the private
bootstrap/time constants generate distinct program hashes from inception, preserved
in `evidence/devnet-binaries.json`. BLS, SSZ, account/storage proofs and timestamp
bindings were actually checked. Independent immutable-runtime reconstruction matches
both deployed OutcomesV3 code and its exact constructor input/funded code hash.

| Operation | Actual cycles | Signed transaction bytes | Actual fee CKB |
|---|---:|---:|---:|
| Twin funding with record |1,684,013|1,689|.01|
| D funding with record |1,656,921|1,028|.01|
| C funding with record |1,676,712|1,028|.01|
| Maker A payout |1,079,004|2,878|.01|
| Maker D payout |1,079,013|2,878|.01|
| Independent B refund |1,045,772|2,807|.01|
| Independent C refund |1,045,772|2,807|.01|
| First/later finality publication |60,832,914 /60,831,584|3,530 each|.01 each|

On a fresh node, otherwise identical signed funding **without** the recovery record
passed actual script verification at1,635,657 /1,638,089 /1,643,585cycles for twins/D/C,
versus the with-record costs above. Overheads were48,356 /18,832 /33,127cycles.
Signatures/digest values differ, so this is measured instance cost, not a universal
constant. Raw funding hashes are identical before/after embedding. Input minus output
capacity independently verifies the fee remains1,000,000shannons in each case. The
without-record alternatives cannot both be committed with the same spent input; they
were node-verified comparisons, while all with-record transactions actually committed.
The preserved P1A run separately supplies committed without-record benchmarks.

The whole13-transaction run paid.13fixtureCKB, including two capacity-only probes;
11core transactions paid.11. Four original reserves paid.04CKB for terminal settlement.
Exact73CKB capacity acceptance and one-shannon-below rejection passed under native
node validation. The 20-byte61CKB capacity control is not an adopted order format.

**Independent replay:** `chain-independent-01.json` reproduced all13hashes and cycles
on a fresh native node, recovered all four orders from actual committed witnesses in
separate restarted processes, and independently observed the four100CKB recipient
cells. It executed92native rejection cases (91captured plus the exact-one-witness
same-group attack) and40recovery rejection cases, including an actual closed local RPC
port and actual node `get_transaction` null for an unknown hash. Malformed/incompatible
witnesses, altered records, wrong outputs/chain and injected missing history fail.
The1130parser cases and additional four saved-actual-RPC strict recovery cases pass.

The live interruption is preserved rather than erased: the previous private chain
could not resume block production after a long offline gap. A separate private chain
then bootstrapped while a stop request was in flight. I restored its exact initial
checkpoint from saved actual raw block/state64 and committed CKB transactions, then
resumed its **same original funded OutPoints**. A pending maker transaction committed
on restart; its real receipt/event was recovered. An insufficient-supermajority update
was rejected; later valid512updates succeeded. No signature/finality check was weakened.
A mixed-setup replay attempt failed before any transaction with unknown OutPoint and
is kept as a failed attempt, not counted among security successes. Final live and
independent offline evidence supersede those incomplete attempts.

Observed host elapsed funding→maker reimbursement was401.688 /406.280seconds; refunds
539.098 /537.339seconds. A delivery was5.153seconds after funding (1.674seconds after
submission). D's delivery latency was not measured through the interrupted driver;
its actual successful receipt is retained. These are private3-second-slot measurements
including interruption/recovery and are **not mainnet latency forecasts**.

Reproduce without Ethereum/Docker/network access after pinned dependencies exist:

```
P1_RUN_NAME=independent-new bash labs/wo04-e2e-viability/src/reproduce.sh
```

Use a new label. The command checks fixture hashes before/after, rebuilds the explicit
private verifier, checks exact deployed code offline, runs parser/authority/model and
actual BLS/SSZ reference checks, then performs native recovery/settlement. The completed
recorded run is `evidence/reproduction-independent-01.log` (exit0). The final strict
recovery checks were also rerun against all four actual saved RPC transcripts after
adding explicit domain/zero-term rejection. Pinning remains blst0.3.15, Zig0.14.1,
solc0.8.30+73712a01, ethers6.15 and the existing CKB SDK/Python lockfiles; no new
production dependency was introduced.

All **1,271 pre-existing tracked files** were byte-identical before committing this new
lab/report. Prior experiments and evidence were not rewritten. The new lab contains
only intentionally public disposable fixture key material; generated keystores/JWTs
remain ignored in private runtime. No PR merge or public deployment occurred.

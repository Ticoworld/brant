# WO01: First principles

Research date: 29 October 2026. Decision: continue bounded architecture research, do not start a full exchange build. Read `06_BREAKTHROUGH_DECISION.md` first for the verdict. Evidence IDs resolve in `evidence/EVIDENCE_LEDGER.md`.

## The job, rather than the exchange category

A customer exchanges control of a specified amount of one asset for control of another. A trading venue is useful if its complete cost, delivery reliability, speed, accessibility and custody terms beat the customer's actual alternatives. A fast screen without enforceable delivery is insufficient. A technically safe trade with a bad price is also insufficient.

The target outcome is not necessarily a home for speculative order flow. Native CKB to spendable stablecoins, and the reverse direction, can be a distinct business from a high-frequency CKB spot market. Neither business has validated demand in this work order. CKB volume on Binance establishes existing exchange activity, not willingness to move wallets, accept channel funding, pay a premium or use our proposed venue.

### Obligations of a single trade

A signed instruction must bind network/genesis identity, asset identity, input ownership or channel allocation, exact integer amounts or conservative limit inequalities, recipients, fees and fee ceiling, authorized settlement route, partial-fill policy, replay domain and operation identifier. An unbounded market order is unacceptable. A quote amount includes delivery costs and any required destination capacity. An input amount that silently pays for unrelated output capacity is a broken price comparison.

A completed trade must establish asset conservation, correct recipients and sufficient settlement evidence. A recovery package must reconstruct the trade without the original exchange backend. This includes signed transactions/states, scripts and their hashes, dependencies, chain identifiers, outpoints/escrow identifiers, secrets where appropriate, transaction hashes, refund parameters, monitoring obligations and a documented reconstruction procedure. A transaction hash alone is not recovery.

### The seven different promises

| Stage | Evidence | What it actually promises |
|---|---|---|
| Received | Authenticated acknowledgement and local durable operation ID | Service saw a request |
| Matched | Concrete counterparty, amounts and route | An executable proposal exists, subject to funding and authorization checks |
| Conditionally guaranteed | Defined enforceable claim, identified collateral and complete recovery data | Delivery or specified compensation under explicit chain, data and monitoring assumptions |
| Node accepted | Successful RPC plus reconciliation | One node admitted a transaction under its local policy |
| Proposed | Proposal inclusion evidence and chain context | Transaction ID was proposed, not that it executed |
| Committed | Verified transaction inclusion | State changed on the currently accepted chain |
| Risk-final | Defined confirmations/finality evidence on every relevant chain | Reorganization exposure meets a declared risk budget, never mathematical PoW irreversibility |

VERIFIED: E01–E04 and X01 distinguish these chain stages. DERIVED: an operator's receipt or a maker's signature cannot, alone, create stage-three protection. A signature over a conflicting spend is not exclusive allocation of assets.

A responsive product can update the first two stages immediately and allow cancellation requests immediately. It must display cancellation requested until cancellation is actually enforceable. A pending trade is not available cash unless a separate funded channel or explicit credit provider makes it available. Credit changes the risk model and is not the default design.

## Requirements by participant

| Participant | Must receive | Actual reason to choose us | Evidence needed |
|---|---|---|---|
| Existing Binance trader | Predictable all-in price and delivery | Direct wallet-to-wallet stablecoin conversion or custody preference outweighs external venue costs | Repeated executable route comparisons and actual repeat use |
| Native CKB holder | Independent control and intelligible recovery | Can obtain useful native assets without an exchange deposit or wrapped-asset exposure | Two-way swaps and operator-off recovery |
| Professional maker | Bounded quote option, hedgeability, predictable capital occupancy | Earns positive net contribution with existing inventory | P&L under delayed settlement and toxic flow |
| Passive holder | Explicit investment/risk mandate | Pays for a service they understand and can exit | Segregated accounting, drawdown and redemption evidence |
| Operator | Revenue with repeat transactions | Distribution, reliability and liquidity relationships | Costed operations and positive contribution margin |

Ordinary holders should not be told that depositing CKB passively reproduces professional market making. They supply one asset, while a useful two-sided market also needs quote assets, hedges and rebalancing. A pooled strategy introduces manager risk even when theft is constrained by a contract.

## Four resources that must not be confused

1. Asset ownership: who can spend each cell or escrow.
2. Execution authority: who may authorize a particular exchange.
3. Pricing information: who observes a competitive price.
4. Balance-sheet capacity: who funds the other side and survives delayed recovery.

The Cell Model can separate those resources. Discovery can aggregate many makers while custody remains separate. Signed orders can separate authorization from transaction assembly. Independent cells can partition conflicts. None of these facts manufactures the fourth resource.

## Fundamental tradeoffs to confront

DERIVED: one live cell cannot fund two incompatible final outcomes. Splitting it creates more independent allocations but cannot duplicate its value. A chain of authorized spends can advance before confirmation, but all descendants inherit parent failure. An untrusted sequencer cannot guarantee an unreserved asset will remain unspent merely by announcing a match.

DERIVED: a maker cannot offer the customer an indefinitely exercisable fixed-price option at a negligible spread during volatile markets. Off-chain quote withdrawal prevents future authorization only if the old authorization cannot still settle. A two-second UI expiry is not such a mechanism.

DERIVED: finite cross-chain timeouts cannot guarantee prompt completion through unbounded chain outages. The safety model must state bounded monitoring/inclusion assumptions and refuse new trades when headroom disappears. Refund eligibility and a confirmed refund are different events.

HYPOTHESIS: separating competitive quote discovery from per-trade allocation, with native assets settling on their home chains, can deliver a better CKB conversion product without native stablecoin pools. HYPOTHESIS: funded portfolio channels can deliver a better repeated-trading product. These hypotheses compete; the second is not automatically an upgrade to the first.

## Success standard

The desired experience is fast submission and order control, honest commitment status, competitive delivered value, bounded maker risk and independently executable recovery. No candidate yet proves that complete combination.

The architectural frontier is not just more transactions per second. It is reducing the interval between a customer committing economically and acquiring an enforceable claim, without transferring a hidden option or insolvency risk to someone else. That interval drives spreads, customer confidence and required capital.

A breakthrough claim would require a demonstrated improvement in that interval or in capital efficiency against the strongest feasible solver/channel competitor, with no compensating safety loss. WO01 has useful engineering evidence, but not that proof.

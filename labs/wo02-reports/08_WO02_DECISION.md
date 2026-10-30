# WO02 founder decision

**Classification: TECHNICALLY PROMISING, SAFETY UNRESOLVED.**

The experiment executed native CKB against a controlled test ERC20 in both directions, recovered without the coordinator in many tested histories, and exposed real principal-loss schedules. It did not establish a complete general bounded settlement guarantee or a competitive trading business. This classification is deliberately weaker than a secure-mechanism verdict.

## Technical conclusion

CKB can enforce a narrow fixed-beneficiary native-asset escrow with real SHA256 claim verification, exact amounts and a consensus-enforced not-before refund. EVM can enforce an exclusive claim/refund timestamp boundary. The operator need not hold customer asset keys, and separate processes can complete/refund from retained packages without its database.

The important architectural repair is to keep the chain orientation fixed: CKB first/longer, EVM second/strictly expiring, with the CKB funder owning the secret. Customer buy/sell direction changes the role of the first funder, not those chain semantics. The important recovery repair is to treat first disclosure differently from re-inclusion after the secret is public and CKB has already paid.

These repairs are useful but incomplete. Failed EVM disclosure can reveal a valid CKB preimage without paying. A late watcher can lose to a CKB refund. Deep rollback can undo one leg after the other paid. No production relation between clock/height advance, fee requirements, inclusion, monitoring and finality was validated. The client guard numbers are local test budgets. A fixed closing fee and retained secret/package data are additional explicit assumptions.

## What was actually executed

74 final scenarios across isolated chains: 63 primary, ten additional boundaries/response/fee cases, and one focused re-inclusion repair. Both happy directions have actual signatures, funded escrows, committed CKB spends, EVM receipts/events, initial/final balances, fees, bytes, cycles and timing records. Coordinator death and database deletion did not prevent the tested independent claims/refunds. Quote signatures and asset payouts were independently cross-checked offline against captured raw records.

Four named counterexamples and four late-watcher cases finish with principal loss; they remain in the evidence archive. This is not 74 security tests passed. It is a completed adversarial experiment with successful paths, expected rejections, repairs and unresolved boundaries.

The CKB claim cost 13,997 cycles/299 bytes; refund 7,885 cycles/267 bytes. Funding cost roughly 1.62 million cycles/625 bytes because it uses a genuine secp wallet. Successful EVM approval/funding/claim used 310,512 gas in this fixture. Contract costs and per-path occupancy are measured local records, not mainnet speed claims.

## Commercial conclusion

There is no established prize-like or exceptional business advantage. Using a newly retrieved spot book and observed gas-price inputs, the Ethereum-style success cost model is approximately $1.145 before hedging/operations and any operator margin. Under explicit benign assumptions, a $1,000 trade leaves only about $0.60 or $0.08 at a 50-bps spread before additional routing fees/fixed overhead. $100 suffers fixed costs; $10,000/$50,000 suffers market impact in the observed hedge book. These are scenarios, not observed P&L or firm quotes.

A strong maker with lower fees, natural opposing flow, existing inventory and cheaper native delivery could do better. That is why the evidence does not justify declaring every escrow business economically impossible. But no executable competitor quote, customer willingness to pay, maker commitment or repeat distribution advantage was established. Binance plus withdrawal, mature solver networks and wallet distribution remain stronger benchmarks than a successful local swap.

## Strongest competing architecture

For repeated trading, a correctly funded native cross-chain portfolio channel has the higher execution/capital-reuse ceiling. It may avoid most per-fill L1 operations and shorten price commitment exposure. Its cross-chain unilateral-exit consistency and safe maker switching remain unproved in this work. That problem deserves the next decisive experiment rather than being pushed aside because the simpler escrow now runs.

For one-off conversion, a verified foreign-payment release condition plus a properly specified refund challenge mechanism is a stronger safety research candidate than a naked preimage. It requires significant verifier/proof/state infrastructure and an explicit capital/latency cost case. No such infrastructure is claimed as implemented.

## Decision and next experiment

Preserve this tested escrow implementation and evidence as the fallback. Do not build a full exchange, general SDK, elaborate UI or liquidity solicitation around it. The next work should compare a bounded portfolio-channel atomic-update/exit experiment with a foreign-payment-proof/refund-challenge design, concentrating on the mechanism that could actually change execution economics or safety.

The decisive channel test is not another successful update: withhold the last signature, force asymmetric old/new-state disputes, delay one chain, remove the coordinator and recover from the latest independently retained evidence. Use the same pricing and capital assumptions, then measure funding, close, dispute and reassignment. If the higher-ceiling protocol cannot be established, reassess whether a narrower custody-sensitive conversion service has enough paying demand to justify D's costs.

## Remit/Sluice continuity check

The saved HACKATHON_OPERATING_RULES(1).md was recovered and read. The repetition would be turning a working swap primitive into packaging and calling it competitive. WO02 instead kept the baseline, attacked the failure boundaries, preserved principal-loss counterexamples, implemented meaningful client repairs and kept the channel ceiling alive. That is discipline, not evidence that the business wins. This is not a hackathon submission and receives no prize classification.

## Evidence and limits

See reports 01–07, evidence/verification.json, evidence/cost-ledger.json, evidence/economics.json, per-scenario results and raw RPC transcripts. The source and executable reproduction sequence are included. WO01's recovered archive matched its SHA256 and all 65 entries; it remains unchanged.

No real funds, public deployment, production contract, public commitment or outside party contact occurred. Read-only public market/gas/consensus queries were used for current modeling. No independent audit, exhaustive state-space proof, production stablecoin behavior test or real-network finality calibration was performed.

**Final decision: TECHNICALLY PROMISING, SAFETY UNRESOLVED. Commercial superiority is unestablished; the higher-ceiling alternative remains active.**

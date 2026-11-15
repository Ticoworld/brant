# WO09 execution comparison — 2026-11-03

## Equivalent quantities, different guarantees

All native profiles exchange the same genuine published test xUDT type,200,000atomic units for10,030,000shannons. Same chosen10,000sh miner fee per action. Controlled disposable counterparties; no live external maker promise. Evidence: `labs/wo09-unified/trading-return/evidence/rivals-1793690498975`, ten committed transactions, independent resolved-UTXO/quantity/fee replay. No earlier transaction was merely re-labelled as a new result.

| Profile | Exchange transaction bytes/cycles | Other required stages | Customer/storage qualification |
|---|---|---|---|
| Existing-wallet bilateral RFQ |836 /3,311,833|None if two wallets/inventories exist|Two actual secp signatures; actual xUDT delivered directly; fixture customer typed minimum142CKB, incremental storage0 if already available|
| Published A2 |841 /1,706,794|Fund850 /1,719,700; recover578 /1,760,430|Passive funded quote; actual token successor; known self-created master recovery|
| Recompiled optimized A2 |841 /1,737,381|Fund850 /1,730,839; recover578 /1,749,570|Same fixture/profile as published|
| New pooled RFQ |1432 /11,503,957|Enrollment, deposit and external withdrawal separate|Two owner Ed signatures; two backed balances exchanged inside shared state; actual delivery tested afterward|

Published A2 fund/fill/recovery totals2269bytes and5,186,924cycles; rebuilt optimized5,217,790cycles. The historical optimization label does not establish superiority here: published is slightly stronger in this workload. A2 full lifecycle and a single pooled internal exchange are not identical services; nevertheless there is no evidence of an execution-cycle advantage for the pool. Pool external token delivery adds1531bytes/7,481,287cycles and receiving capacity.

Real direct RFQ hash `0xb2b3d295192d0ca034df92df0f21a94bae3043ebb4b2a1f0da6cc4a646d02a23`. Published A2 fill `0x60c488a58271bc70bc37657043117d635e9632cc7c08446eddc005acc8073025`. Exact remaining hashes/config/quantities in checked-in events and verifier outputs. Node validates actual secp, A2 and xUDT scripts; offline rival replay independently checks funding/amounts, not every script's implementation.

Important counterexample: sponsor-created A2 bids succeeded without a customer-owned funding input. Customer master identity was set at creation. Zero customer input therefore is not itself a novel onboarding capability; someone still supplies occupied capacity. Each independent active bid/master in this tested profile requires195+94=289CKB, excluding price principal, fee funding and eventual receiving wallet. This is not a claim of the optimal possible multi-order/master structure. Recovery here concerns only a fixture-created known master/successor. Arbitrary lineage and LO-01 remain unresolved; these transactions do not qualify that tool generally.

## Strongest existing rival by customer job

* Existing funded wallet, synchronized maker: direct signed wallet swap wins measured bytes/cycles and needs no new shared state/archive or code deployment.
* Passive, independently funded CKB/xUDT bid: published A2 already offers execution without requiring the taker owner online. Pool's exact-body mutual signing is weaker for independent offer collection and stale-root handling.
* Independent combinable signed intentions: CoBuild OTX is the relevant rival. The new pool is not OTX and every update requires fresh root/outpoint and signatures. No new CoBuild native benchmark was executed, so no numeric superiority is claimed.
* Constant-product liquidity: CKBSwap publishes CKB/xUDT and xUDT/xUDT AMM code and testnet UI. Its advertised0.3% LP fee and pool reserves are not demonstrated profitable LP income. No equivalent native CKBSwap benchmark or executable funded quote was obtained in this investigation.
* Existing funded channel/route: Fiber can avoid per-trade L1 updates when the exact asset and directional route liquidity exist. Channel funding/closing and counterparties are additional conditions. No actual suitable route quote was obtained.
* Liquid centralized CKB/USDT execution: a dated public exchange book exists and is a stronger demonstrated liquidity signal than our controlled maker. It brings custody, access and asset-withdrawal dependencies; USDT on an exchange is not our TEST xUDT or an automatically available CKB-native stable asset.

## Public implementation review, not performance claims

Sources read2026-11-03:

- [CoBuild OTX protocol](https://talk.nervos.org/t/ckb-open-transaction-otx-cobuild-protocol-overview/7739), [orderbook design](https://talk.nervos.org/t/an-orderbook-dex-design-using-cobuild-otx/8089). Agent aggregation is not guaranteed inclusion. Preserved reference source `xcshuan/cobuild-otx-contracts` at `f18eeaf22f29820ecd9a089481ab45b78b2b7454`.
- [CKBSwap introduction](https://talk.nervos.org/t/introducing-ckbswap-building-on-ckb-for-the-long-term/11060), [contracts](https://github.com/ckbswap/contracts), reviewed commit `b7cd8458a798b4386c1b401ce7dd10333a728443`. State500CKB plus CKB reserve; token reserve200CKB each in documented configuration; actor lock input; shared-input contention acknowledged. Those are public source/author statements, not our measured native figures. xUDT configuration differs from our fixture; drop-in compatibility is unproven. Testnet [UI](https://ckbswap.site/) reachable, no firm native quote captured.
- [Fiber channels](https://www.fiber.world/docs/concept/channels/unidirectional-channel), [routing](https://www.fiber.world/docs/concept/routing/multi-hop). Route-specific liquidity/asset compatibility must be checked; generic routing support does not establish a deliverable trading pair.
- [Coinbase RFQ](https://help.coinbase.com/en/exchange/trading-and-funding/request-for-quote-rfq). Public documentation describes provider quotations and participant access, not an accessible firm retail CKB quote. None was requested or executed.

Matching algorithms, liquidity, execution authorization and receiving capacity solve different problems. None should be inferred from a successful Merkle proof.

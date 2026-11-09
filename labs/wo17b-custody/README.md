# WO17B: two-holder custody, partial checkpoint

**INCOMPLETE: no offline sale is implemented.** This private-chain experiment demonstrates shared custody, a jointly signed online allocation, and independently signed withdrawals. The allocation has no payment and consumes Alice's funding cell; it is not a sale or offline authorization. It does not prove an offline intent, minimum payment, expiry, or production safety. WO17A remains intact and has been rerun at `../wo17-custody/evidence/custody-1794258828643`. WO16 issuer and source-to-binary limitations remain open.

The material deadline blocker: CKB `since` sets a minimum, not a maximum. An arbitrary historical header dependency can be reused after a deadline, so it cannot prove current time or height. R7 explicitly used a message without expiry. A sound time-bound offline sale needs a separately justified clock/freshness mechanism with explicit trust and liveness assumptions; a signed expiry field or client-side check is insufficient. No R7 signature verification has been integrated here. Do not claim offline sale authorization, correct sale price, expiry, or replay protection for a sale.

## Construction

Fresh singleton marker and owner issuance reuse WO16 mechanisms; a new market identity is required because WO17A's market does not emit this custody format. The custody args bind the market hash, exact xUDT type, and distinct Alice/Ben standard-lock hashes. Data stores xUDT backing, both explicit u64 balances, a revision and a root over fixed leaves. Every custody input and successor recomputes the root and checks `backing = Alice + Ben` without overflow; the root is not treated as proof of a sum. The market enforces the initial backing and root. A successor preserves custody lock, type and capacity and increments revision.

Online allocation moves one unit from Alice to Ben with both standard funding locks executing; Alice's input capacity is preserved and Ben pays the fee. Withdrawal requires the relevant owner's standard lock input and transfers exactly the requested unit to their external xUDT cell. The fixed structure has only two designated identities; no general multi-user ledger, sale, clock, recovery or batching is claimed. Clients must verify custody creation against the market lineage; withdrawal does not authenticate the lineage afresh. Initial creation does not prove Ben's selected lock hash is usable, so an incorrect identity can lock funds. The zero-balance custody cell remains locked and retains capacity. The code is not audited.

## Run

With CKB 0.210.0, Zig 0.14.1 and pinned local native dependencies, from repository root:

```
bash labs/wo17-custody/build.sh
TRADE_NATIVE_ROOT=$PWD/labs/rebuild/native node labs/wo17-custody/run.cjs
node labs/wo17-custody/verify.cjs labs/wo17-custody/evidence/custody-<timestamp>
bash labs/wo17b-custody/build.sh
TRADE_NATIVE_ROOT=$PWD/labs/rebuild/native node labs/wo17b-custody/run.cjs
node labs/wo17b-custody/verify.cjs labs/wo17b-custody/evidence/shared-<timestamp>
```

Public keys 1, 2 and 3 are disposable fixture keys. Generated binaries are not deployment artifacts. Verification trusts the private node for consensus and VM execution.

## Recorded transactions

`evidence/shared-1794259121449` records issuance `0xf070e337fa6819d607b260ddcf459350d9a341a2b1a2fe8fbeaf9e7841c650c7`, shared purchase `0x0b8883134a1914b1e93437a3c8fe2a128c5d8f709aacba9f2c9982ed6906828f`, **online allocation, not sale** `0x45801765bce35f41580b98281b5d92600a1e7600d28f86407932fe4e2ce16e00`, Ben withdrawal `0xeb5ba72b9fefdc46c49c65251f0674f0c302704b4798b31fd5d8880a29e4e0b7`, and Alice withdrawal `0xa5b7da3c4c3fbba880c114412e2c5ebb000df809e02ed86feac160596a069f45`. Backing and balances are 2=(2,0), 2=(1,1), 1=(1,0), 0=(0,0), with final supply 998 inventory + 1 Ben external + 1 Alice external = 1,000. Each committed transaction pays 0.01 CKB. Cycle estimates for issuance, purchase, online allocation, Ben withdrawal and Alice withdrawal are 1,694,614; 1,762,632; 3,391,684; 1,730,661; and 1,726,269. Minimum occupied capacity is 210 CKB for inventory, 258 for marker, 306 for shared custody, and 142 per external xUDT output; the fixture allocates 350 CKB to custody and 200 CKB to each external token output. These are fixture costs, not an equivalent journey comparison.

The suite tests wrong market identity, wrong asset, invalid successor root, invalid backing, excess allocation, allocation without Alice's input, withdrawal exceeding entitlement, and stale consumed-outpoint replay. Replay is a node outpoint-resolution failure, not a contract rejection. The failed development run `shared-1794259097891` is retained and is not a pass: a wrong-asset mutation also changed the successor type due to a shared in-memory object, causing an earlier rejection. Other preceding runs are earlier iterations. Tests for invalid or expired offline intents, buyer and payment substitution, insufficient payment and fulfilled offline orders are **not performed**.

A matching ordinary xUDT journey with the same exchange and withdrawals was not run; no measured saving or like-for-like comparison is claimed. Completion requires offline signature and payment, a sound expiry decision, dedicated native negative tests, and the matched control.

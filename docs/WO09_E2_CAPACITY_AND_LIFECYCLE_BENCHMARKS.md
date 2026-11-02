# Capacity and lifecycle benchmark — first checkpoint

| Reused Cell layout | Occupancy | USD at $0.00122 | $0.10 | $1 | $10 | $100 |
|---|---:|---:|---:|---:|---:|---:|
| Normal wallet |61 CKB|0.07442|6.10|61|610|6100|
| xUDT cell |130|0.1586|13|130|1300|13000|
| E1 claim |150|0.183|15|150|1500|15000|
| E1 maturity event |206|0.25132|20.6|206|2060|20600|

Values derive from the preserved occupied-capacity formula and approximate script/data sizes; they are capital valuations, not fees. Capacity is typically returned when a Cell is consumed.

Tiny L1 payouts 0.01/0.1/1/5/50 CKB each fall below61 CKB for a new normal output. Existing compatible recipient-cell reuse, ACP or sponsorship can help; a no-cell customer needs somebody to supply the missing capacity. ACP is not proven for these asset/scripts.

Participant grid1/16/32/100/1000 and1/4/16/32/100 root shards is in labs/wo09-e2-capacity/evidence/capacity-frontier.json. It omits manifests, witnesses, proofs, DA, VM cycles and fees. One root serializes spends; separate nullifiers return per-user occupancy.

Actual swap: four existing inputs/two wallets/two xUDT cells to four replacement outputs; persistent delta0. Two issuer transactions and one swap committed. Three rejection cases passed source/receipt/CCC verification. Transaction fees were null in the harness, so no measured fee claim. This is complete-fill spot only.


## Liquid Cells source-derived frontier (not a Trade run)

The pinned Liquid Cells source uses no individual balance Cell in its pooled representation and one mutable anchor per pool/shard. Its described deployed force-exit witness is 33-byte pubkey + 16-byte balance + 8-byte nonce + 256 32-byte siblings = **8,249 bytes**. Checkpoint DA adds **56 bytes per touched account leaf** (57,344 bytes at 1,024 touched leaves), carried in transaction witness data and therefore fee-relevant even though it does not create Cell occupied-capacity lockup. The design delays unilateral exit until **180 epochs** without a newer checkpoint. These are source-derived dimensions, not E2 execution measurements.

The direct exit emits a standalone payout Cell and therefore retains the approximate 61 CKB standard secp occupied-capacity boundary. Below that, the upstream design points to atomic-swap/Fiber egress: a smaller payout can work only when a counterparty and liquidity are available, so the user does not have unilateral L1 recovery during service failure. Every force exit spends the same anchor within a shard. Sharding offers cross-shard concurrency at the cost of more anchors and does not resolve contention inside a shard. The anchor's exact deployed occupied capacity, verification cycles, fee, proof-building cost and live replay behavior remain **UNKNOWN** here.

The upstream CKB-VM test source includes one positive force-exit and six negative cases; Trade could not run it because this environment lacks `cargo` and `rustc`. See [`WO09_E2_LIQUID_CELLS_SOURCE_REVIEW.md`](WO09_E2_LIQUID_CELLS_SOURCE_REVIEW.md) and the machine-readable source-derived parameters in `labs/wo09-e2-capacity/evidence/capacity-frontier.json`.

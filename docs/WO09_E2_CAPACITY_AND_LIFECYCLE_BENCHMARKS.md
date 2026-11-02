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

P1A executes compact no-type/no-data intents with 32-byte terms commitments.

- Node accepts 73 CKB and rejects one shannon less; actual 100.01-CKB cells pay
  exact 100-CKB principal. Standard user-signed funding/recipient locks remain.
- Ethereum IDs bind actual funding TxHash and output index after base commitment,
  with no hash circularity. Identical outputs 0/1 get different fills.
- One fill cannot claim both cells. Global single-input/one-output accounting
  rejects same-group and cross-group shared-payout attacks. No settlement batching.
- Real private-PoS token delivery, two maker payouts and two absence refunds;
  final replay 13 commits /90 rejections, identical hashes/cycles.
- Full terms move to witness; recovery packages precede broadcast.20-byte
  capacity-only test reaches 61 CKB but is not adopted:12-CKB saving weakens margin.
- All prior labs preserved; original working fallback retained. No merge.

Review docs/E2_COMPACT_INTENT_RESULT.md for exact capacities, costs, gas,
OutPoint encoding, genuine unsupported-update recovery and remaining economic /
public-chain /EVM-side CKB funding guarantees.

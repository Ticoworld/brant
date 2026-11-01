# Native execution evidence — 2026-11-01

VERIFIED: fresh isolated CKB 0.210.0 chain; official published A2/iCKB/xUDT/Owned Owner binaries. Canonical complete run: `labs/rebuild/native/evidence/run-1793541730590`.

76 actual committed transaction instances, 18 expected rejection cases. This includes setup/funding, two-owner atomic netting and independent recoveries, 2/8/32 full-fill native batches, two serial full fills, bounded commitment, DAO lifecycle and final spend of redeemed CKB. Counts are not trades or historical counts.

Each event contains signed transaction, node commitment block/hash response, exact serialization bytes and VM cycle estimate. `raw.jsonl.gz` preserves raw RPC including admission, errors, generated blocks and receipts. `verify.cjs` independently cross-checks CCC and CKB SDK hashes/bytes and all raw commitment responses. It is an offline consistency check, not a replacement for fresh execution. The node enforces signatures/DAO maturity. Early rejection cases specify estimate_cycles versus send_transaction accurately; rejected transactions do not commit.

## Actual DAO transactions

| Stage | Transaction hash |
|---|---|
| dao_authentic_deposit_and_receipt | `0x4b760685996ed9b8aace884fa64984b9d084ea9aa4f8402f2a5be3191cb928be` |
| receipt_converts_to_authentic_ickb | `0xc4c4b3a0692ef51f88dc49ff2480633fd4c9041bca242bed9f5e48cca0ac693b` |
| dao_maker_funds_native_bid | `0x2fd111b8429455bc54e6acadb6415f7293f8f319b97f3861ef40111ea2d242ae` |
| holder_trades_ickb_for_spendable_ckb | `0x017e23a889c0f03b52a3bd6dc92604c12c131b9f9bd35f9a303b9c110a4d7f07` |
| maker_independent_authentic_successor_recovery | `0xda1deec17ed3195f70052700d826c7b10c4510f9ecfc8bd62f9e8195e33d4191` |
| genuine_dao_withdrawal_request_burns_ickb | `0xf9d56d9824a4617e23a08852d1f5e5c17f25abae1bc9528443e23df47c85b8dc` |
| actual_mature_dao_withdrawal_completion | `0xd30fa57b2921cb9867b17b865b61071245780658c4315373d3cc432cd3ae9677` |
| redeemed_ckb_is_actually_spendable | `0x88705718ca7208d008ebf9db6e7876406e533fbf264fbf4c080fea0f77beb05b` |

DAO amounts in shannons/iCKB base units (8 decimals):

```json
{
  "depositCapacity": "10008200000000",
  "issued": "9994468360363",
  "payout": "9900000000000",
  "maximum": "10008777920142",
  "independentlyComputed": "10008777920142",
  "finalSpendable": "10018776920142",
  "interest": "577920142",
  "matureSince": "0x20000a00060000d2",
  "minedBlocks": 1780
}
```

Final withdrawal output includes the 100 CKB owner marker and deducts one fixture fee. It is not all DAO interest or trading revenue. A subsequent transaction spends it and pays another fee. Interest freezes at request, independently matched to published DAO arithmetic; 180-epoch rules are exercised by real generated blocks in 10-block integration epochs, not elapsed public-network time.

## Published upstream batch baseline

| Full-fill orders | Serialized bytes | Estimated VM cycles |
|---|---:|---:|
| 2 | 1156 | 1779901 |
| 8 | 3046 | 2023540 |
| 32 | 10606 | 3068833 |

Equivalent two-order serial vs shared settlement: ```json
{
  "workload": "Two 911-token full fills of identical funded A2 bids; funding excluded from both settlement totals",
  "serial": {
    "cycles": "3493599",
    "bytes": 1900,
    "fee": "2000000"
  },
  "shared": {
    "cycles": "1779901",
    "bytes": 1156,
    "fee": "1000000"
  },
  "limits": "Serial preserves one empty token cell and two direct CKB payouts; shared coalesces empty-token capacity and payout. Both keep masters and full successors. Fixed fixture fee policy; no custom competitor or maximum heap claim."
}
```

Funding is excluded from both settlement totals. Serial leaves an empty xUDT cell and separate CKB payouts; shared coalesces payout and empty-token capacity. No custom candidate or optimized heap maximum is claimed. Published unmodified upstream is used directly.

Failures preserved: dep-group JSON encoding, insufficient multisig occupied capacity, malformed multisig identity, and overly narrow expected overflow error pattern. Fixed source reruns succeed. These are implementation/debugging failures, not protocol exploits. Initial partial runs and later full regressions remain independently labeled.

## Independent fresh GitHub clone

Fresh clone of remote ac8ebe2023bcff67e074becbf1cf0c8eb555dd91, full bootstrap and npm-ci, reran native suite: 76 committed transactions, 18 expected rejections; 2,855 raw RPC records. Evidence `run-1793542987108` includes fresh commitment hashes and all raw responses. Bootstrap used its own local downloaded CKB and new node_modules, with no dependency on the original checkout's WO04 tools. Same host and operator; this is independent checkout/environment installation, not an independent security audit. Exact model outputs reproduced unchanged. All 34 vendored hashes and four published code hashes PASS; release bytes match pinned upstream files. See REBUILD_FRESH_CLONE_REPRODUCTION.json.

## Essential recovery qualification

The successful standalone recoveries establish signing/execution for harness-tracked authentic fixtures. recover.cjs does not authenticate arbitrary input history or intended payouts. Known upstream A2 LO-01 is unresolved here; no reproduction or correction tested. The rewritten-lineage rejection case is narrow and must not be promoted into a general forged-lineage rejection claim. Read-only review-lineage passes only self-created recorded ancestry. See REBUILD_OWNER_RECOVERY_REVIEW.md.

CORRECTION: previous 289-CKB bid successors were above occupancy, so prior "full fill" labels are narrowed to partial. New canonical corrected full-fill evidence is run-1793544609163: actual 195-CKB xUDT bid reserve, 199-CKB iCKB reserve, 76 committed transactions, 18 rejections, CCC/SDK/raw checks plus occupancy assertions PASS. See REBUILD_FULL_FILL_CORRECTION.md; historical runs remain unmodified.

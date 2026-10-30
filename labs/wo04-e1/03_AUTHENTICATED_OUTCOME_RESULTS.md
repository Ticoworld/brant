# Actual outcome and native settlement results

**Classification boundary: executed relative to an explicit trusted execution-root checkpoint. No foreign consensus finality proof is claimed.** Final run: 36 recorded transactions,12 committed CKB transactions and24 EVM receipts, including deliberately reverted defensive transactions. Five reservations, four terminal outcomes and one intentionally unresolved reservation. Historical exploratory runs are separate evidence and are not added to these counts.

| Trade | EVM terminal state | Token delivered | Native result | Native settlement hash |
| --- | --- | --- | --- | --- |
| filled_shared | FILLED | 100 E1TEST | 10,000 CKB to Bob | 0x841f9d332c21b9f2748347baeca0e57b8574bca88eaae7539bbbe8b5fcba6ea0 |
| unfilled_shared | EXPIRED_UNFILLED | 0 | 10,000 CKB to Alice | 0x7fd4db6e1973381d3ed3343856e7962e1409d5426800c63c2853f485e8827936 |
| filled_individual | FILLED | 100 E1TEST | 10,000 CKB to Bob | 0xffee1fc753b3e0abd619a670ad2aeed46adb942b0495dd457a5aac09d19fc851 |
| failed_then_unfilled | EXPIRED_UNFILLED | 0 | 10,000 CKB to Alice | 0x79f61418948fd50ae76f7cf6de6bfd75432e3554360f5a89448cd12b15d3760e |
| pending_without_terminal_outcome | OPEN | 0 | 10,000 CKB remains reserved | none |


Each delivered trade transferred100,000,000 raw units of six-decimal E1TEST. Each native reservation principal was1,000,000,000,000shannons. This artificial rate is not a CKB market quote. The controlled token is not actual USDC. The native principals were funded and paid by real chain transactions, not balance simulations.

## Exact identities

CKB genesis: 0x30acd4e32784aa5ffb661e880cd6a71fb59cd787786784a853177c3dc95fa5f9

EVM chain31339. Test token: 0xF2E246BB76DF876Cef8b38ae84130F4F55De395b. Outcome contract: 0x2946259E0334f33A064106302415aD3391BeD384. Outcome runtime codeHash: 0x37084ef7cddeed1d67c3362387956586d6d7f5fef760dde3eca27b657c8b05fd.

Alice EVM: 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf. Bob EVM: 0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF. Exact native recipient locks and unique reservation types are in config/environment.json and evidence/trades.json. Terms bind both chains' identities, addresses, principal/token amounts, deadline and reservation type.

## What was authenticated by CKB-VM

A real EIP-1186 account path was checked against the supplied execution stateRoot, including contract codeHash and storageRoot. A real storage path then authenticated a terminal leaf or immutable two-leaf batch root. Shared settlement checked the exact leaf's SHA256 membership and paid a fixed native beneficiary. Individual recovery checked the account/storage proof directly. The input reservation's unique type and exact capacity were enforced.

The bootstrap containing stateRoot/block identity was supplied by the experiment controller, not validated against Ethereum consensus. Immutability protects retention, not the initial root's truth. Thus these tests demonstrate execution-state proof checking and conditional payouts, not finalized cross-chain truth without trust.

## Actual final balances

Token initial balances were1,000,000 E1TEST each. Final Alice balance:1,000,200 E1TEST. Final Bob balance:999,800 E1TEST. Two filled trades explain the200-token net transfer. Reverted transfers and unfilled trades did not create terminal delivery commitments.

| Role | Initial normal-wallet shannons | Final normal-wallet shannons |
| --- | --- | --- |
| alice | 10000000000000000 | 9996999999000000 |
| bob | 10000000000000000 | 10001959999800000 |
| watcher | 10000000000000000 | 9999969999900000 |

Native final balances were reconstructed from captured genesis and committed input/output records. They exclude the still-reserved trade principal, bootstrap/checkpoint capacity and genesis script cells. Actual transaction fees reconcile the ledger. Two filled trades paid20,000 CKB to Bob; two unfilled trades returned20,000 CKB to Alice;10,000 CKB remains reserved for the OPEN trade. Checkpoint400 CKB and bootstrap300 CKB remain locked by the experimental retention policy.

The first two shared consumers entered the pool together and committed in the same block in the final run. The prior custom-identity run committed them in adjacent blocks; that difference is preserved. This establishes no universally fixed batching latency or TPS rate.

## Evidence granularity

Each defensive case has its observed rejection/result, and all trades have retained terms, outcomes and final disposition. EVM receipts include reverted status, logs and fees; native proofs have transaction bodies and committed status. A separate balance snapshot after every individual rejection was not recorded. Do not infer a complete per-case fee/balance trace beyond those retained records.

Offline verification independently walked five account/storage proofs using ethers RLP/Keccak, checked all trade/reservation bindings, all native transaction hashes and fixed payouts, and the signed EVM transaction hashes. EVM receipts were captured through ethers; not every receipt has a second duplicate raw-RPC log. This is consistency verification of actual recorded execution, not an independent audit or bytecode replay.

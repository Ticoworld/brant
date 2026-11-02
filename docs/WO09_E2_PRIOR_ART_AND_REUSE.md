# Prior art and reuse

Pins and captured source hashes are listed in labs/wo09-e2-capacity/research/sources.json. README statements are publisher claims, not independent audits.

| System | Pinned source and relevance | E2 conclusion |
|---|---|---|
| CoBuild OTX | cryptape/ckb-transaction-cobuild-poc e29514f9b1206b40f2bbc7b97e86c6f35373b0b0; range-scoped signed fragments | Best flexible spot-assembly lead. E2 has not integrated it. Full-body signing is not a new OTX. |
| A2 / compact C | Frozen Trade sources and benchmarks | Reuse funded orders, direct payouts and batching. General recovery/LO-01 remain unresolved. |
| Liquid Cells | LusoCryptoLabs/Liquid-Cells 47492b51673c94635ab23de2c55477625e94ccbf; reviewed `escape.rs`, force-exit/withdrawal CKB-VM test source, DA and threat-model docs | Pinned code describes SMT proof + nullification, pubkey-derived payout lock, 180-epoch silence gate, and reconstructible checkpoint-witness DA. Strongest pooled-claim prior art found. Trade source-reviewed, but did not build/run it. Publisher describes pre-alpha/testnet and unaudited. Small unilateral exits still hit the ~61 CKB Cell floor; smaller path relies on swap/Fiber liquidity. Shared anchor contention and archive-history recovery remain material. See `WO09_E2_LIQUID_CELLS_SOURCE_REVIEW.md`. |
| CoTA | nervina-labs/cota-aggregator a46f62cce406301490983d205edfdd97016e5379 README | SMT aggregator and syncer depend on indexing/database service. Reuse compact asset infrastructure only after verifying exact token exit rights. |
| Fiber | nervosnetwork/fiber 45ffdac8bd2d56f6e9cd4a01c2b2e4975c3e4397 README | Multiasset channels, micropayments and swaps if routes/liquidity exist; WIP. Good recurring-payment comparator, not arbitrary derivatives. No node/route executed. |
| Perun CKB | perun-network/perun-ckb-contract 6d57616889dce1145d7c964cb56305ccd0105a04 README, Apache-2.0 | Channel Cell, signed state updates and disputes. Reuse before inventing channels; entry collateral and close recovery still cost. No E2 execution. |
| Myelin | Myelin-Labs/Myelin f0013339a1459577ab44d02bbcf7fb28e0796f48 README/session-safety | Finite off-chain Cell transitions, VM groups and configured finality; not a full node or permissionless L2, nor automatic enforcement of arbitrary custody rights. |
| Tactus O1 | Tactus-Labs/tactus-o1 a1903b6bbbc92bde11e960cbf3d78a835cba8e71 readiness | CKB-ordered rollup direction; readiness says production admission/custody/safe exits unfinished. No third-party production claim. |
| Anyone Can Pay | CKB receiver-side reuse candidate | Exact version, prefix, assets, fees and cell behavior not sourced/tested here. No universal tiny payout claim. |

Do not copy third-party code. Fetch failures and unknown source revisions remain explicit in the machine-readable source record. Reuse OTX for spot, Fiber/Perun for recurring channels, ACP only after its exact rules are verified. Invent a pooled claim only if it beats Liquid Cells and CoTA on a specified right and independent exit.

# Architecture comparison

| Family | Marginal state | Exit/concurrency | Status |
|---|---|---|---|
| Funded E1 claim | About150 CKB per claim plus deployment/event | Independent owner exits; output floor/funding bound | Existing E1 fallback, not recounted |
| Whole-body OTX intent | Zero order Cells | Complete fill; spent input invalidates draft; every required owner signs | One atomic xUDT/CKB swap committed; no OTX fragment integration |
| Merkle root + nullifier | Root/bitmap per shard plus roughly61 CKB per separate normal nullifier | Root serializes; shard isolates some conflicts; proof/DA needed | Model only |
| Liquid Cells pooled claim | No per-user balance Cells; one shared anchor per pool/shard; 56-byte DA record per touched leaf | Authenticated owner-path exit after 180 silent epochs; shared-anchor conflict; standalone payout floor ~61 CKB | Pinned host STF 49/49 and CKB-VM 24/24 passed with disclosed Zig adapter; no Trade private-devnet exit |
| Static predetermined cohort | Shared manifest plus per-user spent state or shared mutable root | Static ownership proof/data availability; duplicate-exit problem persists | Hypothesis only |
| Fiber/Perun channels | Funded channel state/collateral; routine actions off chain | Channel path/counterparty and close/recovery requirements | Prior-art source study only |
| E2 unexpected spot baseline | No order Cell; reuse wallet and asset outputs | Full-body signatures and complete atomic swap | Verified local execution; narrow workload |

One-root vault remains worth testing: authenticated batched exits may amortize state. The decisive benchmark needs 16/32 users, complete DA, two exits, final claimant and operator absence against Liquid Cells and E1 funded claims. No vault has passed yet.

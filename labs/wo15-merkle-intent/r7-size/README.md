# Bounded R6 compiler experiment

VERIFIED on disposable private chains. This compiles the unchanged R6 candidate with `-Oz -flto` and section elimination. `-Wl,-u,main` is required because LTO otherwise removes the entry point referenced by startup assembly. It retains the R6 proprietary signature format; it is not the R7 wallet-compatible covenant.

| Measure | R6 -O2 | -Oz LTO |
|---|---:|---:|
| Binary bytes | 60,336 | 48,400 |
| Code cell capacity CKB | 60,377 | 48,441 |
| One intent cycles | 4,773,156 | 4,785,943 |
| 50 intent cycles | 134,623,290 | 137,948,231 |

These are estimate_cycles for subsequently committed transactions. The one intent transaction is 0xd7529fe932d2528b2dc8d14d9074fc3085561df091b5178f3f884ed9301b218e; 50 intent transaction is 0x3bc64dec4f3564844c353a3e87b850fe8afc1b5efc6df4c7d5cd9d4b91ade9f2. Fifty positions belong to three controlled sellers and one buyer. The one-intent test passed the R6 root-change, recovery and nine expected rejection cases; offline replay of both runs succeeded. These tests do not establish complete security equivalence.

SHA256: 1f8a19c3570d42a263e64934178a6799be68b53f939aa5c552b4e56dfd99f885. CKB data hash: 0xbd93114749391b16d7bfaf6c3fd9d33197bd2d013f97ae218934d54f1610d741. Evidence directories hold private-chain traces and receipts.

Rebuild after the R6 prerequisites: `bash labs/wo15-merkle-intent/r7-size/build.sh`. Private-chain tests run sequentially using `node labs/wo15-merkle-intent/r7-size/run.cjs` and `COUNT=50 FIXTURE_FEE=50000 node labs/wo15-merkle-intent/r7-size/run.cjs --batch`. Requires localhost port 19224 and public disposable fixtures only. The executable code cell in the fixture uses an unspendable lock, so its capacity is not necessarily recoverable.

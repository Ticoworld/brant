# Independent recovery boundaries

3 November 2026. This is a claim-by-claim classification, not a single self-custody label. Native evidence and source are isolated under `labs/wo09-unified/capacity-access`.

## When Trade and the original funder disappear

No operator process/key is needed to authorize the pool. During the native experiment the original funding key is made unavailable to the runner; later the cooperating recipient/provider key is also unavailable. Owner-only transactions then consume the shared vault, verify real witness signatures and fund miner fees from those owners' backed balances. Neither original provider input nor signature appears. This is an actual native transaction property, not a claim that a public service outage was simulated.

A fresh process reads committed history from the validating private node, replays every old/new leaf/path, checks balances/root/capacity and verifies the referenced latest vault is live. It recovers the owner's current record/proof after other owners update the pool and withdraw. It does not use the original builder's receipts/database. The owner still possesses its key and needs an accessible canonical chain/archive. Declared chain/genesis domain is checked by the client/verifier against the actual devnet genesis; it is not a separate on-chain foreign-consensus proof.

Controlled withholding of an enrollment transaction stops reconstruction with `CONTROLLED_MISSING_HISTORY`. No root-only/private-indexer-loss success is substituted for missing public history. The complete data is public in committed witnesses, but this experiment establishes neither an archival SLA nor recovery from a pruned/reorganized/adversarial network. It tests a fresh process against the existing validating node, not a fresh full-node synchronization from genesis.

## What remains independently possible

- Control of funded principal: only the appropriate owner(s) can authorize tested leaf movements. Invalid signatures, substituted public keys, signatures for a different amount and cross-market signatures reject.
- Owner-funded transfer: users with sufficiently valuable claims can pay real transaction fees inside the existing shared vault without personal or sponsor inputs. Receiving owner consent and a current proof are required in this construction.
- Large ordinary withdrawal: if the backed claim can itself cover receiving capacity and fee, the owner can create a new standard Cell. Carol does so, then actually spends it with secp authorization.
- Small ordinary withdrawal: fails without receiving capacity or another arrangement. Alice/Bob's direct outputs pass script estimation but fail consensus occupied-capacity checks. This is not lost ownership: the funded claim remains, but exact-value independent L1 cash realization is unavailable under those conditions.

## Conditional routes are not unconditional C

The native merge pays an existing separately controlled, funded, signed recipient Cell. It demonstrates authorized value delivery, not that the original owner now has its own ordinary L1 cash. Selling a claim for external value requires a willing counterparty and actual payment path; this lab does not supply a fiat oracle or a quoted buyer.

A distinct provider gifts61CKB for Bob's ordinary receiving Cell; Bob then spends that output with his own secp key. The provider must be available and willing. The gifted capacity becomes Bob's property; there is no demonstrated unilateral provider reclaim/reuse. Calling it a loan would require separate agreed enforcement. If its reclaim lock restricts Bob's ability to spend, the result is not unrestricted ordinary CKB. No provider disappearance is hidden by restoring its key for this route: restoration is explicit in the runner.

ACP can use suitable existing funded destinations under its own lock conditions. A Fiber route needs existing funded channel capacity/liquidity and qualified closing behavior. Pooling several people into a new shared output preserves individual ownership only if the continuing control covenant is demonstrated; it does not make that output independently spendable by each claimant multiple times.

## Capacity provider's own recovery

The282CKB cushion is immutable. Reducing it while keeping customer liabilities rejects at33; closing with outstanding claims rejects at32. A provider lease expiry, insolvency or commercial dispute does not create a script permission to seize user principal. There is no implemented expiry/default-forfeiture operation. If an owner loses its key or never settles, the provider may never recover its cushion. This is an explicit economic trade-off, not a solved inactivity problem.

Only after every liability is discharged can the designated provider recover cushion/remaining subsidy, less actual closure fee. A disappeared provider's own key is restored **only for that final control** in the test. Customers did not need it for earlier owner-only trading. Sponsor inability to fund new entries/exits affects future service and liquidity, not authorization of existing funded claims.

## Fees, conflicts and failure cases

Prepaid subsidy is finite and can be exhausted by authorized fee-paying activity. A test deliberately consumes it; claim-funded trading then still succeeds. Zero-fee valid scripts separately fail relay policy. A claim below actual fee requirements may need incoming value/subsidy/counterparty help; no universal dust-exit promise is made. Fixed maximum fee policy could itself become a liveness constraint if network conditions change.

Concurrent requests share a UTXO. One transaction's commitment invalidates a conflicting spent outpoint; rebuilding with an old proof/intent still rejects. Successful later owner operations show the failed request did not erase its balance. This is bounded conflict/recovery evidence, not anti-starvation or fair sequencing. An active owner can repeatedly change roots or consume subsidy; no public-network load/fairness test was run. Independent cohorts reduce cross-cohort contention but cost additional cushions.

Quarantined WO09-E1 beneficiary validation and A2 LO-01 are neither resumed nor resolved by these tests. New ownership/witness validation applies only to this isolated cash-right pool. Independent review, malformed-key/signature fuzzing, wallet integration, archive/reorg and multi-asset qualification remain necessary before replacing any established contract.

Final recovery-driven qualification: `native-1793683642752` completes26committed transactions and25 independently verified owner signatures with0.5CKB initial Alice funding. Before recovery the runner deliberately deletes its tree and vault cache. A fresh process discovers the latest matching live vault by scanning canonical public blocks (market code/ID only), reconstructs records/configuration/proofs from committed history, and supplies the actual next transaction builder state. Owner-authorized transfers then commit with original funding key absent. This supersedes the weaker earlier observation that a child could return proofs while the builder still retained cached state. Controlled missing-history failure applies to this implemented reconstruction routine; it is not deletion of all public copies or proof that another archive/block retrieval could never recover them.

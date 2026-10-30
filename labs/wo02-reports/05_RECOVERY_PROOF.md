# Coordinator-independent recovery

## What was demonstrated

The coordinator is a separate process that accepts a signed terms record and writes a private database. The integration driver kills it with SIGKILL and removes that database. Recovery then runs as a new Node process reading an exported package, a matching independently retained environment and, only for first disclosure, the secret owner's local secret file. It never reads the coordinator database or uses a coordinator asset key. There is no coordinator asset key.

Sixteen primary successful exchanges cover both customer directions and the configured coordinator-death checkpoints. Source-only funding and abandoned two-escrow trades also refunded independently. Extra tests discarded actual EVM claim responses, then recovered the transaction receipt and preimage event by precomputed hash. CKB claim response loss was similarly reconciled from the submission journal and actual committed transaction body, with a second attempt correctly unable to spend the same outpoint again.

This is a scoped recovery demonstration, not a claim that any state can be reconstructed from a wallet seed. The recovery package must be retained. Package writes use atomic rename; filesystem power-loss durability and loss of both local secret/backups are untested. A missing-outpoint artifact failure in an earlier run is preserved and described in report 04.

## Minimum data

The package contains exact signed terms, both acceptance signatures, both chain identities, exact token/escrow code identity, recipient scripts/addresses, integer amounts, hash and algorithm, refund height/timestamp, CKB code dependency and funded outpoint. The secret remains with the CKB funder until disclosure. After disclosure a watcher can extract it from the EVM Claimed event; after a successful CKB claim it is also in the CKB witness.

The local environment pins expected participant identities and validating-node RPC endpoints. The recovery client checks genesis/chain ID, deployed EVM code hash, actual CKB escrow lock and actual token-order storage. It compares funded recipient/amount/hash/deadline/digest/funder before disclosing. This uses trusted interfaces to our own validating development nodes. It is not a foreign proof verifier and does not establish safety against malicious RPC responses.

## Recovery paths

| Observed state | Action | Keys/data required | Demonstrated outcome |
|---|---|---|---|
| Nothing funded | Abort or continue fresh authorized funding | Participant authority, no recovery claim exists | Coordinator death does not seize funds |
| Only CKB funded | Wait for H, refund to pinned CKB funder | Public package, no secret | Principal returned, closing/funding fees paid |
| Both funded, no secret revealed | Complete only with verified terms and budget, or independently refund each after eligibility | Secret owner for first reveal; anyone for fixed-beneficiary refunds | Both paths exercised |
| EVM claim committed | Extract event secret, claim CKB | Package, public event, EVM gas for monitoring calls/CKB close reserve | New process completed source claim |
| Send response lost | Query known hash/outpoint/order state | Pre-send journal and package | No blind duplicate funding |
| Funding rolled back | Refuse first disclosure, recover surviving funded leg | Package plus canonical local chain data | EVM and CKB funding rollback cases exercised |
| EVM claim removed after CKB payout | Verify committed CKB payout/witness, re-include EVM claim before T | Public CKB claim transaction hash as validated hint, package and secret | Focused repair demonstrated |
| Deep rollback/out-of-budget delay | Recovery may no longer be possible | No software can recreate a lost exclusive claim | Principal-loss evidence preserved |

## Substantive repair: re-inclusion after source payout

A client rule that requires both escrows to remain live is appropriate before first disclosure but wrong after the secret is public. A focused test paid EVM, paid CKB, waited for the chosen CKB confirmation depth, and rolled EVM back to the funded pre-claim state. The old live-escrow check refused recovery. The repaired client accepted a public CKB claim transaction hint only after verifying commitment, selected depth, consumption of this exact funded outpoint, exact recipient/principal and the hash-locked preimage in the witness. It then re-included the EVM claim successfully while T remained open.

The hint does not need trusted provenance because the client verifies it. Automatic discovery of every spender through a production indexer is not implemented. The repair prevents this particular client-induced dead end. It cannot repair an EVM rollback after T followed by a completed token refund. That loss remains in the deep-reorg case. The core CKB/EVM contracts were unchanged by this client repair.

## Watcher obligations

Anyone can operate the watcher or replace its process. It needs the package, its matching environment, access to honest validating nodes and an EVM gas-paying key. It does not need the coordinator database or beneficiary private keys. CKB closing fees are prepaid in the escrow; permissionless triggers pay to pinned beneficiary wallets. The EVM watcher pays transaction fees, and that balance was deliberately zeroed in a test: recovery failed until gas was restored. Replaceable monitoring does not create fee reserves automatically.

The watcher must observe and act early enough for a CKB claim to commit before an adversarial refund can win. In this exact schedule, 26 blocks of delayed observation recovered; 27 blocks admitted a competing refund first and principal was lost by the token funder. No conversion of that number into a universal number of seconds is justified. The experimental eight-block remaining-height guard before first disclosure is not a calibrated production downtime guarantee.

## Limits of the proof

The tested protocol can recover without an exchange operator within the demonstrated histories. Its general safety still depends on bounded relative chain progress, inclusion, monitoring, fees and reorganization depth. The experiment has not proved a complete relation between those production bounds. Data availability, honest RPC/validating-node operation, gas reserves and retained private secret material remain explicit responsibilities. The final classification is safety unresolved, not production secure.

# WO09: actual two-asset RFQ, 2026-11-03

Baseline: `dfbbc1d9ce92fd5c066a7356ba6990ecc9aceb59`, branch `wo09-unified-breakthrough`. Capacity-access remains frozen PARTIAL ADVANCE. No quarantined beneficiary or LO-01 experiment was resumed.

## Hypothesis and scope

Can key-only owner authorization control an exchange of genuinely backed CKB and xUDT balances, with actual token delivery afterward? Yes in a bounded two-owner native experiment. This is more than a CKB-claim assignment, but is not a direct one-transaction external-wallet swap, public orderbook, OTX protocol or commercially qualified DEX.

New isolated implementation: `labs/wo09-unified/trading-return`. The 192-byte state commits configuration, creator/funder capacity ownership, asset type, liabilities, live count and Merkle root. Leaves authenticate owner, CKB, token quantity and nonce. Every transition proves its permitted old/new leaf changes; arbitrary liability-preserving roots are insufficient. State and actual xUDT reserve must be paired outputs0/1 of the same predecessor transaction, recreated together. Reserve cannot spend alone. Integer bounds and real xUDT amounts are checked. The state requires330CKB, token reserve155CKB:485CKB shared occupied capacity, excluding principal/fees/code. Actual token quantity uses the published16-byte xUDT representation; this experimental accounting deliberately limits quantity to uint64.

Owners sign `TRADE_TWO_ASSET_V1`, executing script hash, declared chain domain, raw transaction hash and canonical witness including public keys with signature slots zeroed. This is full-body signing: both parties coordinate and re-sign when the shared predecessor/root changes. No portable independent signed fragments or passive upper expiry were demonstrated. Chain domain is a client-checked declared domain, not an external chain-consensus proof.

## Actual execution

Successful evidence: `labs/wo09-unified/trading-return/evidence/native-1793690123197`. Thirteen committed transactions on a disposable CKB0.210.0 chain; independent offline UTXO/asset/root/accounting replay checks nine owner signatures with Node/OpenSSL. The complete market closed with zero CKB/token liabilities. Raw transactions, committed statuses, hashes, bytes, cycles, fees, cases and public-history reconstruction are retained.

External funder supplies Alice and maker Bob1CKB each. Genuine published xUDT issuance creates maker inventory; Bob deposits100 TEST (six hypothetical decimals) into the real reserve. Alice pays0.1003CKB for0.2 TEST, and separately pays0.0001CKB transaction fee. Bob receives0.1003CKB. Both independently generated Ed25519 keys authorize the exact exchange. Alice has no personal Cell before/after funding and exchange, checked by UTXO scanning. Bob has ordinary funded inventory Cells; this fixture does not claim every maker begins without Cells. TEST has no demonstrated external market value or redemption peg.

Fresh-process reconstruction replaces local tree/vault/reserve caches. With original funder key and maker Ed private key disabled, Alice uses the reconstructed state to withdraw actual xUDT and remaining CKB. An independent fixture participant first supplies a142CKB recipient Cell controlled by Alice's independently generated secp key. Alice signs that real recipient input and the claim authorization. This is explicitly conditional funded receiving capacity, not free or unconditional small withdrawal. Maker key is restored only for maker's own withdrawals; funder key is restored only for empty closure.

Representative committed exchange hash: `0x121d4feff8c5327459c5882a816cda94e88ea4dd5a8b035885cb9d33150ca39b`. All other exact hashes are in `events.json` and `independent-verification.json`; no live node persistence is implied.

| Action | Serialized bytes | Actual estimated VM cycles for committed transaction | Fee shannons |
|---|---:|---:|---:|
| Create paired market |1425|3,368,256|10,000|
| CKB funding, Alice |1430|7,510,707|10,000|
| Maker token deposit |1531|7,527,615|10,000|
| Two-owner exchange |1432|11,503,957|10,000|
| Customer actual token withdrawal |1531|7,481,287|10,000|
| Customer cash withdrawal |1531|7,450,454|10,000|
| Empty closure |561|1,777,616|10,000|

Cycles are node `estimate_cycles` on transactions subsequently committed, not wall-clock execution profiling. Full run fees2,110,000shannons=0.0211CKB include deployment/issuance (1,000,000each); selected10,000sh transaction fees are fixture fees, not proven minimum network fees. One CKB=100,000,000shannons.

Binary50,400bytes, SHA256 `3b367c36ff57bea842b28850d9c310cf9a78dfb785ec5671fb877b9ad8035ee8`; code Cell50,441CKB. This is a real cold-deployment burden. Reuse is possible but commercial utilization is not established. Do not assume immutable deployed code capital is recoverable.

Published xUDT SHA256 `e9b92e5783f692f6ee99ca20eeda5f3da282e0f4010eb4fbd3db4e3058239349`, pinned vendored iCKB contracts commit `c951927e35fb5d4a13e28c5e55687d49cea7ca05`. Actual VM acceptance qualifies that binary in this fixture, not a rebuilt-source equivalence claim.

## Negative evidence and correction

Missing maker signature and changed price with old signatures reject at exchange lock82. Unbacked token liability and asset substitution reject34. Spending reserve without paired state rejects11. Replaying the filled quote rejects during outpoint resolution, before contract execution; it is not counted as a script-level rejection.

First run `native-1793689981524` failed creation at published xUDT Outputs[1].Type error8 after deployment/issuance. It did not complete. The correction consumes genuine existing maker token inventory and recreates that unchanged inventory alongside zero reserve, rather than creating the reserve without an existing token-group input. Published xUDT then accepts. This is an observed Cell-construction difference; exact upstream error8 branch/cause has not been independently source-mapped, so no broader rule is asserted. Source creation bound was adjusted from three to four outputs for this valid construction; financial/signature checks remain enforced.

## Limits

Only two owners and one controlled quote were exercised in this new contract. Earlier thousand-owner financial/kernel measurements do not qualify this binary. No actual public maker, stablecoin peg, two-sided live market, adversarial market-order starvation, arbitrary-history security audit, mainnet relay validation, token issuer-economic guarantee or unconditional sub-minimum external exit was demonstrated. Code and offline verifier are research implementations, not independent security qualification. LO-01 and quarantined E1 beneficiary liveness remain unresolved in their original scope.

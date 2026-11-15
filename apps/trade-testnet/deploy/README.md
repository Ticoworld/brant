# Pudge preparation — no deployment performed

Contract: original configured binary `labs/wo09-unified/build/merkle_market_configured` relative to repository root.17,848bytes, SHA256 c569360ba498e715899635410dc0474003e8f61c6afc08a5c3f2a87527711c1f. CKB data hash0x53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f, hash_type=data1. Source and old research binaries unchanged.

`pudge.template.json` fails closed without genesis/code/secp. `pudge.prepared.json` and `public/pudge.json` contain publicly read Pudge genesis and CCC secp dep-group, but **code:null**. Market actions therefore stop before wallet signing. No dummy deployment outpoint is used.

Read-only refresh:

```sh
NODE_USE_ENV_PROXY=1 node --experimental-strip-types tests/prepare-pudge.mts
```

After explicit approval for a controlled public Pudge deployment, the operator must fund and deploy the **exact binary**, record deployment raw transaction, code output index and confirmations, verify live code data hash, and populate `public/pudge.json.code`. Keep network=pudge and verify genesis0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606. Do not point it at mainnet or claim a local deployment is Pudge. Prefer an immutable/unspendable code Cell as in the native baseline; its17889CKB occupied code capacity is then not recoverable by the publisher.

Funding requirements, all test units:

- Code17889CKB, plus deployment fee and necessary change. This is occupied code capital, not miner fees.
- Market322CKB shared cushion, plus funder's plain replacement of at least61CKB and create fee. Creation builder selects one Cell of at least383.001CKB with current fixed fee.
- Each contributor's selected plain Cell must fund0.125CKB contribution,0.001CKB fee and retain at least61CKB. Two independent pilot owners are required.
- Creator needs its own plain funded Cell to authorize activation; funder/creator may be the same wallet to reuse capacity. Buyer for the0.01CKB assignment needs at least61.011CKB in its chosen input. Seller receives full0.01CKB; buyer pays fee.
- Additional fees for refunds/redemptions/closure, and any fee-rate changes, must be budgeted. Do not double-count reusable wallet change or protected backing.0.1CKB backing per minimum contribution is neither creator proceeds nor protocol revenue.

Controlled pilot acceptance after deployment: two real consenting ordinary-secp Pudge wallets connect, contribute, activate, sign the identical paid assignment, reject former-owner redemption, redeem after actual maturity, recover from a separate browser/profile with no receipts, and close with no obligations. Preserve actual testnet transaction hashes, fees, wallet versions and rejection reasons. Validate indexer support for get_cells, archival witness availability, wallet signing/dep stability, current relay fee and network confirmations. The local fallback scans at most2000blocks and is enabled only for local manifests; it is not a public-chain indexing solution.

Pudge wallet round trip, actual public deployment, faucet funding, provider rate/availability and external-wallet multi-signature behavior remain **unperformed**. No security/audit qualification follows from the local fixture. Do not expose fixture mode, signing keys or a signing server during a pilot.

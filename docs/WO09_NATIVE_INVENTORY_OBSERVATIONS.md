# Native inventory observations — 2026-11-03

The November2 [iCKB release announcement](https://talk.nervos.org/t/ickb-is-now-fully-on-ccc-new-dapp-sdk-and-bot/11092) is verified public evidence of a CCC-based DApp/SDK/bot release. It advertises pre-wallet conversion previews and an improved liquidity policy; its example fills are testnet examples. Do not infer mainnet working inventory or guaranteed fills from that announcement.

Pinned [ickb/stack](https://github.com/ickb/stack) `c8edfa8276108472612e2f1965e18ff85b0da73f`, SDK9002.0.0, CCC1.23.0. The prior statement that native inventory quotes had not been obtained was an investigation gap, not evidence no public read existed. That gap is corrected: the actual `IckbSdk.getL1AccountState` pool/order read ran successfully without a wallet, and the raw unfiltered `OrderManager.findOrders` ran too.

## Actual observations

Evidence under `labs/wo09-unified/inventory-discovery/evidence`:

- `read-1793695361962`, mainnet.ckb.dev: parent block20913440, timestamp2026-11-03T08:42:19.734UTC (09:42WAT), ratio1.2079340403919227CKB/iCKB gross reference.18 resolved groups,18 fulfilled,0matchers in both directions.24 live pool deposits;0ready for wallet withdrawal now.
- `read-1793695599555`, mainnet.ckbapp.dev: block20913464, same18fulfilled/24deposit/0ready pattern. Two endpoint hostnames corroborate the bounded state observation; organizational independence or independent consensus verification is not established.
- Earliest modeled pool claim at first reference snapshot2026-11-08T23:42:25.599UTC; latest2026-12-01T19:36:21.921UTC. These epoch-derived dates use nominal epoch timing and are estimates, not wall-clock consensus promises. Total valued backing2,899,041.59155478CKB; total recorded pool tokens2,399,999.91269602iCKB. This backing is not immediately deliverable maker inventory.
- Sampled fee rate33,222shannons/1000bytes. SDK marginal order-fill fee10,598sh, ten-fill-fee profit gate105,980sh; new-order maturity threshold332,220sh uses a different conservative proxy.

A fulfilled buy may contain tokens and a fulfilled sell CKB, but those assets belong to the order owner, not to a new taker or maker. Counting those balances as order-book inventory would invent liquidity. Actual currently executable bid/ask: **none observed in the canonical Stack book at these snapshots**, so actual$20/$50/$100 output, executed spread and fill delay are **unavailable**, not zero-cost or simulated fills.

## Exact identity and deployed code

`identity.json`, `deployment-group.json`, `deployed-code-hashes.json` bind the configuration to live code Cells. iCKB is not arbitrary TEST xUDT:

- Type code `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95`, hash_type=data1.
- Args `0xb73b6ab39d79390c6de90a09c96b290c331baf1798ed6f97aed02590929734e800000080` (36bytes).
- Logic data hash `0x2a8100ab5990fa055ab1b50891702e1e895c7bd1df6322cd725c1a6115873bd3`.
- Order data hash `0x49dfb6afee5cc8ac4225aeea8cb8928b150caf3cd92fea33750683c74b13254a`.
- Mainnet dep group `0x621a6f38de3b9f453016780edac3b26bfcbfa3e2ecb47c2da275471a5d3ed165:0`.

The read recomputes referenced live code data hashes; the SDK checks read header/transaction-body hashes as documented. This is not a new source-rebuild equivalence audit or canonical-node proof. No recovery signing or adversarial A2 lineage validation was performed. LO-01 remains outside this investigation.

## Second native asset: RUSD/CKB investigation

UTXOSwap SDK `3912cb61ed1f4d9882f4ba14b87f1eb665c7b845` documents mainnet RUSD code dependency `0x8ec1081bd03e5417bb4467e96f4cec841acdd35924538a35e7547fe320118977:0`. Native RPC independently confirmed it live, derived its type code hash `0x26a33e0815888a4a0614a0b7d09fa951e0993ff21e55905510104a0b1312032b`, and sampled100 live token Cells under that hash. Observed args `0x360c9d87b2824c357958c23e8878f686001e88e9527a08ea229e7d9ba7fe39a7`, hash_type=type. Sample is explicitly incomplete: no supply/TVL/depth total follows. This is the CKB-native contract identified by the documented RUSD dependency, not unrelated similarly named Ethereum/Solana/Radius assets. Issuer solvency and a current$1 redemption promise have not been qualified.

[Stable++ official site](https://www.stablepp.xyz) remains reachable and publicly describes its native collateralized asset. UTXOSwap source independently identifies RUSD support, but its documented public pool/config read attempts returned403 without credentials. No API keys were supplied, borrowed from examples or extracted from app bundles. Explorer first rejected a content type415; the corrected ordinary request returned403. App and UTXOSwap page tunnel denials were respected. No attempt bypassed access controls. Third-party reports describe an October shutdown, but the primary shutdown page could not be retrieved here; that report is contextual, not a verified operational fact.

Result: independently verified native asset/contract and historical venue integration; **current executable RUSD/CKB market, reserves, output amounts, minimums and firm bid/ask could not be verified**. Do not label this a verified current liquid market. The second-asset investigation ends at this explicit data/access boundary rather than inventing a market or expanding indefinitely.

Scope caveat: Stack filters unsupported dual-ratio orders and resolves groups under its exact configured order/token scripts. These observations concern that canonical Stack universe and the sampled public-node state, not every possible A2 variant, private RFQ or venue. Indexer scans are not atomic snapshots; hashes and repeated endpoint agreement improve confidence but do not establish completeness against a dishonest or omitting node.

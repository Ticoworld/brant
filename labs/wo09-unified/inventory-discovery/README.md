# WO09 native inventory discovery — read-only

Baseline18c150a776e90b2a4ff174217dcbe44d3a1ee4bc. Existing native exchange and capacity labs remain frozen. No trading, signing, funding, submission, contacts or paid infrastructure occurs here.

Pinned upstream iCKB Stack MIT source and UTXOSwap endpoint/contract source are retained with provenance. SDK tests were not copied or claimed executed. Node24.19.0 strip-types successfully runs these public reads despite upstream's supported Node>=26; this is not a full runtime qualification. CCC1.23.0 uses the already installed rebuild environment. Do not run bot/sign/send entrypoints.

The local ignored `upstream/stack/node_modules` symlink points to the existing `labs/rebuild/native/node_modules`. Recreate that symlink after a fresh clone (or install the exact compatible dependency in a separate resource-safe environment).

```sh
NODE_USE_ENV_PROXY=1 node --experimental-strip-types labs/wo09-unified/inventory-discovery/src/read.mjs
NODE_USE_ENV_PROXY=1 node --experimental-strip-types labs/wo09-unified/inventory-discovery/src/read.mjs https://mainnet.ckbapp.dev/
NODE_USE_ENV_PROXY=1 node labs/wo09-unified/inventory-discovery/src/other-asset.mjs
python3 labs/wo09-unified/inventory-discovery/src/venues.py
```

RPC methods are explicitly read-only allowlisted. Public observations can change. `rpc.jsonl` is a sequence of pretty-printed JSON values (historical filename), not one JSON object per line. Raw outputs are retained; code does not sign or broadcast. New-order estimates are simulations, never labelled standing market offers.

Primary full reads: `evidence/read-1793695361962` and `read-1793695599555` from two documented public endpoint hostnames.18 resolved groups, all fulfilled; zero executable matchers in either direction;24 pool deposits; zero wallet-ready deposits. This is bounded public RPC evidence, not a separately synchronized consensus proof or all-venue liquidity claim. Pool quantity is2.4million iCKB approximately, but locked backing is not a standing bid or ask.

`other-asset.mjs` independently reads the documented RUSD mainnet code Cell and samples100 live Cells under its type-code hash. Exact script and incomplete-scan status are recorded. It does not establish executable market depth or a dollar peg. UTXOSwap pools/config endpoints return403 with no API key. A separate app/site tunnel denial was respected without route changes. Third-party sunset reports are not upgraded to independently verified shutdown facts.

Earlier exploratory reads and failed requests remain evidence. First local import path and urllib Request.method defects were corrected; neither was a liquidity failure. Final read uses exact rational notional conversion; earlier exploratory snapshots are not the final economics basis.

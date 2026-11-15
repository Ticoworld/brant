# WO17: experimental single-entitlement custody slice

This private-chain experiment is **not a production market, audit, or general Merkle ledger**. It makes a new market script identity; it reuses the WO16 one-shot owner and singleton marker mechanisms and creates a new genuine xUDT supply on a fresh chain. It does not reuse the already committed WO16 market or its supply, which cannot be modified to pay a custody lock: the WO16 purchase requires a standard-lock output. The original code is intact. WO16 source-to-binary and other boundaries remain unresolved and are not fixed by this experiment.

## Construction

The new market consumes the inventory, singleton marker, and a standard buyer funding cell. It preserves the exact marker/market/asset binding and marker capacity, charges the curve price to inventory capacity, and creates a custody-locked xUDT cell with quantity equal to the inventory reduction. The market checks the custody code hash, its market hash, buyer lock hash and exact asset type hash; it constructs and checks the single-entitlement root on chain. The custody cell's data is `u128 token amount || 32-byte root`. The root is `blake2b(0x01 || blake2b(0x00 || buyer_lock_hash || u64_le(quantity)) || 32 zero bytes)`. This is a fixed two-leaf Merkle construction with a fixed empty sibling, not an extensible tree or sum-tree.

Full withdrawal consumes the custody cell and a plain standard-lock buyer input; its signature is checked by that standard lock. The custody lock checks exact asset type, the buyer lock, positive quantity, proof and root, and requires an external standard buyer xUDT output with exactly the full custody quantity. The cell is consumed, so replay resolves a spent input. No off-chain balance is authoritative. The custody lock does not authenticate market lineage on its own at withdrawal; the purchase covenant establishes provenance at creation, and clients must independently follow the marker and custody outpoint. There is no incremental root update, partial withdrawal, multiple owners, deposits, offline sale, recovery or batching. Current output count and positional restrictions deliberately prevent composition. No policy, liveness, privacy or complete adversarial security is established.

## Reproduction

Requires CKB 0.210.0, Zig 0.14.1 and the pinned local native dependencies (see `../rebuild/mechanisms/README.md`). Public fixture keys 1, 2, 3 are for isolated chains only. From repository root:

```
bash labs/wo17-custody/build.sh
TRADE_NATIVE_ROOT=$PWD/labs/rebuild/native node labs/wo17-custody/run.cjs
node labs/wo17-custody/verify.cjs labs/wo17-custody/evidence/custody-<timestamp>
```

The generated market embeds the built custody binary's data hash; rebuild both together. The verifier resolves every committed input from the saved genesis or prior committed outputs, checks singleton and issuance identity, all output capacities and occupied minima, fees, quantities, root, proof, reserve change, exact negative script/code, balanced negative transaction capacity, and rejected spent-outpoint replay. It trusts the private node for consensus and actual execution.

## Recorded result

`evidence/custody-1794258109028` (CKB 0.210.0, Zig 0.14.1):

- Issuance `0xe73bc7a6be5b764371962b6c1ee7b6deab7f97abc29fa9503d245dfc0e7f5a00`: 1,000 in inventory.
- Purchase `0xa4cddbb5012e758ae94bf3eb756402d5fd713a8c9cb19853aa358d27e8ac8179`: 998 in inventory + 2 in custody, with buyer entitlement. Reserve increases 21 CKB.
- Withdrawal `0x3df0721973f57d9b2f80f98d488f292a766b70de479de93a09e31a9bbc011217`: 998 inventory + 0 custody + 2 in the buyer's standard-lock external xUDT cell. No tokens were minted or burned during these two transitions.

Incorrect market binding, purchase and withdrawal asset types, purchase amount, purchase root, proof, withdrawal amount and unauthorized buyer input were rejected by the expected market/custody locks. Repeated withdrawal was rejected by the node because the custody outpoint had been spent; this is a UTXO-resolution result, not a custody script execution. All tested negative transactions except the spent-input replay pay the same 0.01 CKB fee and meet occupied-capacity minima; mutation tests remain finite examples, not a general proof.

Estimated VM cycles: issuance 1,722,598, purchase 1,756,576, withdrawal 1,687,850; each committed transaction pays 0.01 CKB. Minimum occupied capacity: inventory 210 CKB, marker 258 CKB, custody 250 CKB, external buyer xUDT 142 CKB. Actual purchase uses 321, 300 and 300 CKB respectively for inventory, marker and custody; withdrawal uses 200 CKB for the external xUDT output. These are fixture values, not economic or network fee estimates. The earlier runs are retained; the final run adds wrong-asset cases, the unauthorized-withdrawer case and the explicit spent-outpoint assertion.

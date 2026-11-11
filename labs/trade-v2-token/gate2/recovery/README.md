# Trade V2 independent recovery client (experimental)

This directory implements chain-history collection, independent reconstruction, and an owner-authorized withdrawal path for the Gate 2 `TMS1` custody format. It does not use Trade's website, relay, solver, or database. The withdrawal command is implemented, but it has not yet been demonstrated against the integrated Gate 2 scripts on a private CKB chain.

## Data availability model

Every custody transition must put its complete `TMS1` update list and compiled CSMT proof in a committed transaction witness. Those bytes are included in the transaction data committed by CKB. Recovery starts from the documented market initialization transaction, obtains exact-script transaction history from an independently operated CKB indexer or scans canonical full blocks, retrieves every committed transaction from a full node, then replays the old/new proofs and owner revisions from the empty root. It independently rebuilds the full owner-keyed map and compares the resulting root and entitlement sum with the current live custody xUDT cell.

The client rejects an indexer gap because the previous custody and marker outpoints must be consumed exactly once by each transition, and because the final replayed outpoint/data must equal the live cell returned by `get_live_cell`. It checks each retrieved transaction's committed status, block height and canonical block hash. It snapshots the node tip before collection and checks that the starting tip remains canonical after collection; a detected reorganization requires a fresh run. The `collect-blocks` command performs this collection without an indexer.

The witness is proof-available only if full transaction bytes remain retrievable. An indexer alone does not provide every witness. The operator needs a CKB full node with archival transaction retrieval for the relevant history and an indexer synchronized through the canonical tip. A second independent provider can be used by rerunning collection and comparing bundles. Long-term historical availability therefore depends on at least one archival full node or replicated transaction archive; the chain does not guarantee that every public RPC provider retains old transaction bodies forever.

## Build and run

From the repository root, first build the verifier against the pinned vendored Nervos `sparse-merkle-tree` 0.6.1 dependency:

```powershell
cargo test --locked --offline --manifest-path labs/trade-v2-token/gate2/recovery/Cargo.toml
cargo build --release --locked --offline --manifest-path labs/trade-v2-token/gate2/recovery/Cargo.toml
node --test labs/trade-v2-token/gate2/recovery/recover.test.cjs
```

Prepare two JSON files containing the exact CKB `Script` objects:

- `custody-lock.json`: the complete custody lock script, whose args encode `market_script_hash || xudt_type_script_hash || genesis_hash || custody_marker_type_hash` (128 bytes).
- `xudt-type.json`: the complete genuine xUDT Type Script.

Then collect and verify:

```powershell
node labs/trade-v2-token/gate2/recovery/recover.cjs collect `
  --node http://127.0.0.1:8114 `
  --indexer http://127.0.0.1:8116 `
  --init 0x<market-initialization-transaction-hash> `
  --owner 0x<owner-lock-script-hash> `
  --custody-lock custody-lock.json `
  --xudt-type xudt-type.json `
  --out recovered-history.json
```

The collector writes the raw history bundle to the requested path and invokes the verifier to write `recovered-history.json.result.json`. The result includes the current owner balance/revision, a compiled membership proof, and—when the owner has a positive balance—a `TMS1` withdrawal transition witness and proposed next root. The witness must be appended at the index required by the transaction's custody lock group. A valid withdrawal transaction still needs a CKB input locked by the owner, the exact xUDT output and capacity layout required by the native contract, fees, signing, submission, commitment, and a post-commit check of the owner's wallet.

The verifier can also construct, sign, broadcast, and check an owner withdrawal from a fresh replay of that bundle. The command requires the node to be local, to report CKB `0.210.0`, and to have the genesis hash bound into the custody script. It verifies every history row again against canonical full-block bodies, checks current custody and marker cells, and searches canonical full-block history from genesis for a live plain CKB funding cell locked by the recovered owner. No indexer, supplied funding outpoint, local proof cache, or Trade service is required. The scan is bounded to 100,000 blocks by default and can be raised with `--max-funding-scan-blocks` (maximum 1,000,000). An explicit `--funding-outpoint` can be supplied instead.

If a process stops after broadcast, resume the canonical confirmation and live-cell checks without signing or broadcasting again:

```powershell
node labs/trade-v2-token/gate2/recovery/recover.cjs verify-withdrawal `
  --node http://127.0.0.1:8114 `
  --report withdrawal.json
```

Set a disposable test key only in the runtime environment. The key must match the recovered standard CKB lock; the tool never writes it to the output report:

```powershell
$env:TRADE_RECOVERY_PRIVATE_KEY = '0x<disposable-test-key>'
node labs/trade-v2-token/gate2/recovery/recover.cjs withdraw `
  --node http://127.0.0.1:8114 `
  --bundle recovered-history.json `
  --out withdrawal.json `
  --mine
```

`--mine` asks the localhost node to generate blocks while waiting for commitment; omit it when another local miner produces blocks. The tool first calls `estimate_cycles`, then submits with `send_transaction`, waits for a committed status, checks the canonical block body, and verifies the real live custody output/root, marker, external xUDT quantity, and spent input cells. The output file contains the signed transaction and public evidence. Pass `--sdk-root` if the pinned `labs/rebuild/native` SDK installation is elsewhere. Only use a private disposable chain and test key.

For offline transcript replay or testing a saved bundle without contacting RPCs:

```powershell
cargo run --locked --offline --manifest-path labs/trade-v2-token/gate2/recovery/Cargo.toml -- replay recovered-history.json recovery-result.json
```

## Native and service-shutdown status

The Rust tests exercise a synthetic two-transition bundle and prove that stale old leaves are rejected, roots reconstruct, entitlements sum to custody xUDT, and an owner proof/withdrawal witness can be generated. The Node test uses a local controlled JSON-RPC server to exercise collection and withdrawal construction, owner signing, canonical block checks, live-cell comparison, proof generation, and fail-closed behavior when a transition is withheld. Its transactions and committed status are simulated; it does not execute the withdrawal in CKB-VM.

**Verified native recovery checkpoint:** on 2026-11-11, a private CKB `0.210.0` four-owner chain was scanned from initialization through block `0x2c` using canonical full-block RPC only. Recovery reconstructed five committed custody transitions, found the owner's fee-funding cell from block history, and committed an owner-authorized withdrawal of 7 xUDT. `get_live_cell` confirmed the external xUDT output and the updated custody cell. A second full-block replay included the withdrawal and verified the current root, owner balance `0`, revision `1`, and `entitlement_total == custody_amount == 3`. The recovery key was injected transiently from the isolated test helper; no key was written to the bundle or report. The committed spend is verified from the canonical transaction inputs because this CKB node reports `unknown` for consumed cells through `get_live_cell`.

This checkpoint proves the recovery path on a four-owner native chain. It does not prove recovery in a separately provisioned environment with a key supplied independently of the test helper, nor the final 1,024-owner integrated journey. Those remain required before Gate 2 can claim complete independent recovery. After a reorganization, rerun collection from the initialization transaction; no cursor or local proof cache is authoritative.

## Known constraints

- The client requires a documented initialization transaction hash; it does not discover which of several market lineages a user intended.
- `get_transactions` must return complete history for the exact custody lock script. Partial indexers fail closed.
- `get_transaction` must return committed full transactions and witnesses. Pruned or unavailable history fails closed.
- The tool currently supports the Gate 2 fixed 128-byte custody args, 48-byte xUDT custody data, `TMS1` version 1, and at most 16 updates per transition.
- It validates the current custody and marker singleton output chain. Gate 1's broader market-lineage, mint-authority, and reserve security gaps retain their own verdict.
- The current withdrawal signer supports only the standard CKB secp256k1 lock and `data1` custody, marker, and xUDT dependencies found in genesis.
- The withdrawal fee defaults to the Gate 2 `FEE_LIMIT` of 1,000,000 shannons. It can be lowered with `--fee`; values over the contract limit are rejected.
- There is no transaction-history public proof publisher yet; committed transaction witnesses plus a full node retaining canonical block bodies form the current test data-availability path.

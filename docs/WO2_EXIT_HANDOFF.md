# Independent withdrawal handoff

The application recovery CLI can prepare a withdrawal for a private CKB 0.210.0 fixture and consume the signed RPC transaction from a separate signer. Use Node 22 with `--experimental-strip-types`. Run with the application server stopped.

1. Run `collect-blocks` from the initialization transaction with both market scripts and the owner lock hash. Use the canonical full-block bundle as `--bundle`.
2. Run `prepare-withdrawal` with `--node`, `--bundle`, `--owner-lock`, `--funding-outpoint`, and a new `--out`. The owner file contains only the public lock script. Review the artifact's network, inputs, destination, quantity, occupied capacity, change and fee. Amounts are in shannons.
3. Give the artifact's `transaction` to the isolated-chain signer. Export the signed RPC transaction. The owner signature belongs in the first standard-lock group witness at index 2. The extra TMS1 witness must remain byte-for-byte identical.
4. Run `submit-signed-withdrawal` with the same arguments, a fresh `--out` and `--signed` pointing to the signed RPC transaction. The command reconstructs the review, verifies the CCC signature and executes signed `estimate_cycles` before submission. Use `--mine` only on the disposable private node.
5. If submission returns an uncertain result, reconcile the hash in the saved report with `verify-withdrawal`. Recollect canonical history before any further preparation. After commitment, verify the owner entitlement is exhausted for a full withdrawal.

The archived native receipt recorded a signed estimate of `0x2062fa` cycles. The public unsigned estimate reported standard-lock failure at funding input 2. That input needs a recoverable 65-byte secp256k1 lock signature over the raw transaction hash, the zeroed first group witness and the extra witnesses, including TMS1. Empty witness bytes cannot satisfy the funding lock. R1 demonstrated the file handoff on two fresh isolated chains, including reconciliation after a dropped submission response.

## Future owner-operated Pudge acceptance

This procedure requires a separately authorized owner session and real extension compatibility.

1. Stop Brant. Run the lab CLI's read-only Pudge collection/replay and `prepare-public-withdrawal` for the registered market. Check current custody and marker outpoints, live dependencies, current entitlement, destination lock and selected plain funding Cell. Use the new review's values.
2. Check output 0 is the custody successor with preserved capacity, reduced xUDT amount and the new root. Output 1 recreates the custody marker at the same capacity. Output 2 is an owner-locked xUDT Cell with 142 CKB occupied capacity for the standard 20-byte lock and current token type. Output 3 returns the remaining capacity to the owner, with a minimum of 61 CKB. At the CLI's 0.01 CKB fee cap, the funding Cell must hold at least 203.01 CKB. Check the reviewed fee against current fee policy before approval.
3. Have the owner approve the exact reviewed transaction via UTXO Global. Verify the returned signature, transaction hash and untouched TMS1 witness locally. Estimate VM cycles using the signed transaction. Under the separate authorization, submit only the approved hash and resolve any uncertain response by querying that hash.
4. Fetch the full canonical block and committed transaction independently. Verify the spent predecessors, custody root and resulting owner-locked xUDT. Start recovery again from initialization and confirm the withdrawn entitlement cannot be spent again.

## R1 isolated acceptance

Use the three-owner bootstrap in labs/trade-v2-token/gate2/BROWSER_BOOTSTRAP.md with the closure build directory, the repository's labs/rebuild/native as TRADE_NATIVE_ROOT, CKB 0.210.0 and Cargo on PATH. Build the recovery verifier with the locked command in the recovery README. Place the platform recovery executable in apps/trade-testnet/lib/v2-engine/target/release.

From the repository root in PowerShell, run the native test with the newly printed bootstrap path and a fresh output directory.

    node apps/trade-testnet/tests/v2-exit-handoff-native.cjs <browser-bootstrap.json> <fresh-output-directory>

For the lost response case, start a second fresh bootstrap and run the fault proxy in a separate terminal.

    node apps/trade-testnet/tests/v2-exit-handoff-rpc-fault.cjs

Then run the same native test against the proxy with a new evidence directory.

    $env:WO2_EXIT_RPC = 'http://127.0.0.1:19226'
    $env:WO2_EXPECT_LOST_RESPONSE = '1'
    node apps/trade-testnet/tests/v2-exit-handoff-native.cjs <browser-bootstrap.json> <fresh-output-directory>

The proxy forwards the transaction, drops the successful reply and mines the isolated chain. The test requires the saved status to remain submission-unknown until a separate process verifies the canonical transaction by hash. Both runs recollect full-block history and check that the owner cannot prepare a second withdrawal.

## Standalone UTXO Global signer

Build from the repository root with the locked application dependencies installed.

    node apps/trade-testnet/exit-signer/build.cjs

Serve the two generated files in apps/trade-testnet/exit-signer-dist with a static HTTP server on loopback. Keep the Brant application stopped. The page reads genesis and live Cells directly from the pinned Pudge RPC. The review file and signed export stay in the browser and the selected wallet.

Import the v1 JSON produced by the lab CLI's prepare-public-withdrawal command. Review the address and amounts, connect UTXO Global on CKB testnet, then export the result after approval. The adapter uses CCC core 1.23.0 and UTXO Global 1.2.6. Its sign-only path delegates to the extension signTransaction interface and skips CCC transaction preparation. The signed export uses the RPC transaction format consumed by the isolated CLI. Public submission remains a separate, explicitly authorized owner operation. The isolated submit-signed-withdrawal command stays restricted to isolated chains.

Run the deterministic mock-provider regression with Node 22.

    node --experimental-strip-types apps/trade-testnet/tests/v2-exit-wallet.mts

The mock exercises the installed CCC adapter and compares the complete exported RPC transaction and witnesses to the retained signed receipt. A real extension session is still blocked pending owner authorization.

### Compact receipt and provenance record

| Isolated run | Transaction hash | Canonical block hash | VM cycles |
| --- | --- | --- | --- |
| Direct | fdca07174bf70eaedceda0ad38a5460987d1a1ab0b095479afb0b3b387f9be98 | 7ad8ee04af319e87b1286752564c73f11e40a88c6f00f2a3134612ece5ecf11d | 0x1fc98a |
| Lost response | 294f9339d18e3859d394dbc9d2918149d08c3b21c8b498ac5a45fe7c2b36bb96 | 5a2b68ebd1ba7d0051be88208f9348fae39d0f0cfa8de74898c5b0890bf3193d | 0x1ff2e8 |

Both receipts recorded 7 RVK in the external output and independent replay found zero owner entitlement afterward. The documented official archive retrieved from the bootstrap.py release URL matched SHA-256 68a94c191109bae172f8dcb71828dbdf0383e2c314e0658743db217472b27bdf. Its extracted node executable hashed to d687e478aa4a395ba9ce839473fe43684cacd4ad7a38096af1e331b8a1ddd178. The R1 portable node executable hashed to a6424a34b2adba5011d3ec1d49569c5effacb54b8dcf97cbb99c0c5800300bf0. These were different executables. R1 remains qualified against its recorded portable executable and matching Gate 2 and xUDT binaries.

### Owner session after the release gate

1. With Brant stopped, prepare a fresh v1 public review from the registered initialization and owner history using the lab CLI. Use the owner's public lock JSON, live funding outpoint and a committed withdrawal whose code dependencies match the registered custody, custody marker and xUDT Cells.
2. Run npm ci in apps/trade-testnet, then run the standalone build from the repository root as above. Compare the files against SHA256SUMS in the distribution directory.
3. Run python -m http.server 4173 --bind 127.0.0.1 --directory apps/trade-testnet/exit-signer-dist from the repository root. Open http://127.0.0.1:4173/ in the Chrome profile containing UTXO Global.
4. Import the review, wait for verification of Roveko Genesis and the RVK type script hash, then compare the displayed destination, quantity, funding outpoint, return and fee to the CLI review.
5. Connect the recovered owner account on CKB testnet. In the separately authorized owner session, approve Sign and export. Keep the exported RPC JSON locally for signed VM estimation and canonical settlement verification. Public submission requires separate authorization.

The clean-install and working-copy Windows builds produced matching SHA-256 hashes.

- index.html — 771b84265e635acc587c41da69626d820a352f682bdb1ee492f9bd278cba299b
- signer.js — 8fabc4688c7c0bb9a36ea931465e9c0b879508a6ca6c205143a3aa8e8456f29e

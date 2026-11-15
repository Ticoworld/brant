# Roveko Pudge owner handoff

## Status and limits

- **VERIFIED:** The isolated CKB 0.210.0 browser lifecycle used one disposable owner for code deployment, setup, issuance, first purchase, buy and sell. The Pudge-facing browser flow was also exercised against a simulated RPC, including a split and interrupted submissions.
- **VERIFIED:** The configured public RPC returned the pinned Pudge genesis, and the standard-secp and xUDT dependency cells were live with the expected data hashes when checked.
- **UNIMPLEMENTED AS A PUBLIC RESULT:** A real UTXO Global signature, public submission, confirmation, public market and public trade require the owner's actions. Do not treat a private or simulated result as a public transaction.
- **LIMIT:** Public custody proofs scan canonical blocks from initialization, with a 100,000-block bound and a 120-second process timeout. If the RPC cannot provide complete history or the scan exceeds those bounds, proof preparation refuses the trade.

## Local launch on this computer

From PowerShell, use the existing Roveko `main` worktree. The following paths identify the checked binaries and the temporary Node 24.19.0 runtime prepared for this session. The collector is a byte-identical copy of the repository's `recover.cjs` next to a freshly built recovery verifier. Temporary directories may be removed by the operating system; rebuild them if unavailable.

```powershell
Set-Location 'C:\Users\timot\.codex\worktrees\pudge-trading-app\trade\apps\trade-testnet'
Remove-Item Env:NEXT_PUBLIC_LOCAL_FIXTURE,Env:NEXT_PUBLIC_PUDGE_TEST_HOOK,Env:ROVEKO_LOCAL_PROOFS,Env:ROVEKO_LOCAL_BROADCAST,Env:ROVEKO_PUDGE_TEST_RPC -ErrorAction SilentlyContinue
$env:ROVEKO_GATE2_BINARIES='C:\Users\timot\Desktop\2026\CKB\trade-gate2-rebuild-closure-20261111'
$env:ROVEKO_SMT_BINARY='C:\Users\timot\AppData\Local\Temp\roveko-v2-01f-rust-smt-tools\release\trade-v2-smt-tools.exe'
$env:ROVEKO_PROOF_BINARY='C:\Users\timot\AppData\Local\Temp\roveko-v2-01f-rust-browser-proof\release\trade-v2-recovery.exe'
$env:ROVEKO_RECOVERY_COLLECTOR='C:\Users\timot\AppData\Local\Temp\roveko-collector-7270b7766bfc409e807dbe80a3fd18bc\recover.cjs'
$taskNode='C:\Users\timot\AppData\Local\Temp\roveko-node-43648741de4e4111a3c9c534fa41ddc1\node-v24.19.0-win-x64\node.exe'
& $taskNode .\node_modules\next\dist\bin\next build --webpack
& $taskNode .\node_modules\next\dist\bin\next start --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000/v2/deploy` in Chrome. The application uses `https://testnet.ckb.dev/` for Pudge RPC. The wallet and application must both be on Pudge.

## Owner actions

1. Connect UTXO Global and select its standard-secp Pudge account. Never enter a private key or recovery phrase into Roveko.
2. Click **Prepare unsigned review**. The page shows the connected address, live plain-cell capacity, selected inputs, reserved anchor, five code outputs, fee and change. The exact amounts come from the connected wallet's current live cells.
3. If the application says a split is required, use **Prepare wallet cell split**, review its inputs, outputs and fee, then separately request a wallet signature and broadcast. Reconcile the split before proceeding. If the cells already suffice, do not split.
4. After reviewing the code transaction, check the review acknowledgement and click **Request wallet signature**. Approve or reject the extension request yourself. A verified signature enables a separate broadcast action; signing alone does not broadcast.
5. If you choose to broadcast, click **Broadcast signed transaction**. Save the displayed public backup. Reconcile the submitted attempt and then the code stage; do not replace an attempt whose outcome is unknown.
6. For setup, issuance and the first purchase, prepare and review each stage, separately sign and broadcast, and reconcile it before the next. After the confirmed purchase, the app verifies a public manifest and opens `/v2`.
7. On the market page, reconnect if needed, verify the market, prepare a trade, review it, request a signature and separately broadcast. Reconcile before another trade. Save the public trade backup if a submission response is lost.

Backups contain public transaction data and signatures, not private keys. Browser storage is a recovery hint; the application checks the recorded history and live state against RPC. Never clear a pending record merely because a submission response is missing. Restore the code backup before restoring a wizard backup on another device.

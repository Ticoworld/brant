# Trade WO13: Windows owner handoff

4 November 2026 (Africa/Lagos). Canonical app: **`apps/trade-testnet`**. Cloud preparation is not real external-wallet acceptance. No public deployment, funding, broadcasting or signing is approved by this guide.

## Install and open — connection only

Use Windows PowerShell, Git for Windows and **Node 24.19.0 / npm 11.9.0**, the exact versions tested in cloud Linux. Obtain Node from https://nodejs.org/ and Git from https://git-scm.com/. Actual Windows execution remains an owner acceptance step; WSL and a local CKB node are not required for the frontend.

Allow at least **3 GB free disk** for checkout, one dependency installation and generated caches; prefer 8 GB system RAM. This is a preparation allowance, not a measured Windows minimum. The cloud dependency directory is approximately 840 MB and the existing Next cache approximately 430 MB. Do not copy cloud node_modules, caches or the old trade-pilot symlink to Windows. Never delete research files to free space.

```powershell
node --version   # expected v24.19.0
npm --version    # expected 11.9.0
Get-PSDrive -PSProvider FileSystem

git clone --branch wo13-trade-experience https://github.com/Ticoworld/trade.git
Set-Location trade
# Compare with the verified remote SHA in the delivery report:
git rev-parse HEAD
git ls-remote origin refs/heads/wo13-trade-experience
Set-Location apps/trade-testnet
npm ci
npm run dev
```

Open **http://localhost:3000** in your physical browser. The server binds to loopback (127.0.0.1). One app, one install, one start command. No development keys or backend credentials are required. If PowerShell blocks npm.ps1, use `npm.cmd ci` and `npm.cmd run dev`; do not relax machine-wide execution policy. Stop with Ctrl+C. A localhost port already in use must be resolved before continuing, not silently confused with another app.

Do not create `.env.local` for ordinary connection. In particular, leave `NEXT_PUBLIC_LOCAL_FIXTURE` unset: `/experience-fixture` and the developer builder fixture must be disabled. No mainnet endpoint, seed, private key or signing-server URL belongs in environment files. The public manifest remains `code: null`; it has not been populated with a fictitious deployment. The UI additionally requires explicit `publicSigningEnabled: true` after separate approval before transaction preparation. Do not edit either gate yourself to make a button work.

## External-wallet acceptance checklist — two independent owners

1. On your physical Chrome browser, install UTXO Global through its official site **https://utxo.global/** and its Chrome download link. Independently compare its listing at **https://www.nervos.org/wallets**. Create disposable testnet accounts under two independent, consenting owners. Do not import a production seed or share a wallet backup.
2. Select **CKB testnet / Pudge** in the extension. This pilot requires its native CKB signing path, not BTC, EVM, JoyID or OmniLock. If that path or testnet selection is unavailable, stop and report the extension version and visible error.
3. Open Trade, click **Connect wallet**, choose the genuine installed CKB connector and approve **account connection only**. Then click **Check wallet compatibility**. Reject any unexpected transaction-signing request at this stage.
4. Confirm each address starts `ckt…`. Exact required lock: code hash `0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8`, hash type `type`, 20-byte args. The application checks the full script profile; `ckt…` by itself is insufficient. Advanced shows the checked public address. A successful profile check still does not qualify complete transaction signing.
5. Repeat for the second consenting wallet/account. Verify that switching/disconnecting removes the previous checked ownership and requires a new compatibility check. Record browser and extension versions, each public address labelled Alice or Bob, and any error screenshots without secrets.
6. Inspect Markets' honest empty state, My Positions, Create Market's funding breakdown and Activity. Creation must remain disabled without an approved code Cell. No Pudge market, liquidity, balance or transaction should appear merely because a wallet connects.
7. Return **only the two public testnet addresses and public observations**. Do not send private keys, seed phrases, extension storage, signed offers or transaction approvals yet.

## Later gates — not authorized now

With actual addresses, perform read-only live/plain Cell and spendability checks and recalculate exact funding. Reference only: Alice 18,272.137 test CKB and Bob 61.137 test CKB under the combined-role, one-Cell budget; total 18,333.274. Unknown balances are not zero; a numeric shortfall cannot be computed yet. Fragmented balances do not necessarily satisfy the one-input builder. No faucet request or transfer is authorized here.

Next prepare a specific unsigned deployment, its funding outpoints, outputs, binary, fee and change. Only then request separate owner approval for that concrete transaction and testnet budget. Qualify real complete-transaction wallet signing without public spending where feasible. No hidden Node signer is an acceptable substitute. After explicit public authorization, commitment and live code verification, review the exact manifest before enabling the two-owner journey.

Frozen covenant SHA256: `c569360ba498e715899635410dc0474003e8f61c6afc08a5c3f2a87527711c1f`.
CKB data hash: `0x53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f`.
A mismatch stops deployment. Code capacity 17,889 CKB is distinct from the 322 CKB market cushion, 61 CKB retained wallet capacity, customer backing and spent fees. No mainnet assets are involved.

## Once separately authorized: paid-assignment handoff

Seller opens Positions in the verified market, selects their claim and the **Sell** tab, then enters the consenting buyer's public address and agreed CKB price, then prepares an offer. Save the offer file and send it privately to the buyer. The buyer opens the same market, chooses the same claim, enters the same buyer address and price, selects **Import offer**, and imports the file. Import does not accept its terms.

Each side uses **Review & add signature**, reviews the amounts/fee/identities and exact outputs in the dialog, and separately consents in their real wallet. Save and return the signed file; do not edit the JSON. The final consenting participant uses **Review & submit** on the same fully reviewed transaction. The buyer pays the 0.001 CKB fee in addition to the seller's consideration. A locally signed file is not settlement or guaranteed liquidity.

If the market, root, owner, price, wallet inputs or transaction body changed, stop. Refresh state, construct a new offer and collect both signatures again; never repair signed terms silently. Activity distinguishes wallet request, signed-only, pending, unconfirmed and committed states, and provides explorer links only for actual hashes. Refreshing clears session Activity; open the known market identity/link again to reconstruct ownership from public history. Redemption remains subject to the exact maturity, fee, receiving capacity and archive conditions.

For repeatable cloud test commands and evidence classification see `WO13_TRADE_EXPERIENCE_EVIDENCE.md`. Native suites are Linux developer tooling, not prerequisites for this Windows connection-only checklist.

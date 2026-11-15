# WO12: owner-browser handoff

Prepared 2026-11-03 UTC. User confirmed no wallet is attached to the cloud session and instructed: read-only preparation only; no deployment or spending. External-wallet acceptance remains blocked. No Pudge Trade transaction has been signed or broadcast.

## Connect from your own computer — no spending

Use your physical Chrome browser, not the cloud diagnostic browser. Obtain UTXO Global from its official website https://utxo.global/ using its Chrome download link; the Nervos wallet directory https://www.nervos.org/wallets independently lists it. Public references reviewed on 2026-11-03 also include the CCC connection guide https://docs.ckbccc.com/en/docs/guides/connect-wallets. These sources establish an integration route, not successful acceptance of the currently installed extension.

Create two independent disposable CKB testnet accounts under consenting owners. Select **CKB testnet / Pudge**, not BTC, EVM or mainnet. Do not import a production seed. Keep all keys and seed phrases inside your wallet; neither the app server nor this session needs them. If the extension cannot expose the CKB testnet signer, stop and report its version and visible error; do not switch authorization modes.

On your own computer, with Node 24 and Git available, use the private repository credentials you already control:

```sh
git clone --branch wo12-pudge-live-acceptance https://github.com/Ticoworld/trade.git
cd trade/apps/trade-testnet
npm ci
npm run dev -- --hostname 127.0.0.1
```

Open http://localhost:3000 in the browser containing the extension. This runs the preserved WO10 core UI used by the WO11 overlay, avoiding duplicate dependencies and filesystem symlinks. It does not run the cloud-only wallet probe or any Node fixture signer. Do not set NEXT_PUBLIC_LOCAL_FIXTURE. On an existing checkout, preserve your local changes before updating; do not reset them blindly. Dependency installation and development startup may generate ignored files or Next type imports locally; these are not intended research changes.

Click **Connect testnet wallet**, select UTXO Global's **CKB** account if discovered, and approve account connection only. A connection request is not permission to sign or spend. If it asks for a transaction signature now, reject it. The unchanged Pudge manifest has `code: null`, so market transaction preparation/signing must remain blocked pending a verified deployment.

For each owner return only:

- Public `ckt…` receiving address, labelled Alice or Bob.
- Extension version, browser version, selected CKB testnet network, and which CKB connector appeared.
- Any connection error or public lock information shown by the UI. Do not send seed phrases, keys, wallet exports or full extension storage.

The exact accepted lock must be independently checked from each address: code hash `0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8`, hash type `type`, exactly 20 bytes of args. Preserve the full lock hash. An address or successful connection alone does not prove complete Trade transaction signing. If this wallet route fails, preserve the blocker rather than using a Node signer as a substitute.

## What is still needed before a transaction can be approved

No receiving addresses or controlled funding outpoints are known yet. Therefore there is no exact funded deployment transaction, input list, actual fee or shortfall to approve today. Do not fund a placeholder or an address copied from public chain samples.

After the two public addresses are supplied, perform read-only exact-lock, live/plain Cell and spendability checks, then recalculate the one-input builder's requirements. Reference amounts only: Alice 18,272.137 test CKB, Bob 61.137 test CKB; total 18,333.274. Standalone deployment reference is 17,950.01, including 17,889 occupied code capacity, 61 replacement capacity and 0.01 selected fee. These are neither an approved spend nor verified balances. The ordinary builder needs a sufficiently large suitable plain Cell; fragmented balances cannot simply be assumed usable.

If a shortfall exists, identify the precise amount and the owner's own receiving address before any separate funding decision. Official faucet: https://faucet.nervos.org/; allowance and availability remain unverified. No faucet claim has been made or requested by this session.

## Later approval and signing order — not authorized now

1. Review an exact unsigned deployment built from actual controlled live funding Cells: Pudge genesis, every input/output, immutable code destination, full code bytes/hash, change and fee. Obtain separate explicit owner approval for that specific deployment and testnet budget. Current permission is read-only.
2. Qualify the real extension's complete-transaction signing path locally without public spending where feasible. Then, only under the explicit public approval, sign the reviewed deployment in the real wallet and broadcast it. If witness/dependency preparation changes terms, stop and re-review. Do not accept account connection as signing qualification.
3. Wait for committed status; independently verify the live code outpoint and data hash. Review the deployment manifest before enabling any market signing. A broadcast receipt is not settlement.
4. Review/sign the later market operations separately: create, two contributions of 0.125 test CKB, activation with 0.2 protected backing and 0.05 gross creator proceeds, paid assignment with 0.01 consideration, permitted redemptions, and lawful closure returning the cushion less the selected fee. Exact outputs, per-step fees and maturity must come from the actual transaction preview, not these reference figures. The 322 CKB cushion and wallet capacity are distinct from fees and backing.
5. Alice and Bob independently consent to the identical paid-assignment body. Record actual committed hashes and fresh-browser recovery; former-owner denial and failures must be labelled according to the layer that rejected them. Do not manufacture an unauthorized public negative transaction merely to obtain a rejection.

Frozen binary SHA256: `c569360ba498e715899635410dc0474003e8f61c6afc08a5c3f2a87527711c1f`.
Frozen CKB data hash: `0x53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f`.
Any mismatch stops deployment. No covenant, wallet policy or manifest has been changed for this handoff.

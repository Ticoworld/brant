# WO12 blocked external-wallet gate

Verdict C: no real user-controlled ordinary-secp browser signer is available to this session. See `docs/WO12_PUDGE_LIVE_ACCEPTANCE.md`. No transaction was constructed, signed, funded or broadcast. Binary hashes match the preserved configured covenant; existing public signing manifest remains disabled.

Public tools below are exact WO11 readers reused in a new directory; no authorization/deployment path was added:

```sh
NODE_USE_ENV_PROXY=1 node labs/wo12-pudge-live-acceptance/src/preflight.mjs
NODE_USE_ENV_PROXY=1 node labs/wo12-pudge-live-acceptance/src/relay-read.mjs
NODE_USE_ENV_PROXY=1 node labs/wo12-pudge-live-acceptance/src/limits-read.mjs
```

Reuse the installed/pinned WO11/WO10 runtime. Browser diagnostic uses system Chromium and existing built apps/trade-pilot production app, port3100:

```sh
node labs/wo12-pudge-live-acceptance/src/wallet-probe.mjs
```

It opens a fresh diagnostic context, never injects a provider/signing key, clicks only Connect, and records availability/screenshot. It cannot discover a wallet on an inaccessible user device or substitute for genuine extension acceptance. Build the unchanged app first if its production build is absent. No new package/toolchain or covenant build is needed. Do not run another server on3100 concurrently.

All source/evidence from WO09–WO11 remains unchanged. No secret browser stores were inspected; only accessible profile directory metadata and public provider presence were checked. A future owner must supply an accessible genuine wallet and public Pudge addresses, then approve a concrete deployment after actual funding/fee verification. Do not treat this README, a reference budget, source review or an old local signature as permission to broadcast.

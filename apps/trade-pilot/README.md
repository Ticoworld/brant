# WO11 Trade pilot overlay

Decision **B: PARTIAL WALLET SUPPORT, KEEP ORIGINAL FALLBACK**. No new covenant; no public signing/deployment/funding. Read `docs/WO11_WALLET_COMPATIBILITY_DECISION.md` and `WO11_NATIVE_AND_PUDGE_EVIDENCE.md` from repository root.

This app reuses frozen WO10 implementation and adds a public lock-profile/capacity inspector with explicit fail-closed support states. It does not silently admit OmniLock or JoyID. Real external-wallet acceptance remains unperformed. Original app/source/evidence is unchanged.

Reuse the existing pinned dependencies (`node_modules` is an ignored symlink to ../trade-testnet/node_modules), or run npm ci here. Node24.19.0, Chromium and native CKB0.210.0 were used.

```sh
cd apps/trade-pilot
npm run dev
npm run typecheck
npm run build
npm run test:native
```

Native test uses ports3100/19224 and starts disposable local assets, never public funding. Do not run other native runners concurrently. The same original two-wallet browser builder and real CCC Node signatures are exercised. It does not fake an external wallet connection. Test secrets stay in the Node-only original fixture; no browser key or signing server exists. `/fixture` and read-only local proxy remain disabled unless explicit local-fixture mode is set by the runner; never deploy that mode publicly.

Read-only checks, from repository root:

```sh
NODE_USE_ENV_PROXY=1 node labs/wo11-pudge-pilot/src/preflight.mjs
NODE_USE_ENV_PROXY=1 node labs/wo11-pudge-pilot/src/relay-read.mjs
node labs/wo11-pudge-pilot/src/analyze.mjs labs/wo11-pudge-pilot/evidence/preflight-1793740498584
node labs/wo11-pudge-pilot/src/native-authority.cjs labs/wo11-pudge-pilot/evidence/preflight-1793740498584/published-acp.bin
```

The last command is **local native**, not a public-node action. It deliberately proves permissionless ACP/always-success controls and rejection by the unchanged market. Preserved ACP binary provenance is in the preflight directory. No new permissive market is built.

From this app directory, offline deployment plan verification:

```sh
node --experimental-strip-types tests/deployment-fixture.mts
```

This checks synthetic unsigned serialization/funding only. Actual-input plan and read-only deployed-code verification scripts are documented in `deploy/README.md`; neither signs, funds, broadcasts or enables the manifest. No production/mainnet/security or unconditional tiny-withdrawal claim.

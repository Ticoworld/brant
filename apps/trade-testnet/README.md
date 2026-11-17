# Roveko experimental CKB trading interface

The default client is configured for the public CKB Pudge testnet. The current manifest identifies the deployed market code and enables the existing wallet-mediated signing path. The owner reports a wallet-approved Buy and Sell followed by chain-state recovery; the saved public transaction records were checked read-only and returned committed. This does not establish broad external-wallet compatibility, a security audit, production readiness, liquidity, or profitable maker economics. Do not use this interface with real assets.

The local-only Roveko flow connects Launch, Discover, Trade, Portfolio, and Activity against a private CKB node. Its single-owner native browser acceptance has passed on an isolated disposable chain, including verified holdings/history recovery and a read-only `/v2` reload check. The focused result is [recorded here](evidence/v2-trade-recovery-1794764545869/trade-recovery.json). This is separate from the public Pudge transaction evidence. See the repository [current state](../../docs/CURRENT_STATE.md) and [next milestone](../../docs/NEXT_CODEX_TASK.md).

Use this directory for isolated local development. Start with `npm ci` then `npm run dev` on Node 24.19.0/npm 11.9.0. See [Windows handoff](../../docs/WO13_WINDOWS_HANDOFF.md), [WO13 evidence](../../docs/WO13_TRADE_EXPERIENCE_EVIDENCE.md), and the repository [current state](../../docs/CURRENT_STATE.md). Automated transaction tests must use private disposable chains, mocked RPC, and disposable test keys; they do not authorize public testnet transactions.

The original WO10 instructions and evidence below are retained as historical context; the new interface shares/imports offer files with exact revalidation instead of displaying JSON by default.

---

# Trade WO10 — backed-claim testnet slice

**LOCAL VERTICAL SLICE WORKS, PUDGE BLOCKED.** This is a bounded research UI, not a commercially validated offer or production service. Original WO09 code/evidence remains frozen at a267ff6e73772bd8a3d58e2d746395276fddceb6.

Next.js16.4.5, TypeScript, official CCC core1.23.0 and connector-react2.2.2. Exact transitive versions/integrities are in package-lock.json. Node24.19.0 and system Chromium were used. The browser module never imports devnet fixture keys or a signing server. Tests alone use disposable private keys in Node; connected-user signing is delegated to the CCC wallet.

```sh
cd apps/trade-testnet
npm ci --ignore-scripts
npm run dev
npm run typecheck
npm run build
npm run test:native
```

The dev UI is localhost:3000. `test:native` starts its own Next server on3100 and disposable CKB0.210.0 on19224, so those ports must be free. It reuses repository native tooling/validated configured contract and requires `/usr/bin/chromium`. Check disk/RAM before running. It consumes only disposable local genesis assets. No public testnet signing/funding/deployment is performed.

## Journey

1. Connect a real CCC-supported **CKB testnet** wallet; check its ordinary secp lock compatibility. OmniLock/JoyID/other locks are rejected by this covenant. A successful connector UI is not proof every supported wallet can own this contract.
2. Once an approved deployment is configured, create an empty market:322CKB shared cushion; minimum contribution0.125CKB; fixed80% backing; minimum monetary goal number-of-slots times0.125CKB; immutable maturity; features0. Creator may be a different consenting funded ordinary-secp address.
3. Each slot owner contributes from one adequately funded plain Cell. After all slots/goal are funded, creator signs activation and receives exactly20% gross, minus selected fee. Pre-activation owner refunds are exposed.
4. Inspect live owner lock hashes, backing, root and transaction status. This right is not an xUDT/token or a proven financial business.
5. Paid assignment uses seller and buyer funded Cells in the **same transaction**. Share the proposal JSON out of band, set the selected market/index/price/buyer address, review, and add both real wallet signatures without changing raw terms. Missing signatures fail on chain. Whoever submits must still review their role/intent; a source-level check is not a security audit.
6. Current owner may redeem partially/fully under exact maturity/dust conditions. Fee comes from gross payout; replacement wallet retains61CKB minimum. Small standalone/unfunded exits are not promised. Final funder closure requires zero obligations.
7. Recovery rebuilds every historical leaf/path/accounting state from committed witnesses, checks transaction hashes and current live Cell. No private receipts/indexer database is required, but public archival witnesses and trustworthy chain/RPC access are. Stale transactions must be rebuilt/re-signed.

## Evidence and boundaries

Primary browser/native final evidence: `evidence/browser-native-1793737248546`,10committed transactions including code deployment; actual Chromium builder, actual CCC Node signers, independent offline UTXO/Merkle replay,5native rejection cases, controlled missing-history/network preflight failures, and screenshot. No private key was passed into Chromium. This is **not** an external wallet-extension/Pudge test, and the connector screenshot is not a blockchain transaction demonstration.

Existing unmodified configured regressions were freshly executed:16-holder policy/maturity lifecycle25transactions/9rejections and configured security suite22transactions/30rejections. New outputs were relocated under this app's `evidence/regression-*`; old runner log paths remain historical run locations. No1,000-holder mechanism was rebuilt or repeated.

Earlier failures remain captured: dev-origin fixture timeout, mistyped client secp identifier, legacy recorder dep-group spelling (a transaction had committed before recording failed), absent local get_cells indexer, and hash-check failure from a manual RPC enum conversion. Corrections use documented dev origins, exact original secp ID, an evidence-only legacy enum adapter, bounded local block discovery, and official CCC RPC transaction decoding. No covenant/signature/hash check was relaxed.

The selected fixed pilot miner fee is100000sh=0.001CKB, below the covenant1000000sh ceiling. UI live-rate preflight pauses if its conservative requirement exceeds this budget; it never silently reprices a partly signed assignment. This is not adaptive fee selection or a network fee guarantee. Claim/price arithmetic is bigint and exact eight-decimal display; occupied capacity and spent fees remain separate.

`/fixture` and the read-only `/api/local-rpc` adapter work only with `NEXT_PUBLIC_LOCAL_FIXTURE=1`, used by the native test runner. Default production build disables both fixture exposure and local proxy access. No signing API exists. Do not publish a fixture-enabled build.

Pudge preparation: [deploy/README.md](deploy/README.md). Evidence summary: `docs/WO10_TESTNET_VERTICAL_SLICE_EVIDENCE.md` from repository root. No mainnet, production-security, universal rug-protection or active secondary-liquidity claim.

Bounded original regression commands (from repository root; they create new evidence directories and do not overwrite prior evidence):

```sh
MARKET_SIZES=16 TEST_CONFIGURED_POLICY=1 node labs/wo09-unified/src/run-merkle-configured-scale.cjs
node labs/wo09-unified/src/run-merkle-configured-security.cjs
node labs/wo09-unified/src/verify-merkle-scale.cjs apps/trade-testnet/evidence/browser-native-1793737248546
```

The two-wallet connector flow is prepared but still needs manual acceptance with actual external supported wallets after an approved Pudge deployment. Its intent guards include buyer address as well as market/index/price; automated native evidence qualifies the shared builder and Node signers, not these external-device interactions.

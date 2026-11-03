# WO09 return to native trading: isolated two-asset RFQ

Research fallback, not production qualification or demonstrated public liquidity. Frozen capacity-access and financial contracts are unchanged.

This derivative backs CKB and bounded uint64 xUDT balances with actual native Cells. Two owners sign the full transaction using witness Ed25519 authorization. It does not implement OTX fragments, an AMM, passive quote expiry or unconditional small external withdrawal. The two-owner fixture includes actual published xUDT delivery into a separately funded ordinary recipient Cell.

Use the existing pinned rebuild environment and disposable assets only. Node runners use port19224 and must run sequentially. Generated customer private keys stay in memory. Standard public devnet fixture keys are supplied by the existing engine; do not use them outside disposable chains.

```sh
python3 labs/wo09-unified/trading-return/src/build.py
node labs/wo09-unified/trading-return/src/run.cjs
node labs/wo09-unified/trading-return/src/rivals.cjs
node labs/wo09-unified/trading-return/src/verify.cjs labs/wo09-unified/trading-return/evidence/native-1793690123197
node labs/wo09-unified/trading-return/src/verify-rivals.cjs labs/wo09-unified/trading-return/evidence/rivals-1793690498975
```

`recover.cjs` reconstructs current state from public history in a fresh process. Raw committed transaction/status records, rejected RPC attempts, genesis, configuration, binary manifests and first failure remain preserved. Original ephemeral chains need not still exist; rerunning creates a fresh chain. Offline replay checks the captured execution evidence, not a currently running consensus network.

Provenance: CKB0.210.0; Zig0.14.1 Ed25519 adapter copied from `../capacity-access/contracts/auth.zig` (its pinned upstream/license research remains applicable); CKB C stdlib from `labs/rebuild/mechanisms/deps/ckb-c-stdlib`; shared MIT helper `labs/wo09-open-markets/contracts/common.h`; engine `labs/wo09-e2-capacity/src/engine.cjs`. Dependencies and licenses are retained in their existing locations. Actual published xUDT binary is `labs/rebuild/native/vendor/ickb/build/release/xudt`, provenance `labs/rebuild/native/vendor/ickb/PROVENANCE.json`. A2 binaries come from the existing published genesis fixture and frozen rebuilt optimized baseline. No source-equivalence claim is made for the published xUDT binary.

See `docs/WO09_TRADING_TWO_ASSET_NATIVE.md` and subsequent comparison/decision reports. The first failed run is not a successful lifecycle. Live market snapshots are dated observations, not executed orders or firm liquidity promises.

# Independent recovery of a local Gate 2 entitlement

The browser exports `roveko-recovery-identity.json`, containing public market scripts, genesis, initialization transaction and owner lock hash. Retain this file outside the application host and use a full-history node on the same isolated chain. The following prepares the exact two script files consumed by the independently runnable recovery CLI:

```powershell
$identity = Get-Content roveko-recovery-identity.json -Raw | ConvertFrom-Json
$identity.custodyLock | ConvertTo-Json -Compress | Set-Content custody-lock.json
$identity.xudtType | ConvertTo-Json -Compress | Set-Content xudt-type.json
cargo build --release --locked --offline --manifest-path labs/trade-v2-token/gate2/recovery/Cargo.toml
node labs/trade-v2-token/gate2/recovery/recover.cjs collect-blocks --node http://127.0.0.1:19224 --init $identity.initializationTransactionHash --owner $identity.ownerLockHash --custody-lock custody-lock.json --xudt-type xudt-type.json --out recovery-history.json
```

The command reconstructs and verifies entitlement; it does not move tokens. For the independently signed withdrawal path, see `labs/trade-v2-token/gate2/recovery/README.md`, including its local-node and disposable-key restrictions. That CLI must receive the owner's own authorization and enough plain-cell capacity for the external token output and fee. A full node retaining canonical transaction witnesses is required. No server, coordinator, or browser is required after export.

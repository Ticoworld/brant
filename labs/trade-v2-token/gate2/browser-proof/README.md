# Browser proof helper

This is a separate copy of the Gate 2 recovery verifier with a `transition` command. It replays a collected bundle and derives a single-owner buy or sell TMS1 transition from its verified membership proof. It does not collect chain data, sign, or submit transactions. The sell witness must be followed by little-endian 64-bit quantity and minimum payout, as required by `market_smt.c`.

From the repository root on Linux, WSL, or Windows with Rust and a C compiler installed:

```sh
cargo build --release --locked --offline --manifest-path labs/trade-v2-token/gate2/recovery/Cargo.toml
cargo build --release --locked --offline --manifest-path labs/trade-v2-token/gate2/browser-proof/Cargo.toml
node labs/trade-v2-token/gate2/browser-proof/test-transitions.cjs
```

The experimental Next endpoint `/api/v2/proof` is disabled unless `ROVEKO_LOCAL_PROOFS=1`. Set `ROVEKO_LOCAL_DEPLOYMENT` to the absolute path of a trusted local bootstrap JSON and `ROVEKO_PROOF_BINARY` to the absolute path of the built helper. Optionally set `ROVEKO_LOCAL_RPC` to an HTTP loopback URL; the default is `http://127.0.0.1:19224`. Run Next and the binaries on the same operating system. The endpoint checks the configured genesis and invokes `recover.cjs collect-blocks`, which requires the recovery release binary at its normal path and full canonical transaction history. It accepts only public owner lock hashes, side, and quantity. It returns proof data, not a signed or complete transaction. A caller must verify the market lineage and live inputs again before signing and broadcasting.

On Windows the proof binary is `labs\trade-v2-token\gate2\browser-proof\target\release\trade-v2-recovery.exe`; the recovery executable uses the same name under `gate2\recovery\target\release`.

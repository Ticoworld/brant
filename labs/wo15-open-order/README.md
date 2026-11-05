# WO15 funded full-fill sell-order experiment

Experimental private-chain research. Do not deploy or use with valuable assets.

The maker funds an xUDT Cell locked by `sell_order`; its arguments commit to the maker lock hash, xUDT type hash, exact 16-byte amount, and 64-bit CKB price. A maker-controlled input authorizes cancellation. Otherwise a buyer input must authorize the buyer lock named in the order witness, the buyer must receive the exact xUDT amount, and the maker must receive at least the order Cell's capacity plus the price in a plain CKB output. Only one input using this order code identity is permitted in a transaction. This avoids shared-payout reuse but prevents batching these orders.

Expiry, partial fills, chain-domain binding, indexer authentication, wallet acceptance, independent concurrent settlement measurement and production security review remain unimplemented or unverified. A maker must authenticate the order funding transaction and terms; merely discovering a script-identical Cell proves no maker intent. A buyer must independently verify the live Cell, asset identity, price and transaction, and its wallet must sign the complete fill. The lock does not establish best price, liquidity, economic profitability or protection from chain reorganizations.

Build on Linux with Zig 0.14.1 and the existing CKB C stdlib:

```sh
mkdir -p build
../rebuild/mechanisms/tools/zig-x86_64-linux-0.14.1/zig cc -target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -nostdlib -fno-builtin -fdata-sections -ffunction-sections -I../rebuild/mechanisms/deps/ckb-c-stdlib -I../rebuild/mechanisms/deps/ckb-c-stdlib/libc -Wl,--gc-sections -Wl,-e,_start -Wl,--strip-all -Wl,--image-base=0x10000 -o build/sell_order contracts/sell_order.c
node run.cjs
```

The harness requires the pinned CKB 0.210.0 binary and npm dependencies under `../rebuild/native`; it starts an isolated node on localhost ports 19224/19225 and uses public disposable devnet fixture keys. Every run uses a fresh evidence directory. No public network transaction is required.

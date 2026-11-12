# Disposable browser bootstrap

`browser-bootstrap.cjs` derives from the Gate 2 native runner. It starts a fresh
private node, deploys the scripts into its genesis, issues the fixed supply and
performs the initial fixture purchase. It then leaves the node running and writes
`browser-bootstrap.json`, `events.jsonl`, and `rpc.jsonl` under a new evidence
directory. The initial purchase is fixture-signed and is **not** evidence of a
browser wallet journey. Fixture keys in the native tooling are public and must
never be used outside this isolated chain.

From a Linux/WSL checkout, set paths to the pinned native tooling and Gate 2
build directory, then run:

```sh
TRADE_NATIVE_ROOT=/path/to/labs/rebuild/native \
TRADE_GATE2_BUILD_DIR=/path/to/verified-gate2-binaries \
CKB_BIN=/path/to/ckb-0.210.0 \
TRADE_GATE2_OWNER_TARGET=3 node labs/trade-v2-token/gate2/browser-bootstrap.cjs
```

The node listens on localhost port 19224. Stop it by creating a `stop-node` file
in the newly printed evidence directory; the runner then terminates its child.
The browser test must use a disposable signer and must independently verify
the committed post-trade state. Do not point this fixture at a public network.

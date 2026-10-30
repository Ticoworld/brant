# Reproduce WO01

The evidence is a single isolated-node run and independent scenario models. The experiment does not implement exchange authorization. Never use the always-success lock, development keys or exposed IntegrationTest RPC with real assets.

## Inputs and environment

Linux x86_64; Python 3.12 standard library; CKB 0.210.0 (`2592ddf 2026-09-17`). Official archive:
https://github.com/nervosnetwork/ckb/releases/download/v0.210.0/ckb_v0.210.0_x86_64-unknown-linux-gnu.tar.gz

Archive SHA-256 `68a94c191109bae172f8dcb71828dbdf0383e2c314e0658743db217472b27bdf`, matched the release API's asset digest. The 32.9-MB archive is not included in the evidence ZIP; fetch it from the pinned URL. The release metadata is included in `sources/ckb-release.json`. Extract with `tar --no-same-owner -xzf ...` into a temporary binary directory.

The always-success program is included in this folder, sourced from:
https://raw.githubusercontent.com/nervosnetwork/ckb/v0.210.0/test/template/specs/cells/always_success

Its CKB personalized Blake2b-256 hash is `0x28e83a1277d48add8e72fadaa9248559e1b632bab2bd60b27955ebc4c03800a5`. `dev.toml` adds that program as a system cell and issues a test-asset cell to it. Network configuration is localhost only with no configured bootstrap peers. It is a custom test network, not mainnet or public testnet. Any random development keys in generated files are public examples, never secrets for real funds.

## Run on a clean config directory

From this workspace root, with the CKB binary extracted to `/tmp/wo01-bin/ckb`:

```bash
python3 experiments/prepare_devnet.py --ckb /tmp/wo01-bin/ckb --directory /tmp/wo01-reproduce-dev
python3 experiments/node_probe.py --ckb /tmp/wo01-bin/ckb --config /tmp/wo01-reproduce-dev
python3 experiments/market_models.py
python3 experiments/market_snapshot.py
```

Run on a copy if preserving the original evidence, because output paths are `evidence/`. The node probe starts a node as its subprocess, waits for RPC, performs tests and terminates it in `finally`. It must start in the same network namespace as the client. Ports 18114/18115 must be free. The preparation script refuses an existing directory; the node probe itself expects a fresh prepared chain.

The base probe records transaction statuses and hashes. Supplementary original block bodies are retained as `node-commit-blocks.json`; to independently reproduce that capture, query `get_block_by_number` for heights 17–20 before stopping the node, or restart the same database and read them. Template scheduling can shift the exact commitment height. Check proposal and commit distance rather than requiring identical hashes/heights. The 100-conflict admission outcome also assumes the exact configured RBF policy and fee increments.

The scripts do not mine on any public chain, use wallet credentials, or send any message externally. Model scripts require no dependencies. `market_snapshot.py` recalculates a historical snapshot; it does not fetch current executable prices. Live repetition should save a new dated snapshot and must not overwrite the original evidence.

## What a reproduction establishes

Pool conflict semantics, unconfirmed dependency admission, descendant eviction, consensus commitment eligibility, numerical model arithmetic and snapshot VWAP. It does not establish secure signatures, OTX compatibility/cycles, mainnet latency, realistic exchange throughput, cross-chain atomicity or profitability.

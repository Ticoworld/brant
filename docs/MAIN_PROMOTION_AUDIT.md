# Main promotion audit — 2026-11-15

## Scope and result

- **VERIFIED:** PR #3 merged the `v2/pudge-trading-app` work at `74cc12d4002c5459f4240e698dfe1ea9218cc818`; current `main` HEAD is `cecc8e8098e832cc0ff9d5c9e3a990678028a7b4`.
- **VERIFIED:** the PR diff contains 4,618 paths. GitHub reported no status checks for the PR. This audit does not replace a complete security review.
- **VERIFIED:** the imported paths include 838 binary artifacts as reported during the promotion review. The largest groups include protocol labs, native/browser evidence, logs, fixtures, and screenshots. These are retained historical and experimental materials, not production build outputs.
- **VERIFIED:** no `.next` build tree, materialized `node_modules` directory, `.env` file, PEM/private-key file, or keystore path was found in the PR path audit. A focused filename/content pattern scan found no high-confidence credential value. This is not a substitute for a dedicated secret scanner.

## Symlink entries

The PR contains two Git mode `120000` entries:

- `apps/trade-pilot/node_modules` points to `../trade-testnet/node_modules`. On this Windows checkout Git materializes it as a small regular file rather than a functional symlink.
- `labs/wo09-unified/inventory-discovery/upstream/stack/node_modules` points to `/workspace/trade/labs/rebuild/native/node_modules`, a Linux workspace path that is not portable to Windows.

Do not delete these historical entries as part of this task. Any future cleanup needs its own narrowly scoped change and Linux/Windows behavior check.

## Product claim boundary

The public manifest at `apps/trade-testnet/public/pudge.json` still has `code: null`. It does not establish a deployment, public market, transaction, liquidity, or public customer journey. Local private-node and mocked browser evidence must remain explicitly labeled and must not be described as public Pudge validation.

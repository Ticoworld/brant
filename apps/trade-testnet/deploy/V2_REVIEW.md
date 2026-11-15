# Gate 2 deployment review

## Pinned inputs

Run `node deploy/v2-review.mjs <pinned-elf-directory>` from `apps/trade-testnet`. The read-only script checks all five ELF SHA-256 values against its pinned manifest, derives their CKB data hashes, and checks the official Pudge genesis, standard-secp dependency group, and xUDT dependency through RPC. It never constructs, signs, or broadcasts a transaction. The reviewed binaries in `trade-gate2-rebuild-closure-20261111` match the five pinned SHA-256 identities.

The official Pudge xUDT at `0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f:0x0` has expected data hash `0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95`. The pinned standard-secp dep group is `0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37:0x0`, with expected data hash `0xf66ca3517241864672b7f47d093aec4d6d4d07824068993eacd728eb9078e236`. These are read-only identity checks; public contract execution remains unverified.

## Owner-controlled deployment flow

`/v2/deploy` is connected to the existing owner browser-wallet flow. With `ROVEKO_GATE2_BINARIES` pointing at the five pinned ELF files, and the proof utilities and recovery collector configured, it checks the wallet and RPC genesis, live secp and xUDT dependencies, binary identities, funding Cells, fee bounds, reserved issuance anchor, and initialization proof before presenting the unsigned transaction. The review exposes inputs, outputs, code hashes, capacities, fee, change, and the serialized transaction.

The owner must acknowledge the review before requesting a wallet signature. The app verifies the returned standard-secp signature, reviewed transaction hash and witnesses, and serialized size, then revalidates the wallet, network, funding Cells and dependencies. Only then does the separate broadcast control become available. The owner must activate it. A rejected signature, changed transaction, stale input, missing proof tool, changed dependency, or unavailable RPC fails closed.

The app journals an attempted submission before calling the wallet broadcast method. An unknown response must be reconciled against canonical Pudge history before retrying. After the code stage is confirmed, setup, issuance, and initial curve purchase remain separate owner-reviewed transactions and each must be confirmed and reconciled before its dependent stage.

## Limits

The initial capacity estimate assumes standard-secp code-cell locks and fixed Gate 2 script/data sizes. It excludes curve reserve, initialization/issuance funding, wallet-specific changes, and actual fee selection until the connected owner's live inputs are inspected. The indexer must return complete eligible Cells. `public/pudge.json` still has `code: null`; no deployed public market or completed public transaction is established. External-wallet compatibility, public transaction behavior, security, liquidity, and business economics remain **UNVERIFIED** until supported by actual canonical Pudge evidence.

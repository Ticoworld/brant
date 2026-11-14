# WO-V2-01F evidence

## VERIFIED — isolated node

On a fresh CKB 0.210.0 disposable node, Chromium used one disposable owner lock for code deployment, setup, fixed-supply issuance and the first purchase, then bought and sold, reloaded, reconnected and rejected a changed manifest. The test independently checked the owner input indices, canonical blocks, live successor cells and fees. Contract-controlled inputs were executed by the node's VM; they were not replaced by wallet locks.

The preparation split was confirmed before its outputs were used. The code deployment paid 115,828 shannons; setup, issuance and purchase each paid 1,000,000 shannons in this fixture. These figures are **not** a public wallet quote.

Raw transaction evidence: `apps/trade-testnet/evidence/v2-init-browser-1794646790530/`. Bootstrap and node RPC trace: `labs/trade-v2-token/gate2/evidence/native-1794646489773/`. The executable test is `apps/trade-testnet/tests/v2-init-browser-native.mts` with `ROVEKO_SINGLE_OWNER=1` and `ROVEKO_TEST_COMBINED=1` after running `v2-single-owner-bootstrap.mts` on a fresh private node.

## VERIFIED — simulated Pudge application flow

`tests/v2-pudge-stages-browser.mts` uses a localhost simulated RPC and disposable signer. It exercises the optional split, five-code deployment, setup, issuance, purchase, buy, sell, rejected modified transaction, stale anchor, withheld proof, an accepted transaction with a lost response, reload, and backup restoration. The trace is labeled `MOCK_RPC_DISPOSABLE_SIGNER`; it is not a Pudge transaction. Evidence: `apps/trade-testnet/evidence/v2-pudge-browser-1794649496209/transactions.json`.

`tests/v2-pudge-proof-route.mts` exercises the actual proof route, canonical block collector and independently built Rust verifiers against a localhost simulated history. `tests/v2-utxo-global-adapter.mts` exercises CCC's UTXO Global signer implementation with a disposable in-memory provider, including mixed lock groups, refusal, transaction modification and wrong wallet network. It does not exercise a physical extension.

The three Rust tools were freshly built from this checkout with `cargo build --locked --offline --release` into separate temporary target directories. Their SHA-256 values are `b2661691f4d2c55739e872caa16dd34c1ac018cac77faa00266ffd1200080868` (SMT generator), `e153ae388c8d0bc2aeca3bfc3ab37a7e7b55d38ceba437f71957c3edb4f9a59e` (browser proof verifier) and `2a3217673a68aecf2bed75761208b8513a260ace230e61c88c04b925fc3f3560` (collector's recovery verifier). The collector copy's SHA-256 matched the checked-in `recover.cjs`: `d42e5e384d8ad37e9db6a625fd06600704b82e37770f73200c9a37a916d32679`.

## VERIFIED — read-only public data

`tests/v2-pudge-live-deps.mts` checks Pudge genesis and the live pinned standard-secp and official xUDT code dependencies without submitting a transaction. The public RPC timed out once during testing and passed on retry; unavailable or stale RPC data blocks review.

## UNIMPLEMENTED AS PUBLIC EVIDENCE

No real UTXO Global wallet signature, public Pudge submission, public confirmation, live owner funding amount, exact owner transaction fee, or public trade has been observed. Those require the owner to connect and approve the transactions. Instructions and local configuration are in `WO-V2-01F-PUDGE-HANDOFF.md`.

# WO10 first testnet experience: evidence and decision

**LOCAL VERTICAL SLICE WORKS, PUDGE BLOCKED.** Branch `wo10-trade-testnet` was created from fetched/verified `a267ff6e73772bd8a3d58e2d746395276fddceb6`. Original WO09 contracts, binaries, old evidence and research branch were not edited. No market/miner discovery, new financial payoff or1,000-holder rebuild was performed.

The Next.js/TypeScript app and reusable browser-safe CCC module live in `apps/trade-testnet`. Fixed configured covenant,80% backing, features0; no royalties, ratchet, DAO yield or AMM. Ordinary secp wallet compatibility is checked. Private signing stays in the connected user's wallet; disposable test keys occur only in the Node-only harness and existing public devnet fixture source.

## Actually executed

Primary final evidence `apps/trade-testnet/evidence/browser-native-1793737248546`. Chromium executes the same browser transaction-building/recovery module used by the application. Node-only actual CCC signers authorize independently funded controlled wallets; the real CKB0.210.0 node commits10transactions including deployment. No private keys or key-bearing signer were injected into the browser. This is a real browser-builder/chain path, **not** a real wallet-extension/Pudge connection or blockchain proof inferred from a mock UI.

|Committed action|Transaction hash|Bytes|Node estimated cycles for committed tx|
|---|---|---:|---:|
|deploy_market|`0xba7a11fc9bbd6e7260023f1d04a0b512c27d31b756d1789a99bd4873116c8ce7`|18288|0x18d941|
|browser_CCC_create|`0x399252230ec5e47702dbe6aa598c88584f9899f5f7ac830c6f62c60603f9b0cb`|802|0x196eab|
|browser_CCC_enroll_0|`0x6441e28fb8add839e4ccbdcbc41b8ae9f92081965cb27523443ee16195a11813`|990|0x1b4556|
|browser_CCC_enroll_1|`0xc0de6c6ee730e6bf3312bf2a29c21f0a4bb063f1d805307d1610b26e2da82b60`|990|0x1b4abe|
|browser_CCC_creator_activation|`0xa0b01fff66dbef26ad65dbfe1919e554297f6736e1d090b41084568ea2e91322`|854|0x19521e|
|browser_CCC_atomic_paid_assignment_two_signers|`0xc200e158275d7e4a3a0fad98e8a25b093b873794ff8a83e985269cb04cb8da09`|1236|0x34c4f0|
|browser_CCC_partial_owner_redemption|`0x1521dc7f7da64a24ff8bf486a88ca5fb0cd60fbcf68ed82636251f0ec8df6d29`|990|0x1b1f70|
|browser_CCC_full_redemption_0|`0xe924403488e7fa1e48b5f74a1ea548258b8008906c6f5c5d1bbf8326b4c5f42a`|990|0x1b2f26|
|browser_CCC_full_redemption_1|`0xec6cce73f8c9b9f6935dd6f86e2443f73b23fee0499d3fc9873ea39fadd3273b`|990|0x1b871a|
|browser_CCC_lawful_closure|`0xe5c09925b418e98e6b713f2cc47a3ec274eff8533e90c549537162d172600497`|464|0x1a3bcc|

Independent offline UTXO/Merkle replay reports10committed transactions,6leaf updates, zero final backing and lawful closure. Total fees0.019CKB include0.01deployment and9market actions at0.001each. Two0.125CKB contributions fund0.2CKB protected backing and0.05CKB gross creator proceeds. Assignment pays0.01CKB real consideration separately; partial/full withdrawals exhaust obligations and return only the322CKB cushion. Code17889CKB is separate occupied/unspendable capital in this fixture.

Native rejected cases: missing seller signature; signed but unpaid assignment(error71); former-owner redemption(error60); wrong actual secp signature(error-11); replay using consumed vault(outpoint resolution, not a covenant error). UI/pre-signing tests separately reject altered seller payout and former owner. Controlled RPC withholding and wrong genesis fail closed; those are simulated data/environment failures, not native rejection cases.

Fresh browser reconstruction discards local market state, discovers the current live vault and replays committed witnesses, transaction hashes, roots, paths and exact counters. A second rebuild after partial redemption recovers the updated entitlement. Local node lacks get_cells; bounded committed-block discovery is used only for local network manifests. Pudge requires its actual indexer plus public historical witnesses. No dishonest-RPC consensus proof, pruning guarantee, reorg robustness or indefinite shared-input starvation solution is asserted.

Fresh unmodified regression source runs:16-holder configured policy/maturity suite25transactions/9rejections; configured security suite22transactions/30rejections. Evidence was moved from fresh WO09 output directories into `apps/trade-testnet/evidence/regression-*`, leaving old evidence intact. Existing offline replay verifies both. The security regression retains its historical optional-feature tests; the new app exposes none of those features.

## Browser/product and build qualification

The actual application renders with official CCC connector-react2.2.2/core1.23.0, testnet-only provider, explicit lock compatibility, creation/funding/activation, owner/backing/root display, external two-wallet proposal exchange, signature/intent review, redemption/refund/closure and transaction status. Paid proposals are rederived from latest live inputs and checked against selected market/index/price before signing. A wallet changing raw terms is refused. Spent/stale inputs require rebuilding and fresh consent. Claim/price display uses exact bigint denominations. Selected pilot fee is explicit; live-rate preflight rejects an insufficient budget rather than secretly deducting more.

Chromium screenshot `app.png` captures the real unconnected app; no wallet extension was installed/connected, so it must not be called external-wallet acceptance. The local test signs using real CCC cryptography in Node. It proves browser module integration, not device-wallet behavior. The configured covenant only accepts ordinary secp locks: a wallet being available in CCC does not make OmniLock/JoyID/other locks compatible.

TypeScript and a production Next.js build passed. Default fixture route and local read proxy are disabled without the explicit local-test build environment. No browser signing secrets or server signing endpoint exist. This is an inspectable bounded product slice, not production-security, commercially valuable financing, a launched xUDT, a liquid secondary venue or universal rug protection.

## Failed runs preserved and diagnosed

Earlier directories preserve: local dev-origin timeout; client secp constant typo; legacy recorder dep_group/depGroup mismatch after a real committed creation; local absent indexer; and hash mismatch caused by manual RPC enum decoding. Final corrections retain covenant authorization and hash checks, use CCC's official RPC transformer, and distinguish failed recording from failed chain execution. A preliminary complete native run at10000sh fee also remains preserved; the final source/run uses100000sh. None of the failed runs is reported as a complete PASS.

## Pudge remains blocked at an explicit boundary

Read-only preparation retrieved official Pudge genesis and CCC secp deployment reference. `public/pudge.json` contains exact expected contract hash but code:null. Signing is deliberately disabled until a real approved deployment exists. No public deployment, public testnet funding/spending, real asset use or outside commitments occurred. The controlled native binary hash is not a Pudge deployment receipt.

Remaining pilot gates: approved code deployment/recorded hash, funded consenting ordinary-secp wallets, manual external-wallet signature/paid-assignment round trip, current relay-fee/indexer/archival service checks and recorded actual Pudge transactions. Fee selection is a fixed-budget bounded pilot, not production adaptive pricing. Single plain input per wallet is a contract/UX limitation; consolidation is not silently attempted. Receiving capacity and history availability remain explicit dependencies; no unconditional dust withdrawal or instantaneous finality claim.

## Reproduction and next action

See app README for npm ci/typecheck/build/native commands and deployment preparation for exact hashes/funding/verification steps. Node24.19.0, system Chromium and preserved native CKB0.210.0/tooling were used. No prohibited security investigation was resumed. The next action is an explicitly approved, funded controlled Pudge deployment and manual two-wallet acceptance exercise, not more market discovery or contract redesign.

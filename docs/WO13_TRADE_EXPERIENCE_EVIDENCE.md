# WO13: Trade experience and local handoff

4 November 2026, Africa/Lagos. Baseline: `58ab7777e6388ab1cefc36a68aeb17617bb18380`; branch `wo13-trade-experience`. Verdict: **A. CLOUD EXPERIENCE READY FOR LOCAL WALLET ACCEPTANCE**. Real Windows execution, external-wallet signing and Pudge lifecycle acceptance remain human/external gates, not PASS results.

## Implemented experience

`apps/trade-testnet` is the canonical app, with one dependency install and loopback `npm run dev`. It imports neither the trade-pilot overlay nor its development symlink. WO11 tooling/source and historical READMEs remain available; earlier branch heads are not moved. The native transaction builder `lib/market.ts`, configured covenant binary, public manifests and existing recovery rules remain unchanged.

The old long numbered form and large headline are replaced by Markets, My Positions, Create Market and Activity navigation. Empty states explicitly state that there is no automatic discovery/global portfolio index or implied liquidity. Known market identities and `?market=` links can be opened. Owner-aware cards show contribution, remaining CKB backing, funding/activation phase and maturity eligibility. A selected claim supplies its current amount; unsupported, non-owner, premature and already-settled actions are unavailable or rejected by the preserved builder. Administrative actions respect creator/funder roles and outstanding obligations.

Creation separates 322 CKB shared capacity, 61 CKB retained wallet capacity, 0.001 CKB selected fee and 383.001 CKB minimum suitable creation input. The 17,889 CKB code deployment is a separate prerequisite. Fixed80% initial backing/20% gross creator proceeds remain unchanged; optional financial flags are not exposed. Redemption review separates gross amount, fee and actual net wallet change. No USD floor, token launch, automatic royalty, guaranteed buyer or instant-finality claim is added.

Assignment now uses downloadable/importable offer files, with raw paste confined to a secondary disclosure. Import does not imply consent. Both sides still select market/claim/buyer/price and execute the original exact-body `reviewAssignment` verification. A modal shows amounts, fee, identities and exact outputs before wallet consent. Account changes, form changes, altered terms, unexpected fees and consumed inputs invalidate or reject approval. The builder's one-plain-Cell restriction is retained. The buyer pays the assignment fee in addition to the agreed seller consideration.

Activity distinguishes wallet request, signed-only, pending, unconfirmed, committed and failed outcomes; explorer links require actual hashes. The latest recovered live-market transaction can appear as committed history, explicitly not a new submission. Session Activity is not persistent/global history; ownership recovery remains independent of session receipts. Diagnostics/hashes belong under Advanced. No new backend, secret store, signer service or private key is imported into the browser.

Public preparation now explicitly requires both an approved code outpoint and `publicSigningEnabled: true`, in addition to network/code verification. The checked-in manifest remains `code: null` and no approval flag was enabled. This is an additional fail-closed UI gate, not a change to contract authorization. No public transaction was signed or broadcast.

## Interface research and actual inspection

Read-only Chromium screenshots and text are in `labs/wo13-trade-experience/evidence/interface-audit.json`, alongside `before.png`, `jupiter.png`, `uniswap.png`, `pump.png` and `ickb.png`. Observed 4 November local time (raw capture timestamps use UTC). No account was connected to these products and no trade or external commitment was made.

| Public source | Observed principle applied |
|---|---|
|https://jup.ag/swap|Focused primary amount/action surface, persistent connection control, secondary chart/history disclosure. No borrowed charts, quotes or branding.|
|https://app.uniswap.org/swap|Concise inputs and action hierarchy, distinct connection requirement. Wallet/signing review was not exercised.|
|https://support.uniswap.org/hc/en-us/articles/39862756339341-Uniswap-Web-App-The-Swap-Screen|Official review documentation separates amounts, network cost and execution terms; Trade uses claim-specific accounting, not swap terminology.|
|https://pump.fun/|Search/discovery/create separation; public welcome gate visible. No authenticated creation acceptance or copying of volume/price panels.|
|https://ickb.org|Real CKB DApp network selection and clear estimate-versus-wallet-checked availability wording. The `app.ickb.org` research-tool attempt was unavailable; the actual browser loaded `ickb.org`.|
|https://www.w3.org/WAI/WCAG22/quickref/|Visible focus, keyboard controls, semantic labels/status, reflow and target size guidance.|

Primary original issues: excessive technical text and raw assignment JSON, no navigation, no truthful discovery/portfolio empty states, no application-level transaction review dialog, mixed financial labels, wall-of-forms layout and fragile two-app local setup. Screenshots from the running app were visually inspected, including mobile positions and the review dialog. Responsive navigation, wrapping and card layouts replace wide hash tables. The Next development indicator was disabled after it overlapped a mobile fixture card; application errors still surface.

## Verification and evidence scope

Evidence root: `labs/wo13-trade-experience/evidence/`. Final browser directory is `browser-1793749086527`:41 checks,16 scans,zero automated violations and10 incomplete checks. Full counts are in `acceptance-index.json`; failed and superseded runs remain preserved. Screenshots include1440px desktop,768px tablet and375px mobile, all four navigation screens, controlled owner/funding/maturity states, and transaction review. Fixtures have an explicit CONTROLLED LOCAL UI FIXTURE banner and are disabled in the ordinary production build.

| Executed check | Actual scope/result |
|---|---|
|TypeScript and production build|Passed; logs `typecheck-delivery.log` and `production-build-delivery.log`. No new dependency versions were introduced.|
|Browser presentation suite|Production disconnected/no-deployment gates; controlled supported/unsupported, funding, owner positions, creation review, offer import/export, assignment review, pending/committed, loading, RPC/archive and stale states. These presentation fixtures are not real wallet/chain results.|
|Responsive/keyboard/accessibility|All four production views reflow at1440/768/375; native modal Escape/focus-return tested. axe-core4.10.3 WCAG2/2.1/2.2 A/AA automated smoke scans, pinned URL/hash; no automated violations in completed runs. Incomplete contrast checks (10 across the scans) remain manual-review limitations; selected palette ratios independently checked in `contrast-palette.json`. No full WCAG conformance claim.|
|Updated browser-builder/native suite|`browser-native-1793748678569`:10 committed disposable-private-node transactions,5 native rejection cases, zero page errors. Actual CCC Node-only fixture signatures; no key enters Chromium. Added live-input review, exact fee/body, unapproved-manifest and stale-review checks pass against actual native state. Not external-wallet acceptance.|
|Configured security regression|`merkle-configured-security-1793748485591`:22 committed private-chain transactions,30 intended native rejection cases. Optional historical contract tests do not expose optional product features.|
|Bounded policy/maturity regression|`merkle-configured-scale-1793748704977`:explicit MARKET_SIZES=16;25 committed transactions,5 recorded rejection cases, genuine native maturity and lawful closure. Actual counts retained rather than matching older report totals.|
|Independent offline replay|`verify-browser-native.log`, `verify-configured-security.log`, `verify-policy-16.log`: authenticated UTXO/Merkle/accounting histories replayed; primary markets closed with zero backing liabilities.|

Native suites ran sequentially, with no shared-node/port collision. The primary updated browser-native deployment and nine market actions used1,900,000shannons total actual miner fees (0.019CKB), of which0.009CKB were market-action fees. These are disposable private-chain fees, not Pudge estimates or new product economics.

The native rejection records distinguish missing seller/wrong signature lock failures, unpaid assignment covenant71, former-owner covenant60 and stale consumed-input resolution failures. Controlled missing-history/wrong-network and altered review terms are client-side fail-closed tests, not native security rejections. The16-holder run distinguishes covenant missing-since error60, actual consensus immature-since rejection and closure-with-liabilities error32. No earlier quarantined investigation was resumed.

## Preserved failures and bounded corrections

- First browser suite stopped because an unscoped alert locator matched both Trade and Next's route announcer. Scoped the locator to Trade; no application guard was weakened.
- Second stopped on unsupported Playwright `isFocused()`. Replaced with an actual active-element comparison. Successful reruns verify Escape and focus restoration. Failed logs/results remain in their original directories.
- Initial policy command accidentally used the runner's16/100/1000 default. The unnecessary remaining scale workload was interrupted; its partial data and `wo13-interruption.json` remain under `merkle-configured-scale-1793748571298`, excluded from acceptance PASS counts. Completed16-holder evidence was then rerun with an explicit size. No protocol/scaling implementation was rebuilt. Large newly generated raw files were losslessly gzip-compressed with byte-equality checks; no historical evidence was removed.
- The first original native run is preserved separately from the updated review-guard run. It is not counted again as an independent final acceptance gate. No test was relabelled as real browser-wallet or Pudge acceptance.

## Repeat and hand off

Use Node24.19.0/npm11.9.0. From `apps/trade-testnet`: `npm ci`, `npm run typecheck`, `npm run build`, then `npm run test:experience`. Browser tests need system Chromium (`CHROMIUM_PATH` override) and pinned axe source download (`NODE_USE_ENV_PROXY=1` in this cloud or optional `AXE_PATH` with exact hash). Tests use localhost3101; no extension impersonation or Pudge broadcast.

For developer native regression, separately run `npm run test:native`, then from repository root `node labs/wo09-unified/src/run-merkle-configured-security.cjs`, then `MARKET_SIZES=16 node labs/wo09-unified/src/run-merkle-configured-scale.cjs`. Do not run them concurrently;19224/3100 must be free. Reuse validated local CKB/fixtures; these are Linux developer tests, not Windows frontend prerequisites. Offline replay: `node labs/wo09-unified/src/verify-merkle-scale.cjs EVIDENCE_DIRECTORY`.

[Windows owner checklist](WO13_WINDOWS_HANDOFF.md): install/choose genuine CKB testnet extension, run one app, connect and check two independent accounts, return only public addresses and public version/error observations. Exact funding inputs, funding shortfall, complete external-wallet signing and concrete deployment approval remain outstanding. No public signing, funding, code deployment or Pudge lifecycle is claimed. The current backed-claim demonstration is not Trade's entire launch, price discovery, secondary trading or liquidity vision.

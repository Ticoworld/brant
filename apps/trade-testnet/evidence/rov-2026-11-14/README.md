# Roveko UI Evidence

Captured from the optimized production build at `http://127.0.0.1:3001` with installed Chrome and `tests/capture-roveko-evidence.mjs`.

The `after-*` set covers `/`, `/v2`, Discover, Portfolio, Open Orders, Activity, Withdraw, Deploy Test Market, and legacy `/claims` in English and Simplified Chinese at 1440x900 and 390x844. `browser-report.json` records HTTP status, resolved route, headings, language, overflow, wallet choices, trade-action gating, and browser page errors.

The `before-root-claims-*` images show the unchanged historical claims screen that previously occupied `/`; it is now retained at `/claims`. The `before-v2-local-market-desktop.png` image is from an explicitly labeled disposable local-chain fixture. It is not a public market and its values are not represented in the after screenshots.

The after screenshots use public configuration with no verified Pudge deployment, so balances, prices, liquidity, market history, orders, and activity correctly remain unavailable. The browser showed the CCC wallet chooser and its wallet options, but no wallet was connected and no signatures or transactions were approved. The browser also reports a repeated CCC signer-discovery page error (`addressPrefix` read from undefined) in the no-wallet profile; the chooser still opens. Isolated-node transaction browser regressions require the repository's disposable-node environment variables, which were not configured for this capture.

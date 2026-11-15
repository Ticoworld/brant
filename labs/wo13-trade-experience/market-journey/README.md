# WO13 market journey evidence

See [the delivery report](../../../docs/WO13_MARKET_JOURNEY.md) for scope, boundaries and reproduction commands.

- `browser-*`: actual Chromium rendering. `result.json` distinguishes complete passes from retained failed harness attempts. Fixtures are explicitly labelled, contain no wallet or chain execution, and are disabled in the production build. Production-state screenshots use the real unconfigured manifest.
- `native-1793789438897`: completed browser-builder/private-chain regression, actual-app read-only journey, raw traces, exact errors and independent offline verification.
- `native-failed-1793789392061`: first run; five real transactions committed before development HMR erased the separate builder tab's in-memory variable. It is a failed incomplete run, not a full lifecycle PASS.
- `draft-*.png`: earlier inspected layout captures, before final focus/skip-link fixes; not final screenshots.

The controlled indexer adapter exposes actual committed private-chain market Cells and forwards read-only history/live-Cell requests to that node. It proves the app's reconstruction and routing against committed state, not a Pudge indexer, genuine extension signer or public deployment. Test keys remain Node-only in the existing disposable harness; no keys were injected into a browser.

Native configured security and maturity/refund regression evidence is under `labs/wo09-unified/evidence/merkle-configured-security-1793789498078` and `merkle-configured-scale-1793789623317`. All native suites ran sequentially.

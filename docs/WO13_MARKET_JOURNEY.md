# WO13 — Markets → position → action

4 November 2026 UTC. Branch: `wo13-trade-experience`. Starting private remote: `58f80b7dd350712ec906b9c5841a3fc234e6a015`.

**A. CLOUD EXPERIENCE READY FOR LOCAL WALLET ACCEPTANCE.** This is a qualified local journey, not external-wallet acceptance or Pudge deployment.

## Working journey

Markets is the default page; the generic Trade tab is removed. A user can paste a market ID or link, or explicitly search the configured deployment. Discovery inspects up to 20 live candidate Cells per page, with cursor continuation. Every listing must independently pass deployment, committed-history, Merkle/accounting and live-Cell reconstruction. Unverifiable candidates are excluded. This is a bounded directory, not a claim of complete ecosystem discovery or available liquidity. With today's `code: null` manifest the honest result is no verified listings and disabled discovery.

Each market opens its own `/market/<identity>` workspace, including reloadable `?claim=<raw-slot>` selection. The workspace displays contributed CKB, remaining protected backing, creator gross allocation, funding progress, maturity and authenticated positions. Creator allocation derives from original contributions and the fixed initial backing, **not** contributions minus remaining backing; it does not increase after a redemption. Shared capacity, receiving requirements and fees are distinct.

Selecting a position opens its actions in that market: contribute to an empty funding slot; refund one's own contribution before activation; sell one's active position; acquire another owner's position through a consenting signed offer; redeem one's remaining backing only at maturity. Activation requires the creator and complete funding. Closure requires the cushion funder and no outstanding liabilities. A disconnected or unchecked wallet has no owner actions. UI availability is guidance; the preserved builder, signatures and covenant remain authoritative.

The single ledger, proportional backing/funding bar and contextual side panel replace the imitation swap ticket. Mobile selection focuses the action panel; closing it returns focus to its table row. Technical identities, raw slot numbers, commitments and JSON are optional details. Exact fees, payout sources, receiving capacity and fresh-consent rules remain visible. Signed offer files still require both parties to review the identical transaction; import is not approval or settlement.

## Verification

| Evidence | Actual scope |
|---|---|
| TypeScript and production build | Passed; dynamic market route included. |
| Parser checks | IDs, links, old query links, selected slots, invalid IDs/slots and route roundtrips. |
| Chromium browser suite | 54 checks, 36 axe scans; no reported violations or page errors. Screenshots at 1440, 768 and 375 px. Eight scans have incomplete contrast checks: this is an accessibility smoke test, not WCAG certification. |
| Actual application over native state | Directory → market → position → fresh dynamic-route reload; missing-history refresh removes actions. Committed CKB state, controlled read-only indexer/RPC adapter, signing disabled, no injected wallet. |
| Browser builder/native lifecycle | 10 committed private CKB 0.210.0 transactions; 5 intended rejections. CCC signatures generated in the Node-only disposable harness, never in the browser. Offline UTXO/Merkle replay passed. |
| Preserved configured security regression | 22 committed native transactions and 30 rejection cases; offline replay passed. This historical suite also exercises optional contract behavior which remains unavailable in this app. |
| Fixed-policy maturity/refund regression | 27 committed native transactions at 16 positions, including pre-activation refund, re-enrollment, early-since rejection, actual block-maturity waiting, redemption and closure. Offline replay passed. |

Native transaction IDs, fees, cycles, raw compressed RPC traces and exact rejection errors are preserved in the evidence directories below. The browser lifecycle paid 0.019 CKB including deployment; its nine market transactions paid 0.009 CKB. This is disposable private-chain execution, not Pudge activity or a fresh commercial/security qualification.

## Failures retained and corrected

Three browser attempts stopped on obsolete fixture expectations: exact numeric text nested beside CKB, then a creation-capacity line absent from the controlled review fixture. Assertions were corrected to inspect rendered financial text, and the fixture now exposes capacity in primary review terms, matching the real controller. These were harness/fixture failures, not passing contract rejections.

The first extended native run committed five transactions, then the builder tab lost its in-memory market when Next development compilation refreshed that tab. The correction reconstructs that state from authentic committed history before continuing; it does not fabricate a replacement. The complete rerun passed. Both traces remain preserved.

The screenshot inspection also caught an off-screen skip-link appearing in full-page captures after focus scrolling. Its unfocused state is now clipped, while keyboard focus reveals it normally.

## Boundaries and handoff

`lib/market.ts`, `lib/approval.ts`, the configured covenant source/binary and public deployment manifest are unchanged. Read-only discovery/recovery is separate from transaction preparation. All writes still require public approval, exact binary/network verification, the supported secp lock, live inputs, exact fee/body review and fresh consent after changed terms. No public signing gate was enabled.

No external extension was impersonated. Real supported wallet signing, Windows execution, actual Pudge discovery, approved funding and deployment remain unverified owner/external gates. A controlled manifest and read-only adapter in the native browser test are explicitly not a Pudge indexer demonstration. Positions is scoped to verified markets loaded in this session, not a global balance index. Reconstruction still needs committed historical witnesses and the latest live Cell; no archive means no verified action. Resale needs a buyer; small redemption still needs suitable receiving capacity.

Use the updated [Windows handoff](WO13_WINDOWS_HANDOFF.md). The immediate owner action is connection-only acceptance in a physical browser with two independent disposable testnet accounts, returning public addresses and compatibility observations. No test CKB should be spent yet.

## Evidence and reproduction

- [Final browser results](../labs/wo13-trade-experience/market-journey/browser-1793789870889/result.json) · [desktop](../labs/wo13-trade-experience/market-journey/browser-1793789870889/position-1440.png) · [tablet](../labs/wo13-trade-experience/market-journey/browser-1793789870889/position-768.png) · [mobile](../labs/wo13-trade-experience/market-journey/browser-1793789870889/position-375.png) (labelled UI fixtures).
- [Actual-app native evidence](../labs/wo13-trade-experience/market-journey/native-1793789438897/actual-application-market-journey.json)
- [Native lifecycle](../labs/wo13-trade-experience/market-journey/native-1793789438897/events.json)
- [Configured security regression](../labs/wo09-unified/evidence/merkle-configured-security-1793789498078/)
- [Maturity and refund regression](../labs/wo09-unified/evidence/merkle-configured-scale-1793789623317/)

From `apps/trade-testnet`: `npm run typecheck`, `npm run build`, `npm run test:experience`, `node --experimental-strip-types tests/market-reader.mts`, then `npm run test:native`. Browser tests require system Chromium and pinned axe 4.10.3 (or `AXE_PATH` with the expected hash). Run native suites sequentially: `node labs/wo09-unified/src/run-merkle-configured-security.cjs`, then `MARKET_SIZES=16 REFUND_ROUNDTRIP=1 node labs/wo09-unified/src/run-merkle-configured-scale.cjs` from the repository root. Offline replay uses `node labs/wo09-unified/src/verify-merkle-scale.cjs <evidence-directory>`.

The verified delivery SHA is the private branch commit containing this report; compare `git rev-parse HEAD` with `git ls-remote origin refs/heads/wo13-trade-experience`. Exact remote verification is recorded in the delivery response. WO09–WO12 branch heads remain unchanged.

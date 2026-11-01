# Counterexamples and limitations

The attached historical manifest is retained in REBUILD_HISTORICAL_MANIFEST.md and remains historical evidence only. Launch attacks, upper-expiry limitations, revocation costs and maker economics require new minimal reproductions or explicit historical classification.

Current native evidence does not establish passive upper expiry, foreign-chain finality, permanent redemption, post-launch depth, profitable market making, demand or production safety. Native fixed fees are not executable market pricing.

Checkpoint C: new exact Fraction depth/accounting tools and executable strategy scenarios in labs/rebuild/models. All data are synthetic. Fee or depth absence returns UNKNOWN. Delivery is refused when native inventory is exhausted or reserved for obligations. CEX hedges remain separate from native CKB; transfers count once in transit, with fees. DAO claims are marked assets but unavailable delivery inventory. Stale replacement costs turn a quoted spread into a loss. Zero-fee principal netting generates no LP income. Commercial returns remain UNPROVED.

New six launch counterexamples are minimal mechanisms illustrating the historical failure classes, not recreation of the rejected launchpad. Their numbers are new synthetic witnesses, not old observed measurements.

Source-derived expiry finding: pinned CKB SinceVerifier::verify_absolute_lock rejects when current block/epoch/median time is BELOW since. It has no upper-bound condition. load_header accepts explicitly provided historical headers (or input-associated block headers present in header deps), without requiring the latest tip. Selecting an old header cannot prove inclusion is before a quote deadline. B's actual late fill confirms the limitation for the reconstructed commitment; no new generic upper-expiry covenant is claimed.

Exact-outpoint revocation is HISTORICAL ONLY: adapted A2 requires the exact live 36-byte gate outpoint as dep in mint/match, forbids substitution/rebinding; spending gate defeats later fills but cannot reverse a fill that wins ordering. Ordinary A2 does not implement this. Old comparable two-order lifecycle: 7 vs 9 tx, 6,088 vs 7,627 bytes, 12,119,195 vs 15,650,428 cycles, 578 vs 807 occupied CKB; independent adapted code cell ~42,889 CKB. These costs are not remeasured. Rebuilding this optional covenant does not change baseline readiness and adds no right required by present models. Revisit only for a WO09 hypothesis that needs active group revocation.

## Upstream A2 confusion and recovery boundary — UNRESOLVED

The pinned upstream security review explicitly reports known/live LO-01 order confusion. This rebuild did not execute its specific reproduction or test a correction. Output-lock identity alone does not authenticate creation history. Self-created mint/match/recovery runs and the one rewritten-reference rejection do not prove security against arbitrary forged lineage. Current recover.cjs accepts supplied transaction/input metadata and has no chain-history, live-cell or payout-intent guard. Its proper scope is disposable fixture signing. A correct signature may authorize an unintended transaction if the signing policy is wrong. See REBUILD_OWNER_RECOVERY_REVIEW.md for ordinary source inspection and bounded read-only checks.

Economic tools use synthetic inputs only. The new model witnesses preserve failure classes; they do not attest to the old implementation or any live market. The historical maximum batch and revocation costs remain historical.

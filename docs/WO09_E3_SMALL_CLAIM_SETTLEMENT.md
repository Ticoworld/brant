# WO09-E3 existing-Cell derivative

Historical initial status: RECONSTRUCTED, NOT VALIDATED. Later recovered functional results supersede this status: see WO09_E3_RECOVERED_MILESTONE.md. The initial build-only findings below remain preserved as history.

An isolated derivative adds an alternate payout predicate to force_exit only. The existing exact-value payout remains a fallback. The new predicate requires exactly one canonical owner-secp input, with no type script and empty data, and exactly one same-lock output with no type, empty data, and input capacity plus full authenticated claim amount. Capacity overflow, multiple matching owner inputs/outputs, changed type/data or missing owner input fail the predicate. All inherited SMT, nullification, total, anchor capacity and timeout checks remain unchanged. CKB must separately execute the recipient secp signature over the transaction. This dependency has not yet been tested for the new path.

Implementation: labs/wo09-e3/src/recipient_merge.rs. Preparation: python labs/wo09-e3/scripts/prepare-derivative.py <clean-pinned-upstream> <new-isolated-directory>. The script asserts upstream commit and cleanliness, archives it, then changes precisely one force_exit payout predicate. No baked proof key, proof verifier, checkpoint or force_refund policy changes are made. Upstream source remains unchanged. Attribution: Liquid Cells, LusoCryptoLabs, commit 47492b51673c94635ab23de2c55477625e94ccbf; upstream license remains in the generated archive.

Build: pinned Rust 1.99.1 with -C target-feature=-a,+forced-atomics -C passes=lower-atomic. Initial new-target build failed with ENOSPC. The retry reused the existing /tmp/trade-lower-atomic.iVszNg/crates/ckb-contract/target cache, CARGO_BUILD_JOBS=1, and succeeded. This is a build-resource correction, not a protocol change.

VM regression: seven upstream forceexit tests passed with the derivative binary substituted only in the ignored test artifact path; baseline artifact was restored afterwards. These tests exercise original payouts and original negative cases. They do not exercise the new recipient-merge arm, signatures, its uniqueness conditions or tiny balances. Do not upgrade this result to Q2 PASS.

Next decisive tests: 0.1 and 1 CKB SMT-backed accounts in CKB-testtool with actual recipient secp authorization; independent fee input; exact recipient capacity increase; preserved other liabilities; repeated settlement; invalid signature; wrong input identity; changed output type/data; ambiguous recipient inputs/outputs; wrong delta; recipient-input contention. Synthetic anchors must remain explicitly VM fixtures, never presented as proven checkpoint creation.

Fee assumption: full claim amount must reach recipient; a distinct fee payer supplies the miner fee. When recipient and fee payer use the same lock group, the deliberately strict uniqueness rule may reject the transaction. This is a usability limitation to measure, not silently loosen.

Commercial verdict: UNPROVED. This candidate requires an existing suitable Cell and does not solve Alice's no-funded-Cell onboarding, fee liquidity, active operator censorship or archive availability. No ACP semantics or channel guarantees are assumed.

WO04-E2D-P0 demonstrates both native-funded no-user-Ethereum paths on real private
PoS, preserving E2C fallback and all 745 previous tracked lab files.

- Deterministic immutable OutcomesV2: no open, expiry, owner or upgrade. Exact
  funding/chain/contract/beneficiary/amount/deadline identity; real controlled-USDC
  delivery and permanent order marker; token/reentrancy/replay cases executed.
- Customer nonce stays 0. Filled reimbursement and unfilled non-inclusion refund
  each transfer the original 1,000 CKB, with standard user/maker secp locks.
- Correct account+storage inclusion/non-inclusion parser; missing account and
  parser errors never refund. Independent py-trie cross-check and native vectors.
-720-byte SSZ timestamp proof authenticates exact finalized execution time using
  unchanged E2 publisher. Strict deadline equality and later-header retiming fail.
- Final independent reproduction:18 commits /50 native rejections; all 8 live
  hashes/cycles match;71 state roots /103 body roots plus real BLS predicates.
- Fill/refund native cycles 1,038,250 /973,118; maker EVM fill 85,534 gas; user EVM0.
  Full costs, capacity, private latency and limitations documented separately.

Review docs/E2_ZERO_ORIGIN_RESULT.md and DESIGN_LESSONS.md. Pinned DLN/Across
source-level review completed after successful public-code access checks.
No EVM-side CKB funding/confirmation proof, reverse trading, wider-participation
staging, public deployment or production security claim. Do not merge PR #2.

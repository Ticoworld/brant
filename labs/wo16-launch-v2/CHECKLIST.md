# WO16 checklist

- [x] Inspect pinned xUDT, R7 and native harness.
- [x] Candidate one-shot xUDT issuance; committed native issuance and overissuance/reuse rejection. VERIFIED for recorded cases only.
- [x] First and second purchases and sale committed on disposable CKB 0.210.0, with recorded accounting and independent transaction replay.
- [x] Test stale price, wrong recipient, underpayment, excessive fee and seller minimum.
- [x] Transfer actual xUDT to a second fixture owner, return it and deposit it into inventory through a curve sale.
- [ ] Repair canonical market identity. VERIFIED counterexample: same market lock accepts a different xUDT; counterfeit purchase committed in run-1794222815030. This is an unsafe invariant and makes the current candidate unsuitable for use.
- [ ] Test singleton identity and issuance under adversarial attempts, including duplicate inventory and wrong asset.
- [ ] Offline R7-style seller authorization: standard xUDT lock currently requires an online transaction signature; a separate covenant-controlled intent is needed.
- [ ] Commit verified evidence and create and verify local recovery bundle.

Cloud reproduction: on CKB 0.210.0 and Zig 0.14.1, `run-1794227269564` repeats issuance, purchases, sale and the committed counterfeit purchase; `verify.cjs` reconciles the recorded run. `lineage-1794227293131` repeats candidate issuance, one purchase and marker-substitution rejection only. The candidate has not passed the identity or accounting security gate.

Cloud identity candidate update: `lineage-1794252622863` records one-shot issuance, two purchases and a sale plus eleven rejected transactions, including an unrelated xUDT against the real marker (market lock error 6), unauthorized remint and changed marker. `node labs/wo16-launch-v2/verify_lineage.cjs labs/wo16-launch-v2/evidence/lineage-1794252622863` independently checks recorded transaction hashes, singleton succession and accounting, relying on the private node for consensus. Issuance now binds output 0 to the issued asset and output 1 to the marker and its exact data. This is a bounded experimental result, not a security audit; the original market remains vulnerable and unchanged. Canonical identification requires clients to verify the full marker and xUDT scripts, their code hashes, and the trusted issuance transaction; a lock hash or metadata alone does not establish provenance. Other deployment configurations, arbitrary scripts, chain reorganizations and exhaustive adversarial behavior remain unverified. Duplicate inventory and cross-market scenarios need additional dedicated tests. Do not use with real assets.

No public network, user wallet, or real assets used. CKB node commitment claims depend on the private node; replay is not an independent consensus verification.

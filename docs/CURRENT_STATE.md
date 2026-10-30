# Current project state — October 30, 2026

## Goal
Find whether native CKB can support a safer, faster, more capital-efficient trading business than available alternatives. Candidate customer jobs: one-off native-asset delivery, and repeated funded-session trading. No customer demand, maker commitments, executable competitive quotes, or profitability have been proven.

## Proven locally in research labs
- WO01: isolated CKB concurrency/mempool behavior with independent cells and dependency chains.
- WO02: native CKB/EVM escrow trades; exposed dangerous leaked preimages and claim/refund races. Do not use as production architecture.
- WO03: six inconsistent exit outcomes in a simplified independently adjudicated two-leg model; 19 contract cases, 103 EVM transaction receipts, 9,565 modeled states. This is **not** a Perun exploit.
- WO04 partial: actual native CKB funded session, 100 alternating signed updates, independent local CKB exit. Foreign-chain exit consistency not established.
- WO04-E1: 12 CKB transactions, 24 isolated-EVM receipts, 30 named defensive/result cases; four terminal outcomes and one reserved during outage. CKB verified real account/storage proofs RELATIVE to a controller-selected EVM execution root. Two CKB reservations shared read-only checkpoint. No foreign finality authentication.

## Central unproven security obligation
CKB must authenticate a sufficiently finalized, canonical external execution state root without trusting whoever submits it, before source storage proofs may authorize actual principal payouts. E1 currently trusts the root chosen by the devnet controller.

## Measured E1 cycle economics
- Direct proof settlement averaged ~442,403.5 CKB-VM cycles per trade.
- Shared read-only checkpoint consumption averaged ~49,594 cycles each.
- One checkpoint publication cost ~2,064,388 cycles.
- For two settlements, shared path totaled ~2,163,576 cycles vs ~884,807 direct proxy. Batching is not already cheaper at N=2; rough modeled cycle crossover ~6 with exclusions.
- Fixed fixture fees did not fall merely because cycles fell. Real proof, retention, and maker economics unmeasured.

## Next experiment (WO04-E2 candidate)
1. Reconstruct and compile E1 from this repository; verify results and explicitly label lack of consensus verification.
2. Compare actual ways to authenticate a finalized EVM execution root on CKB (correct light-client updates, succinct proof of same predicate, or security-explicit optimistic protocol) with executable measurements.
3. Wire an authenticated root into E1's existing payout/refund verifier, with incorrect-chain, stale, malformed, unfinalized proof cases.
4. Independently consider Ethereum zero-slot non-inclusion refund after immutable deadline to remove customer EVM `open` transaction. This is **NOT IMPLEMENTED**.
5. Compare independent direct proofs with shared checkpoint cost and recovery, not just CKB cycles.

No need to rerun WO01–WO04 historical experiments unless one targeted regression is necessary.

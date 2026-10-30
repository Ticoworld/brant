# WO03 decision: change the consistency mechanism

**Leading architecture: PROMISING BUT UNPROVEN.** The independently adjudicated portfolio-channel baseline requires redesign. The stronger candidate is a funded portfolio session with one authoritative sealed outcome and proof-gated native payout on the other chain. This is a conditional architecture, not an established trustless implementation.

## What changed

WO02 showed real native CKB/test-token exchange and specific unsafe escrow schedules. It did not prove HTLCs, channels or a CKB-native trading business impossible. WO03 challenged the higher-ceiling channel branch instead of silently treating its security as solved.

The new executed result is precise: a common signed state, version numbers, active monitoring of both legs and restarting challenge windows do not by themselves prevent different final portfolio projections when update cutoffs differ. The contract experiment includes a late hidden certificate after both legs already entered dispute. This is a counterexample to this baseline, not to every channel protocol or Perun's complete construction.

## Evidence

19 named cases, 103 real isolated-EVM receipts, 6 deliberately inconsistent outcomes, 9,565 abstract model states. Cryptographic domain, allocation, version and duplicate-settlement rejections were exercised. The honest-attestor repair worked; the lying-attestor control broke it. Those controls establish the trust boundary.

Two logical legs ran on one EVM development chain. No new native CKB channel or foreign consensus-proof verifier was implemented. No production finality or performance was measured. WO01 and WO02 artifacts remain unchanged and checksum-matched. Full code, source snapshots, compiler settings, receipts and transition witnesses accompany this decision.

## Strongest design now

Keep on-chain custody segregated and make only the *choice of exit outcome* authoritative once per session. Repeated complete signed portfolio updates can then reuse funded balances. Independent CKB session cells preserve concurrency across customers; netting and competing makers preserve economic options. A permissionless authenticated foreign proof is the missing component. Generic operator signatures, committee assertions, TEEs and trusted RPC responses cannot be silently substituted for it.

If proof delivery fails, follower funds can remain locked. Adding an independent refund may recreate inconsistent exits. The most dangerous technical problem is therefore sound cross-chain outcome authentication **and bounded independent release**, including proof availability and fee funding. Source adjudication, stale proposals and last-signature option semantics remain part of that proof obligation.

## Business conclusion

The repeated-trading ceiling remains higher than per-trade escrow, conditional on consistency and usable exits. The inventory-reuse example reaches $100,000 alternating gross volume with $2,000 combined funded principal, but only by assuming exact reversing flow and constant prices. One-way demand still consumes stablecoin inventory. This is not liquidity creation.

The most dangerous economic problem is whether users trade often enough with the same funded counterparties to offset opening, proof, exit, capital lock and maker-switching costs. A responsive channel balance does not satisfy a one-off customer asking for native stablecoins in an external wallet. No firm delivered competitor quote, demand evidence or profitable maker operation was established.

## Decision

Preserve WO02's repaired escrow as the conversion fallback. Do not begin a full exchange build. Advance the anchored-session candidate only through one native CKB/EVM atomic-update/exit experiment, described in05_NEXT_DECISIVE_EXPERIMENT.md. First inspect a complete supported multi-ledger construction and reproduce its actual semantics; reuse it if it meets the gate. Otherwise test the real proof direction and quantify verifier cost. The experiment must defeat withheld signatures, skewed disputes, false proofs and proof withholding without installing a mandatory trusted operator.

The next result must establish a stronger mechanism, not merely add more passing happy paths. There is a credible path worth testing, and no justified breakthrough or commercial-superiority claim yet.

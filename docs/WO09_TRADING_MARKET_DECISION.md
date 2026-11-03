# WO09 trading-market decision — 2026-11-03

## Decision

**Technical: ADVANCE — bounded two-asset research capability; preserve as optional fallback.**

**Commercial: UNPROVED — no current opportunity has demonstrated a competitive business advantage.**

**Product: PARTIAL — not a production DEX, live liquidity venue or unconditional small-withdrawal system.**

The strongest remaining specific opportunity is native-asset RFQ/inventory replenishment for existing CKB-native holders and liquidity providers, with an optional shared-capital access layer for repeat small traders lacking personal typed Cells. CKB/iCKB is a concrete asset family supported by preserved authentic issuance/redemption research, but current firm iCKB quotes, demand and profitable replenishment are missing. A generic stablecoin market cannot be assumed from a TEST xUDT demonstration or custodial CKB/USDT book.

Existing-wallet direct settlement and published A2 remain the execution fallbacks. The new pool preserves genuinely backed ownership without customer input funding, but has worse measured execution cost, expensive cold code, shared-input coordination and conditional external withdrawal. Do not adopt it as Trade's default architecture merely because it executes. Do not reopen frozen ordinary-capacity research to improve those numbers without materially new evidence.

## Answers to the decision gate

1. **Opportunity:** atomic native-asset inventory RFQ/rebalancing, potentially with storage-amortized repeated access. Bounded-risk contracts and paid inventory commitments remain alternatives, not presumed winners.
2. **Users:** holders who need actual native asset delivery and professional/hobbyist makers who already obtain that asset and manage inventory. No named prospect has yet committed to use or pay Trade.
3. **Why choose Trade:** permissionless contract-enforced delivery and owner control are technically real but already overlap A2/direct RFQ. Only a narrow potential advantage is demonstrated mechanically: two backed balances exchange under key-only authorization and shared storage. Whether the complete cost/exit trade-off is preferable is not commercially established.
4. **Funded assets:** new fixture uses real native CKB and published-contract TEST xUDT from identified issuer/maker inventory. Two owner signatures authorize pool exchange. Genuine external token delivery subsequently consumes Alice's funded secp recipient. TEST has no asserted market value. Intended production assets require separately verified issuance, redemption and maker inventory.
5. **Economic advantage:** no measured execution advantage. Storage amortization can beat newly created independent per-user Cells under explicit utilization assumptions; it loses against already funded wallets on incremental storage. Code deployment, proof service, shared contention and external receiver must be included. Maker gross spread is not net income.
6. **Capacity contribution:** helpful only for repeated internally settled holdings and callers without personal funded Cells; not a way to avoid collateral or assure small external cashout. A2 sponsor-funded order creation is an important rival counterexample.
7. **Missing evidence:** actual bid/ask and replenishment quotes for the exact native asset; paid user frequency/volume; willing inventory provider; concrete maker economics; default/issuer risks; quote service availability; full independent contract/signature/recovery audit; scale and contention qualification of this particular binary; practical archive persistence; suitable receiver liquidity. Arbitrary A2 lineage/LO-01 and quarantined E1 beneficiary problems remain explicitly unresolved and untouched.
8. **Next decisive engineering experiment:** only after obtaining a credible exact-asset funded quote, test a thin isolated pool-to-established-A2 settlement adapter so a maker can use an existing funded order rather than join this pool. Compare end-to-end owner-authorized delivery, all receiving capacity, fees and inventory replenishment against direct existing-wallet/A2 execution. Use only known self-created disposable orders; this must not become LO-01 or quarantined beneficiary testing. The current contract intentionally restricts input topology and cannot simply accept that composition without separate qualification. If no willing quotes/customer job emerge, stop expanding the adapter and preserve the existing execution stack.
9. **Preservation:** initial native/rival milestone `0fbf94aacafa1a952c7200ba1471746b75203368` was non-force pushed and verified on `origin/wo09-unified-breakthrough`. This decision/economic checkpoint is the following commit; its exact verified SHA is recorded in the final user report/Git history rather than a self-referential document hash.

## Why no further speculative market build now

A valid two-asset experiment and strong native rival comparison resolve this continuation's highest-value technical uncertainty. Demand, real inventory pricing and repeat use are now more decision-changing than another matching engine, generic storage kernel or fixture-funded swap. None of those can establish a paid LP or beat an existing public exchange's actual book by assertion. There is no environment or permission failure being disguised as protocol failure; the unresolved boundary is market/customer evidence and unqualified production security.

No customer contact is authorized. A focused read-only/public-data validation plan is appropriate: identify an exact supported token and issuer contract; record accessible firm bid/ask, minimums, inventory, fees, replenishment path and withdrawal requirements; compare direct/A2, any applicable AMM/Fiber route and custodial alternative under identical asset/size/time assumptions. Prepare interview questions for real holders/makers, but do not send them without authorization. A fixture-maker quote remains useful execution evidence only.

## Research question tree

- Q1: Can no-personal-Cell ownership exchange two genuinely backed assets? **BOUNDED NATIVE YES**,13 committed transactions; final external recipient condition explicit.
- Q2: Is execution superior to established approaches? **NO in measured workload**. Direct RFQ836bytes/3.31Mcycles; published A2 fill841/1.71M; pool1432/11.50M. Full-stage semantics differ.
- Q3: Is sponsor-funded onboarding unique? **NO**. A2 bid/master creation succeeds without customer funding input.
- Q4: Does the optimized label guarantee a faster rival? **NO**. Published A2 slightly beats this rebuilt optimized binary; keep the stronger result.
- Q5: What caused the first zero-reserve failure? **Partially diagnosed:** published xUDT error8 at creation; adding actual existing token-group input/unchanged inventory output enables lifecycle. Exact upstream source branch unverified; negative trace preserved.
- Q6: Can an owner exit without original maker/funder keys? **YES under tested funded recipient/history conditions**. Customer delivered actual token after fresh-process recovery. No unconditional sub-minimum external receiver claim.
- Q7: Does warm storage help at utilization? **DERIVED YES for new per-user Cell profiles**; native scale of this binary remains untested. Existing wallets add0occupied capacity, so no automatic advantage.
- Q8: Who replenishes inventory and pays spread? **OPEN**. Price hedge is not token replenishment; no willing external maker verified.
- Q9: Is tiny-ticket access enough to create demand? **OPEN**. Public CEX5USDT minimum is observed, but no willingness-to-pay follows.
- Q10: Could a funded existing-order adapter reduce maker adoption costs? **NEXT CONDITIONAL HYPOTHESIS**, not implemented or labelled equivalent to OTX.
- Q11: Would fixed-term risk or paid commitment win? **OPEN ALTERNATIVES**. Need actual premium/retainer payer and fully specified oracle/term/inventory assumptions. Do not resume quarantined work.

All earlier contracts, negative findings, raw evidence and frozen capacity conclusions remain preserved. No WO10, public deployment, mainnet funds, external commitments or protected-branch edits.

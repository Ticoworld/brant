# WO09 preservation and strategic handoff

Preserved 2026-11-03 at the user’s request. The text below is the supplied reference note, retained verbatim. It records strategic recommendations rather than new independently verified market evidence or authorization to contact participants. No new implementation, outreach, trading or funding is started by preserving it.

Research checkpoint verified on the private `wo09-unified-breakthrough` branch before this addition: `bf9fe46bf98acab7470aa4985e35a1a568621309`. Existing source, tests and evidence remain preserved. Detailed evidence qualifications remain in `WO09_NATIVE_INVENTORY_DECISION.md` and its linked reports.

Original attachment: `Pasted text.txt`; SHA256: `a30d3af330d58653b4cb9cd0d2877247fef27481229ace1dd2928500e943944c`.

---

This is the right decision for the iCKB maker opportunity. We should stop it and preserve the results. But we should not stop Trade.

I verified the private GitHub checkpoint: [`bf9fe46bf98acab7470aa4985e35a1a568621309`](https://github.com/Ticoworld/trade/commit/bf9fe46bf98acab7470aa4985e35a1a568621309?utm_source=chatgpt.com).

The research has produced something more valuable than another successful transaction: evidence that tells us where not to invest additional engineering.

## What this result actually tells us

The new iCKB mainnet investigation found 18 fulfilled order groups but no remaining executable offers in the sampled books. The SDK could calculate potential trade outputs, but those were not orders someone could actually fill at that moment.

And the economics are weak.

| Trade value | Gross revenue at 0.01% |
| ----------- | ---------------------- |
| $20         | $0.002                 |
| $50         | $0.005                 |
| $100        | $0.01                  |

Those amounts are before inventory financing, replenishment, transaction fees and operations.

For example, the modeled 2% annual capital cost over 5.62 days is approximately 0.0308% of notional, already more than three times the 0.01% fee.

That does not establish that every iCKB market maker loses money. It does establish that we have no demonstrated economic advantage from building another maker using these assumptions.

The new iCKB SDK and bot already provide a conversion workflow, order matching and inventory management. The November 2 release specifically describes improvements to fees, funding cycles and liquidity availability.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://talk.nervos.org\&sz=32)

Nervos Talk



Competing by reproducing it would be a weak use of our research.

## One important distinction

No executable offers at the observed time does not mean there is no demand for iCKB.

It could mean low activity, completed trades, insufficient makers or temporary liquidity conditions. We haven't established which.

Similarly, RUSD returning HTTP 403 does not establish that its market is empty. It means our evidence cannot establish executable liquidity there.

So the appropriate result is STOP this opportunity on present evidence, not STOP all CKB-native trading.

## Where Trade stands after WO09

| Research area                                  | Decision                                            |
| ---------------------------------------------- | --------------------------------------------------- |
| Native exchange and A2 settlement              | Preserve working baseline                           |
| Large-scale batch clearing                     | Preserve, no demonstrated maker-capital superiority |
| Operatorless Merkle financial ownership        | Technical advance, product unproved                 |
| Trading without personal 61-CKB Cells          | Technical advance, conditional small exits          |
| Zero-personal-Cell two-asset exchange          | Working prototype, no execution-cost advantage      |
| CKB/iCKB maker and A2 adapter                  | STOP                                                |
| Fixed-term risk and paid liquidity commitments | Remain open, commercially unvalidated               |

Notice something important.

We have spent considerable effort proving what CKB can technically support, but comparatively little evidence establishes who will pay for a superior trading service.

That is now our main constraint.

## What I would do next

I would formally freeze the completed WO09 implementation experiments. No more new matching contracts, Merkle variants, adapters or capacity optimizations simply to keep Codex busy.

Then I would investigate actual underserved trading participants, not start another large architecture investigation.

Specifically, I want evidence for these questions:

1. Who currently holds CKB-native assets but struggles to obtain acceptable execution?
2. What asset, amount and settlement deadline do they actually need?
3. What price or premium would they accept for guaranteed or faster execution?
4. Can a real capital provider supply that inventory profitably?
5. Is there a financial-market opportunity beyond spot exchange, such as bounded-risk positions or paid liquidity commitments, with identifiable counterparties?

The difference now is that we must obtain evidence from actual market activity or prospective participants, not generate another hundred hypothetical fixtures.

I would start with a small number of relevant asset holders and liquidity providers, once outreach is authorized. Public data can guide the selection, but it cannot substitute for their actual requirements or firm bids.

## The most important strategic decision

We should not abandon the high-price CKB accessibility work. It demonstrated that small traders can control funded positions without owning personal Cells, which could become valuable as capacity costs rise.

But we also should not force that mechanism into every future Trade architecture.

Keep it as an optional capability until a trading job genuinely benefits from it.

And don't move automatically into fixed-term derivatives simply because iCKB market making failed. That direction also requires an actual risk buyer, counterparty, pricing and a credible reason to use Trade instead of existing instruments.

My recommendation is therefore:

Close this WO09 opportunity, preserve the technical stack, and make the next phase of Trade about discovering one demonstrably underserved trading market before committing to another implementation.

That keeps us moving toward the original ambition: not merely building an exchange that functions on CKB, but discovering a trading business that has a compelling reason to exist.
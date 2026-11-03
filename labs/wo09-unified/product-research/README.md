# WO09 product/payoff discovery

This phase does not change or rerun the qualified native covenant. It tests financial hypotheses against public creator jobs and simpler alternatives.

- `sources.json`: dated primary-source registry, immutable source refs where obtained, reported-vs-verified limits.
- `research-trail.json`: discovery/debug trail and discarded/qualified leads.
- `offer-cards.json`: complete hypothetical financial offers, not issuer quotes or commitments.
- `model_product_offers.py` / `model-results.json`: exact Decimal payoff identities, counterexamples, budget/price/reuse/floor scenarios and operating-cost stress.

Run from repository root:

```sh
python3 labs/wo09-unified/product-research/model_product_offers.py
```

No external dependencies, chain node, SP1, private keys, paid service or live assets are used. Model assertions are not VM/security tests, customer preference data or a commercial score. Repeated scenario rows do not represent independent customers.

Current selection: `docs/WO09_MASTER_PRODUCT_SELECTION_GATE.md`. Unsent validation plan: `docs/WO09_MASTER_NEXT_DECISIVE_EXPERIMENT.md`. No contacting or solicitation was performed. The current cash-only offer is rejected; plausible conditional service/earned-balance jobs need actual customer, terms and cost evidence before another implementation.

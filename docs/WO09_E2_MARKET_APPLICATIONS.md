# Trade market applications

| Workload | Reusable state-free improvement | Hard remaining condition | Status |
|---|---|---|---|
| Spot exchange | Full body intent can be exchanged in one atomic transaction, replacing existing cells | complete compatible fill, all signers, real maker inventory; no reservation while waiting | Native 4-in/4-out proof |
| Protected launch | Off-chain intents reduce order state; existing E1 claims fund independent right | claim redemption/storage capacity and escrow/fairness; pooled exits need proof/DA/uniqueness | E1 claims remain fallback; E2 pooled launch unbuilt |
| Fixed risk | Open order needs no new order Cell | funded collateral, trustworthy observation, maturity output budgets and independent claimant state | E1 fixed-recipient fallback; no new E2 risk script |
| Maker commitments | Signed RFQ avoids resting order Cell | quote validity, actual inventory, fee, adverse selection and finite replenishment | model/source only |
| Micro-payments | Fiber/payment channel can amortize routine L1 actions | funded channel/path/counterparty and close/force-exit policy | source reuse only |
| Pooled claims | one commitment can amortize participant state | duplicate redemption, shared contention or per-user nullifier, proofs/data and sponsor-exit costs | formal model only |

Position size should select architecture: existing-cell reuse for occasional spot; channel for repeated routed transfers; funded per-claim for simple independent rights; pooled validity system only if its proof/DA/forced exit beats those alternatives. No E2 commercial preference is proven.

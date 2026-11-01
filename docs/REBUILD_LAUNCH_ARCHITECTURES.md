# WO06 architecture knowledge reconstruction

VERIFIED offline: launch_architecture.py executes stateful exact-arithmetic reserve-pool trades, selective uniform-auction admission, equal-identity distribution, gross-demand graduation and revocable LP reserves. It preserves all six historical attack classes without recreating the rejected large bonding-curve implementation.

A creator buys 10 units, a customer buys 10, then the creator sells 10; the pool remains reserve-conserving while the creator extracts positive customer-funded profit across batches. Swapping early/late buyer identity changes price. Restricting solver admission changes the auction winner. A split search over budgets, honest participation and creator identities demonstrates allocation gains. Creator-funded gross demand is explicitly separate from independent net capital. Withdrawal removes all LP reserves when authorization permits it.

The alternative reserve-floor predicate is also preserved: assets must cover floor times outstanding claims, and owner withdrawals must preserve backing. A one-unit authorized reserve removal without claim burn violates it. This is a distinct solvency mechanism, not proof of fair issuance, fees, permanent redemption or market depth. No native launchpad/floor implementation is claimed and no WO09 implementation started.

These are new runnable mechanism witnesses, not identical original code. Old synthetic witnesses remain for provenance. Historical 4,950 split tests are not reproduced or forced; the current independent parameter search tests the actual allocation rule and retains each result.

# Experimental two-market checkpoint

Status: INCOMPLETE; not frozen or security approved. No contract source was modified in this checkpoint. Original evidence remains unchanged.

The disposable private CKB 0.210.0 harness was run using:

```
TRADE_NATIVE_ROOT=/workspace/trade/labs/rebuild/native node labs/wo16-launch-v2/run_two_market.cjs
node labs/wo16-launch-v2/verify_two_market.cjs labs/wo16-launch-v2/evidence/two-market-1794254025984
```

The second command passed against an earlier revision of the verifier requiring 26 positive-numbered script rejections. The saved source was subsequently extended to require 28 cases, including witness-owner attempts returning xUDT error -52. Its error regex currently accepts only unsigned codes, so it will fail on the latest run until corrected; no successful verification of the latest evidence is claimed.

`two-market-1794254025984` contains two committed issuances, purchases and sales and 26 script rejections. `two-market-1794254274373` additionally contains attempts using the exact owner script in a witness, rejected by the token script with error -52. The latter outcome alone does not prove the witness was correctly parsed or that the enhanced owner path was reached, because the upstream implementation ignores errors from that path. Validate witness encoding and both group-input and group-output paths before closing the owner-mode gate. The other two type-hash activation flags are disabled for the tested 32-byte plain xUDT args; alternative configurations remain untested.

The test for extra purchase inputs returned market error 23 (fee conservation), so it does not independently establish that every structurally valid extra-input case is rejected. Issuance extra-input/output cases exercise overissuance only. Dedicated checks of reserve and fee conservation under other extra-cell configurations, complete provenance replay, occupied-capacity reconciliation and reproducible verifier for all cases remain open. No fallback freeze, R7 offline order, Merkle ownership, protected floor or batching is claimed.

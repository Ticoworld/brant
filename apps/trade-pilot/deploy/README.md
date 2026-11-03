# Pudge preflight and manual acceptance

Public signing remains disabled: `public/pudge.json.code=null`. Expected genesis10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606 and original code data hash53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f. Original binary17848bytes,17889CKB immutable code capacity, market cushion322CKB. No candidate identity or silent WO10 binary substitution exists.

Current public observations are in `labs/wo11-pudge-pilot/evidence/preflight-1793740498584` and relay JSON. get_cells and a committed historical body with7witnesses were read; body hash recomputed. This samples availability, not a pruning/archive or canonical-consensus guarantee. Relay min1000sh/1000bytes, replacement min1500, sampled median19685. Conditions can change; estimates do not promise inclusion.

## Exact selected-budget requirements

All amounts are disposable **test CKB**, analytical until actually funded. Standard-secp one-input/two-output immutable code deployment is18288bytes in the known fixture and offline reproduction. At sampled median the size-based estimate is360000sh=0.0036CKB; selected explicit deployment fee is1000000sh=0.01CKB. Standalone deployment input must be **17950.01CKB**:17889code+61minimum change+0.01fee. Code capacity is permanently locked in this unspendable-code profile, not a fee returned at market close.

Market creation alone needs **383.001CKB**:322cushion+61change+0.001selected fee. Each contribution is0.125CKB, backing0.1; creator gross0.025 per contributor. Buyer consideration0.01 is additional and fully paid to seller.

For the exact two-owner default journey, Alice is code publisher/funder/creator/first contributor and starts with **18272.137CKB in one plain Cell**; Bob starts with **61.137CKB in one plain Cell**. This covers code deployment, creation, both contributions and Bob's0.01purchase at selected fees. At Alice's funding low point her replacement retains61CKB; Bob retains61 after purchase. Later redemption fees come from gross payouts and final closure fee from returned cushion. Total initial requirement18333.274CKB, including code17889 and both reusable wallet/cushion capital. Do not count those same balances again as freely available liquidity. Actual witnesses/input topology, extra refund rounds, fee changes or additional actions require recalculation. No faucet funds were obtained or assumed available.

## Prepared scripts

```sh
# Offline only; input file contains PUBLIC Cell data/outpoint, never a private key.
node --experimental-strip-types tests/deployment-plan.mts FUNDING_CELL_JSON OUTPUT_JSON
# Read-only after an approved deployment; never writes a signing-enabled manifest.
NODE_USE_ENV_PROXY=1 node --experimental-strip-types tests/verify-deployed.mts TX_HASH OUTPUT_INDEX
```

The first emits an unsigned plan with funding_live_verified=false and zero signature placeholder. It is not an executable signed quote or proof the input exists on Pudge. The second checks expected genesis, actual live code hash, committed deployment status and the immutable/unspendable code lock. A successful read alone is not approval to enable signing. Only after explicit deployment/funding/signing approval and independent verification should an operator propose the code outpoint in the manifest for review. These scripts have no broadcast call. Do not alter protected evidence or the original code hash.

## Manual real-wallet acceptance plan — not executed

1. Obtain explicit approval and controlled testnet funding/deployment authorization. No public action is authorized by this README. Deploy the exact original bytes, record actual transaction, wait for commitment and selected confirmation policy, run the read-only verifier, then separately approve a manifest change.
2. Use two consenting, independent UTXO Global **CKB/standard-secp** accounts (or another genuinely supported ordinary-secp wallet). Record wallet/CCC versions, Pudge address/lock/full hash and exact args; do not infer compatibility from wallet brand. No OmniLock/JoyID address is accepted for this phase. Never export real keys.
3. Confirm network/fees/code identity, plain-cell balances and no unsupported mode. Capture the full transaction preview and consent before every actual signature. A connected wallet or estimated cycles alone is not a committed transaction.
4. Create the two-slot market, contribute0.125 each, activate, preserve80/20 accounting, and demonstrate partial withdrawal under actual configured maturity. Test refund/re-enrollment in a separate round with additional fees if desired; do not claim simulated waiting as since validation.
5. Seller and buyer review identical market/index/buyer/price and outputs. Add both wallet signatures in the same transaction. Confirm raw-body stability, witness framing and preservation of the first party's signature. Missing/altered/unsigned tests remain on private node unless separately authorized. Repeat the sign order only in a distinct legitimately funded attempt, never double-spend one input to manufacture counts.
6. Record paid assignment commitment, former-owner denial, buyer redemption, current proof rebuild after another update, closure/cushion return, exact fees and statuses. Use a fresh profile/browser without cached receipts. Check archive failure and stale roots fail closed. A stale input is a resolution error, not a covenant authorization PASS.
7. If extension preparation changes deps, raw terms, signature grouping or witnesses unexpectedly, STOP that wallet profile and preserve the failure; do not weaken checks or mark a mock signer PASS. If secp suffices, finish this pilot rather than expanding the contract.

Remaining blockers: no approved public deployment/outpoint/funding, no actual external-wallet execution, no signature/CoTA/passkey/BTC hardware interaction, no long-term archive/relay guarantee. No actual committed Pudge lifecycle exists in this work order.

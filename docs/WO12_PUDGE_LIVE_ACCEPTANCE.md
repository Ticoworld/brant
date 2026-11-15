# WO12: first real Pudge lifecycle acceptance

**Final decision: C. EXTERNAL WALLET BLOCKED.** 3 November2026, Africa/Lagos. No qualified real browser-wallet signer was available through this session's accessible browser/tools. This is not Pudge partial success: no Trade public transaction was constructed, signed or broadcast. The first required gate failed, so deployment and the two-owner lifecycle stopped safely.

Baseline/fetched commit: `c2a2fb52cb633525931428409c455d24aa0a7fc9`, branch `wo11-pudge-pilot`. New work is isolated on `wo12-pudge-live-acceptance`. WO09, WO10 and WO11 source/binaries/tracked evidence remain unchanged. No covenant redesign, wallet-mode expansion, financial feature, market research or local lifecycle rerun substitutes for public acceptance.

## Recovered implementation and exact binary

Read the WO11 compatibility/evidence decisions, WO10 native vertical-slice report, current deployment README, unsigned planner, read-only verifier and native browser transaction builder. These remain qualified only within their documented scope: earlier real Node-only CCC signatures are not external-wallet acceptance.

Binary `labs/wo09-unified/build/merkle_market_configured` is17,848bytes. Both checks passed:

- SHA256 `c569360ba498e715899635410dc0474003e8f61c6afc08a5c3f2a87527711c1f`.
- CKB data hash `0x53277b69232d6856a0de486e3950e20adc8a4ed4c3c909f511ec3f9827c5cb1f`.

No binary mismatch occurred. No new binary/deployment identity was created. The preserved Pudge manifest still has code:null and publicSigningEnabled:false. Data-hash equality is a binary integrity result, not a public deployment receipt.

## Actual external-wallet gate

Accessible capability: local system Chromium154.0.8037.57 with Playwright. No user-owned interactive browser or remote-desktop connection was attached. Existing container Chromium profile metadata contained only Crash Reports, with no installed extension directory. No wallet secret stores were read. This inventory does not inspect or make claims about wallets on the user's personal device.

The actual existing Trade UI was opened and its Connect testnet wallet button clicked. Diagnostic evidence:

- `labs/wo12-pudge-live-acceptance/evidence/wallet-probe-1793743675272`: development-server observation and connector screenshot.
- `labs/wo12-pudge-live-acceptance/evidence/wallet-probe-1793743814567`: production-server observation and connector screenshot.

In both fresh diagnostic browser contexts, `window.utxoGlobal` and its `ckbSigner` were absent; extension targets were empty; no address, account or signature was obtained. These are availability probes, not simulated external-wallet acceptance. No provider object, injected mock signer, Node key or test extension was substituted. The menu's MetaMask/JoyID/other entries are discovery/connection choices, not proof of installed wallets or covenant compatibility. None was used as an alternate route around the ordinary-secp gate.

Pinned CCC UTXO Global source confirms the CKB integration requires `window.utxoGlobal.ckbSigner`; its CKB signer delegates to the external provider's transaction signing and prepares ordinary-secp dependencies/witnesses. Source compatibility alone does not establish a real extension's network selection, address ownership, account consent or complete-transaction signing behavior.

| Acceptance field | Actual result |
|---|---|
|Real external wallet/extension tested|None available; no acceptance PASS|
|Actual selected testnet account/address|Unavailable|
|Exact accepted owner lock|Not observed; expected policy only below|
|Plain Cell ownership|Not assessed without owner address/provider|
|Complete Trade transaction signing|Not attempted|
|Private keys exported or imported into test harness|None|

Expected existing policy, not an observed wallet identity: code hash `0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8`, hash_type=type, args exactly20bytes. Preserve its full lock hash as owner identity. Do not switch to OmniLock or JoyID or accept any arbitrary matching lock hash to bypass this blocker.

## Refreshed read-only public preflight

Existing WO11 public readers were reused verbatim in the WO12 directory, producing `preflight-1793743715063` and `relay-1793743721252.json`. Pudge genesis matched `0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606` at `https://testnet.ckb.dev/`. get_cells, current live script dependencies and one committed historical transaction with7witnesses were accessible. The sample transaction belongs to existing public history, not to this work order and not to the user. A sampled public Cell is not verified owner funding.

Current observations:

| Check | Read-only result |
|---|---|
|RPC/indexer|Answered at the above provider; not a service-availability guarantee|
|Relay minimum|1000shannons/1000bytes|
|Replacement minimum|1500shannons/1000bytes|
|Sampled median fee rate|1000shannons/1000bytes; distinct from relay policy|
|Pool transaction-size limit|512,000bytes|
|Consensus block-size limit|597,000bytes|
|Consensus block-cycle limit|3,500,000,000cycles|

Block limits are not proof of an endpoint's exact per-transaction verification-cycle policy or inclusion guarantee. Actual funded transaction estimation/relay remains unperformed. Existing covenant/witness bounds remain unchanged; no new maximum-scale claim follows.

`consensus.json` records the successful read. An initial fetch without Node's environment-proxy option failed before receiving a consensus result; the failure is retained in `consensus-default-fetch-failure.json`. Retrying through the existing supported proxy configuration succeeded. This was an environment configuration correction, not a contract failure or access-policy workaround.

## Funding: unknown, not zero and not approved

No two consenting owner addresses, actual plain funding Cells or wallet versions were supplied. Therefore there is no verified funding source, balance, actual input topology, receiving address or numeric shortfall. Do not treat prior disposable private-chain keys or random public indexer samples as user-controlled Pudge funds.

The prior analytical budgets remain references under their selected fees/topology:

| Component | Reference test CKB / qualification |
|---|---|
|Immutable occupied code|17,889CKB; not a spent miner fee and not assumed recoverable|
|Standalone deployment input|17,950.01CKB = code17,889 + wallet replacement61 + selected fee0.01|
|Shared market cushion|322CKB, returned only after lawful closure|
|Ordinary-secp wallet replacement|At least61CKB for each actual required replacement|
|Market creation input|383.001CKB under old one-input0.001fee plan|
|Two-owner journey|18,333.274CKB total: Alice18,272.137 and Bob61.137 under the documented combined-role/one-Cell plan|
|Protected backing|0.2CKB from two0.125CKB contributions, not issuer/fee money|
|Creator proceeds|0.05CKB gross, distinct from reserve and net of its action fee|
|Actually consumed WO12 transaction fees|0; no transactions broadcast|

At the refreshed1000sh/1000bytes median, the old18,288-byte standalone deployment shape gives a size estimate18,288sh=0.00018288CKB. That is not a final fee, approved spend or replacement for a real wallet-prepared transaction. The selected0.01deployment and0.001market-action fees retain the prior reference budgets. Actual funding Cells, maturity, fragmentation, wallet witness/dependency changes and selected fee require recalculation before approval. Sum of wallet balances alone is insufficient for a one-input builder; suitable live/spendable plain Cells must exist.

Official named faucet URL: [Nervos Pudge Faucet](https://faucet.nervos.org/). The public page was located read-only; no claim, account request or funding commitment was made. Faucet allowance and availability were not qualified. **Faucet receiving address and shortfall are unknown until the owner supplies and proves control of actual public Pudge addresses.** No address was invented and no transfer was requested.

## Public lifecycle status

| Stage | WO12 count/status |
|---|---|
|Constructed public deployment/market transactions|0|
|Signed|0|
|Broadcast|0|
|Pending|0|
|Committed|0|
|Rejected public lifecycle transactions|0; none submitted|

Deployment transaction hash/output index/capacity/actual fee: **not available**. Every committed Trade Pudge transaction hash: **none**. No manifest was populated from a nonexistent code Cell; signing remains disabled. No absent public lifecycle is relabelled as local execution, an existing historical transaction or simulated UI success.

Creator proceeds, contribution review, paid Alice-to-Bob assignment, former-owner rejection, fresh-browser ownership recovery, mature redemption and final cushion return remain **not performed on public Pudge with an external wallet**. Existing WO10/WO11 local evidence is preserved as fallback only.

## Human-experience observation and exact next action

Actual screenshot confirms the UI/connector renders and warns of secp-only support, fixed80% backing and20% creator financing, receiving capacity, history dependence and unvalidated liquidity. No real wallet signing prompt was available, so its terms, errors and two-wallet behavior cannot be accepted here. No speculative UI feature was added. Running the diagnostic dev server regenerated two Next type-import paths; those exact automatic changes were restored, leaving WO11 tracked files unchanged. The reusable probe now uses the existing production build to avoid that rewrite.

Next human action:

1. Provide an accessible **user-controlled browser route** with a real UTXO Global CKB signer, or run the unchanged app locally with the genuine extension. Select Pudge and connect two independent consenting accounts. Share only public `ckt…` addresses and public lock/provider/version observations—never keys, seeds or wallet storage.
2. Qualify each exact ordinary-secp lock and plain Cell ownership via the actual provider. Public addresses alone are not signature evidence or permission to spend. Then query actual balances/Cells and calculate the specific shortfall; if needed, the owner obtains disposable test CKB through the official faucet to their own addresses.
3. Only after actual signer/funding qualification, prepare the exact unsigned deployment and its concrete inputs, destination, binary hash and fee. Request the owner's **specific** approval for that deployment and testnet budget. The WO12 prompt and reference budgets do not grant it.
4. After actual approval and checks, let the real wallet sign; broadcast only under the stated gates, wait for commitment, verify live code and identity, and then propose the exact manifest before the two-owner lifecycle. Nothing in this blocked report grants that approval.

No deployment approval was requested prematurely because there is no actual funded, reviewable transaction. No production/mainnet readiness, commercial success or real-user adoption is asserted. Stop this attempt at the external-wallet gate; resume from the preserved branch when the human signer/access requirement is resolved.

## Owner-browser continuation, 2026-11-03 UTC

The owner explicitly confirmed no UTXO Global CKB testnet wallet is connected to this cloud environment and authorized only read-only checks and preparation. No deployment or spending is authorized. The focused [owner-browser handoff](WO12_OWNER_BROWSER_HANDOFF.md) gives the local preserved-app route, public-address intake, funding boundaries and later transaction approval sequence. It does not qualify an external wallet or invent funded transactions. Verdict remains C. EXTERNAL WALLET BLOCKED; public transaction counts remain zero. The next required human action is connection from the owner's physical browser and provision of two public testnet addresses, not a private key or deployment approval.

Read-only refresh at 22:21 UTC is preserved in `labs/wo12-pudge-live-acceptance/evidence/preflight-1793744489418` and `relay-1793744495473.json`: expected genesis, indexer/historical retrieval and configured live dependencies resolved again; relay minimum remained 1000 shannons/1000bytes. Frozen binary SHA256 was rechecked unchanged. These reads are not Trade lifecycle transactions or wallet ownership evidence. No prior source or manifest was modified.

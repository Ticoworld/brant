from pathlib import Path
import json,math
p=Path(__file__).resolve().parents[1]
r=lambda n:json.loads((p/'evidence'/n).read_text())
events=r('events.json');trades=r('trades.json');cases=r('cases.json');cost=r('costs.json');verification=r('verification.json');env=json.loads((p/'config/environment.json').read_text());proofs=r('source-proofs.json');sharing=cost['measuredSharing'];cp=sharing['checkpoint'];sc=sharing['sharedAverageCycles'];dc=sharing['directAverageCycles'];nstar=math.ceil(cp['cycles']/(dc-sc));by={e['label']:e for e in events}
def table(headers,rows):return '| '+' | '.join(headers)+' |\n| '+' | '.join(['---']*len(headers))+' |\n'+'\n'.join('| '+' | '.join(map(str,x))+' |'for x in rows)+'\n'
tradeTable=table(['Trade','EVM terminal state','Token delivered','Native result','Native settlement hash'],[[t['label'],{1:'OPEN',2:'FILLED',3:'EXPIRED_UNFILLED'}[t['status']],'100 E1TEST'if t['status']==2 else'0','10,000 CKB to '+('Bob'if t['status']==2 else'Alice')if t['status']!=1 else'10,000 CKB remains reserved',t.get('ckbSettlement','none')]for t in trades])
(p/'03_AUTHENTICATED_OUTCOME_RESULTS.md').write_text(f'''# Actual outcome and native settlement results

**Classification boundary: executed relative to an explicit trusted execution-root checkpoint. No foreign consensus finality proof is claimed.** Final run: {len(events)} recorded transactions,12 committed CKB transactions and24 EVM receipts, including deliberately reverted defensive transactions. Five reservations, four terminal outcomes and one intentionally unresolved reservation. Historical exploratory runs are separate evidence and are not added to these counts.

{tradeTable}

Each delivered trade transferred100,000,000 raw units of six-decimal E1TEST. Each native reservation principal was1,000,000,000,000shannons. This artificial rate is not a CKB market quote. The controlled token is not actual USDC. The native principals were funded and paid by real chain transactions, not balance simulations.

## Exact identities

CKB genesis: {env['genesis']}

EVM chain31339. Test token: {env['token']}. Outcome contract: {env['outcome']}. Outcome runtime codeHash: {env['outcomeCodeHash']}.

Alice EVM: {env['parties']['alice']['evm']}. Bob EVM: {env['parties']['bob']['evm']}. Exact native recipient locks and unique reservation types are in config/environment.json and evidence/trades.json. Terms bind both chains' identities, addresses, principal/token amounts, deadline and reservation type.

## What was authenticated by CKB-VM

A real EIP-1186 account path was checked against the supplied execution stateRoot, including contract codeHash and storageRoot. A real storage path then authenticated a terminal leaf or immutable two-leaf batch root. Shared settlement checked the exact leaf's SHA256 membership and paid a fixed native beneficiary. Individual recovery checked the account/storage proof directly. The input reservation's unique type and exact capacity were enforced.

The bootstrap containing stateRoot/block identity was supplied by the experiment controller, not validated against Ethereum consensus. Immutability protects retention, not the initial root's truth. Thus these tests demonstrate execution-state proof checking and conditional payouts, not finalized cross-chain truth without trust.

## Actual final balances

Token initial balances were1,000,000 E1TEST each. Final Alice balance:1,000,200 E1TEST. Final Bob balance:999,800 E1TEST. Two filled trades explain the200-token net transfer. Reverted transfers and unfilled trades did not create terminal delivery commitments.

'''+table(['Role','Initial normal-wallet shannons','Final normal-wallet shannons'],[[role,x['initialNormalWalletShannons'],x['finalNormalWalletShannons']]for role,x in cost['nativeBalancesFromCapturedLedger'].items()])+'''
Native final balances were reconstructed from captured genesis and committed input/output records. They exclude the still-reserved trade principal, bootstrap/checkpoint capacity and genesis script cells. Actual transaction fees reconcile the ledger. Two filled trades paid20,000 CKB to Bob; two unfilled trades returned20,000 CKB to Alice;10,000 CKB remains reserved for the OPEN trade. Checkpoint400 CKB and bootstrap300 CKB remain locked by the experimental retention policy.

The first two shared consumers entered the pool together and committed in the same block in the final run. The prior custom-identity run committed them in adjacent blocks; that difference is preserved. This establishes no universally fixed batching latency or TPS rate.

## Evidence granularity

Each defensive case has its observed rejection/result, and all trades have retained terms, outcomes and final disposition. EVM receipts include reverted status, logs and fees; native proofs have transaction bodies and committed status. A separate balance snapshot after every individual rejection was not recorded. Do not infer a complete per-case fee/balance trace beyond those retained records.

Offline verification independently walked five account/storage proofs using ethers RLP/Keccak, checked all trade/reservation bindings, all native transaction hashes and fixed payouts, and the signed EVM transaction hashes. EVM receipts were captured through ethers; not every receipt has a second duplicate raw-RPC log. This is consistency verification of actual recorded execution, not an independent audit or bytecode replay.
''')
(p/'04_CHECKPOINT_EXPERIMENT.md').write_text(f'''# Shared read-only checkpoint experiment

## Executed result

Two distinct funded native reservation cells referenced the **same checkpoint outpoint** through cell_dep. Both were accepted before mining; the captured pool had two pending transactions and no proposed transactions at that point. The final run committed them together, while another retained run used adjacent blocks. They did not consume the checkpoint, overlap principal inputs, or consume each other's allocation. The checkpoint remained live after both settled.

Its type script verified a real EVM account/storage proof before creation. The bootstrap root remained an explicitly trusted fixture. Publication cannot be described as foreign consensus authentication.

## Measurements in the final run

'''+table(['Operation','Cycles','Transaction bytes'],[[x['label'],x['cycles'],x['bytes']]for x in cost['ckb']if'checkpoint'in x['label']or'recovery'in x['label']or'refund'in x['label']])+f'''
A shared consumption averaged{sc:,.0f}cycles and{sharing['sharedAverageBytes']:,.0f}bytes. Direct execution-proof consumption averaged{dc:,.1f}cycles and{sharing['directAverageBytes']:,.1f}bytes across two observed proof shapes. Checkpoint publication used{cp['cycles']:,}cycles/{cp['bytes']:,}bytes, including its funding-wallet authorization and output validation. These are whole-transaction costs, not isolated pure-Merkle or pure-MPT function costs.

The initial built-in-TYPE_ID run consumed about1.043million cycles per shared settlement. The final custom generative reservation removed that million-cycle fixed charge while preserving the tested uniqueness rules. Its extra code capacity, dependency bytes and audit surface must be counted. Built-in TYPE_ID remains in the one-time bootstrap publication. The source constant is pinned in research/ckb-script_src_type_id.rs.

## Lifetime, replacement and retention

The authenticated checkpoint type rejects consuming or replacing an existing checkpoint. A real attempted spend was rejected. This preserves dependent claims, at the cost of permanently retaining400 CKB in this fixture. The bootstrap similarly retains300 CKB. This is not an economically complete garbage-collection design.

A separate controlled test consumed an optional read dependency before submitting a transaction that referenced it. The node rejected that transaction. Rebuilding without the dead optional dependency then succeeded through direct recovery. This demonstrates the dependency-liveness hazard; it is not a claim that the immutable authenticated checkpoint itself was consumed.

A practical lifecycle could retain immutable finalized roots until all claims resolve, or retire a checkpoint while preserving permissionless reconstruction/direct recovery from a durable authenticated header history. Retirement without that fallback can strand claims. E1 implements immutability and the individual execution-proof path, not a safe economical historical-root archive or retirement protocol.

The checkpoint script permits independently funded copies of the same verified commitment. Duplicate copies are not a trust bypass because their creation still runs the proof verifier against the pinned bootstrap. Duplicate publication was not separately executed in this run. The copy mechanism alone does not solve initial root authentication or source-data loss.

## What is not measured

No production root-verifier publication cost, Ethereum consensus validation cycles, proof-compression cost, large-batch source-tree gas or real-network throughput was measured. Cheap membership consumption is not free foreign verification. The source contract only commits batches of1 or2. Larger-batch comparisons in06 are explicit sensitivity models requiring additional implementation.
''')
(p/'05_RECOVERY_AND_SECURITY.md').write_text('''# Recovery, defensive cases and limits

A separate executable process retrieved source proofs from the isolated EVM node and submitted CKB transactions from retained public packages. It loaded no participant signing keys or coordinator database for settlement. Fixed outputs let any caller perform settlement. Alice's earlier funding signature and Bob's EVM delivery authorization remain the asset authorizations.

The coordinator process was terminated and its test database removed before checkpoint creation and recovery. The checkpoint proof was supplied by the driver after independent source retrieval; no claim is made that consensus authentication survives an absent controller. A different process independently constructed shared membership information and individual account/storage proofs.

## Actual case ledger

'''+table(['Defensive case','Observed result'],[[c['label'],c['result']]for c in cases])+'''
## Safety established within the tested boundary

The external contract rejected duplicate delivery, delivery after closure, incorrect terms and expiry of a filled trade. A reverted token transfer left the trade OPEN with no terminal leaf. Explicit later expiry produced the unfilled result. The contract made FILLED and EXPIRED_UNFILLED mutually exclusive on its one executed history.

CKB rejected mismatched status, trade proof, recipient, principal, checkpoint identity and outdated/malformed proof inputs. A conflicting refund for the filled trade could not use its batch proof. Spent reservation inputs could not settle twice. Unique reservation creation checks rejected recreation and duplicate outputs. These are tested cases, not exhaustive correctness/security proofs.

## Recovery when the batch publisher is absent

One filled trade had no published batch checkpoint. The shared recovery attempt did not settle. Its separate-process direct path retrieved an account/storage proof against the retained bootstrap and paid Bob. Another trade recovered Alice's unfilled principal after a3600-second development-time jump. Its commitment remained terminal and usable; no independent CKB time-based choice was introduced.

An OPEN trade had no authoritative unfilled outcome even after its deadline. The recovery process refused to invent one. When the external EVM process was deliberately stopped, another recovery attempt failed and native funds remained live/reserved. The experiment did not restart that node to prove resumed recovery. In production, anyone could call expire once source progress resumes, but the resulting root must then be authenticated and published. E1's immutable fixed-root fixture cannot supply verified future root updates.

## Unresolved assumptions, stated plainly

1. **Foreign canonical finality:** bootstrap stateRoot was chosen by the experiment controller. Neither the CKB scripts nor a sound light-client update authenticated its canonicality/finality. A fabricated or orphaned initial root is outside the demonstrated guarantee. A signature, root immutability, own-node check or two dev descendants does not close this gap.
2. **Proof/data availability:** source access, retained public packages and historic trie data are required. Unlimited outage/data loss can lock native principal. A batch publisher can be replaced only when authenticated root/data/fees remain obtainable.
3. **Fee-funded liveness:** each native reservation fixes100,000shannons of close fee. There is no general sponsorship or fee-bump path. A market that will not include that fee violates the tested inclusion assumption. Recovery has no new participant-key requirement but still needs source RPC availability.
4. **Parser/script correctness:** the custom RLP/trie/SHA256/reservation code is unaudited and not exhaustively fuzzed. Inline-node/branch parsing is bounded; only the encountered concrete proof paths and selected malformed cases were executed. No production security claim follows.
5. **Checkpoint lifecycle:** immutable checkpoint/boot capacity remains locked. Safe retirement and authenticated historical-root reconstruction are future work.
6. **Real assets and chains:** the controlled ERC20 is not a production stablecoin. L2 sequencer/DA/finality models and issuer risks require different explicit adapters.

## Alternative B, strongest defensible version

An optimistic outcome relay can share expensive checks only if it has a sound executable fraud-proof path against authenticated foreign history. It must specify which canonical fact proves a proposal false, data disclosure, challenger access, censorship/inclusion bounds, bond denomination and compensation rules. With no honest included challenge, a false proposal may pay; economic deterrence is not cryptographic truth. A bond without canonical root verification still lacks the decisive predicate. E1 did not implement this alternative and does not claim it defeated the missing-root problem.

## Proof/refund paradox

Authoritative EXPIRED_UNFILLED removes the specific choice between a finalized external fill and a separate native timeout refund, conditional on correct canonical outcome authentication. It transfers the unresolved liveness dependency to foreign progress, expiration inclusion, proof availability and native inclusion. It does not permit an honest refund during unlimited foreign unavailability. No mathematical impossibility of every alternative protocol is asserted; a compensation/credit alternative changes who bears loss and needs its own funded enforceable claims.
''')
(p/'06_ECONOMIC_COMPARISON.md').write_text(f'''# Individual versus shared verification economics

All costs below are isolated measured records or explicitly labeled arithmetic models. No historical market price is represented as a current executable quote. No mainnet dollar price, profitable maker operation or demand advantage was established.

## Native verification resources

For the two-trade batch, checkpoint publication plus shared consumption used{sharing['twoTradeSharedTotalCycles']:,.0f}cycles versus a{sharing['twoTradeDirectProxyCycles']:,.0f}-cycle proxy from two measured direct proofs. It used{sharing['twoTradeSharedBytes']:,.0f}bytes versus a{sharing['twoTradeDirectProxyBytes']:,.0f}-byte direct proxy. These compare different actual trade proof paths in the same final source state, not paired identical-trade benchmark runs.

Cycles therefore **increase** at the tested batch size2, while transaction bytes decrease. All settlement closes paid the same prototype-fixed100,000shannons regardless of cycle count. A checkpoint adds another100,000-shannon publication fee. Cycles are not EVM-style gas charges and lower cycle count does not automatically lower the paid fee.

'''+table(['N, modeled trades','Shared cycles, constant small-tree envelope','Direct cycles proxy'],[[x['N'],f"{x['sharedCyclesAssumingConstantSmallTreeCosts']:,.0f}",f"{x['directCyclesProxy']:,.0f}"]for x in cost['largerBatchSensitivity']])+f'''
Under that simplified envelope, the cycle break-even is about{nstar}trades. **Only batches of1 or2 are implemented.** Larger rows omit increasing membership depth, source tree construction gas, root-verifier cost, header retention, traffic arrival/batch waiting, and proof-generation scaling. They are arithmetic sensitivity, not achieved throughput, a promised saving percentage or an economic forecast.

## Actual EVM gas and paid fees

'''+table(['Operation','Gas used','Actual paid wei'],[[x['label'],x['gas'],x['feeWei']]for x in cost['evm']])+'''
The shared token approval can be reused while allowance remains. Source open/fill/expire and root commitment fees are distinct from CKB proof verification. Actual dev gas prices varied with the development fee mechanism; multiplying them by a live ETH price would not create a production quote. Deployment, defensive failures and token failure-switch transactions are separately labeled and are not normal trade costs.

## Capacity and capital

Each trade committed10,000 CKB principal plus0.001 CKB closing reserve, with a430-CKB minimum occupied-capacity footprint inside that principal. Peak reserved trade principal was50,000 CKB across five trades, not executable stablecoin depth. Four terminal trades closed and one10,000-CKB principal remains reserved. The isolated setup's700 CKB checkpoint/bootstrap allocation remains locked. Minimum data/script occupied capacities are210 CKB for bootstrap and294 CKB for checkpoint; configured values are300/400.

Script code was installed in genesis. Code footprint and corresponding minimum code-cell capacity are measurable, but deployment fees are unmeasured. The final reservation binary is12,288bytes, settlement9,224bytes, checkpoint7,120bytes and deny1,016bytes; a simple empty-args code cell adds41 capacity bytes. This shared static capital cost matters to a small venue. Genesis allocates larger100,000-CKB code cells, which is fixture configuration rather than an optimized production requirement.

Recorded terminal trades occupied principal for roughly4–5 host seconds in the final run. Blocks were manually mined and source time was advanced400/3600seconds. These values are not mainnet latency, wall-clock deadline behavior or a production capital-occupancy estimate. Proof-generation observations are local RPC response/transport/logging durations, not a standalone prover benchmark.

## Liquidity and maker margin

Bob kept test tokens in his separate wallet until successful delivery. That avoids a pre-funded per-trade external escrow, but executable quotes still need reserved spendable inventory. After delivery Bob waits for CKB risk-finality/outcome verification and can have delivery capital or hedge exposure outstanding. Batch verification creates no stablecoins and does not reduce one-way inventory depletion.

A maker's required spread must cover hedge fee/impact, adverse selection during the authorized quote window, network and proof/relay fees, failed trade expenses, rebalancing, capital occupancy, monitoring and operating margin. Alice's native reservation while Bob can choose whether to fill still gives Bob a selective-abort option. A short deadline narrows that option but cannot remove all inclusion/finality risk. No observed profitability model or customer willingness to pay was obtained.

At an assumed12% annual capital hurdle, simple opportunity cost is principal×0.12×lockedSeconds/31,536,000. This is a scenario formula, not yield. Shared finality verification also needs an amortized operating/proving budget. Without a measured finality verifier and realistic occupancy, a complete delivered-price estimate is unavailable.

## Comparison with WO02 and repeated trading

WO02's measured EVM approval/fund/claim fixture used310,512gas. E1's source delivery path has separate open and fill plus allowance, optional root commitment and a still-missing consensus verifier. Asset flow, authorization and amortization differ; no like-for-like all-in price superiority is established. E1 improves the *meaning* of release evidence relative to a naked preimage and uses one source contract to decide fill versus unfilled expiry. The trusted bootstrap means E1 has not yet demonstrated a stronger end-to-end trust model.

One-off conversion may favor direct execution proofs. Ten/hundred/thousand express trades still require per-trade physical delivery and source operations; only proof/checkpoint overhead might amortize. Idle reservations, maker switching, failed sessions and forced recovery remain costs. E1 does not implement100off-chain trades or rebalancing. Repeated funded portfolio trading can potentially remove per-fill chain writes, but its consistency and collateral protocol remains a distinct unproved branch.

The current contract requires Alice to fund an EVM open transaction and Bob to deliver with EVM gas. That is friction for a native-CKB-only customer. Gas sponsorship with independently signed terms is a possible repair, not an implemented customer journey.
''')
(p/'07_E1_DECISION.md').write_text(f'''# E1 founder decision

**PARTIAL MECHANISM, CRITICAL PROOF REMAINING.**

E1 executed real native CKB payouts/refunds governed by real external terminal outcome proofs, but only relative to a controller-selected execution-root checkpoint. A foreign-consensus verifier was not implemented. Calling this end-to-end authenticated settlement without a trusted operator would be false.

## Answers to the decision questions

1. **Can CKB safely distinguish finalized external payment from failed payment?** It checked real account/storage proofs and correctly distinguished the tested terminal outcomes relative to the supplied root. It did not authenticate that root as canonically finalized foreign history. Global finalized-payment safety remains unproved.
2. **Can one external contract decide both outcomes?** Yes, on the tested EVM history. FILLED was recorded only after exact delivery; expired-unfilled closed the fill opportunity. Duplicate/conflicting later transitions reverted. No independent native timeout made another choice.
3. **Cheapest defensible authentication?** Not established for the complete system. Direct proof checking and shared checkpoint consumption are measured. A checkpoint can amortize execution-proof work, but it still needs a sound consensus-authenticated root. Optimistic bonds do not supply that fact by themselves.
4. **Can multiple native transactions read one checkpoint?** Yes. Two independent reservation spends were admitted before mining and used the same read-only checkpoint without consuming it. The final run included both in one block; another retained run used adjacent blocks. This is not a throughput benchmark.
5. **Can an individual recover without the batch publisher?** Yes in the fixture, once the trusted bootstrap exists: a separate keyless settlement process obtained individual EVM account/storage proofs and paid the fixed native beneficiary. It cannot manufacture authenticated roots if the root authority or source data is unavailable.
6. **Measured costs?** Shared close about{sc:,.0f}cycles/376bytes; individual close averaged{dc:,.1f}cycles across two proof paths; shared checkpoint publication{cp['cycles']:,}cycles/{cp['bytes']:,}bytes. Each native close paid0.001 CKB fixed fee. Bootstrap/checkpoint retained700 CKB. Complete gas/fees/bytes are in06 and evidence/costs.json. Foreign consensus verification cost remains unknown.
7. **Important failure?** An absent/unavailable source or unavailable authenticated new root leaves an OPEN reservation locked. Initial false/orphaned roots are not excluded by the on-chain implementation. Fixed fee reserves and immutable retention are additional liveness/economic limits.
8. **Stronger than WO02?** The authoritative outcome semantics address preimage-as-payment and independent refund-choice failures at the design level. Complete end-to-end security superiority is not demonstrated because the new canonical-root requirement is missing.
9. **Shared foundation for both products?** Potentially, at the authenticated fact/commitment interface. Express delivery uses exact terminal payment/unfilled facts. Portfolio exits need unique finalized full allocation, session/collateral epoch, all asset obligations and correct adjudicator. A root attesting EVM payments cannot automatically attest the earlier CKB-authoritative portfolio session. Different anchor/proof directions may be required.
10. **Precise next experiment?** Authenticate a real finalized execution stateRoot on CKB from a pinned Ethereum light-client bootstrap and a valid consensus update, including fork/domain, sync-committee verification, finality branch and execution-header inclusion. Test wrong chain/fork, insufficient finality, replayed old update, malformed branches, withheld data and permissionless recovery. Then connect that accepted root to this existing E1 execution-proof interface. Measure total CKB cycles/bytes and update/retention cost. If direct validation is impractical, test one correctly specified compressed proof of the same predicate. An arbitrary BLS signature or hardcoded checkpoint is not a pass.

## What actually completed

The final run has12 committed CKB transactions,24 EVM receipts and30 named defensive/result cases. Four terminal trades settled; a fifth OPEN trade remained reserved during source outage. A separate offline verifier checked five MPT proofs, all five terms/reservation bindings and observed native payouts. Native source plus compiled artifacts, exact versions, public recovery packages, raw records and costs are preserved. Prior WO04 remained unchanged. No splice repair, public deployment or real-money transfer occurred.

The unique reservation script was improved after a measured fixed TYPE_ID overhead was identified. The final cheaper script passed the same suite plus identity-recreation/duplicate-output tests. This is an engineering improvement with an unaudited extra script, not a cryptographic finality breakthrough.

## Commercial decision

Do not start a production exchange or claim a sustainable business. At the tested two-trade batch, shared publication plus consumption used more cycles than the direct-proof proxy. A simplified larger-batch envelope breaks even around{nstar}trades, but larger batches and consensus-verifier costs are unmeasured. Fixed paid fees did not fall when cycles fell. Native-only customer EVM-gas friction, quote optionality, proof waiting and permanent capacity retention remain material.

Keep the tested primitive as a fallback for the next finality experiment. Preserve the portfolio-channel branch as a separate higher-ceiling candidate for repeated execution. A future system may share authenticated foreign-header infrastructure across both, but needs distinct application predicates and enforceable recovery. No universal shared-root or liquidity-creation claim is justified.

## Evidence versus assumptions

VERIFIED: recorded execution, conditional native allocation checks, real execution-state proofs, shared read dependencies, selected rejected cases, separate-process recovery and observed source-outage lock.

DERIVED: if a sound canonical finalized root is supplied and the parser/source code is correct, mutually exclusive terminal commitments can determine native payout versus refund without an independent native timeout.

HYPOTHESIS: production finality verification/retention can be compressed or amortized enough for competitive delivery and perhaps funded trading.

UNIMPLEMENTED/CRITICAL: foreign consensus/finality verification and verified root advancement; audited parser/scripts; arbitrary-outage recovery; production stablecoin integration; larger-batch execution; executable competitive route prices and profitable maker demand.
''')
print('Wrote reports03–07 from final-run evidence')

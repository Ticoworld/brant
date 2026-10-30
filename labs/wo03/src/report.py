from pathlib import Path
import json,hashlib,collections
R=Path(__file__).resolve().parents[1]
load=lambda f:json.loads((R/'evidence'/f).read_text())
d=load('contract-results.json');v=load('verification.json');m=load('model-results.json');tx=load('transactions.json')
caseRows='\n'.join(f"| {c['name']} | {c['result']} |" for c in d['cases'])
eager=next(c for c in d['cases']if c['name']=='eager_all_leg_watch_with_start_skew')
cooperative=next(c for c in d['cases']if c['name']=='public_update_both_legs');record=[r for r in tx if r['hash']in cooperative['transactions']];total=sum(int(r['receipt']['gasUsed'])for r in record);deploy=sum(int(r['receipt']['gasUsed'])for r in record if r['label'].startswith('deploy'))
by=collections.defaultdict(list)
for r in tx:
 if not r.get('reverted'):by[r['label']].append(int(r['receipt']['gasUsed']))
gasRows='\n'.join(f'| {k} | {min(vals):,} | {max(vals):,} |'for k,vals in by.items())
(R/'03_EXECUTED_EVIDENCE.md').write_text(f'''# Executed channel-boundary evidence

**VERIFIED:** {v['caseCount']} named contract cases, {v['receiptsCrossChecked']} transaction receipts cross-checked against captured RPC, comprising {v['successfullyExecutedTransactions']} successful transactions and {v['revertedTransactions']} deliberately rejected transactions. {v['explicitContractSplits']} cases end with inconsistent allocations, including the dishonest-attestor control. These selected adversarial cases are not failure probabilities.

Runtime: {d['runtime']}; Node {d['node']}; Solidity {d['compiler']}; chain ID31338; Shanghai execution, optimizer200. Private Ganache in-process EVM, controlled public test keys and WO03TEST ERC20. Both logical assets use the same controlled token in separate funded contracts. No real stablecoin, native CKB channel execution, independent-chain clock or reorg experiment occurs in this round. This is a focused contract test of adjudication semantics. WO02 remains the actual CKB/EVM exchange evidence.

## Result matrix

| Case | Observed result |
| --- | --- |
{caseRows}

All state signatures bind a common context containing both adjudicator addresses, token, participants, chain ID and unique session serial. The contract verifies both signatures, allocation bounds and increasing versions. Wrong signature, context replay, over-allocation, old state, expired update and duplicate payout were rejected. Sixteen retained state signatures were independently recovered offline.

## Stronger counterexample: active monitoring of both legs

The old state was registered on both contracts. Their locally started deadlines were X={eager['deadlines']['x']} and Y={eager['deadlines']['y']} in development-chain timestamp units. New-state publication on Y occurred at {eager['revealTimestamp']}, after X's update cutoff and before Y's. The attempted X upgrade reverted. X closed at version0/Alice50; Y closed at version1/Alice40. Alice's combined allocation was therefore (50,40), while the signed alternatives were (50,50) and (60,40). Bob gained ten modeled token units beyond either consistent alternative. All transfers are actual EVM token transfers, with native gas paid separately. No real-world clock bound is inferred.

The simpler four cases exercise each signature ordering, old/new leg selection and fixed/restarting timeout variants. A malicious last signer can keep the complete certificate private. A UI acknowledgement does not remove its enforceability. The eager-monitor case matters more than leaving the other leg unregistered.

## Repair controls

With an honest designated test attestor, the follower released the projection of the sealed anchor outcome. A participant could not impersonate the attestor. With a dishonest attestor, the follower accepted a contradicting outcome. Both controls paid actual tokens. This proves what the contract checks, including its trust assumption. It does not prove consensus-proof verification or independent recovery without the attestor.

## Finite exhaustive model

{v['modelStates']:,} reachable abstract states and {sum(x['edges']for x in m['independent']+m['eagerIndependent']):,} transition edges were enumerated over windows2/3/4 and horizon12, with and without eager all-leg disputes, fixed and restarted deadlines. All twelve parameter configurations contain a counterexample. An honest watcher reacts within one modeled tick to publicly available certificates. This is exhaustive only over that finite transition system, not over arbitrary protocols or consensus histories.

The anchor abstraction enumerates72 outcome/delay/proof/refund cases. Sound proof with no independent refund produces no mismatching paid outcome by construction of its verification rule, but an absent proof leaves funds locked. Independent refund reintroduces mismatches. This is a model result with an assumed verifier, not proof of an implemented trustless repair.

## Actual gas ledger

| Operation | Minimum gas | Maximum gas |
| --- | ---: | ---: |
{gasRows}

The selected consistent session used {total:,} gas, including {deploy:,} gas for its two per-session contract deployments. Its nondeployment operations used {total-deploy:,} gas. Contract funding was supplied by Alice from her isolated test supply; the experiment does not implement safe two-party channel opening. One signer broadcasts all test transactions to simplify contract-level fault control. Separate production wallet processes and coordinator-death recovery were not re-proven for this new channel design.

Raw transaction requests, receipts, logs and RPC responses are saved in evidence/transactions.json and evidence/rpc.json. Full compiler input/output, bytecode, signed states and hashes are included. The JavaScript µWS native extension was unavailable under Node24; Ganache used its JavaScript fallback. No throughput or timing benchmark is claimed.

## Evidence limits

There is no CKB adjudicator implementation, foreign-finality verifier, unbiased network timing measurement, production audit, exhaustive channel security proof or observed business profitability in WO03. The lab does not execute Perun contracts. Four Perun source files were inspected and pinned by Git blob identity; do not present these lab counterexamples as an exploit of Perun. WO01's65 and WO02's3,001 saved checksum entries still match.
''')
(R/'04_CAPITAL_AND_COST_FRONTIER.md').write_text(f'''# Can the repaired design change economics?

**DERIVED, conditional:** repeated trading can amortize session opening/closing and reuse funded allocations. **HYPOTHESIS:** this yields a product traders prefer after proof costs, inventory constraints and exits. No new live price/depth quote was retrieved for this round; WO02's dated market snapshots remain historical evidence only.

## What is measured

The two-leg EVM lab session consumed {total:,} gas including per-session deployments, or {total-deploy:,} excluding them. This is neither a native CKB/EVM channel cost nor a production Perun cost. The session deliberately registers old and new states on-chain to test disputes. A production shared adjudicator may amortize code deployment, but has other storage, proof and funding costs. An anchor/follower native construction has not been measured.

WO02 measured310,512 EVM gas for one escrow approval/fund/claim fixture. Its allowance structure can be optimized and cheaper delivery chains can change economics. Comparing that fixture with the new two-EVM-leg lab is a *sensitivity calculation*, not an apples-to-apples price benchmark.

| Fills per session | Measured lab session gas divided by fills | Extra gas budget below N×310,512 |
| ---: | ---: | ---: |
'''+ '\n'.join(f'| {n} | {total/n:,.2f} | {n*310512-total:,} |'for n in [1,10,100])+'''

The extra budget column includes no real proof cost. Positive headroom is not commercial profit. Negative headroom means this lab session envelope exceeds that repeated-escrow EVM fixture. A verifier/header relay may incur persistent costs even without session closes; allocate them explicitly. Neither mainnet dollar prices nor L2 all-in fees are claimed here.

## Inventory reuse example

Assume a frictionless constant price, a $1,000 CKB allocation initially owned by Alice and a $1,000 token allocation initially owned by Bob. One fully collateralized session therefore holds $2,000 combined principal, including Bob's initial $1,000. One hundred alternating $1,000 swaps produce $100,000 gross volume while allocations toggle between the same two funded portfolios. This is arithmetic under chosen flow, not observed demand, and both parties may spend most of a session locked into the counter-asset.

One hundred one-way $1,000 CKB sales instead require $100,000 token delivery capacity, or timely replenishment. A $1,000 token allocation cannot quote $100,000 simultaneous executable depth. One hundred separate customers generally need separately enforceable allocated balances or a proven safe reassignment mechanism. Session reuse does not authorize double-pledged maker capital.

A 50bps gross spread on $100,000 volume is $500 before costs. At 10bps hedge fees on every fill it loses $100; hedging only a net residual could reduce that charge but exposes the maker to intra-session mark-to-market and direction risk. Subtract adverse-selection losses, failed openings, disputes, session-exit proof/relay charges, inventory funding, rebalancing and operating expenses. No user commitment or maker profitability was observed.

## The economic risk that survives gas savings

Channel capital stays committed while the session remains open. At an assumed12% annual hurdle, $2,000 costs about $0.0274 per hour and $0.6575 per day, before risk premiums. A $100,000 maker allocation costs about $32.88 per day at that same assumption. Annualized simple opportunity cost is not a promised yield. Long idle sessions can erase the benefit of cheap updates.

Signed pending quotes also create option exposure. A failed acknowledgement is not revocation; forced cancellation/exit has an on-chain horizon. A maker that suppresses signature delivery or a customer that retains an exercisable quote may exploit price moves. Pricing this option and making its duration independently bounded are required before claiming tight professional spreads.

## Compare the customer job

| Customer job | Strongest plausible architecture | Reason / unresolved cost |
| --- | --- | --- |
| One CKB sale, native stablecoins in external wallet | Competitive conditional delivery | No long-lived session onboarding; WO02's timing/option risks remain |
| Many self-custodial trades, retained balances | Anchored funded portfolio session | Per-fill signature updates; foreign proof and exits unimplemented |
| Frequent one-way customer flow | Delivery plus maker netting/hedging | Inventory must replenish; channels do not manufacture stablecoins |
| Switching among makers | Competitive discovery plus safe reassignment | Allocation migration and independent exit costs are unresolved |
| Ordinary CEX spot activity | Existing CEX plus withdrawal remains benchmark | This round obtains no executable comparison proving customer advantage |

No Binance replacement claim survives this round. The plausible advantage is a narrow repeated-trading or inventory-reuse service, with competitive one-off delivery retained. Prove the native close mechanism, then compare actual delivered prices and customer friction.
''')
(R/'06_WO03_DECISION.md').write_text(f'''# WO03 decision: change the consistency mechanism

**Leading architecture: PROMISING BUT UNPROVEN.** The independently adjudicated portfolio-channel baseline requires redesign. The stronger candidate is a funded portfolio session with one authoritative sealed outcome and proof-gated native payout on the other chain. This is a conditional architecture, not an established trustless implementation.

## What changed

WO02 showed real native CKB/test-token exchange and specific unsafe escrow schedules. It did not prove HTLCs, channels or a CKB-native trading business impossible. WO03 challenged the higher-ceiling channel branch instead of silently treating its security as solved.

The new executed result is precise: a common signed state, version numbers, active monitoring of both legs and restarting challenge windows do not by themselves prevent different final portfolio projections when update cutoffs differ. The contract experiment includes a late hidden certificate after both legs already entered dispute. This is a counterexample to this baseline, not to every channel protocol or Perun's complete construction.

## Evidence

{v['caseCount']} named cases, {v['receiptsCrossChecked']} real isolated-EVM receipts, {v['explicitContractSplits']} deliberately inconsistent outcomes, {v['modelStates']:,} abstract model states. Cryptographic domain, allocation, version and duplicate-settlement rejections were exercised. The honest-attestor repair worked; the lying-attestor control broke it. Those controls establish the trust boundary.

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
''')
print({'cooperativeSessionGas':total,'nondeploymentGas':total-deploy,'reportsGenerated':4})

"""Independent research after beneficiary-validation pause. Exact synthetic witnesses only.
No chain calls, signatures, beneficiary tests, public transactions or customer contact.
"""
from fractions import Fraction as Q
from pathlib import Path
from itertools import product
import json,hashlib,importlib.util,sys
R=Path(__file__).resolve().parents[1]
def launch():
 rows=[]
 for draw in [0,100,150,300,1000]:
  paid=Q(1000);remaining=paid-draw;shares=100
  assert remaining>=0 and remaining+draw==paid
  redemption=[remaining/shares]*shares
  assert sum(redemption)==remaining
  rows.append({'issuer_draw':str(draw),'remaining_nav':str(remaining),'all100_shares_total_redemption':str(sum(redemption)),'original_full_refund_supported':remaining>=paid,'right':'Pro-rata unspent NAV, not original fixed principal; spending lowers every share claim'})
 cases=[]
 for floor,fee,need,occupied in product([Q(0),Q('0.5'),Q('0.85'),Q(1)],[Q(0),Q('0.01')],[Q('0.1'),Q('0.3')],[Q(0),Q(150)]):
  principal=Q(1000);backing=floor*principal;charge=fee*principal;proceeds=principal-backing-charge
  cases.append({'floor':str(floor),'fee':str(fee),'issuer_budget_fraction':str(need),'extra_occupied_capital':str(occupied),'buyer_total':str(principal+occupied),'protected_principal':str(backing),'issuer_proceeds':str(proceeds),'budget_met':proceeds>=need*principal,'cost_of_locking_protected_cash':'Not priced; retained-cash rival keeps liquidity instead'})
 assert any(not x['budget_met']for x in cases)
 return {'structures':[{'name':'Retained cash + grant','buyer_contributes':'1000','buyer_retains_liquid_cash':'850','issuer_receives':'150','extra_new_claim_occupancy':'0 assumed; existing wallet','limitation':'No integrated project upside/transfer mechanism is provided; compare the actual risky entitlement too'}, {'name':'Fixed85% backed note','buyer_contributes':'1150','funded_note':'850 principal +150 occupancy','issuer_receives':'150','limitation':'Native right exists; occupies more capital and delays protected exit vs retained cash'}, {'name':'Full refundable escrow','buyer_contributes':'1000 + actual occupancy/fees','issuer_before_success':'0','failure_refund':'1000 if unspent and fees separately funded','success':'Release funds; continuing full-refund right must end or have separate backing','limitation':'External success/milestone selection and native implementation not proved here'}, {'name':'Milestone release / declining pro-rata NAV','right':'Refund unspent balance, not spent project money','limitation':'Milestone authority and strategic votes remain; no full-principal floor claim'}],'drawdown_cases':rows,'financing_grid':cases,'decision':'No dominant launch architecture. High refund commitment competes with usable financing; pro-rata rights change the promise rather than defeating the funding constraint.'}
def tranche_prices():
 # Explicit ZERO-RATE synthetic risk-neutral martingale, NOT a market calibration.
 prices=[Q(1,4),Q(1),Q(7,4)];weights=[Q(1,3)]*3;C=Q(2000);U=Q(1000)
 assert sum(p*w for p,w in zip(prices,weights))==1
 senior=[min(C*p,U)for p in prices];junior=[C*p-s for p,s in zip(prices,senior)]
 assert all(s+j==C*p for s,j,p in zip(senior,junior,prices))
 vs=sum(w*s for w,s in zip(weights,senior));vj=sum(w*j for w,j in zip(weights,junior));assert vs+vj==C
 assert vs<1000 and vj>1000
 # Cash-minus-tail-put and call on collateral: financial prior art, not new payoff.
 assert all(s==U-max(U-C*p,0)for s,p in zip(senior,prices))
 assert all(j==max(C*p-U,0)for j,p in zip(junior,prices))
 return {'classification':'TESTED SYNTHETIC, explicitly assumed zero-rate risk-neutral distribution; not observed probabilities or fair market quotes','prices':[str(x)for x in prices],'weights':[str(x)for x in weights],'senior_terminal_usd':[str(x)for x in senior],'junior_terminal_usd':[str(x)for x in junior],'senior_model_value':str(vs),'junior_model_value':str(vj),'symmetric1000_issue_transfers_model_value_to_junior':str(vj-1000),'premium_direction':'In THIS model junior pays more and senior less than1000; do not always assume senior must pay junior an extra premium','payoff_identity':'Senior is cash1000 minus tail put; junior is call on2000*P with strike1000. This resembles debt/equity, not newly invented insurance.','outage_rule':'If initial pricing changes contributions, fallback must explicitly refund the agreed contributions/premium policy; symmetric1000/1000 fallback is not automatically correct.','native_status':'Unequal contribution pricing/fallback NOT newly executed; fixed-beneficiary symmetric prototype stays bounded fallback','candidate_reframing':'Term treasury funding / collateralized senior claim plus junior residual is an independent customer hypothesis. Demand, actual rates and oracle trust remain unknown.'}
def maker():
 rows=[]
 for I,days,annual,flow_fraction,adverse,spread,service in product([Q(1000),Q(10000)],[30,180],[Q('0.04'),Q('0.12')],[Q(0),Q('0.5'),Q(1)],[Q(0),Q('0.1'),Q('0.5')],[Q(0),Q('0.01')],[Q(1),Q(10)]):
  executed=I*flow_fraction;carry=I*annual*Q(days,365);selection=executed*adverse;earned_spread=executed*spread
  needed=max(Q(0),carry+selection+service-earned_spread)
  revenue=needed+earned_spread;assert revenue-carry-selection-service>=0
  rows.append({'inventory_ckb':str(I),'days':days,'annual_opportunity_cost':str(annual),'flow_fraction':str(flow_fraction),'adverse_move':str(adverse),'executed_spread':str(spread),'operating_cost_ckb':str(service),'required_issuer_retainer_ckb':str(needed),'net_at_minimum_retainer_ckb':str(revenue-carry-selection-service),'assumption':'Single liquidation/fill wave; dynamic replenishment, market premium and hedge basis remain extra costs'})
 assert any(Q(x['required_issuer_retainer_ckb'])>Q(x['inventory_ckb'])/2 for x in rows)
 return {'grid':rows,'selection_counterexample':'10% spread on unfilled interest pays nothing; retainer must be an actual issuer obligation, not a function of gross displayed quotes','service_redesign':'Auction a fixed allocated inventory quota at specified price/term, or pay real availability retainer with separately enforceable breach terms. Neither promises unlimited useful public depth.','inventory_identity':'A CEX hedge/positive cash equity does not restore native delivery inventory. Replenishment needs an actual asset route and transfer time.','demand':'No issuer retainer mandate, maker quote or verified third-party customer identity obtained.'}
def execution():
 # Same three-owner principal exchange; gas/bytes differences NOT invented.
 offers=[{'X':-10,'Y':10},{'Y':-10,'Z':10},{'Z':-10,'X':10}]
 full={x:sum(o.get(x,0)for o in offers)for x in 'XYZ'};short={x:sum(o.get(x,0)for o in offers[:2])for x in 'XYZ'}
 assert full=={'X':0,'Y':0,'Z':0} and short['X']==-10 and short['Z']==10
 return {'matched_vector':full,'missing_leg_vector':short,'matched_principal_lp_revenue':'0 unless someone explicitly pays a fee','rivals':[{'name':'Full-body normal signing','right':'Whole agreed transaction fixed before sign','cost':'Any mutation needs affected parties to re-sign; current native claim/xUDT evidence','independent_fragment_assembly':False}, {'name':'CoBuild OTX PoC','right':'Pinned source hashes declared ranges including resolved Cells/data/deps','cost':'Wallet/range/composition security qualification not delivered in this WO','independent_fragment_assembly':'Source capability; not newly reproduced'}, {'name':'A2 / compact funded orders','right':'Existing funded partial/full execution and independent exit within known limits','cost':'Reuse historical fair1536 workload; LO-01/general recovery unresolved','independent_fragment_assembly':'Do not conflate order semantics with unrestricted OTX'}],'benchmark_rule':'No speed/fee superiority without equivalent rights, same native workload and lifecycle. Public spot-book arithmetic is not an executable native liquidity route.'}
def old_launch_cases():
 p=R.parent/'rebuild/models/launch_architecture.py';spec=importlib.util.spec_from_file_location('wo09_preserved_launch',p);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
 return {'source':str(p.relative_to(R.parent.parent)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'scope':'Read-only rerun of preserved six-class exact model; no frozen file rewritten or native checkpoint recounted','result':m.run()}
def combinations():
 return {'launch_plus_execution':'Secondary sale is a right, not a bidder. Launch-only cash retention/escrow can remain rational without a new DEX.','risk_plus_trading':'Transferable beneficiaries remain UNRESOLVED; fixed-recipient risk and independent RFQ/OTX research do not depend on this blocked security validation.','finite_inventory_plus_issuer_finance':'A retainer consumes issuer finance. It cannot be simultaneously counted as free project proceeds or protected buyer reserve.','shared_event':'Share observation identity/code costs only; no funded principal saving. An oracle-free refund mechanism need not inherit oracle dependency.','new_independent_alternative':'Senior treasury finance plus junior residual, priced as existing debt/equity rather than automatically marketing it as insurance. Fixed-recipient variant can be researched without transferable-record assumptions.'}
out={'scope':'Independent permitted exact models after beneficiary-liveness pause. Not native security, market pricing or customer validation.','launch':launch(),'risk_pricing':tranche_prices(),'maker':maker(),'execution':execution(),'preserved_six_launch_attacks':old_launch_cases(),'combinations':combinations()}
(R/'evidence/independent-alternatives.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'status':'CHECKED SYNTHETIC','launch_finance_cases':len(out['launch']['financing_grid']),'maker_cases':len(out['maker']['grid']),'key_counterexample':'Symmetric tranche funding need not be fair, and premium direction is not predetermined.','beneficiary_validation':'UNRESOLVED / NOT RUN'}))

"""WO09 product falsification. Exact arithmetic; no chain, customer, price or audit claims."""
from decimal import Decimal as D, getcontext
from pathlib import Path
import json
getcontext().prec=40
OUT=Path(__file__).resolve().parent
PRICES=[D('.00122'),D('.10'),D('1'),D('10')]
BUDGETS=[('FiberLatch Access historical',D('3000')),('CrowdCell rescope',D('5000')),('Kirea hardening',D('7250')),('Fiber Link original',D('20000')),('Cellula proposal',D('22258.48'))]
checks=[]
def check(name,condition,detail):
    assert condition,name
    checks.append(dict(name=name,result='MODEL_ASSERTION_PASSED',detail=detail))
# A: same delivered benefit, same irreversible price, unconditional reserve repayment.
for contribution in [D('.125'),D('25'),D('250')]:
 for value in [D(0),D(5),D(500)]:
  reserve=contribution*D('.8');fee=contribution-reserve
  for return_of_reserve in [True]:
   bundled=value+reserve-contribution
   simple=value-fee
   check('cash_retention_replication',bundled==simple,dict(contribution=str(contribution),benefit_value=str(value),net_before_cost=str(simple)))
# Buyer advances a reserve that stays locked: it is not creator working capital.
check('financing_impossibility_60_80',D('.6')+D('.8')>1,{'need':'60% immediately usable plus 80% protected needs at least 40% extra capital'})
check('milestone_labels_do_not_create_capital',D('1500')+D('4000')>D('5000'),{'scenario':'5000 raised, 1500 released, 4000 promised: deficit500'})
# B: package is cash-or-asset, not cash AND asset. Model payoff, not an executed option contract.
option=[]
for asset_value in [D(0),D(10),D(79),D(80),D(81),D(100),D(200)]:
 r=D(80);bundle=max(r,asset_value);replica=r+max(asset_value-r,0)
 check('cash_or_asset_call_replication',bundle==replica,{'asset_value':str(asset_value),'terminal_package':str(bundle)})
 option.append({'asset_value':str(asset_value),'cash_or_asset':str(bundle),'retained_cash_plus_call_intrinsic':str(replica)})
check('independent_parts_allow_double_spend_of_package',D(80)+D(200)>max(D(80),D(200)),{'counterexample':'old owner cashes80 while transferee claims200-valued asset:280 paid against200 economic package'})
# An unauthenticated off-chain milestone cannot be inferred from identical public observations.
worlds=[dict(chain='same-root-same-payments',delivery=False),dict(chain='same-root-same-payments',delivery=True)]
check('external_delivery_indistinguishable',worlds[0]['chain']==worlds[1]['chain'] and worlds[0]['delivery']!=worlds[1]['delivery'],{'consequence':'chain-only decision cannot correctly distinguish both worlds without additional evidence/trust'})
# Channel capital cannot also remain liquid cash backing in a different covenant.
check('liquidity_lease_no_double_count',D('500000')+D('400000')>D('500000'),{'channel_capital':'500000','separate_claim_backing':'400000','minimum_external_shortfall':'400000'})
check('earned_cash_is_not_new_financing',D(100)-D(100)==0,{'merchant_earned_balance100':'fully funded exit needs100 reserve, not20 creator grant'})
# 80% native-denominated backing is not 80% dollar insurance.
check('ckb_price_loss_not_insured',D('.8')*D('.1')==D('.08'),{'scenario':'90% CKB/USD fall leaves backing worth8% of initial dollar contribution'})
# Common stress: published budget is issuer need, NOT a buyer subscription/order.
rows=[]
for name,need in BUDGETS:
 for floor in [D('.8'),D('.4'),D('.2')]:
  for gross_fee in [D(0),D('.01')]:
   fraction=1-floor-gross_fee
   required=need/fraction
   assert required*floor+required*gross_fee+need==required
   for px in PRICES:
    for n in [100,1000]:
     for markets in [1,10,100]:
      rows.append(dict(budget_reference=name,creator_need_usd=str(need),floor=str(floor),gross_fee_fraction=str(gross_fee),required_raise_usd=str(required),protected_usd_at_entry=str(required*floor),buyer_count=n,per_buyer_usd=str(required/n),hypothetical_ckb_usd=str(px),code_markets=markets,allocated_code_capacity_ckb=str(D(17889)/markets),allocated_code_value_usd=str(D(17889)*px/markets),vault_value_usd=str(322*px),new_buyer_wallet_capacity_value_usd=str(61*n*px),creator_wallet_value_usd=str(61*px),position_ckb=str(required/n/px),code_opportunity_cost_90d_5pct_usd=str(D(17889)*px/markets*D('.05')*D('.25')),reserve_opportunity_cost_90d_5pct_usd=str(required*floor*D('.05')*D('.25'))))
# Reserve externality stress, separately assumed new Trade operating layer (not any creator's actual budget).
operations=[]
for archive_monthly in [D(50),D(300),D(1000)]:
 for acquisition_each in [D(0),D(5),D(20)]:
  for n in [100,1000]:
   total=archive_monthly*6+acquisition_each*n+D(20)*D(40) # 20h support at assumed $40/h
   raise_= (D(5000)+total)/D('.19') # 80% backing,1%gross fee, issuer funds these separate expenses
   operations.append(dict(archive_monthly_assumed_usd=str(archive_monthly),buyer_acquisition_each_assumed_usd=str(acquisition_each),buyers=n,support_assumed_usd='800',additional_operating_cost_usd=str(total),raise_to_net_5000_after_costs_usd=str(raise_)))
# Every successfully withdrawn funded minimum exhausts equal capacity; no reserve magic.
old_backing,old_liabilities,paid=D(100),D(100),D(10)
new_backing,new_liabilities=old_backing-paid,old_liabilities-paid
check('no_free_floor_from_fully_backed_redemption',new_backing-new_liabilities==old_backing-old_liabilities,{'before':'B=L=100','after':'B=L=90','new_surplus':'0'})
result=dict(classification='EXECUTABLE_EXACT_ARITHMETIC_PRODUCT_MODELS_NOT_VM_OR_CUSTOMER_VALIDATION',as_of='2026-11-03 Africa/Lagos',checks=checks,call_replication=option,financing_scenarios=rows,operating_cost_stress=operations,unpriced=['independent security review','legal/compliance','mainnet conversion/offramp spread','real LP quotes','service-delivery costs not in stated creator budget','contract changes/deployment capacity','archival SLA engineering'],scope='Published asks are references. All hypothetical prices, floors, conversion, option availability, financing acceptance, counts, CAC, support and operations scenarios are assumptions; no solicitation or paid service.')
(OUT/'model-results.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'model_assertions':len(checks),'financing_rows':len(rows),'operating_stress_rows':len(operations),'classification':result['classification']}))

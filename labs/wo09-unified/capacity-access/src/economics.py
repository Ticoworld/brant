from pathlib import Path
from decimal import Decimal as D,getcontext,ROUND_CEILING
import json
getcontext().prec=40
p=Path(__file__).resolve().parents[1];binary=json.loads((p/'build/manifest.json').read_text());code=D(binary['bytes']+41);rows=[]
for n in [100,1000,10000]:
 cohorts=(n+999)//1000
 for price in map(D,['.50','1','2','10']):
  for usd in map(D,['1','5','20']):
   claim=usd/price;backing=n*claim
   for markets in [1,10,100]:
    r=dict(users=n,usd_per_ckb=str(price),position_usd=str(usd),position_ckb=str(claim),cohorts=cohorts,max_supported_target_per_cell=1024,modeled_users_per_cohort=1000,shared_capacity_ckb=str(282*cohorts),shared_capacity_usd=str(282*cohorts*price),backing_ckb=str(backing),backing_usd=str(n*usd),code_total_ckb=str(code),code_shared_market_count=markets,allocated_code_ckb=str(code/markets),capacity_plus_allocated_code_usd=str((D(282*cohorts)+code/markets)*price),owner_funded_wallet_capacity_ckb='0',optional_monthly_sponsor_fee_budget_ckb=str(D(n)*60*D('.0001')),actual_fixture_claim_paid_fee_ckb='.0001',actual_fixture_claim_paid_fee_usd=str(D('.0001')*price),fee_fraction_of_position=str(D('.0001')*price/usd),independent_exact_value_standalone_output_possible=False,absolute_structural_occupied_floor_ckb='41',standard_payout_floor_ckb='61',gift_for_all_users_ckb=str(61*n),gift_for_all_users_usd=str(61*n*price),gift_for_one_percent_users_ckb=str(D(61*n)/100),minimum_extra_for_all_61ckb_outputs_ckb=str(max(D(0),D(61)-claim)*n),quarter_year_5pct_capacity_opportunity_usd=str((D(282*cohorts)+code/markets)*price*D('.05')*D('.25')),quarter_year_5pct_backing_opportunity_usd=str(backing*price*D('.05')*D('.25')))
    assert claim<D(41)
    # Distinct owners cannot each withdraw the same sponsor capital.
    assert D(r['minimum_extra_for_all_61ckb_outputs_ckb'])+backing>=61*n
    rows.append(r)
loss=[]
for n in [100,1000,10000]:
 for rate in [D('.001'),D('.01')]:
  sizes=[min(1000,n-i) for i in range(0,n,1000)]
  expected=sum((D(282)*(1-(1-rate)**s) for s in sizes),D(0))
  loss.append(dict(users=n,assumed_independent_key_loss_fraction=str(rate),expected_indefinitely_locked_cohort_cushion_ckb=str(expected),worst_locked_cushion_ckb=str(282*len(sizes)),qualification='Illustrative independent-loss model; no expiry confiscation or forced settlement'))
out=dict(classification='MODELED_CAPITAL_REQUIREMENTS_NOT_NATIVE_SCALE_OR_CUSTOMER_DEMAND',date='2026-11-03 Africa/Lagos',source_binary_sha256=binary['sha256'],rows=rows,lost_key_stress=loss,assumptions=['One position per active user;10000users use10separate cohorts, not a10000leaf executed market','Each claim fully backed once; sponsor shared storage never counted as customer asset backing','Publicly priced ordinary CKB spot/UDT exchange, onramp, LP bids and archive quotes absent','Code Cell unspendable in test deployment; code reuse allocates cost but does not free that capital','Gift61CKBpernewordinaryexit is actual prototype route and becomes user property; no forced reuse','Expected one-percent exit demand is only an assumption; worst-case allusers needs full funding or refusal','60monthly actions/user and fee10000sh use fixture fee, not guaranteed future quote','Archive expenses remain unquoted; stress50/300/1000USDmonthly separately','No guarantee no sponsor means ordinary small standalone cash withdrawal'])
(p/'evidence/capital-economics.json').write_text(json.dumps(out,indent=2)+'\n');print('modeled',len(rows),'capital scenarios and',len(loss),'lost-key scenarios')

"""Exact snapshot-calibrated capital/price-grid analysis; no live quotes or trades."""
from fractions import Fraction as Q
from pathlib import Path
import json
r=Path(__file__).resolve().parents[1];U=10**8
price=json.loads((r/'research/web/ckb-price.raw').read_text(),parse_float=Q)['nervos-network']['usd'];book=json.loads((r/'research/web/ckb-book.raw').read_text());fixtures=[]
target=int(1000*price*U);assert Q(target,U)==1000*price
for ratio in ['0.8','0.5','0.2','0.01','1','1.25','2','0.51']:
 exact=price*Q(ratio)*U;scaled=(exact.numerator*2//exact.denominator+1)//2
 assert scaled>0 and abs(Q(scaled)-exact)<=Q(1,2)
 senior=min(2000*U,(target*U+scaled-1)//scaled)
 fixtures.append({'price':str(scaled),'target_usd_scaled':str(target),'senior_principal':str(senior),'junior_principal':str(2000*U-senior),'relative_price_assumption':ratio,'rounding':'nearest1e-8 USD price, ceil1-shannon payout; illustrative relative shocks to captured reference'})
(r/'fixtures/market-scale-risk-payoffs.json').write_text(json.dumps(fixtures,indent=2)+'\n')
# Cash/return basis separates contributed occupied capital, principal and profit.
capital=[]
for principal in [2000,20000,2000000]:
 for transferable in [False,True]:
  buffers=122;event=206;records=316 if transferable else 0;overhead=buffers+event+records
  capital.append({'risk_principal_ckb':str(principal),'principal_reference_usd':str(principal*price),'output_budget_ckb':str(buffers),'permanent_event_ckb':str(event),'permanent_records_ckb':str(records),'overhead_fraction':str(Q(overhead,principal)),'capital_usd_including_overhead':str((principal+overhead)*price),'deployment_code_cost':'One-time per script; separately measured and potentially amortized, not included','transaction_and_oracle_service_fees':'UNKNOWN market cost; prototype uses explicitly funded chain fees'})
walks=[]
for quantity in [1000,100000,1000000,2000000]:
 for side in ['bids','asks']:
  left=Q(quantity);cash=Q(0);filled=Q(0)
  for p,q in book[side]:
   take=min(left,Q(q));cash+=take*Q(p);filled+=take;left-=take
   if not left:break
  best=Q(book[side][0][0]);average=cash/filled
  walks.append({'ckb_requested':str(quantity),'side':side,'visible_filled_ckb':str(filled),'unfilled_ckb':str(left),'visible_cash_usd':str(cash),'visible_average_price':str(average),'slippage_vs_best':str(abs(average-best)/best),'classification':'Historical displayed-depth arithmetic; no fill assurance, fee, access, transfer or hedge basis qualification'})
# At reference scale, a1000 USD senior needs far more than2000 CKB total.
required=Q(2000)/price;assert required>1000000
out={'scope':'EXTERNAL REFERENCE + SYNTHETIC SHOCKS, not premium calibration or customer evidence','reference_usd_per_ckb':str(price),'small_pool_senior_target_usd':str(Q(target,U)),'ckb_principal_for_1000usd_senior_and_equal_junior':str(required),'capital_cases':capital,'book_walks':walks,'permanence_counterexample':'Beneficiary records cannot burn after settlement;316 CKB remains occupied per pool even if the event is shared','sharing_case':{'ten_independent_fixed_pools_event_ckb_without_sharing':'2060','same_event_single_record_ckb':'206','savings_ckb':'1854','principal_saved':'0','proof':'Derived; same typed event dependency can be shared, but a ten-pool native batch is not claimed'},'limits':['No current offer to sell either tranche','No actual market-implied risk distribution or premium','No authentication of reference feed for on-chain use','A visible CEX book does not establish a native CKB replenishment route','Permanent event/record costs count even after settlement']}
(r/'evidence/market-scale-economics.json').write_text(json.dumps(out,indent=2)+'\n');print('Snapshot-scaled fixtures, occupied-capital ratios, visible-depth limits and premium unknowns preserved.')

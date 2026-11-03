"""Offline exact calculation. Standing offers, SDK simulations and cost assumptions stay distinct."""
from pathlib import Path
from decimal import Decimal as D
from datetime import datetime,timezone
import json,hashlib
B=Path(__file__).resolve().parents[1];E=B/'evidence';P=E/'read-1793695599555'
def load(p):return json.loads(p.read_text())
def ceil(a,b):return (a+b-1)//b
state=load(P/'state.json')['system'];stats=load(P/'market-stats.json');orders=load(P/'all-orders.json');quotes=load(P/'order-simulations.json');r=state['exchangeRatio'];A=int(r['ckbScale']);Bv=int(r['udtScale']);U=10**8
assert stats['all_orders']==stats['fulfilled']==len(orders)==18
assert stats['matchers_give_CKB']==stats['matchers_give_iCKB']==0 and len(state['poolDeposits'])==24
assert len(load(P/'ready-pool.json'))==0
codes=load(P/'deployed-code-hashes.json');identity=load(P/'identity.json')
for name in ['ickb','logic','order']: assert identity[name]['codeHash'] in [c['ckb_data_hash'] for c in codes]
assert len({(x['cell']['outPoint']['txHash'],x['cell']['outPoint']['index']) for x in state['poolDeposits']})==24
rows=[]
for q in quotes:
 price=D(q['ckb_price_usd']);usd=D(q['usd_ticket']);amount=int(q['source_amount']);buy=q['direction']=='CKB_TO_iCKB';output=ceil(amount*(A if buy else Bv)*99990,(Bv if buy else A)*100000)
 assert output==int(q['quote']['convertedAmount'])
 effective=q.get('estimate') or {};effout=int(effective.get('convertedAmount',output));minimum=int(q['minimum'])
 rows.append({'classification':'SDK_NEW_ORDER_SIMULATION_NOT_EXECUTED_OR_EXISTING_OFFER','price_reference':str(price),'ticket_usd_assumed':str(usd),'direction':q['direction'],'input_units':str(D(amount)/U),'output_units':str(D(effout)/U),'embedded_order_fee_ckb':str(D(effective.get('ckbFee',q['quote']['ckbFee']))/U),'accepted_amount_floor':amount>=minimum,'minimum_source_units':str(D(minimum)/U),'modeled_delay_seconds':str((D(effective['maturity'])-D(state['tip']['timestamp']))/1000) if effective.get('maturity') else None,'actual_fill_delay':None,'actual_executed_output':None,'receiver_secp_occupied_ckb':146,'new_secp_order_master_occupied_ckb':293})
# Different from indicative standing market: bot's recommended float and incremental economics.
dep=D(state['depositCapacity'])/U;capital=D('3.2')*dep+1000
first=min(int(x['maturity']) for x in stats['deposit_times']);days=(D(first)-D(state['tip']['timestamp']))/D(86400000)
maker=[]
for price in map(D,['0.001152','.5','1','2','10']):
 for ticket in map(D,['20','50','100']):
  for net_rate in map(D,['0','.02','.10']):
   fee_income=ticket*D('.0001');wait_cost=ticket*net_rate*days/365
   maker.append({'classification':'HYPOTHETICAL_MAKER_MODEL_NO_DEMAND_OR_FILL','price_usd':str(price),'ticket_usd':str(ticket),'gross_one_side_fee_usd':str(fee_income),'net_annual_capital_rate_assumption':str(net_rate),'first_pool_date_days_modeled':str(days),'replenishment_wait_cost_usd':str(wait_cost),'gross_less_that_cost_usd':str(fee_income-wait_cost),'bot_reference_float_ckb':str(capital),'bot_reference_float_usd':str(capital*price),'one_fill_10fee_allowance_ckb':str(D(stats['partial_fee'])*10/U),'capital_rate_scope':'Net of any held-asset DAO income; do not add or double-count that income again','excluded':'Full mint/receipt/collection fees, recurring operations, spread, adverse selection, bid/ask liquidity and realized maker demand unavailable'})
result={'classification':'DERIVED_FROM_DATED_RPC_WITH_EXPLICIT_SIMULATIONS','reference_read':str(P.relative_to(B)),'observed_standing_bid':None,'observed_standing_ask':None,'observed_book_filled_orders':18,'quote_rows':rows,'maker_models':maker,'gross_ratio_ckb_per_ickb':str(D(Bv)/A),'pool_ckb':str(sum(D(x['ckbValue']) for x in state['poolDeposits'])/U),'pool_ickb':str(sum(D(x['udtValue']) for x in state['poolDeposits'])/U),'first_modeled_pool_claim_utc':datetime.fromtimestamp(first/1000,timezone.utc).isoformat(),'first_claim_days':str(days),'recommended_reference_bot_ckb':str(capital),'source_capacity':{'secp_iCKB_receiver_ckb':146,'standard_new_order_plus_master_ckb':293,'receipt_phase2_capacity_ckb':208,'minimum_direct_deposit_total_ckb':1082,'standard_cap_iCKB':100000},'usd_note':'0.001152 is mid of dated CKB/USDT denomination-only response; USDT=USD assumed for comparison, not iCKB liquidity. Other prices hypothetical stress cases.'}
(E/'comparison.json').write_text(json.dumps(result,indent=2)+'\n')
print('Verified',len(rows),'SDK quote arithmetic rows;',len(maker),'explicit maker scenarios')
for q in rows[:6]:print(q)
print('Reference float',capital,'CKB; earliest pool claim days',days)

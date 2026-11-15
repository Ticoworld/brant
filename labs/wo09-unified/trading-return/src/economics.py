"""Exact-decimal, explicitly hypothetical economics; no orders, pegs or liquidity invented."""
from decimal import Decimal as D, ROUND_FLOOR, ROUND_CEILING
from pathlib import Path
import json
base=Path(__file__).resolve().parents[1]
def enc(x):
 if isinstance(x,D): return format(x,'f')
 raise TypeError(type(x))
prices=list(map(D,['0.50','1','2','10']));tickets=list(map(D,['1','5','20']))
rows=[]
for p in prices:
 for usd in tickets:
  for n in [2,100,1000]:
   q=usd/p;storage=D(485)/n;code=D(50441)/n;fee=D('.0001')
   rows.append(dict(usd_position=usd,ckb_price_usd=p,position_ckb=q,users=n,
    source='MODELED amortization only; new exchange native executed2owners, not100/1000',
    principal_usd=usd,shared_storage_ckb_per_owner=storage,shared_storage_usd_per_owner=storage*p,
    code_capital_ckb_per_owner=code,code_capital_usd_per_owner=code*p,
    existing_typed_wallet_new_occupied_usd=D(142)*p,existing_wallet_incremental_storage_usd=D(0),
    new_external_typed_receiving_capacity_usd=D(142)*p,
    chosen_internal_trade_fee_usd=fee*p,modeled_gross_spread_0_3_percent_usd=usd*D('.003'),
    shared_storage_10percent_annual_30day_opportunity_cost_usd=storage*p*D('.10')*D(30)/D(365),
    code_10percent_annual_30day_opportunity_cost_usd=code*p*D('.10')*D(30)/D(365)))
maker=[]
for t in tickets:
 for s in map(D,['.001','.003','.01']):
  for adverse in map(D,['0','.01','.05']):
   maker.append(dict(ticket_usd=t,gross_spread_rate=s,adverse_inventory_move_rate=adverse,
    gross_spread_usd=t*s,inventory_loss_on_equal_notional_usd=t*adverse,
    gross_less_inventory_move_usd=t*(s-adverse),
    omitted='Replenishment, hedge/basis, capital, fees and operations; negative example not forecast'))
def first(cost,per):return int((D(cost)/D(per)).to_integral_value(rounding=ROUND_FLOOR))+1
breaks={'warm_shared_vs_new142_typed_wallets':first(485,142),
 'cold_shared_including_code_vs_new142_typed_wallets':first(50441+485,142),
 'warm_shared_vs289_per_independent_A2_bid_master_profile':first(485,289),
 'cold_shared_vs_already_deployed_A2_289_profile':first(50441+485,289),
 'both_cold_shared_vs_optimized_A2_profile':first(50441+485-(34528+41),289),
 'warning':'Storage-only, excludes asset backing, sponsor fees, data, liability exit capacity. A2 per-user independent master profile only; no claim of optimal master sharing. Existing typed wallet incremental storage is zero; pool never wins that metric.'}
# Actual public snapshot, NOT a submitted order. LOT_SIZE limit-order rounding only.
book=json.loads((base/'research/binance_depth.json').read_text());info=json.loads((base/'research/binance_exchange_info.json').read_text());symbol=info['body']['symbols'][0]
f={x['filterType']:x for x in symbol['filters']};step=D(f['LOT_SIZE']['stepSize']);minimum=D(f['NOTIONAL']['minNotional']);ask=D(book['body']['asks'][0][0]);bid=D(book['body']['bids'][0][0]);market=[]
for t in tickets:
 qty=(t/ask/step).to_integral_value(rounding=ROUND_FLOOR)*step
 up=(minimum/ask/step).to_integral_value(rounding=ROUND_CEILING)*step
 market.append(dict(budget_usdt=t,whole_lot_quantity=qty,ask_notional_usdt=qty*ask,
  meets_published_limit_notional_filter=qty*ask>=minimum,
  smallest_ask_quantity_for_min_notional=up,smallest_ask_cost_usdt=up*ask,
  qualification='Indicative displayed quote and limit-order filter only, no order, account fees, live validity, access or withdrawal guarantee'))
assert ask>bid>0 and minimum==5 and step==1
assert D(485)/1000==D('.485') and first(50926,142)==359
assert first(50926,289)==177 and first(16357,289)==57
assert D('.0001')*D(10)==D('.001')
result={'classification':'EXACT_ARITHMETIC_MODELS_NOT_NATIVE_SCALE_OR_CUSTOMER_VALIDATION',
 'assumptions':{'code_ckb':50441,'shared_storage_ckb':485,'typed_recipient_ckb':142,'A2_profile_ckb':289,'annual_cost_rate':'0.10 HYPOTHETICAL','holding_days':30,'miner_fee_ckb':'.0001 CHOSEN_FIXTURE_FEE'},
 'position_scenarios':rows,'maker_counterexamples':maker,'storage_break_even_users':breaks,
 'public_CEX_observation':{'retrieved_utc':book['retrieved_utc'],'server_date':book['server_date'],'best_bid':bid,'best_ask':ask,'relative_mid_spread':(ask-bid)/((ask+bid)/2),'minimum_notional_usdt':minimum,'tickets':market}}
(base/'research/economics.json').write_text(json.dumps(result,default=enc,indent=2)+'\n')
print(json.dumps({'scenarios':len(rows),'maker_counterexamples':len(maker),'break_even':breaks,'observed_cex':result['public_CEX_observation']},default=enc,indent=2))

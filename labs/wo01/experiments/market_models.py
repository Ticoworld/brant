#!/usr/bin/env python3
"""Scenario models, not empirical CKB market forecasts. Python standard library only."""
import json,math,random,pathlib
rng=random.Random(1001);N=200000
# Stale ask: taker buys only when the later reference price exceeds the fixed ask.
option=[]
for daily_vol in [.04,.08,.16]:
 for seconds in [1,30,120,600]:
  sigma=daily_vol*math.sqrt(seconds/86400)
  xs=[rng.gauss(0,sigma) for _ in range(N)]
  for spread_bps in [10,30,60]:
   s=spread_bps/10000
   loss=sum(max(x-s,0) for x in xs)/N*10000
   z=s/sigma;analytic=(sigma*math.exp(-z*z/2)/math.sqrt(2*math.pi)-s*.5*math.erfc(z/math.sqrt(2)))*10000
   option.append({'daily_vol':daily_vol,'delay_s':seconds,'spread_bps':spread_bps,'loss_bps_per_quote_opportunity_MC':round(loss,4),'analytic_bps':round(analytic,4)})
# Negative flow imbalance. These are independent fills, not a Poisson arrival assumption.
flows=[]
for buys,sells in [(50,50),(60,40),(100,0)]:
 flows.append({'buys':buys,'sells':sells,'ticket_usd':100,'gross_usd':100*(buys+sells),'net_external_usd':100*abs(buys-sells),'netting_reduction':1-abs(buys-sells)/(buys+sells)})
# Inventory capacity: busy times include refunds, usable_fraction excludes hedge buffers.
capital=[]
for busy_s in [30,120,600,3600]:
 capital.append({'total_inventory_usd':20000,'one_side_inventory_usd':10000,'usable_fraction':.6,'busy_s':busy_s,'upper_bound_one_way_usd_per_hour':10000*.6*3600/busy_s})
# LP annual hurdle is a cost, not a promised yield. Costs are hypothetical.
mm=[]
for turnover in [.25,1,4]:
 for adverse in [5,20,50]:
  daily_volume=20000*turnover
  costs_bps=8+3+adverse+(.12/365/turnover*10000)
  mm.append({'daily_turnover':turnover,'volume_usd':daily_volume,'hedge_bps':8,'gas_rebalance_bps':3,'adverse_bps':adverse,'annual_capital_hurdle':.12,'break_even_spread_bps':round(costs_bps,4),'profit_at_40bps_usd_per_day':round(daily_volume*(40-costs_bps)/10000,4)})
# Signed freshness against a supplied old header has no bound on actual inclusion time.
stale={'anchor_time':100,'signed_price_time':101,'actual_inclusion_time':1000,'max_age':5,'passes_anchor_relative_check':abs(101-100)<=5,'actual_age':1000-101}
assert stale['passes_anchor_relative_check'] and stale['actual_age']>stale['max_age']
# HTLC deadlines are times in a model, not recommended chain parameters.
timeouts=[]
for remaining,gap,claim_latency,stall in [(600,300,60,0),(600,300,60,400),(600,900,60,0)]:
 timeouts.append({'destination_deadline':remaining,'source_deadline':remaining+gap,'source_claim_latency':claim_latency,'source_stall':stall,'reveal_at':remaining-1,'source_claim_before_refund':remaining-1+claim_latency+stall<remaining+gap})
calibrated=[{'hedge_bps':h,'adverse_bps':a,'other_bps':3,'capital_bps':.12/365*10000,'required_bps':round(h+a+3+.12/365*10000,4)} for h in [26,32] for a in [5,20,50]]
out={'snapshot_hedge_sensitivity':calibrated,'seed':1001,'samples_per_vol_delay':N,'stale_option':option,'netting':flows,'capital_upper_bounds':capital,'maker_scenarios':mm,'stale_header_counterexample':stale,'timeout_scenarios':timeouts,'limitations':'Gaussian returns omit jumps, endogenous selection, fees and true CKB volatility; netting assumes executable opposing orders and common settlement domain; capital rates are bounds, not realized volume; timeout model assumes absolute clocks and does not implement either contract.'}
p=pathlib.Path(__file__).resolve().parents[1]/'evidence'/'model-results.json';p.write_text(json.dumps(out,indent=2));print(json.dumps({k:v for k,v in out.items() if k!='stale_option'},indent=2))

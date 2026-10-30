#!/usr/bin/env python3
"""Recompute hypothetical VWAP from preserved Binance depth, no trading or network calls."""
import json,pathlib
p=pathlib.Path(__file__).resolve().parents[1]/'evidence';d=json.loads((p/'binance_vision_depth.json').read_text());t=json.loads((p/'binance_vision_ticker.json').read_text())
out={'retrieval_date':'2026-10-29','endpoint':'https://data-api.binance.vision/api/v3/depth?symbol=CKBUSDT&limit=100','lastUpdateId':d['lastUpdateId'],'ticker':t,'best_bid':float(d['bids'][0][0]),'best_ask':float(d['asks'][0][0]),'execution_scenarios':[]}
mid=(out['best_bid']+out['best_ask'])/2;out['spread_bps']=(out['best_ask']-out['best_bid'])/mid*10000
for usd in [100,1000,10000]:
 for side in ['bids','asks']:
  target=usd/mid;left=target;quote=0
  for ps,qs in d[side]:
   price,qty=float(ps),float(qs);fill=min(left,qty);quote+=fill*price;left-=fill
   if left<1e-8:break
  out['execution_scenarios'].append({'side':'sell_CKB' if side=='bids' else 'buy_CKB','reference_notional_usdt':usd,'ckb_quantity':target,'fully_covered':left<1e-8,'vwap':quote/(target-left),'cost_vs_mid_bps':((quote/target/mid-1) if side=='asks' else (1-quote/target/mid))*10000 if left<1e-8 else None,'unfilled_ckb':left})
(p/'binance-depth-analysis.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2))

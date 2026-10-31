"""Conditional sensitivity model, NOT market quotes, executed batching, or a business PASS."""
import csv,json,itertools,datetime,math
from pathlib import Path
R=Path(__file__).resolve().parents[1];P=R.parent/'wo04-e2/compact-intents'
measured=json.loads((P/'evidence/chain-live-recovered.json').read_text())
# Endpoint scenarios are explicit stress envelopes, not statistical confidence intervals.
S={
 'low':dict(ckb=.001,eth=1500,l1gwei=.1,fillGas=86237,proofRoot=.01,proofTrade=.001,capitalRate=.05,hedgeBps=10,riskBps=0,sourceMinutes=.5,monthlyOps=500,monthlyTrades=10000),
 'high':dict(ckb=.02,eth=6000,l1gwei=50,fillGas=103325,proofRoot=.50,proofTrade=.05,capitalRate=.30,hedgeBps=200,riskBps=100,sourceMinutes=2,monthlyOps=10000,monthlyTrades=100),
}
# Destination delivery gas is only measured on private PoS. L2 ALL-IN costs include
# L1 data fee as a scenario; not gas*price using our L1 measurement alone.
ROUTES={
 'Ethereum L1':dict(delivery=(None,None),reimburseMinutes=(15,45),status='UNPROVEN',security='Existing predicate demonstrated only on historical/private Capella; current mainnet deployment/fork compatibility NOT demonstrated'),
 'Base':dict(delivery=(.001,.25),reimburseMinutes=(7*1440,8*1440),status='UNPROVEN',security='No CKB proof of resolved fault-dispute output plus L1 finality implemented; seven-day assumption is illustrative, sequencer delivery is not reimbursement'),
 'Arbitrum':dict(delivery=(.001,.25),reimburseMinutes=(7*1440,8*1440),status='UNPROVEN',security='No CKB proof of confirmed assertion/challenge result plus state binding implemented'),
 'Linea validity':dict(delivery=(.001,.50),reimburseMinutes=(60,1440),status='UNPROVEN',security='Source shows proof-gated finalization AND separate liveness recovery; live deployed mode/proof latency/USDC liquidity NOT verified. No authenticated L1 storage -> L2 root bridge implemented'),
}
rows=[]
for route,v in ROUTES.items():
 for amount,n in itertools.product([10,50,100,1000],[1,5,10,50]):
  costs={}
  for ix,(scenario,s) in enumerate(S.items()):
   destination=s['fillGas']*s['l1gwei']*1e-9*s['eth'] if v['delivery'][ix] is None else v['delivery'][ix]
   ckbfee=.02*s['ckb'] # actual signed funding .01 + actual settlement .01, not minimum fee-rate promise
   rootfee=.01*s['ckb']/n # actual 3530-byte root transition,60.8M cycles, one root shared
   proof=s['proofTrade']+s['proofRoot']/n
   inventory=amount*s['capitalRate']*(v['reimburseMinutes'][ix]+s['sourceMinutes'])/(365*24*60)
   hedge=amount*s['hedgeBps']/10000
   risk=amount*s['riskBps']/10000 # arbitrary reserve sensitivity, NOT calibrated tail-risk cap
   # Root cells cannot be spent. Charge a full first year of capital carrying per publication;
   # locked capacity and ongoing future annual liabilities remain separate, never a burn.
   rootcapital=282*s['ckb']*s['capitalRate']/n
   pertradecapital=.01*s['ckb']*s['capitalRate']*(v['reimburseMinutes'][ix])/(365*24*60)
   variable=destination+ckbfee+rootfee+proof+inventory+hedge+risk+rootcapital+pertradecapital
   # Code occupied capacity remains locked/reusable, not burned. Current immutable cells
   # have no demonstrated reclaim path; annual opportunity cost only.
   codeMonthly=(148241+13321)*s['ckb']*s['capitalRate']/12
   stateMonthly=(386+482)*s['ckb']*s['capitalRate']/12
   fixed=s['monthlyOps']+codeMonthly+stateMonthly
   total=variable+fixed/s['monthlyTrades']
   makerVariable=variable-ckbfee-pertradecapital
   makerTotal=total-ckbfee-pertradecapital
   costs[scenario]=dict(destination=destination,ckbFundingSettlement=ckbfee,rootUpdate=rootfee,proof=proof,inventory=inventory,hedge=hedge,riskReserveUncalibrated=risk,rootOccupiedCapitalFirstYear=rootcapital,rootNewLockedCapitalUSD=282*s['ckb']/n,rootAnnualOngoingCarryUSD=282*s['ckb']*s['capitalRate']/n,feeReserveCapital=pertradecapital,variable=variable,codeCapitalMonthly=codeMonthly,stateCapitalMonthly=stateMonthly,operationsMonthly=s['monthlyOps'],assumedMonthlyTrades=s['monthlyTrades'],allIn=total,makerVariable=makerVariable,makerAllIn=makerTotal,customerNativeFees=ckbfee,customerNativeCosts=ckbfee+pertradecapital,routeBreakEvenBps=total/amount*10000,breakEvenBps=makerTotal/amount*10000)
   for quote in [25,50,100,200]:
    contribution=amount*quote/10000-makerVariable
    costs[scenario][f'netAt{quote}bps']=amount*quote/10000-makerTotal
    costs[scenario][f'monthlyTradesToCover{quote}bps']=math.ceil(fixed/contribution) if contribution>0 else None
  row=dict(route=route,notionalUSD=amount,tradesPerRoot=n,verdict=v['status'],executedN50=False,security=v['security'])
  for sc,cs in costs.items():
   for k,val in cs.items():row[sc+'_'+k]=val
  rows.append(row)
meta=dict(historicalComparisons={'E1':{'directSettlementCyclesMean':442403.5,'checkpointPublicationCycles':2064388,'checkpointReadCyclesMean':49594,'security':'controller-selected root; NOT comparable authenticated finality cost'},'E2C':{'fundBytes':869,'fillCycles':564138,'fillBytes':1872,'refundCycles':624993,'refundBytes':2021,'occupiedIntentCKB':518,'evm7ReceiptGas':1884025,'locks':'always-success; not standard wallet production'},'E2D_P0':{'signedFundBytes':1098,'fillCycles':1038250,'fillBytes':2503,'refundCycles':973118,'refundBytes':2347,'occupiedIntentCKB':642,'fillGas':85534,'principalCKB':1000},'comparisonRule':'Historical observations, not additive line items or price quotes'},generatedAt='2026-10-31T00:16:26+00:00',marketDataVerified=False,parameterClass='HYPOTHETICAL sensitivity ranges; no live spot/depth/gas/quotes obtained',scenarioEndpoints=S,routes=ROUTES,measuredBaselineCommit='7771f6c73fcebf6777e4d4f9c3b562eb797ecc36',measured=dict(fillGas=[86237,103325],rootBytes=3530,rootCycles=[60832914,60831584],fillSettlementBytes=2901,refundSettlementBytes=2830,fillSettlementCycles=1044297,refundSettlementCycles=1011230,fundingTwinBytes=593,singleFundingBytes=472,feePerTransactionCKB=.01,tradeInputCKB=100.01,principalCKB=100,occupiedIntentCKB=73,codeMinimumCKB=161562),unpriced=['Executable CKB-USDC market impact, withdrawal fee/delay/access, exchange/custody/counterparty exposure','Adverse selection and inventory replenishment USDC->CKB','Unbounded proof/finality outage and low-participation liveness','Production fork support, actual L2 proof cost/availability, source reorg loss calibration','Capital for standing two-sided inventories, regulatory/compliance expenses, customer acquisition','Every newly retained immutable root requires additional capacity indefinitely; first-year carrying expense does NOT imply pruning or release after one year'],rows=rows)
(R/'evidence/model.json').write_text(json.dumps(meta,indent=2)+'\n')
with (R/'evidence/model.csv').open('w') as f:w=csv.DictWriter(f,fieldnames=rows[0].keys(),lineterminator='\n');w.writeheader();w.writerows(rows)
md=['| Route | USD | N=1 break-even bps | N=5 | N=10 | N=50 |','|---|---:|---:|---:|---:|---:|']
for route in ROUTES:
 for amount in [10,50,100,1000]:
  cells=[]
  for n in [1,5,10,50]:
   r=next(x for x in rows if x['route']==route and x['notionalUSD']==amount and x['tradesPerRoot']==n);cells.append(f"{r['low_breakEvenBps']:.1f}–{r['high_breakEvenBps']:.1f}")
  md.append('| '+route+' | '+str(amount)+' | '+' | '.join(cells)+' |')
(R/'evidence/matrix.md').write_text('\n'.join(md)+'\n')
# Sanity: larger N only amortizes shared costs, never destination execution.
for route in ROUTES:
 for amount in [10,50,100,1000]:
  rs=[r for r in rows if r['route']==route and r['notionalUSD']==amount]
  assert len(rs)==4 and rs[0]['low_destination']==rs[-1]['low_destination']
  assert rs[0]['low_allIn']>rs[-1]['low_allIn']
assert len(rows)==64
print('64 route/notional/N rows generated; 128 endpoint scenarios; all verdicts UNPROVEN')

net=['| Route | USD | N | modeled maker net at 50 bps, low / high USD | low-case monthly trades to cover ops |','|---|---:|---:|---:|---:|']
for route in ROUTES:
 for amount in [10,50,100,1000]:
  for n in [1,50]:
   x=next(x for x in rows if x['route']==route and x['notionalUSD']==amount and x['tradesPerRoot']==n)
   net.append(f"| {route} | {amount} | {n} | {x['low_netAt50bps']:.4f} / {x['high_netAt50bps']:.4f} | {x['low_monthlyTradesToCover50bps'] or 'no positive contribution'} |")
(R/'evidence/net-revenue.md').write_text('\n'.join(net)+'\n')

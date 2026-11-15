"""Exact synthetic maker stress lab: venue inventory, delay, fees and FIFO basis.
No external prices, demand, executable quotes or profitable product are asserted.
"""
from fractions import Fraction as F
from dataclasses import dataclass,field
from itertools import product
from pathlib import Path
import json

@dataclass
class Portfolio:
    native:F=F(40)
    cex:F=F(0)
    cash:F=F(100)
    destination_cash:F=F(0)
    reserved:F=F(0)
    lots:list=field(default_factory=lambda:[[F(40),F(1)]])
    pending:list=field(default_factory=list)
    realized:F=F(0)
    fees:F=F(0)
    cex_basis:F=F(0)
    def invariant(self):
        assert self.native>=self.reserved>=0 and self.cex>=0 and self.cash>=0 and self.destination_cash>=0
        assert sum((q for q,_ in self.lots),F(0))==self.native
        assert all(q>0 and maturity>=0 for q,maturity,basis in self.pending)
    def consume_basis(self,q):
        basis=F(0)
        while q:
            n,p=self.lots[0];take=min(n,q);basis+=take*p;q-=take;n-=take
            if n:self.lots[0][0]=n
            else:self.lots.pop(0)
        return basis
    def deliver(self,q,quote,fee):
        if fee is None:return 'UNKNOWN_FEE'
        if q>self.native-self.reserved:return 'NO_DELIVERY_INVENTORY'
        proceeds=q*quote-fee
        if proceeds<0:return 'UNEconomic'
        basis=self.consume_basis(q);self.native-=q;self.destination_cash+=proceeds;self.realized+=proceeds-basis;self.fees+=fee;self.invariant();return 'FILLED'
    def buy_hedge(self,q,price,depth,fee):
        if depth<q:return 'NO_DEPTH'
        cost=q*price+fee
        if cost>self.cash:return 'NO_CASH'
        self.cash-=cost;self.cex+=q;self.cex_basis+=cost;self.fees+=fee;self.invariant();return 'HEDGED_CEX_ONLY'
    def replenish(self,now,delay,limit,transfer_fee):
        q=min(self.cex,limit)
        if q<=transfer_fee:return 'NO_TRANSFER'
        average=self.cex_basis/self.cex;basis=q*average
        self.cex-=q;self.cex_basis-=basis
        # The actual transfer fee destroys inventory; cost basis stays with net delivery.
        self.pending.append([q-transfer_fee,now+delay,basis]);self.invariant();return 'IN_TRANSIT'
    def tick(self,now):
        waiting=[]
        for q,arrival,basis in self.pending:
            if arrival<=now:self.native+=q;self.lots.append([q,basis/q])
            else:waiting.append([q,arrival,basis])
        self.pending=waiting;self.invariant()
    def equity(self,price):
        return self.cash+self.destination_cash+(self.native+self.cex+sum((q for q,_,_ in self.pending),F(0))-self.reserved)*price
    def unrealized(self,price):
        basis=sum((q*p for q,p in self.lots),F(0))+self.cex_basis+sum((basis for _,_,basis in self.pending),F(0))
        return (self.native+self.cex+sum((q for q,_,_ in self.pending),F(0)))*price-basis-self.reserved*price

def simulate(spread,drift,fee,depth,delay,limit,strategy):
    p=Portfolio();initial=p.equity(F(1));outcomes=[];hedges=[]
    for tick in range(8):
        p.tick(tick)
        price=F(1)+drift*F(tick,7)
        # A stale fixed quote faces rising replacement price/adverse selection.
        result=p.deliver(F(10),F(1)+spread,fee);outcomes.append(result)
        if result=='FILLED' and strategy!='unhedged':
            hedges.append(p.buy_hedge(F(10),price,depth,fee))
            if strategy=='replenish':p.replenish(tick,delay,limit,F('0.1'))
    p.tick(8);end_price=F(1)+drift;equity=p.equity(end_price);gain=equity-initial
    # Realized and unrealized accounting must reconcile with total marked gain.
    assert gain==p.realized+p.unrealized(end_price)
    return {'strategy':strategy,'spread':str(spread),'drift':str(drift),'fee':str(fee),'depth':str(depth),'delay':delay,'limit':str(limit),'fills':outcomes.count('FILLED'),'inventory_failures':outcomes.count('NO_DELIVERY_INVENTORY'),'missing_depth':hedges.count('NO_DEPTH'),'pnl':str(gain),'realized':str(p.realized),'unrealized':str(p.unrealized(end_price)),'native_final':str(p.native),'cex_final':str(p.cex),'transit_final':str(sum((q for q,_,_ in p.pending),F(0)))}

def run():
    results=[]
    for spread,drift,fee,depth,delay,limit,strategy in product([F(0),F('0.002'),F('0.02')],[F('-0.25'),F(0),F('0.25')],[F(0),F('0.1'),F(2)],[F(0),F(10)],[0,2,10],[F(0),F(25)],['unhedged','hedge','replenish']):
        results.append(simulate(spread,drift,fee,depth,delay,limit,strategy))
    separated=Portfolio(cash=F(0),destination_cash=F(100));assert separated.buy_hedge(F(1),F(1),F(10),F(0))=='NO_CASH'
    p=Portfolio(reserved=F(35));assert p.deliver(F(10),F(1),F(0))=='NO_DELIVERY_INVENTORY';assert p.deliver(F(1),F(1),None)=='UNKNOWN_FEE'
    hedged=simulate(F('0.02'),F(0),F(0),F(10),0,F(25),'hedge');replenished=simulate(F('0.02'),F(0),F(0),F(10),0,F(25),'replenish')
    assert hedged['fills']==4 and F(hedged['cex_final'])==40
    assert replenished['fills']>hedged['fills']
    assert any(F(r['pnl'])<0 and r['strategy']=='replenish' for r in results)
    # Independently calibrate DAO cash flow from real chain evidence, without adding
    # underlying deposit and its iCKB/withdrawal claim as separate assets.
    root=Path(__file__).resolve().parents[3]
    evidence=root/'labs/rebuild/native/evidence/run-1793544609163/dao-lifecycle.json'
    life=json.loads(evidence.read_text());payout=F(int(life['payout']),10**8);redemption=F(int(life['maximum']),10**8)
    dao=[]
    for days,annual,fees in product([30,180,360],[F('0.04'),F('0.12')],[F(1),F(100)]):
        capital_cost=payout*annual*F(days,365);net=redemption-payout-fees-capital_cost
        dao.append({'days':days,'annual_capital_cost':str(annual),'fees':str(fees),'gross_redemption_margin':str(redemption-payout),'capital_cost':str(capital_cost),'net':str(net)})
    assert any(F(r['net'])<0 for r in dao) and any(F(r['net'])>0 for r in dao)
    sorted_results=sorted(results,key=lambda r:F(r['pnl']))
    return {'classification':'SYNTHETIC stress inputs; actual DAO redemption amounts only are sourced from private chain. Not observed execution/returns.','scenarios':len(results),'losses':sum(F(r['pnl'])<0 for r in results),'inventory_exhaustion_cases':sum(r['inventory_failures']>0 for r in results),'worst':sorted_results[:5],'best':sorted_results[-5:],'matched_hedge_vs_replenish':{'hedged':hedged,'replenished':replenished},'dao_evidence':str(evidence.relative_to(root)),'dao_stress':dao,'limits':['Customer demand/depth/fees are synthetic','Professional RFQ can use the same strategies; no unique advantage is inferred','Marking claims at par is a scenario assumption, not executable liquidity','Reserved balances are obligations and reduce both deliverable inventory and equity','Transfer fee is paid in CKB; transaction/hedge fees modeled in USD; destination receipts do not replenish CEX USD cash','DAO maturity uses hypothetical elapsed-day costs; native epoch proof is separate']}

if __name__=='__main__':
    result=run();Path(__file__).with_name('portfolio-stress-results.json').write_text(json.dumps(result,indent=2)+'\n');print(result['scenarios'],'strategies; FIFO/MTM conservation, inventory/replenishment, fee/depth/delay and DAO capital-cost assertions PASS')

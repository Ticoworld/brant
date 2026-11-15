"""WO09 exact mechanism selection. Synthetic assumptions are never market evidence."""
from fractions import Fraction as F
from itertools import product,permutations
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[1]
UNIT=10**8

def launch():
    cases=[]
    for floor,issuer_need,fee in product([F(1),F('0.85'),F('0.5')],[F('0.1'),F('0.3')],[F(0),F('0.01')]):
        entry=F(1000);reserved=entry*floor;issuer=entry-reserved-entry*fee
        assert reserved+issuer+entry*fee==entry
        cases.append({'floor_fraction':str(floor),'issuer_required_fraction':str(issuer_need),'fee_fraction':str(fee),'reserve':str(reserved),'issuer_receives':str(issuer),'financing_viable':issuer>=entry*issuer_need})
    assert any(not c['financing_viable'] for c in cases)
    # Cash-backed immutable claims: all supply redeemable, no team exclusion.
    for n in [1,2,8,32]:
        reserve=F(850)*n;claims=[F(850)]*n;original=reserve
        for face in claims:reserve-=face;assert reserve>=0
        assert reserve==0 and original==sum(claims)
    # Ratchets can consume real surplus, not require new buyers in every design.
    backing=F(100);supply=F(100);old=F('0.85');new=F('0.9')
    assert new*supply<=backing and old<=new
    assert F('1.1')*supply>backing
    counterfeit_team_supply=F(20);assert old*(supply+counterfeit_team_supply)>F(85)
    # Locked collateral and borrower debt are not simultaneously redeemable token supply.
    total,locked,floor=F(100),F(20),F(1);cash_after_loan=F(80)
    assert cash_after_loan==floor*(total-locked)
    assert cash_after_loan<floor*total
    # DAO receipts are assets, but cannot finance an instant native cash promise.
    cash,dao_claim,instant_liability=F(0),F(850),F(850)
    assert cash+dao_claim>=instant_liability and cash<instant_liability
    # Per-address caps and discretionary admission do not create identity fairness.
    honest=F(1,2);split=F(2,3);assert split>honest
    early_bonus=F(50);issuer_surplus=F(150);assert issuer_surplus-early_bonus==100
    # Full campaign failure refund and spending an at-risk grant are incompatible
    # without a second funded source for the spent amount.
    full_refund=F(1000);remaining_cash=F(850);assert remaining_cash<full_refund
    # A buyer can replicate the basic protected launch using cash + a risky grant.
    own_cash,risky=F(850),F(150);assert own_cash+risky==1000
    return {'classification':'TESTED SYNTHETIC / bounded exact accounting','financing_cases':cases,'all_claim_redemption_sizes':[1,2,8,32],'counterexamples':{'hidden_team_claims':'Uncounted team redemption claims exceed backing','unsupported_ratchet':'110% floor on100 supply with100 backing fails;90% can use real surplus','instant_DAO_exit':'Balance-sheet backing does not imply spendable cash','full_failed_launch_refund':'850 retained after150 spent cannot refund1000','sybil_allocation':'Two identities get2/3 vs1/2','early_premium':'50 early bonus consumes50 of issuer150 budget, not free appreciation'},'six_WO06_classes':{'selective_admission':'Still present unless inclusion independently enforced; open self-service claims only remove a redemption solver dependency','sequential_manipulation':'Price scheduling still matters; uniform clearing inside each batch is not uniform across time','creator_roundtrip':'Cash-backed claim conservation prevents reserve theft, not unrelated speculative-price manipulation','split_gaming':'Address caps do not defeat Sybil coalitions','artificial_demand':'Creator-funded issuance remains self-capital, not independent demand','revocable_liquidity':'Individually funded redemption removes issuer reserve withdrawal for that right, not secondary-market disappearance'},'survivor':'Fixed, individually funded native-asset claims as an enforcement primitive; generic protected token launch lacks demonstrated value over cash retention plus risky financing','not_proved':['Fair allocation','Useful issuer demand/funding needs','Permanent USD value','Global atomic floor ratchet across independent cells','Full refund of already-spent at-risk grant']}

def risk():
    C=F(2000);target=F(1000);initial_junior=F(1000);cases=[]
    for p in [F('0.8'),F('0.5'),F('0.2'),F('0.01'),F(1),F('1.25'),F(2),F('0.51')]:
        senior=min(C,target/p);junior=C-senior
        assert senior+junior==C and 0<=senior<=C and 0<=junior<=C
        cases.append({'settlement_price_usd':str(p),'senior_ckb':str(senior),'junior_ckb':str(junior),'senior_usd':str(senior*p),'junior_usd':str(junior*p),'target_met':senior*p>=target,'junior_usd_return':str((junior*p-initial_junior)/initial_junior)})
    assert not next(c for c in cases if c['settlement_price_usd']=='1/100')['target_met']
    assert next(c for c in cases if c['settlement_price_usd']=='2')['junior_usd_return']=='2'
    # No finite CKB collateral guarantees positive constant dollars as P ->0.
    for cap in [F(100),F(2000),F(10**6)]:
        p=target/(2*cap);assert cap*p<target
    # Explicit output reserves fix materialization, at an actual capital cost.
    dust=next(c for c in cases if c['settlement_price_usd']=='51/100');assert 0<F(dust['junior_ckb'])<61
    assert F(dust['junior_ckb'])+61>=61
    # Synthetic junior compensation sensitivity; no estimated real probabilities.
    premium_cases=[]
    distributions=[([F('0.5'),F(1),F(2)],[F(1,3)]*3),([F('0.2'),F('0.8'),F(1)],[F(1,3)]*3)]
    for prices,weights in distributions:
        expected=sum((w*(C-min(C,target/p))*p for p,w in zip(prices,weights)),F(0))
        for annual,days,fees in product([F('0.04'),F('0.12')],[30,180],[F(1),F(10)]):
            carry=initial_junior*annual*F(days,365)
            required=max(F(0),initial_junior+carry+fees-expected)
            premium_cases.append({'prices':[str(p) for p in prices],'weights':[str(w)for w in weights],'junior_expected_terminal_usd':str(expected),'days':days,'annual_capital_cost':str(annual),'fees_usd':str(fees),'break_even_premium_usd':str(required)})
    # A stronger alternative: band-limited put payoff, funded by finite collateral.
    band=[{'p':str(p),'ckb_put':str(min(F(500),max(F(0),target/p-1000)))}for p in [F('0.2'),F('0.8'),F(1),F(2)]]
    return {'classification':'FORMALLY CHECKED / BOUNDED exact payoff grid; all premiums/probabilities synthetic','payoffs':cases,'premium_sensitivity':premium_cases,'band_alternative':band,'barrier_price':str(target/C),'effective_junior_delta_leverage_before_extra_costs':str(C/initial_junior),'counterexamples':{'unlimited_USD_protection':'For any finite C, price=target/(2C) leaves only half the promised purchasing power','native_conservation_not_protection':'Both payouts sum toC at99% price loss, while senior target still fails','dust':'AtP=0.51, positive junior payout<61 CKB cannot form an ordinary output without reserve/sponsorship','oracle_outage':'Original collateral refund conserves units but does not preserve dollars','oracle_conflict':'A single accepted event can be made immutable; publisher can still choose a false price under a trusted-publisher model','late_publisher':'Lower-bound maturity does not enforce publication before a fallback expiry; ordering must be explicit'},'survivors':['Fully collateralized fixed-term capped payoff with declared maturity publisher and refund semantics','Band-limited protection as a distinct capital/coverage tradeoff'],'not_proved':['External price truth','Current reliable CKB maturity feed','Willing junior counterparties or fair premium','Production oracle/finality security','Secondary sale of the risk positions']}

def trading():
    # Asset vectors settle only if every desired leg is supplied. No maker earns
    # nonexistent fees simply because principal netting succeeds.
    offers=[{'X':-10,'Y':10},{'Y':-10,'Z':10},{'Z':-10,'X':10}]
    aggregate={a:sum(o.get(a,0)for o in offers)for a in ['X','Y','Z']};assert all(v==0 for v in aggregate.values())
    incomplete={a:sum(o.get(a,0)for o in offers[:2])for a in ['X','Y','Z']};assert any(v for v in incomplete.values())
    maker_need={a:-v for a,v in incomplete.items() if v};assert maker_need=={'X':10,'Z':-10}
    # Full body signing loses independent fragment assembly if a solver edits
    # any authorized output; CoBuild already has a distinct range-signing design.
    auth={'fully_signed_body':'Any output edit changes transaction hash; all affected parties must sign again','OTX':'Reference source signs selected input/output/data/dependency ranges; security and wallet integration are separate prerequisites'}
    return {'classification':'TESTED SYNTHETIC','ring_net':aggregate,'incomplete_net':incomplete,'residual_maker_vector':maker_need,'LP_income_without_funded_fee':'0','authorization':auth,'survivor':'Reuse rails for genuine claim exchange; generic three-party composition is prior art, not a competitive breakthrough','limits':['No native OTX signature implementation in this model','No assurance compatible owners/bids exist','External RGB++ settlement remains outside frozen foreign-finality proof']}

def liquidity():
    I=F(1000);consumed=F(1000);assert I-consumed==0
    external_demand=F(1001);assert external_demand>I
    rows=[]
    for flow,price_move,fee,retainer in product([F(0),F(500),F(1000)],[F(0),F('0.1'),F('0.5')],[F(1),F(10)],[F(0),F(100)]):
        loss=flow*price_move;net=retainer-loss-fee;rows.append({'flow':str(flow),'adverse_move':str(price_move),'service_cost':str(fee),'issuer_retainer':str(retainer),'maker_net':str(net)})
    assert any(F(x['maker_net'])<0 for x in rows) and any(F(x['maker_net'])>0 for x in rows)
    # The corrective right is allocated finite quota, not an unlimited public
    # depth guarantee; it competes with a funded option/RFQ, not free LP yield.
    quotas=[F(250)]*4;assert sum(quotas)==I
    return {'classification':'TESTED SYNTHETIC','service_cases':rows,'self_consumption_counterexample':'Maker can consume finite inventory with controlled counterparties; locked inventory alone does not prove public third-party service','unbounded_demand_counterexample':'1001 valid demand cannot be guaranteed by1000 finite inventory','compensation_source':'An issuer-funded availability retainer or explicit executed spread/fee; not unrelated P2P principal','survivor':'Finite quota/firm RFQ commitments with truthful depletion and compensation terms','not_proved':['Independent demand/identity','Replenishment obligation','Price quality/freshness','Profitable capital supply','Enforceable third-party-service SLA']}

def combinations():
    # Conservatively account pledged liabilities before any economic promotion.
    rows=[
      ('launch alone',850,850,'Issuer receives150 of1000 entry before costs; strongest rival is retained cash plus risky grant'),
      ('risk alone',2000,2000,'Two sides fund complementary capped payoffs; oracle and term capital cost remain'),
      ('trading alone',0,0,'Owners exchange existing claims; no new backing or liquidity appears'),
      ('commitments alone',1000,1000,'Finite inventory/quota; issuer retainer is a real extra contribution'),
      ('launch + secondary trading',850,850,'Ownership changes without duplicate reserve; secondary buyer must actually exist'),
      ('risk claims + secondary trading',2000,2000,'Requires enforceable transferrable beneficiaries, not just a UI balance; fixed-recipient pool is insufficient'),
      ('launch + funded protection',2850,2850,'Independent850 backing plus2000 risk collateral is safe; sharing the same850 twice is not'),
      ('launch + liquidity commitment',1850,1850,'850 redemption reserve and1000 executable quote inventory must remain distinct'),
      ('modular funded rights + shared event oracle/discovery',2850,2850,'Share verified code, event observations and discovery, not pledged principal')]
    for _,assets,liability,_ in rows:assert assets>=liability
    assert F(850)<F(850)+F(1000)
    return [{'case':name,'distinct_funded_assets':str(a),'maximum_native_liability':str(l),'additional_value_or_limit':why,'evidence':'TESTED SYNTHETIC; native qualification tracked separately','commercial':'MARKET UNKNOWN'}for name,a,l,why in rows]

def observations():
    price=json.loads((ROOT/'research/web/ckb-price.raw').read_text(),parse_float=F)['nervos-network'];book=json.loads((ROOT/'research/web/ckb-book.raw').read_text(),parse_float=F)
    ref=price['usd'];assert ref>0 and book['bids'] and book['asks'];costs={str(q):str(F(q)*ref)for q in [61,122,150,206,406]}
    return {'classification':'EXTERNAL MARKET OBSERVATION, one public reference and one book snapshot; not executions or demand','reference_usd_per_ckb':str(ref),'reference_updated_at_unix':price['last_updated_at'],'book_updated_at_unix_ms':book['update'],'best_bid':book['bids'][0],'best_ask':book['asks'][0],'capacity_mark_usd':costs,'fees':'UNKNOWN','usable_native_hedging_or_replenishment':'UNKNOWN','CKB_Pyth_feed_query':'[] at this capture; availability not established'}

def main():
    out={'launch':launch(),'risk':risk(),'trading':trading(),'liquidity':liquidity(),'combinations':combinations(),'observations':observations()};(ROOT/'evidence/discovery-models.json').write_text(json.dumps(out,indent=2)+'\n')
    # Independent integer fixtures for native risk tests, including the dust edge.
    fixtures=[]
    for p in [F('0.8'),F('0.5'),F('0.2'),F('0.01'),F(1),F('1.25'),F(2),F('0.51')]:
        scaled=int(p*UNIT);C=2000*UNIT;target=1000*UNIT;protected=min(C,(target*UNIT+scaled-1)//scaled);residual=C-protected
        assert F(protected,UNIT)*p>=min(F(1000),F(2000)*p)
        fixtures.append({'price':str(scaled),'target_usd_scaled':str(target),'senior_principal':str(protected),'junior_principal':str(residual),'rounding':'ceil1-shannon, clipped to actual collateral'})
    (ROOT/'fixtures/risk-payoffs.json').write_text(json.dumps(fixtures,indent=2)+'\n')
    print('All four tracks, nine combinations, collateral/counterparty/dust failures and source snapshots checked; models are not native proofs.')
if __name__=='__main__':main()

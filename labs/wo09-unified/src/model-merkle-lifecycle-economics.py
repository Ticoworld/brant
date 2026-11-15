"""Exact Decimal cost scenarios; modeled economics are not native executions or prices."""
from decimal import Decimal as D
from pathlib import Path
import json
P=Path(__file__).resolve().parents[1]
prices=[D('0.00122'),D('.10'),D('1'),D('10')]
rows=[]
for n in [3,16,100,1000]:
    contribution=D('.125')*n;backing=contribution*D('.8');gross=contribution-backing
    # Existing ordinary wallet capacity is reusable. Contribution is already inside funded wallets.
    base=D(17889+322+61)
    entry_fees=D('.001')*((n+99)//100)
    market_fees=D('.001')+entry_fees+D('.0001')*(n+4) # creation .001; activation, partial, sale, n final settlements, closure
    for price in prices:
        rows.append(dict(n=n,usd_per_ckb=str(price),contribution_ckb=str(contribution),protected_ckb=str(backing),creator_gross_ckb=str(gross),cold_code_ckb='17889',vault_cushion_ckb='322',creator_retained_wallet_ckb='61',ordinary_wallet_floor_each_ckb='61',minimum_funding_excluding_fees_ckb=str(base+61*n+contribution),actual_test_wallets_ckb=str(100*n+100),modeled_market_fees_ckb=str(market_fees),cold_fixed_usd=str(base*price),protected_usd=str(backing*price),creator_gross_usd=str(gross*price),minimum_funding_excluding_fees_usd=str((base+61*n+contribution)*price)))
    assert backing+gross==contribution
# Native logs determine actual fees; modeled common workload must match completed large markets exactly.
native=json.loads((P/'evidence/merkle-configured-scale-1793671317288/independent-verification.json').read_text())
for m in native['markets']:
    expected=next(r for r in rows if r['n']==m['n'])
    assert D(m['market_fees_shannons'])/100000000==D(expected['modeled_market_fees_ckb'])
claims=[]
for position in [D('.1'),D('1'),D('5'),D('20')]:
 for price in prices:
    claims.append(dict(position_ckb=str(position),usd_per_ckb=str(price),position_usd=str(position*price),retained_wallet_floor_usd=str(61*price),one_redemption_fee_ckb='.0001',one_redemption_fee_usd=str(D('.0001')*price),redemption_fee_fraction=str(D('.0001')/position)))
out={'classification':'EXACT_ARITHMETIC_MODELED_SCENARIOS_WITH_NATIVE_FEE_CROSSCHECK','assumptions':['No real market prices','Cold fixed includes code, vault cushion and creator retained wallet','Actual 100 CKB wallet already contains contribution: never add both actual wallet balance and contribution','61 CKB is plain secp Cell floor; fees and contribution require additional initial capacity','Code deployment fixture has an unspendable lock; not automatically recoverable','Vault cushion recoverable only after every claim is settled','Operator, LP, archive, wallet-service and opportunity costs are unpriced; not zero'], 'markets':rows,'small_positions':claims}
(P/'evidence/merkle-lifecycle-economics.json').write_text(json.dumps(out,indent=2)+'\n')
print('verified native fee equations; wrote exact scenario tables')

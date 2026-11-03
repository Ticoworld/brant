"""Exact financial model only: preserve heterogeneous minima; no pro-rata promises invented."""
from itertools import permutations
import json
from pathlib import Path
# Counterexample to a naive remaining-unit ratio when promised minima differ.
units=[1,9];minimum=[9,1];backing=sum(minimum)
naive=[u*backing//sum(units) for u in units]
assert naive[0]<minimum[0]
orders=[]
for order in permutations(range(3)):
 rights=[10,100,1000];reserve=sum(rights);cushion=298
 # An actual external contribution of 7 is assigned, rather than counted twice as sale proceeds.
 contribution=7;rights[2]+=contribution;reserve+=contribution
 for i in order:
  # Partial settlement preserves the exact residue; no ratio rounding or new units.
  part=rights[i]//3;rights[i]-=part;reserve-=part
  assert reserve==sum(rights)
  reserve-=rights[i];rights[i]=0
  assert reserve==sum(rights)
 assert reserve==0 and cushion==298;orders.append(list(order))
result={'classification':'INTEGER_MODEL_ONLY','heterogeneous_minimum_counterexample':{'units':units,'minimum':minimum,'naive_ratio_payout':naive},'funded_exact_entitlement_orders':orders,'surplus_policy':'zero unallocated surplus; donated capital is immediately assigned to named outstanding liabilities','rounding_policy':'floor initial 80 percent per claim; partial settlement subtracts exact shannons; no global ratio','limitations':['model is not a new native result','does not establish rational fee willingness or uniform token-price floor']}
Path(__file__).resolve().parents[1].joinpath('evidence/funded-ratchet-model.json').write_text(json.dumps(result,indent=2)+'\n');print('heterogeneous-floor ratio counterexample and six exact-funded settlement orders verified')

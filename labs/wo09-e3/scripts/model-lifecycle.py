"""Exact Decimal scenario accounting; explicit assumptions, not market quotes or measured full costs."""
from decimal import Decimal as D, getcontext
import json, pathlib
getcontext().prec = 40
root = pathlib.Path(__file__).resolve().parents[1]
rows=[]
for principal in map(D,['0.1','1','5','20']):
 for price in map(D,['0.10','1','10']):
  wallet=D(61) # derived plain-secp floor; tested fixtures used 100 CKB
  pool=D(500)/D(1000) # scenario: pool split among 1,000 rights
  entry=D('0.0001') # illustrative, NOT a measured issuance fee
  exit=D('0.0001') # VM measured 10,000-shannon fee choice
  checkpoint=D('0.001')*D(4)/D(1000) # scenario uses four 100k-shannon checkpoint fees
  fees=entry+exit+checkpoint
  funding=principal+wallet+pool
  reserve=principal*D('0.8')
  creator_gross=principal-reserve
  assert reserve+creator_gross==principal
  assert funding==principal+wallet+pool
  rows.append({
   'principal_ckb':str(principal),'hypothetical_usd_per_ckb':str(price),
   'principal_usd':str(principal*price),'reusable_wallet_capacity_ckb':str(wallet),
   'wallet_capacity_usd':str(wallet*price),'shared_pool_allocation_ckb':str(pool),
   'modeled_lifecycle_fees_ckb':str(fees),'modeled_lifecycle_fees_usd':str(fees*price),
   'gross_principal_plus_capacity_ckb':str(funding),'gross_plus_modeled_fees_usd':str((funding+fees)*price),
   'exit_fee_usd':str(exit*price),'exit_fee_fraction_of_principal':str(exit/principal),
   'cap_fee_fraction_of_principal':str(D('.01')/principal),
   'dedicated_wallet_30day_cost_at_5pct_ckb':str(wallet*D('.05')*D(30)/D(365)),
   'illustrative_protected_floor_ckb':str(reserve),'illustrative_creator_gross_spendable_ckb':str(creator_gross),
  })
output={'classification':'ANALYTICAL_SCENARIO_NOT_FULL_MEASURED_LIFECYCLE',
 'assumptions':{'holders':1000,'checkpoints':4,'anchor_ckb':500,'code_cell_minimum_ckb_derived':118225,'code_allocation':'118225 / total beneficiaries across reused deployments; not included in gross scenario totals','entry_fee':'illustrative 10000 shannons','exit_fee':'VM fee choice 10000 shannons, relay untested','checkpoint_fee':'100000 shannons per batch scenario from prior fixtures','wallet':'61 CKB derived minimum, 100 CKB was tested','price':'hypothetical only'},
 'unmeasured':['proof generation and prover hardware','node archival storage and availability','entry/issuance native transaction fee','channel route fees and liquidity capital','LP spreads and refusal risk','capital interest and demand','contract/code publication funding allocation','commercial oracle or fixed-term observation cost'], 'rows':rows}
(root/'evidence/lifecycle-cost-scenario.json').write_text(json.dumps(output,indent=2)+'\n')
print('12 price/position scenarios; capital and reserve identities checked; unmeasured lifecycle costs explicit')

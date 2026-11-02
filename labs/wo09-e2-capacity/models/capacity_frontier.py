"""Exact CKB storage/exit frontier; execution fees are measured or left UNKNOWN."""
from fractions import Fraction as F
from pathlib import Path
from itertools import product
import json
R=Path(__file__).resolve().parents[1];U=100_000_000
# Existing rebuilt common.occupied: 8+33+lockargs+optional(33+typeargs)+data bytes.
profiles=[
 {'id':'normal_wallet','bytes':61,'purpose':'standard secp wallet','reused_by_trade':True},
 {'id':'xudt_cell','bytes':130,'purpose':'secp20 lock + xUDT type20 +16-byte amount','reused_by_trade':True},
 {'id':'WO09_E1_claim','bytes':150,'purpose':'secp20 lock + type32 +24-byte claim data','reused_by_trade':False},
 {'id':'WO09_E1_maturity_event','bytes':206,'purpose':'secp20 lock + type32 +80-byte event','reused_by_trade':False},
]
for x in profiles:x['occupied_ckb']=str(x['bytes']);x['capital_usd']={str(p):str(F(x['bytes'])*F(p))for p in ['0.00122','0.1','1','10','100']}
scales=[]
for n in [1,16,32,100,1000]:
 for shard_count in [1,4,16,32,100]:
  shards=min(n,shard_count);root_bytes=61+32+((n+7)//8) # root plus a redemption bitmap (not proof data)
  nullifiers=n*61
  scales.append({'participants':n,'root_shards':shards,'root_plus_dense_bitmap_total_ckb':root_bytes*shards,'separate_nullifier_ckb':nullifiers,'all_users_state_ckb':root_bytes*shards+nullifiers,'marginal_per_user_ckb_asymptotic':'61 nullifier bytes*capacity per participant','concurrency':'one spender per shard/root; simultaneous requests conflict within a shard','root_only_security':'Insufficient to prevent repeat claims unless each exit changes a live root or consumes a one-time nullifier'})
outputs=[]
for x in ['0.01','0.1','1','5','50']:
 outputs.append({'payout_ckb':x,'minimum_plain_secp_output_ckb':'61','standalone_shortfall_ckb':str(max(F(0),F(61)-F(x))),'with_existing_recipient_cell':'Increase recipient cell capacity/data-consistent output; no additional output Cell if script accepts exact existing format','without_existing_recipient_cell':'Someone funds >=61 CKB occupied output; capacity is reusable by recipient, but unavailable to sponsor unless separately repaid','ACP':'May permit receiver-side no-signature cell reuse under exact published script rules; script, prefix, change, fee and custody behavior must be validated per integration','proof':'Derived from inherited occupied-capacity function; ACP and sub-61 CKB L1 principal delivery not demonstrated here'})
# A fully matched bilateral spot swap can replace two wallets + two asset Cells one-for-one.
trade={'inputs':4,'outputs':4,'existing_wallet_cells':2,'existing_xudt_cells':2,'new_persistent_cells':0,'net_exchange_specific_capacity_delta_ckb':0,'ordinary_minimum_capacity_reused_ckb':2*61+2*130,'condition':'Both users already own compatible funded wallets and xUDT Cells; exact full-body signatures; unchanged Cell inventory/cardinality','unavoidable_costs':['transaction fee','CKB VM script cycles','wallet input availability','xUDT delivery capacity130 per recipient Cell','off-chain order discovery/indexing','liquidity/opportunity cost'],'no_extra_order_cell':'An unsigned/signed off-chain intention is not live/reserved collateral; stale inputs can make it unfillable. No fill guarantee until transaction confirms.'}
out={'classification':'DERIVED exact byte-capacity arithmetic + hypotheses; no user balances or fees are synthetic execution records','capacity_profiles':profiles,'participant_and_shard_grid':scales,'tiny_l1_exit':outputs,'wallet_reuse_trade':trade,'lifecycle_unknowns':['network inclusion delay','production fee rate','proof generation/indexing costs','wallet support','recipient Cell reuse for arbitrary locks'], 'forks':{'if_root_only':'duplicate redemption possible or state never changes; enforce nullifier/depletion','else_if_separate_nullifier':'61 CKB marginal nullifier shifts the per-user Cell instead of eliminating state','what_if_static_commitment':'No balance mutation means the same immutable leaf cannot safely pay repeatedly without a consumed shared root/nullifier or one-shot independent UTXO right','what_if_channels':'Tiny repeated payments may stay off chain, but collateral/liquidity/counterparty/channel-open/close costs and unilateral state exit remain'} }
(R/'evidence/capacity-frontier.json').write_text(json.dumps(out,indent=2)+'\n');print(f"profiles={len(profiles)}; participant-grid={len(scales)}; micro-payouts={len(outputs)}; state-free balanced-swap persistent delta=0 under stated reuse assumptions")

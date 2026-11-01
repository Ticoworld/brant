"""Minimal stateful launch architecture counterexamples, synthetic exact arithmetic."""
from fractions import Fraction as F
from dataclasses import dataclass
from itertools import product
from pathlib import Path
import json

@dataclass
class ReservePool:
    reserve: F = F(100)
    inventory: F = F(100)
    def buy(self,tokens):
        assert 0<tokens<self.inventory
        cost=self.reserve*tokens/(self.inventory-tokens)
        self.reserve+=cost;self.inventory-=tokens;return cost
    def sell(self,tokens):
        assert tokens>0
        payout=self.reserve*tokens/(self.inventory+tokens)
        self.reserve-=payout;self.inventory+=tokens;return payout

def auction(bids,admitted):
    accepted=[(price,who) for who,price in bids.items() if who in admitted]
    return max(accepted) if accepted else None

def allocation(budget,identities):
    total=sum(identities.values());return {who:F(budget)*n/total for who,n in identities.items()}

def run():
    out={};bids={'customer':F(12),'creator':F(8)}
    fair=auction(bids,set(bids));excluded=auction(bids,{'creator'});assert fair!=excluded
    out['selective_admission']={'all':str(fair),'selected':str(excluded),'limitation':'Uniform price does not force solver inclusion.'}
    a=ReservePool();first=a.buy(F(10));second=a.buy(F(10));assert first<second
    out['sequential_auction']={'first_cost':str(first),'second_cost':str(second),'limitation':'Order determines execution price even in a solvent reserve-backed pool.'}
    p=ReservePool();creator_cost=p.buy(F(10));customer_cost=p.buy(F(10));creator_return=p.sell(F(10));profit=creator_return-creator_cost;assert profit>0
    assert p.reserve==100+customer_cost-profit
    out['creator_roundtrip']={'profit':str(profit),'customer_paid':str(customer_cost),'remaining_reserve':str(p.reserve),'limitation':'Reserve conservation is not fair price discovery; cross-batch extraction remains possible.'}
    search=[]
    for honest,sybils,budget in product([1,2,5],[1,2,4],[10,100]):
        unsplit=allocation(budget,{'creator':1,'honest':honest})['creator'];split=allocation(budget,{'creator':sybils,'honest':honest})['creator']
        assert split>=unsplit
        search.append({'honest':honest,'sybils':sybils,'budget':budget,'gain':str(split-unsplit)})
    assert any(F(x['gain'])>0 for x in search)
    out['split_search']={'cases':search,'limitation':'Equal per-address allocation rewards additional identities without Sybil resistance.'}
    creator=F(90);external=F(10);treasury=creator+external
    out['artificial_demand']={'gross_threshold':str(treasury),'net_external':str(external),'creator_can_recycle':str(creator)};assert treasury>=100 and external<100
    p=ReservePool();withdrawn=p.reserve;p.reserve-=withdrawn
    out['revocable_liquidity']={'withdrawn':str(withdrawn),'remaining':str(p.reserve),'limitation':'LP withdrawal authorization defeats lasting post-launch depth.'};assert p.reserve==0
    # Compare a materially different guarantee, not a new launchpad product.
    floor_reserve=F(100);redeemable_claims=F(100);floor=F(1)
    assert floor_reserve>=floor*redeemable_claims
    insolvency_after_owner_withdraw=floor_reserve-F(1)<floor*redeemable_claims
    assert insolvency_after_owner_withdraw
    out['reserve_backed_alternative']={'predicate':'reserve >= floor * outstanding claims; operator withdrawals must preserve it','observations':'Solvency is distinct from fairness, fee coverage, market depth and demand. Transferable claims need authentic mint/burn and native proof.','native_proof':'UNIMPLEMENTED','minimal_counterexample':'One reserve unit withdrawn without burning a claim violates full floor backing.'}
    return {'scope':'Exact stateful synthetic counterexamples; reconstructed mechanisms, not old file identity or a validated launchpad','architectures':['reserve-backed constant-product launch pool','selective uniform auction','equal-identity allocation','gross-demand graduation','revocable LP reserve','reserve-floor solvency alternative'],'results':out}
if __name__=='__main__':
    result=run();Path(__file__).with_name('launch-architecture-results.json').write_text(json.dumps(result,indent=2)+'\n');print('stateful launch architectures and split parameter search PASS')

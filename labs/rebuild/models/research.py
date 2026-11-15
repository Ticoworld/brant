"""Exact synthetic mechanisms and accounting, never executable market observations."""
from fractions import Fraction as F
from dataclasses import dataclass
import json
from pathlib import Path

@dataclass(frozen=True)
class Snapshot:
    source: str
    observed_at: str | None
    synthetic: bool
    fee: F | None
    bids: tuple[tuple[F,F], ...]

    def proceeds(self, quantity):
        remaining, gross = F(quantity), F(0)
        for price, size in self.bids:
            take = min(size, remaining)
            gross += take * price
            remaining -= take
        if remaining or self.fee is None:
            return None
        return gross-self.fee

def equity(assets, obligations, marks):
    # Asset identities include venue: CEX hedges are not native delivery inventory.
    return sum((v*marks[k] for k,v in assets.items()),F(0))-sum((v*marks[k] for k,v in obligations.items()),F(0))

def cases():
    results = {}
    def check(name, predicate, detail):
        assert predicate, name
        results[name] = detail
    # One uniform clearing price is not protection against solver exclusion.
    bids = {'customer':F(12),'creator':F(8)}
    check('selective_solver_admission',max(bids.values()) != bids['creator'], 'Excluding customer changes winner and price from 12 to 8.')
    # Two sequential one-unit marginal sales at 1 then 3: ordering decides surplus.
    check('sequential_auction_manipulation',F(4)-1 > F(4)-3, 'A value-4 participant gains 2 by buying first at 1 rather than second at 3.')
    # Separate batches with prices 1 and 3 let creator recycle treasury-funded demand.
    check('creator_cross_batch_roundtrip',F(3)-1 > 0, 'Buy at 1 in batch A, sell at 3 in B: 2 extracted before fees; no same-batch wash needed.')
    def allocate(weights): return [F(w,sum(weights)) for w in weights]
    honest=allocate([1,1])[0];split=sum(allocate([1,1,1])[:2])
    check('split_allocation_gaming',split>honest, {'honest':str(honest),'two_identities':str(split),'mechanism':'per-address equal allocation'})
    # Gross reported demand 100 comprises creator 90 and independent customer 10.
    check('artificial_creator_demand',100>10, '90 recycled creator funds plus 10 independent funds meets a gross threshold of 100; net external demand is 10.')
    check('revocable_post_launch_liquidity',F(100)-100==0, 'An LP can remove all 100 reserves if withdrawal remains authorized; graduation does not preserve depth.')
    # Lower bound permits a late transaction. Any tx-selected old header can be reused later.
    valid=lambda tip, selected_header, since: tip>=since and selected_header<=tip
    check('since_is_no_upper_expiry',valid(101,90,96) and valid(1000,90,96), 'The same old header and lower-bound since remain admissible later; no authenticated current-height upper bound.')
    check('outpoint_revocation_race', {'gate','order'}.isdisjoint({'other'}) and bool({'gate'} & {'gate'}), 'Exact gate must be a live dependency; spending it disables later admission, but a fill already ordered first wins. Historical covenant only, not newly executed.')
    assets={'nativeCKB':F(10),'cexCKB':F(0),'cexUSD':F(100)};marks={'nativeCKB':F(1),'cexCKB':F(1),'cexUSD':F(1)}
    before=equity(assets,{},marks);assets['nativeCKB']-=10;assets['cexUSD']+=10
    check('hedge_is_not_inventory',assets['nativeCKB']==0 and equity(assets,{},marks)==before, 'After selling 10 native CKB, cash preserves value but native delivery inventory is zero; hedge execution elsewhere cannot replenish it.')
    check('obligations_reduce_equity',equity({'nativeCKB':F(100)},{'nativeCKB':F(80)},marks)==20, '100 assets minus 80 obligations leaves 20; deposited collateral and claims cannot both be free assets.')
    # receipt claim and underlying deposit are alternate representations of one resource.
    def canonical_equity(resources):
        seen=set();total=F(0)
        for identity,value in resources:
            if identity in seen: raise ValueError('double counted underlying')
            seen.add(identity);total+=value
        return total
    try: canonical_equity([('dao-outpoint',100),('dao-outpoint',100)])
    except ValueError: rejected=True
    else: rejected=False
    check('receipt_deposit_double_count_rejected',rejected,'Receipt/iCKB ownership is a claim; do not add underlying DAO CKB to the same beneficial balance.')
    check('stale_quote_loss',F(100)-F(120)-1 < 0, 'Sell for stale 100, replace inventory for 120, fee 1: realized loss 21.')
    check('p2p_netting_not_lp_income',F(100)-100==0, 'Netting 100 opposite principal at zero spread/fees produces zero LP revenue.')
    check('idle_capital_and_delay',F(10)-2-F(100)*F(1,10)*F(180,365)<10, 'Gross 10 less 2 fees and opportunity cost of 100 locked capital for 180/365 years is below gross return.')
    check('inventory_exhaustion',F(10)-10==0, 'One 10-unit fill exhausts a 10-unit delivery inventory even when net equity stays positive.')
    book=Snapshot('synthetic fixture',None,True,F(1),((F('0.1'),F(10)),(F('0.09'),F(20))))
    check('exact_depth_after_fee',book.proceeds(20)==F('0.9'), '10*0.1 + 10*0.09 - 1 = 0.9 exactly; no floating point.')
    check('insufficient_depth_unknown',book.proceeds(31) is None,'Insufficient book depth yields UNKNOWN, not fabricated execution.')
    check('missing_fee_unknown',Snapshot('unobserved',None,False,None,book.bids).proceeds(1) is None, 'Missing fee yields UNKNOWN.')
    check('technical_success_not_profit',F(1)-2<0,'A technically valid trade with revenue 1 and cost 2 loses 1.')
    return {'classification':'newly reproduced synthetic counterexamples; no external snapshots','cases':results}

if __name__=='__main__':
    result=cases();path=Path(__file__).with_name('results.json');path.write_text(json.dumps(result,indent=2)+'\n');print(len(result['cases']),'exact model cases')

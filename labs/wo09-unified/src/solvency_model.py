"""Executable exact-integer financial specification. No cryptographic or CKB execution claim."""
from dataclasses import dataclass, replace
from fractions import Fraction
from itertools import permutations
import json
from pathlib import Path

@dataclass(frozen=True)
class Right:
    owner: str
    backing: int

@dataclass(frozen=True)
class Market:
    rights: tuple
    capacity: int
    cushion: int
    cushion_owner: str
    creator_proceeds: int
    closed: bool = False

    def check(self):
        assert all(r.backing >= 0 for r in self.rights)
        assert self.capacity == self.cushion + sum(r.backing for r in self.rights)
        assert self.cushion >= 0
        assert not self.closed or self.capacity == 0

    @classmethod
    def enroll(cls, payments, protection, cushion, creator, signatures):
        assert 0 <= protection <= 1 and cushion >= 0
        assert all(owner in signatures and paid > 0 for owner, paid in payments)
        rights = tuple(Right(o, int(p * protection)) for o, p in payments)
        protected = sum(r.backing for r in rights)
        m = cls(rights, cushion + protected, cushion, creator, sum(p for _, p in payments)-protected)
        m.check()
        return m

    def redeem(self, index, amount, signatures):
        assert not self.closed
        r = self.rights[index]
        assert r.owner in signatures and 0 < amount <= r.backing
        rr=list(self.rights); rr[index]=replace(r,backing=r.backing-amount)
        m=replace(self,rights=tuple(rr),capacity=self.capacity-amount); m.check()
        return m, (r.owner, amount)

    def sell(self, index, buyer, price, buyer_input, seller_received, signatures):
        assert not self.closed
        r=self.rights[index]
        assert r.backing>0 and r.owner in signatures and buyer in signatures
        assert buyer != r.owner and price>0 and buyer_input>=price and seller_received==price
        rr=list(self.rights);rr[index]=replace(r,owner=buyer)
        m=replace(self,rights=tuple(rr));m.check();return m

    def topup(self, additions, funded_input):
        assert not self.closed and len(additions)==len(self.rights)
        assert all(a>=0 for a in additions) and sum(additions)==funded_input
        # Closed/redeemed rights cannot manufacture new entitlements through a floor ratchet.
        assert all(a==0 or r.backing>0 for r,a in zip(self.rights,additions))
        m=replace(self,rights=tuple(replace(r,backing=r.backing+a) for r,a in zip(self.rights,additions)),capacity=self.capacity+funded_input)
        m.check();return m

    def close(self):
        assert not self.closed and all(r.backing==0 for r in self.rights)
        m=replace(self,capacity=0,cushion=0,closed=True);m.check()
        return m,(self.cushion_owner,self.cushion)

def rejected(fn):
    try:fn()
    except AssertionError:return True
    raise AssertionError('invalid model operation unexpectedly accepted')

def main():
    unit=100_000_000
    payments=[('Alice',unit//10),('Bob',unit),('Carol',20*unit)]
    m=Market.enroll(payments,Fraction(4,5),500*unit,'Creator',{'Alice','Bob','Carol'})
    assert m.creator_proceeds==422_000_000
    cases=[]
    for order in permutations(range(3)):
        st=m
        for i in order:
            old=st;st,pay=st.redeem(i,st.rights[i].backing,{st.rights[i].owner})
            assert all(st.rights[j]==old.rights[j] for j in range(3) if j!=i)
        st,pay=st.close();assert pay==('Creator',500*unit);cases.append(list(order))
    st,_=m.redeem(0,1,{'Alice'})
    st=st.sell(0,'Dana',7,100,7,{'Alice','Dana'})
    rejected(lambda:st.redeem(0,1,{'Alice'}))
    st,pay=st.redeem(0,st.rights[0].backing,{'Dana'});assert pay[0]=='Dana'
    neg={
      'unfunded_ratchet':lambda:m.topup([1,2,3],0),
      'early_closure':lambda:m.close(),
      'owner_missing':lambda:m.redeem(0,1,{'Bob'}),
      'excess_redemption':lambda:m.redeem(0,m.rights[0].backing+1,{'Alice'}),
      'unpaid_sale':lambda:m.sell(0,'Dana',7,100,0,{'Alice','Dana'}),
      'unsigned_sale':lambda:m.sell(0,'Dana',7,100,7,{'Dana'}),
      'resurrect_redeemed_claim':lambda:st.topup([1,0,0],1),
      'duplicate_redemption':lambda:st.redeem(0,1,{'Dana'}),
    }
    for fn in neg.values():rejected(fn)
    funded=m.topup([1,2,3],6);assert funded.capacity==m.capacity+6
    # Rounding counterexample: per-right floors must be summed, not floor(sum contributions * ratio).
    rounded=Market.enroll([('A',1),('B',1),('C',1)],Fraction(4,5),1,'Creator',{'A','B','C'})
    assert sum(r.backing for r in rounded.rights)==0 and int(3*Fraction(4,5))==2
    report={'classification':'EXECUTABLE_INTEGER_MODEL_ONLY','orders':cases,'negative_model_cases':list(neg),'creator_gross_proceeds_shannons':m.creator_proceeds,'protected_total_shannons':sum(r.backing for r in m.rights),'rounding_counterexample':{'sum_individual_floors':0,'floor_aggregate':2},'limitations':['signatures are modeled membership, not cryptography','payments are model constraints, not real asset transfers','no on-chain covenant or public-history proof validated']}
    p=Path(__file__).resolve().parents[1]/'evidence/solvency-model.json';p.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()

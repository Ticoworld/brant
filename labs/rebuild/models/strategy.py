"""Exact cross-venue inventory accounting. Synthetic scenarios only."""
from fractions import Fraction as F
from dataclasses import dataclass, field
import json
from pathlib import Path

@dataclass
class Ledger:
    balances: dict[str,F]
    obligations: dict[str,F] = field(default_factory=dict)
    transit: dict[str,F] = field(default_factory=dict)
    fees: F = F(0)
    def deliver(self, asset, amount, payment, revenue, fee):
        if self.balances.get(asset,F(0))-self.obligations.get(asset,F(0))<amount:
            raise ValueError('delivery inventory exhausted or reserved')
        if fee is None: raise ValueError('unknown execution cost')
        self.balances[asset]-=amount
        self.balances[payment]=self.balances.get(payment,F(0))+revenue-fee
        self.fees+=fee
    def transfer_start(self, asset, amount, destination, fee):
        if self.balances[asset]<amount+fee: raise ValueError('insufficient source')
        self.balances[asset]-=amount+fee
        self.transit[destination]=self.transit.get(destination,F(0))+amount
    def transfer_complete(self, destination):
        self.balances[destination]=self.balances.get(destination,F(0))+self.transit.pop(destination)
    def equity(self, marks):
        return sum((q*marks[k] for k,q in self.balances.items()),F(0))+sum((q*marks[k] for k,q in self.transit.items()),F(0))-sum((q*marks[k] for k,q in self.obligations.items()),F(0))

def load_snapshot(file):
    obj=json.loads(Path(file).read_text(),parse_float=F)
    if not obj.get('source') or 'synthetic' not in obj: raise ValueError('provenance required')
    if not obj['synthetic'] and not obj.get('observed_at'): raise ValueError('observation timestamp required')
    obj['bids']=[(F(str(p)),F(str(q))) for p,q in obj['bids']]
    obj['fee']=None if obj.get('fee') is None else F(str(obj['fee']))
    if any(p<=0 or q<=0 for p,q in obj['bids']): raise ValueError('invalid depth')
    if obj['bids']!=sorted(obj['bids'],reverse=True): raise ValueError('unsorted bids')
    return obj

def run():
    marks={'nativeCKB':F(1),'cexCKB':F(1),'cexUSD':F(1),'daoClaim':F(1)}
    results=[]
    for spread,replacement,fee in [(F(1),F(1),F(1)),(F('1.01'),F('1.2'),F(1)),(F('1.02'),F(1),F(1))]:
        ledger=Ledger({'nativeCKB':F(100),'cexUSD':F(200)})
        start=ledger.equity(marks)
        ledger.deliver('nativeCKB',F(100),'cexUSD',100*spread,fee)
        # Buying an offsetting CEX asset hedges price, but native inventory remains zero.
        ledger.balances['cexUSD']-=100*replacement
        ledger.balances['cexCKB']=F(100)
        assert ledger.balances['nativeCKB']==0
        try: ledger.deliver('nativeCKB',F(1),'cexUSD',F(1),F(0))
        except ValueError: pass
        else: raise AssertionError('hedge incorrectly allowed native delivery')
        assert ledger.equity(marks)-start==100*(spread-replacement)-fee
        results.append({'spread':str(spread),'replacement':str(replacement),'profit_at_fixture_marks':str(ledger.equity(marks)-start),'native_inventory':'0'})
    ledger=Ledger({'cexCKB':F(100),'nativeCKB':F(0),'cexUSD':F(0)})
    ledger.transfer_start('cexCKB',F(99),'nativeCKB',F(1))
    assert ledger.equity(marks)==99 and ledger.balances['nativeCKB']==0
    ledger.transfer_complete('nativeCKB')
    assert ledger.balances['nativeCKB']==99 and ledger.equity(marks)==99
    reserved=Ledger({'nativeCKB':F(100)},{'nativeCKB':F(80)})
    try: reserved.deliver('nativeCKB',F(21),'cexUSD',F(21),F(0))
    except ValueError: pass
    else: raise AssertionError('reserved principal double spent')
    assert reserved.equity(marks)==20
    # A DAO claim is encumbered/unavailable until redemption, even at par mark.
    locked=Ledger({'daoClaim':F(100),'nativeCKB':F(0)})
    assert locked.equity(marks)==100 and locked.balances['nativeCKB']==0
    return {'classification':'SYNTHETIC; no observed prices, fees, demand or competitive returns','strategies':results,'transfer_fee_loss':'1','reserved_equity':'20','dao_liquid_inventory':'0'}

if __name__=='__main__':
    Path(__file__).with_name('strategy-results.json').write_text(json.dumps(run(),indent=2)+'\n')
    print('strategy and conservation scenarios passed')

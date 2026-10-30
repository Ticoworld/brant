"""Strict, fail-closed Capella/mainnet finalized-only light-client subset.

No optimistic/force updates. Checkpoint trust is external; this is not a
weak-subjectivity oracle. Unsupported forks must never silently reuse indices.
"""
import copy
import hashlib
import json
from pathlib import Path
from py_ecc.bls import G2ProofOfPossession as BLS

ROOT = Path(__file__).resolve().parents[1]
GENESIS = '4b363db94e286120d76eb905340fdd4e54bfe9f06bf33ff6cf5ad27f511bfe95'
CHECKPOINT = '5afc212a7924789b2bc86acad3ab3a6ffb1f6e97253ea50bee7f4f51422c9275'
ZERO = bytes(32)

def require(ok, reason):
    if not ok:
        raise ValueError(reason)

def hx(s, size=None):
    require(isinstance(s, str) and s.startswith('0x'), 'hex encoding')
    b = bytes.fromhex(s[2:])
    require(size is None or len(b) == size, 'hex length')
    return b

def uint(n, size=8):
    n = int(n)
    require(0 <= n < 2**(8*size), 'integer range')
    return n.to_bytes(size, 'little').ljust(32, b'\0')

def H(b):
    return hashlib.sha256(b).digest()

def tree(leaves, limit=None):
    n = limit or len(leaves)
    require(0 < n and len(leaves) <= n, 'merkle limit')
    width = 1 << (n-1).bit_length()
    layer = list(leaves) + [ZERO] * (width-len(leaves))
    require(all(len(x) == 32 for x in layer), 'merkle chunks')
    while len(layer) > 1:
        layer = [H(layer[i]+layer[i+1]) for i in range(0,len(layer),2)]
    return layer[0]

def vector(b):
    return tree([b[i:i+32].ljust(32,b'\0') for i in range(0,len(b),32)])

def beacon(b):
    return tree([uint(b['slot']),uint(b['proposer_index']),hx(b['parent_root'],32),
                 hx(b['state_root'],32),hx(b['body_root'],32)])

def execution_chunks(e):
    extra = hx(e['extra_data'])
    require(len(extra) <= 32, 'extra_data bound')
    return [hx(e['parent_hash'],32),hx(e['fee_recipient'],20).ljust(32,b'\0'),
        hx(e['state_root'],32),hx(e['receipts_root'],32),vector(hx(e['logs_bloom'],256)),
        hx(e['prev_randao'],32),uint(e['block_number']),uint(e['gas_limit']),
        uint(e['gas_used']),uint(e['timestamp']),H(extra.ljust(32,b'\0')+uint(len(extra))),
        uint(e['base_fee_per_gas'],32),hx(e['block_hash'],32),
        hx(e['transactions_root'],32),hx(e['withdrawals_root'],32)]

def execution(e):
    return tree(execution_chunks(e))

def committee(c):
    require(len(c['pubkeys']) == 512, 'committee size')
    return tree([tree([vector(hx(k,48)) for k in c['pubkeys']]),
                 vector(hx(c['aggregate_pubkey'],48))])

def branch(leaf, nodes, index, root):
    require(len(nodes) == index.bit_length()-1, 'branch depth')
    for s in nodes:
        v = hx(s,32)
        leaf = H(v+leaf) if index & 1 else H(leaf+v)
        index >>= 1
    require(index == 1 and leaf == root, 'merkle branch')

def header(h):
    slot = int(h['beacon']['slot'])
    require(194048*32 <= slot < 269568*32, 'unsupported fork')
    branch(execution(h['execution']),h['execution_branch'],25,hx(h['beacon']['body_root'],32))
    return beacon(h['beacon'])

def signing_root(b, genesis=GENESIS):
    # Capella DOMAIN_SYNC_COMMITTEE; fork selected at signature_slot - 1.
    fork_data = tree([bytes.fromhex('03000000').ljust(32,b'\0'),bytes.fromhex(genesis)])
    domain = bytes.fromhex('07000000') + fork_data[:28]
    return tree([beacon(b),domain])

class Store:
    def __init__(self, bootstrap, checkpoint=CHECKPOINT, genesis=GENESIS):
        self.genesis = genesis
        root = header(bootstrap['header'])
        require(root == bytes.fromhex(checkpoint), 'trusted checkpoint')
        branch(committee(bootstrap['current_sync_committee']),
               bootstrap['current_sync_committee_branch'],54,
               hx(bootstrap['header']['beacon']['state_root'],32))
        self.finalized = copy.deepcopy(bootstrap['header'])
        self.current = copy.deepcopy(bootstrap['current_sync_committee'])
        self.next = None
        self.last_signature = 0

    def update(self, u, current_slot):
        # Validate atomically before changing persistent trust state.
        a,f = u['attested_header'],u['finalized_header']
        sig,att,fin = int(u['signature_slot']),int(a['beacon']['slot']),int(f['beacon']['slot'])
        old = int(self.finalized['beacon']['slot'])
        require(current_slot >= sig > att >= fin, 'slot ordering')
        require(194048*32 <= sig-1 < 269568*32, 'unsupported signing fork')
        period,sp,ap,fp = old//8192,sig//8192,att//8192,fin//8192
        require(sp == period or (sp == period+1 and self.next is not None), 'committee period')
        require(fp <= period+1, 'finalized period jump')
        require(sig > self.last_signature, 'replay')
        need_next = self.next is None and ap == period and 'next_sync_committee' in u
        require(att > old or need_next, 'stale update')
        header(a)
        froot = header(f)
        branch(froot,u['finality_branch'],105,hx(a['beacon']['state_root'],32))
        nc = u.get('next_sync_committee')
        require((nc is None) == (u.get('next_sync_committee_branch') is None), 'next committee fields')
        if nc is not None:
            branch(committee(nc),u['next_sync_committee_branch'],55,hx(a['beacon']['state_root'],32))
            if ap == period and self.next is not None:
                require(nc == self.next, 'conflicting next committee')
        bits = hx(u['sync_aggregate']['sync_committee_bits'],64)
        count = sum(x.bit_count() for x in bits)
        require(count*3 >= 512*2, 'insufficient supermajority')
        c = self.current if sp == period else self.next
        keys = [hx(k,48) for i,k in enumerate(c['pubkeys']) if bits[i//8] >> (i%8) & 1]
        msg = signing_root(a['beacon'], self.genesis)
        require(BLS.FastAggregateVerify(keys,msg,hx(u['sync_aggregate']['sync_committee_signature'],96)), 'BLS signature')
        if self.next is None:
            require(fp == period and nc is not None and ap == period, 'cannot acquire next committee')
            self.next = copy.deepcopy(nc)
        elif fp == period+1:
            self.current = self.next
            self.next = copy.deepcopy(nc) if ap == fp else None
        if fin > old:
            self.finalized = copy.deepcopy(f)
        self.last_signature = sig
        return {'slot':int(self.finalized['beacon']['slot']),
                'state_root':self.finalized['execution']['state_root'],
                'participants':count,'signing_root':'0x'+msg.hex()}

def load(name):
    v = json.loads((ROOT/'fixtures'/f'{name}.json').read_text())
    return [x['data'] for x in v] if isinstance(v,list) else v['data']

if __name__ == '__main__':
    s=Store(load('bootstrap'))
    results=[]
    for u in load('updates')+[load('finality')]:
        results.append(s.update(u,int(u['signature_slot'])))
    (ROOT/'evidence/reference-valid.json').write_text(json.dumps(results,indent=2)+'\n')
    print(json.dumps(results,indent=2))

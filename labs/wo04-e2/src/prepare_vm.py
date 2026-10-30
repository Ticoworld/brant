"""Build a pinned single-update CKB-VM cryptographic harness, NOT a publisher.

The host must authenticate the committee first. This deliberately does not
pretend that host state transitions are CKB-enforced state transitions.
"""
from reference import *

def serial_beacon(b):
    return uint(b['slot'])[:8]+uint(b['proposer_index'])[:8]+hx(b['parent_root'],32)+hx(b['state_root'],32)+hx(b['body_root'],32)

def carray(name,b):
    return 'static const unsigned char '+name+'[] = {'+','.join(str(x) for x in b)+'};\n'

if __name__=='__main__':
    (ROOT/'build').mkdir(exist_ok=True)
    s=Store(load('bootstrap'))
    for u in load('updates'):
        s.update(u,int(u['signature_slot']))
    u=load('finality')
    a=u['sync_aggregate']
    packet=(uint(u['signature_slot'])[:8]+serial_beacon(u['attested_header']['beacon'])+
        serial_beacon(u['finalized_header']['beacon'])+
        b''.join(execution_chunks(u['finalized_header']['execution']))+
        b''.join(hx(x,32) for x in u['finalized_header']['execution_branch'])+
        b''.join(hx(x,32) for x in u['finality_branch'])+
        b''.join(hx(k,48) for k in s.current['pubkeys'])+hx(s.current['aggregate_pubkey'],48)+
        hx(a['sync_committee_bits'],64)+hx(a['sync_committee_signature'],96))
    context=committee(s.current)+uint(s.finalized['beacon']['slot'])[:8]+uint(u['signature_slot'])[:8]
    (ROOT/'fixtures/vm-update.bin').write_bytes(packet)
    (ROOT/'fixtures/vm-context.bin').write_bytes(context)
    keys_root=tree([vector(hx(k,48)) for k in s.current['pubkeys']])
    compact=packet[:1032]+keys_root+packet[25608:]
    (ROOT/'fixtures/vm-update-fast.bin').write_bytes(compact)
    (ROOT/'build/fixture.h').write_text(carray('fixture',packet)+carray('context',context))
    # Compatible layout only, gated by complete HOST verification.
    s.update(u,int(u['signature_slot']))
    e=s.finalized['execution']
    domain=H(b'WO04-E2A Ethereum mainnet finalized execution v1')
    adapter=domain+hx(e['state_root'],32)+uint(e['block_number'])[:8]+hx(e['block_hash'],32)
    (ROOT/'evidence/e1-root-adapter.json').write_text(json.dumps({
      'scope':'HOST-VERIFIED ONLY; not yet a CKB-authenticated publishing cell',
      'layout':'domain[32] || stateRoot[32] || blockNumberLE[8] || blockHash[32]',
      'data':'0x'+adapter.hex(),'finalized_beacon_slot':int(s.finalized['beacon']['slot']),
      'state_root':e['state_root'],'ganache_proofs_compatible':False},indent=2)+'\n')
    print('packet bytes',len(packet),'context bytes',len(context))

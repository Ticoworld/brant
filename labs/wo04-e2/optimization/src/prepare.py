import ctypes,sys,json,hashlib
from pathlib import Path
O=Path(__file__).resolve().parents[1];E=O.parent
sys.path.insert(0,str(E/'src'))
from reference import *
from prepare_vm import serial_beacon,carray
lib=ctypes.CDLL(str(O/'build/libblst.so'))
def affine(b,g):
    p=ctypes.create_string_buffer(96 if g==1 else 192)
    assert getattr(lib,f'blst_p{g}_uncompress')(p,ctypes.create_string_buffer(b))==0
    out=ctypes.create_string_buffer(96 if g==1 else 192)
    getattr(lib,f'blst_p{g}_affine_serialize')(out,p)
    return out.raw
def proof(leaves,index):
    result=[]
    while len(leaves)>1:
        result.append(leaves[index^1]);index//=2
        leaves=[H(leaves[i]+leaves[i+1]) for i in range(0,len(leaves),2)]
    return b''.join(result)
s=Store(load('bootstrap'));results=[]
for i,u in enumerate(load('updates')+[load('finality')]):
    sp=int(u['signature_slot'])//8192;old=int(s.finalized['beacon']['slot'])
    c=s.current if old//8192==sp else s.next
    context=committee(c)+uint(old)[:8]+uint(u['signature_slot'])[:8]+uint(sp)[:8]
    verified=s.update(u,int(u['signature_slot']))
    if i not in [2,3,6]:continue
    name=str(verified['participants']);d=O/'build'/name;d.mkdir(parents=True,exist_ok=True)
    keys=[hx(k,48) for k in c['pubkeys']];leaves=[vector(k) for k in keys]
    bits=hx(u['sync_aggregate']['sync_committee_bits'],64);agg=hx(c['aggregate_pubkey'],48);sig=hx(u['sync_aggregate']['sync_committee_signature'],96)
    missing=[j for j in range(512) if not (bits[j//8]>>(j%8)&1)]
    f=u['finalized_header'];a=u['attested_header']
    packet=(uint(u['signature_slot'])[:8]+serial_beacon(a['beacon'])+serial_beacon(f['beacon'])+b''.join(execution_chunks(f['execution']))+b''.join(hx(x,32) for x in f['execution_branch'])+b''.join(hx(x,32) for x in u['finality_branch'])+tree(leaves)+agg+bits+sig+affine(agg,1)+affine(sig,2)+bytes([len(missing)]))
    for j in missing:packet+=j.to_bytes(2,'little')+keys[j]+affine(keys[j],1)+proof(leaves,j)
    assert len(packet)==1561+434*len(missing)
    (O/'fixtures'/f'{name}.bin').write_bytes(packet)
    (O/'fixtures'/f'{name}-context.bin').write_bytes(context)
    (d/'context.h').write_text(carray('context',context))
    e=f['execution'];out=H(b'WO04-E2A Ethereum mainnet finalized execution v1')+hx(e['state_root'],32)+uint(e['block_number'])[:8]+hx(e['block_hash'],32)
    (O/'fixtures'/f'{name}-output.bin').write_bytes(out)
    (O/'fixtures'/f'{name}-output.json').write_text(json.dumps({'data':'0x'+out.hex()})+'\n')
    results.append({'participants':verified['participants'],'sourceUpdateIndex':i,'missingIndices':missing,'referenceVerified':True,'contextTrust':'Host reference-authenticated, same harness boundary as fallback','signingPeriod':sp,'witnessBytes':len(packet),'finalizedSlot':int(f['beacon']['slot'])})
(O/'evidence/fixture-generation.json').write_text(json.dumps(results,indent=2)+'\n')
print(results)

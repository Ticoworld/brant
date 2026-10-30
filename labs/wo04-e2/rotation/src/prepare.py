import sys,ctypes,json,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[1];E=R.parent
sys.path.insert(0,str(E/'src'))
from reference import *
from prepare_vm import serial_beacon
lib=ctypes.CDLL(str(R/'build/libblst.so'))
def affine(b,g):
 p=ctypes.create_string_buffer(96 if g==1 else 192);assert getattr(lib,f'blst_p{g}_uncompress')(p,ctypes.create_string_buffer(b))==0
 out=ctypes.create_string_buffer(96 if g==1 else 192);getattr(lib,f'blst_p{g}_affine_serialize')(out,p);return out.raw
def proof(leaves,index):
 result=[]
 while len(leaves)>1:
  result.append(leaves[index^1]);index//=2;leaves=[H(leaves[j]+leaves[j+1]) for j in range(0,len(leaves),2)]
 return b''.join(result)
def state(s,v):
 b=s.finalized['beacon'];e=s.finalized['execution'];p=int(b['slot'])//8192
 return (b'E2STATE1'+bytes.fromhex(GENESIS)+bytes.fromhex(CHECKPOINT)+uint(v)[:8]+uint(b['slot'])[:8]+beacon(b)+hx(e['state_root'],32)+uint(e['block_number'])[:8]+hx(e['block_hash'],32)+uint(p)[:8]+committee(s.current)+(committee(s.next) if s.next else bytes(32))+uint(s.last_signature)[:8]+bytes.fromhex('0300000000000000'))
def save(n,b):
 p=R/'fixtures'/n
 if p.exists():assert p.read_bytes()==b, 'refuse changing pinned fixture '+n
 else:p.write_bytes(b)
b=load('bootstrap');s=Store(b);header=b['header'];co=b['current_sync_committee'];initial=state(s,0);assert len(initial)==280;save('state-0.bin',initial)
save('bootstrap.bin',serial_beacon(header['beacon'])+b''.join(execution_chunks(header['execution']))+b''.join(hx(x,32) for x in header['execution_branch'])+committee(co)+b''.join(hx(x,32) for x in b['current_sync_committee_branch']))
committees={int(header['beacon']['slot'])//8192:co};rows=[]
for i,u in enumerate(load('updates')+[load('finality')]):
 ss=int(u['signature_slot']);sp=ss//8192;old=int(s.finalized['beacon']['slot'])
 c=s.current if old//8192==sp else s.next;keys=[hx(k,48) for k in c['pubkeys']];leaves=[vector(k) for k in keys]
 agg=hx(c['aggregate_pubkey'],48);bits=hx(u['sync_aggregate']['sync_committee_bits'],64);sig=hx(u['sync_aggregate']['sync_committee_signature'],96);missing=[j for j in range(512) if not(bits[j//8]>>(j%8)&1)]
 a=u['attested_header'];f=u['finalized_header'];nc=u.get('next_sync_committee');has=nc is not None
 packet=(uint(ss)[:8]+serial_beacon(a['beacon'])+serial_beacon(f['beacon'])+b''.join(execution_chunks(f['execution']))+b''.join(hx(x,32) for x in f['execution_branch'])+b''.join(hx(x,32) for x in u['finality_branch'])+tree(leaves)+agg+bits+sig+affine(agg,1)+affine(sig,2)+bytes([len(missing)]))
 for j in missing:packet+=j.to_bytes(2,'little')+keys[j]+affine(keys[j],1)+proof(leaves,j)
 packet+=bytes([has])+(committee(nc)+b''.join(hx(x,32) for x in u['next_sync_committee_branch']) if has else bytes(192))
 packet+=b''.join(execution_chunks(a['execution']))+b''.join(hx(x,32) for x in a['execution_branch'])
 assert len(packet)==2362+434*len(missing)
 save(f'update-{i}.bin',packet)
 result=s.update(u,ss);save(f'state-{i+1}.bin',state(s,i+1))
 if nc:committees[int(a['beacon']['slot'])//8192+1]=nc
 rows.append({'index':i,'participants':512-len(missing),'missing':missing,'signatureSlot':ss,'signingPeriod':sp,'finalizedSlot':int(s.finalized['beacon']['slot']),'hasNext':has,'witnessBytes':len(packet),'referenceVerified':True})
for p,c in committees.items():
 agg=hx(c['aggregate_pubkey'],48);save(f'committee-{p}.bin',b''.join(hx(k,48) for k in c['pubkeys'])+agg+affine(agg,1))
save('sequence.json',(json.dumps(rows,indent=2)+'\n').encode())
assert [r['participants'] for r in rows]==[511,512,511,510,512,512,512]
print(rows)

"""Capture real consensus-client LC responses; configure a separate Capella devnet binary.
Never changes E2B source, mainnet constants or evidence. No signature generation here.
"""
import json,sys,hashlib,ctypes,subprocess,os
from pathlib import Path
from endpoints import endpoint,opener
API=None
R=Path(__file__).resolve().parents[1];E=R.parent;ROT=E/'rotation';D=R/'devnet/runtime/data/custom_config_data';F=R/'fixtures/devnet';F.mkdir(exist_ok=True)
def get(p):
 with opener.open((API or endpoint('e2c-cl',5052))+p,timeout=20) as r:return json.load(r)
def save(n,j):
 p=F/n
 if p.exists():assert p.read_text()==json.dumps(j,indent=2)+'\n','refuse evidence overwrite'
 else:p.write_text(json.dumps(j,indent=2)+'\n')
offline=sys.argv[1]=='offline'
if offline:spec=json.loads((F/'spec.json').read_text());gen=json.loads((F/'genesis.json').read_text())
else:spec=get('/eth/v1/config/spec')['data'];gen=get('/eth/v1/beacon/genesis')['data']
assert spec['PRESET_BASE']=='mainnet' and int(spec['SLOTS_PER_EPOCH'])==32 and int(spec['EPOCHS_PER_SYNC_COMMITTEE_PERIOD'])==256 and int(spec['SYNC_COMMITTEE_SIZE'])==512
assert spec['CAPELLA_FORK_VERSION']=='0x03000000' and int(spec['CAPELLA_FORK_EPOCH'])==0
assert int(spec['SECONDS_PER_SLOT'])==3 and int(spec['DENEB_FORK_EPOCH'])==1000000000
# Same audited experiment subset; all domain/time/fork changes explicit.
sys.path.insert(0,str(E/'src'));import reference as ref
code=(E/'src/reference.py').read_text().replace('194048*32','0').replace('269568*32','1000000000*32')
ns={'__file__':str(E/'src/reference.py')};exec(compile(code,'devnet-capella-reference','exec'),ns)
ns['GENESIS']=gen['genesis_validators_root'][2:]
from prepare_vm import serial_beacon
for k in ['committee','execution_chunks','hx','beacon','uint','tree','H','vector']:globals()[k]=ns[k]
lib=ctypes.CDLL(str(R/'build/libblst.so'))
def affine(b,g):
 p=ctypes.create_string_buffer(96 if g==1 else 192);assert getattr(lib,f'blst_p{g}_uncompress')(p,ctypes.create_string_buffer(b))==0
 out=ctypes.create_string_buffer(96 if g==1 else 192);getattr(lib,f'blst_p{g}_affine_serialize')(out,p);return out.raw
def proof(leaves,index):
 out=b''
 while len(leaves)>1:
  out+=leaves[index^1];index//=2;leaves=[H(leaves[j]+leaves[j+1]) for j in range(0,len(leaves),2)]
 return out
def put(n,b):
 p=F/n
 if p.exists():assert p.read_bytes()==b,'refuse changing fixture '+n
 else:p.write_bytes(b)
def state(s,v,checkpoint):
 b=s.finalized['beacon'];e=s.finalized['execution'];return b'E2STATE1'+bytes.fromhex(ns['GENESIS'])+bytes.fromhex(checkpoint)+uint(v)[:8]+uint(b['slot'])[:8]+beacon(b)+hx(e['state_root'],32)+uint(e['block_number'])[:8]+hx(e['block_hash'],32)+uint(int(b['slot'])//8192)[:8]+committee(s.current)+(committee(s.next) if s.next else bytes(32))+uint(s.last_signature)[:8]+bytes.fromhex('0300000000000000')
if sys.argv[1] in ['bootstrap','offline']:
 if offline:cp=json.loads((F/'configuration.json').read_text())['checkpoint'];b=json.loads((F/'bootstrap.json').read_text())
 else:
  from extract import bootstrap
  cp,b=bootstrap()
 s=ns['Store'](b,cp[2:],ns['GENESIS']);save('bootstrap.json',b);save('genesis.json',gen);save('spec.json',spec)
 save('configuration.json',dict(checkpoint=cp,genesis=gen,trust='Single explicit local finalized checkpoint from independently executing Lighthouse+Geth; NOT host root per payout',preset='mainnet',slotsPerEpoch=32,epochsPerPeriod=256,committeeSize=512,secondsPerSlot=3,capellaForkVersion='0x03000000',denebForkEpoch=1000000000))
 put('state-0.bin',state(s,0,cp[2:]));h=b['header'];c=b['current_sync_committee'];agg=hx(c['aggregate_pubkey'],48)
 put('bootstrap.bin',serial_beacon(h['beacon'])+b''.join(execution_chunks(h['execution']))+b''.join(hx(x,32) for x in h['execution_branch'])+committee(c)+b''.join(hx(x,32) for x in b['current_sync_committee_branch']))
 put('committee-0.bin',b''.join(hx(k,48) for k in c['pubkeys'])+agg+affine(agg,1))
 # Generated copies in new build dir: no historical source mutation.
 B=R/'build/devnet';B.mkdir(exist_ok=True)
 for p in (ROT/'contracts').glob('*'):
  if p.suffix not in ['.c','.h']:continue
  text=p.read_text()
  if p.name=='common.h':
   start=text.index('static const uint8_t genesis[32]');text=text[:start]+'static const uint8_t genesis[32]={'+','.join(str(x) for x in bytes.fromhex(ns['GENESIS']))+'};\n'
  if p.name=='layout.h':
   start=text.index('static const uint8_t checkpoint[32]');end=text.index(';',start)+1;text=text[:start]+'static const uint8_t checkpoint[32]={'+','.join(str(x) for x in bytes.fromhex(cp[2:]))+'};'+text[end:]
  if p.name=='state.c':text=text.replace('194048*32ULL','0ULL').replace('269568*32ULL','1000000000*32ULL').replace('1606824023ULL+12*ss',str(int(gen['genesis_time']))+'ULL+3*ss')
  (B/p.name).write_text(text)
 print('Real finalized devnet bootstrap captured',cp)
elif sys.argv[1]=='update':
 index=int(sys.argv[3]) if len(sys.argv)>3 else 0
 cfg=json.loads((F/'configuration.json').read_text());b=json.loads((F/'bootstrap.json').read_text());s=ns['Store'](b,cfg['checkpoint'][2:],ns['GENESIS'])
 for prior in range(index):s.update(json.loads((F/f'update-{prior}.json').read_text()),2**63)
 from extract import update
 u=update()
 assert int(u['finalized_header']['beacon']['slot'])>int(s.finalized['beacon']['slot']),'wait for newer real finality'
 assert int(u['finalized_header']['execution']['timestamp'])>=int(sys.argv[2]),'trade terminal states not finalized yet'
 sig=int(u['signature_slot']);s.update(u,sig)
 c=b['current_sync_committee'];keys=[hx(k,48) for k in c['pubkeys']];leaves=[vector(k) for k in keys];agg=hx(c['aggregate_pubkey'],48);bits=hx(u['sync_aggregate']['sync_committee_bits'],64);signature=hx(u['sync_aggregate']['sync_committee_signature'],96);missing=[j for j in range(512) if not(bits[j//8]>>(j%8)&1)]
 assert len(missing)<=2,'actual participation outside bounded range'
 save(f'update-{index}.json',u)
 a=u['attested_header'];f=u['finalized_header'];nc=u.get('next_sync_committee');assert nc,'authenticate next committee'
 packet=uint(sig)[:8]+serial_beacon(a['beacon'])+serial_beacon(f['beacon'])+b''.join(execution_chunks(f['execution']))+b''.join(hx(x,32) for x in f['execution_branch'])+b''.join(hx(x,32) for x in u['finality_branch'])+tree(leaves)+agg+bits+signature+affine(agg,1)+affine(signature,2)+bytes([len(missing)])
 for j in missing:packet+=j.to_bytes(2,'little')+keys[j]+affine(keys[j],1)+proof(leaves,j)
 packet+=b'\x01'+committee(nc)+b''.join(hx(x,32) for x in u['next_sync_committee_branch'])+b''.join(execution_chunks(a['execution']))+b''.join(hx(x,32) for x in a['execution_branch'])
 assert len(packet)==2362+434*len(missing);put(f'update-{index}.bin',packet);put(f'state-{index+1}.bin',state(s,index+1,cfg['checkpoint'][2:]));save(f'verification-{index}.json',dict(referenceBLSVerified=True,participants=512-len(missing),finalizedSlot=int(f['beacon']['slot']),executionRoot=f['execution']['state_root'],executionBlock=f['execution']['block_number']))
 print('Real full-predicate update verified',512-len(missing),f['beacon']['slot'])

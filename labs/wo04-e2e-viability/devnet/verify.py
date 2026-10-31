"""Offline independent BLS/SSZ reference verification of actual captured chain data."""
from pathlib import Path
import sys,json,gzip,copy
R=Path(__file__).resolve().parents[1];E=R.parent/'wo04-e2';F=R/'fixtures/devnet'
sys.path.insert(0,str(E/'src'))
code=(E/'src/reference.py').read_text().replace('194048*32','0').replace('269568*32','1000000000*32')
ns={'__file__':str(E/'src/reference.py')};exec(compile(code,'configured-devnet-reference','exec'),ns)
cfg=json.loads((F/'configuration.json').read_text());b=json.loads((F/'bootstrap.json').read_text());gen=cfg['genesis']['genesis_validators_root'][2:];s=ns['Store'](b,cfg['checkpoint'][2:],gen)
from extract import state_roots,body_roots,tree,payload_header
blocks={};states={}
for p in (F/'raw').glob('*.json.gz'):
 j=json.loads(gzip.decompress(p.read_bytes()));assert j['version']=='capella'
 if p.name.startswith('block-'):
  v=j['data']['message'];blocks[v['slot']]=v;roots=body_roots(v['body']);h={k:v[k] for k in ['slot','proposer_index','parent_root','state_root']};h['body_root']='0x'+tree(roots).hex();v['_header']=h
 else:states[j['data']['slot']]=j['data']
for slot,state in states.items():
 assert state['genesis_validators_root']==cfg['genesis']['genesis_validators_root'] and state['genesis_time']==cfg['genesis']['genesis_time']
 assert state['fork']['current_version']=='0x03000000'
 assert '0x'+tree(state_roots(state)).hex()==blocks[slot]['state_root']
assert ns['beacon'](blocks[b['header']['beacon']['slot']]['_header']).hex()==cfg['checkpoint'][2:]
results=[]
for i,p in enumerate(sorted(F.glob('update-*.json'))):
 u=json.loads(p.read_text());a=u['attested_header']['beacon'];child=blocks[str(int(u['signature_slot']))]
 assert child['parent_root']=='0x'+ns['beacon'](a).hex()
 assert child['body']['sync_aggregate']==u['sync_aggregate']
 before=copy.deepcopy(s);s.update(u,int(u['signature_slot']));results.append(dict(index=i,participants=sum(x.bit_count() for x in ns['hx'](u['sync_aggregate']['sync_committee_bits'],64)),finalizedSlot=int(s.finalized['beacon']['slot'])))
 for name,mutate in [('signature',lambda x:x['sync_aggregate'].__setitem__('sync_committee_signature','0x'+'00'*96)),('execution-root',lambda x:x['finalized_header']['execution'].__setitem__('state_root','0x'+'11'*32)),('finality-branch',lambda x:x['finality_branch'].__setitem__(0,'0x'+'22'*32))]:
  bad=copy.deepcopy(u);mutate(bad)
  try:copy.deepcopy(before).update(bad,int(u['signature_slot']))
  except ValueError:pass
  else:raise AssertionError('accepted invalid '+name)
 wrong=copy.deepcopy(before);wrong.genesis='33'*32
 try:wrong.update(u,int(u['signature_slot']))
 except ValueError:pass
 else:raise AssertionError('wrong chain domain accepted')
print(json.dumps(dict(actualCapturedUpdates=results,rawStateRootsVerified=len(states),rawBodyRootsChecked=len(blocks),negativeCasesPerUpdate=['signature','execution-root','finality-branch','chain-domain']),indent=2))

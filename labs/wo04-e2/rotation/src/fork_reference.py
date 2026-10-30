"""Official SSZ/header/config reference tests; NOT later-fork consensus proof."""
import ast,json,sys,re,copy
from pathlib import Path
R=Path(__file__).resolve().parents[1];sys.path.insert(0,str(R.parent/'src'))
from reference import H,hx,tree,uint,beacon,execution_chunks,GENESIS,branch
def scalar(x):
 x=x.strip()
 return ast.literal_eval(x) if x.startswith("'") else int(x)
def header_yaml(p):
 d={};section=None
 for line in p.read_text().splitlines():
  if not line.strip():continue
  if line.startswith('- '):d[section].append(scalar(line[2:]));continue
  if line.startswith('  '):k,v=line.strip().split(':',1);d[section][k]=scalar(v);continue
  k,v=line.split(':',1)
  if v.strip():d[k]=scalar(v)
  else:section=k;d[k]=[] if k=='execution_branch' else {}
 return d
def root(h,extended):
 leaves=execution_chunks(h['execution'])
 if extended:leaves += [uint(h['execution']['blob_gas_used']),uint(h['execution']['excess_blob_gas'])]
 assert len(h['execution_branch'])==4
 return tree([beacon(h['beacon']),tree(leaves),tree([hx(x,32) for x in h['execution_branch']])])
def proof_yaml(p):
 v={};nodes=[]
 for line in p.read_text().splitlines():
  if line.startswith('- '):nodes.append(scalar(line[2:]))
  elif ':' in line:
   k,x=line.split(':',1)
   if x.strip():v[k]=scalar(x)
 v['branch']=nodes;return v
def derive(p):
 h=hx(p['leaf'],32);index=p['leaf_index'];assert len(p['branch'])==index.bit_length()-1
 for v in p['branch']:
  b=hx(v,32);h=H(b+h) if index&1 else H(h+b);index>>=1
 assert index==1;return h
refs=R/'references';h=header_yaml(refs/'electra-header-value.yaml');expected=header_yaml(refs/'electra-header-roots.yaml')['root']
assert root(h,True)==hx(expected,32)
assert root(h,False)!=hx(expected,32), 'Capella structure must not validate the Electra vector'
bad=copy.deepcopy(h);bad['execution']['blob_gas_used']^=1;assert root(bad,True)!=hx(expected,32)
proofs={name:proof_yaml(refs/f'electra-{name}-proof.yaml') for name in ['current','next','finality','execution']}
assert {k:v['leaf_index'] for k,v in proofs.items()}=={'current':86,'next':87,'finality':169,'execution':25}
state_roots=[derive(proofs[k]) for k in ['current','next','finality']];assert len(set(state_roots))==1
for name,index in [('current',54),('next',55),('finality',105)]:
 try:branch(hx(proofs[name]['leaf'],32),proofs[name]['branch'],index,state_roots[0]);raise AssertionError('legacy branch accepted')
 except ValueError:pass
text=(refs/'mainnet-v1.6.1.yaml').read_text();forks=[]
for name in ['CAPELLA','DENEB','ELECTRA','FULU']:
 epoch=int(re.search(r'^'+name+r'_FORK_EPOCH:\s*(\d+)',text,re.M)[1]);version=re.search(r'^'+name+r'_FORK_VERSION:\s*0x([0-9a-f]+)',text,re.M)[1]
 forks.append({'name':name,'epoch':epoch,'version':version,'current':86 if name in ['ELECTRA','FULU'] else 54,'next':87 if name in ['ELECTRA','FULU'] else 55,'finality':169 if name in ['ELECTRA','FULU'] else 105,'execution':25,'executionHeaderFields':15 if name=='CAPELLA' else 17})
def selection(signature_slot):
 epoch=(signature_slot-1)//32
 return max((f for f in forks if f['epoch']<=epoch),key=lambda f:f['epoch'])
domains=[]
for i,f in enumerate(forks):
 slot=f['epoch']*32
 assert selection(slot+1)['name']==f['name']
 if i:assert selection(slot)['name']==forks[i-1]['name']
 data=tree([bytes.fromhex(f['version']).ljust(32,b'\0'),bytes.fromhex(GENESIS)]);domains.append('07000000'+data[:28].hex())
assert len(set(domains))==4
result={'officialElectraSSZHeaderRootMatched':expected,'legacy15FieldHeaderRejected':True,'mutatedBlobGasRejected':True,'proofIndicesAndDepthsChecked':True,'legacyIndicesRejected':True,'consistentOfficialElectraStateProofRoot':'0x'+state_roots[0].hex(),'forks':forks,'signatureSlotMinusOneDomainBoundariesPassed':True,'scope':'SSZ static/header/config/branch consistency only. No Electra/Fulu/Deneb BLS-finality/state-transition run.'}
(R/'evidence/fork-reference.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))

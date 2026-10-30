"""Capella/mainnet-preset SSZ branches from REAL beacon JSON, never synthetic signatures.
All constructed state/body roots must equal the signed block's exact commitments.
Bounded to own devnet blocks without slashings/deposits/exits/BLS changes.
"""
import json,gzip,hashlib,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'src'))
from reference import H,hx,uint,vector,beacon,committee,execution,execution_chunks
from endpoints import endpoint,opener
API=None;DEST=Path(__file__).resolve().parents[1]/'fixtures/devnet/raw';DEST.mkdir(parents=True,exist_ok=True)
ZERO=bytes(32)
def tree(xs,limit=None):
 xs=list(xs);limit=limit or len(xs);assert 0<len(xs)<=limit
 n=1<<(limit-1).bit_length();z=ZERO
 while n>1:
  if len(xs)&1:xs.append(z)
  xs=[H(xs[i]+xs[i+1]) for i in range(0,len(xs),2)];z=H(z+z);n//=2
 assert len(xs)==1;return xs[0]
def seq(xs,limit):
 xs=list(xs);return H(tree(xs or [ZERO],limit)+uint(len(xs)))
def packed(b,limit,length=None):
 chunks=[b[i:i+32].ljust(32,b'\0') for i in range(0,len(b),32)]
 root=tree(chunks or [ZERO],(limit+31)//32)
 return root if length is None else H(root+uint(length))
def ck(c):return H(uint(c['epoch'])+hx(c['root'],32))
def eth1(e):return tree([hx(e['deposit_root'],32),uint(e['deposit_count']),hx(e['block_hash'],32)])
def ints(xs):return b''.join(int(x).to_bytes(8,'little') for x in xs)
def validator(v):return tree([vector(hx(v['pubkey'],48)),hx(v['withdrawal_credentials'],32),uint(v['effective_balance']),uint(v['slashed'],1),uint(v['activation_eligibility_epoch']),uint(v['activation_epoch']),uint(v['exit_epoch']),uint(v['withdrawable_epoch'])])
def state_roots(s):
 f=s['fork'];r=[uint(s['genesis_time']),hx(s['genesis_validators_root'],32),uint(s['slot']),tree([hx(f['previous_version'],4).ljust(32,b'\0'),hx(f['current_version'],4).ljust(32,b'\0'),uint(f['epoch'])]),beacon(s['latest_block_header']),tree([hx(x,32) for x in s['block_roots']],8192),tree([hx(x,32) for x in s['state_roots']],8192),seq([hx(x,32) for x in s['historical_roots']],2**24),eth1(s['eth1_data']),seq([eth1(x) for x in s['eth1_data_votes']],2048),uint(s['eth1_deposit_index']),seq([validator(v) for v in s['validators']],2**40),packed(ints(s['balances']),8*2**40,len(s['balances'])),tree([hx(x,32) for x in s['randao_mixes']],65536),packed(ints(s['slashings']),8*8192)]
 for name in ['previous_epoch_participation','current_epoch_participation']:r.append(packed(bytes(int(x) for x in s[name]),2**40,len(s[name])))
 r += [hx(s['justification_bits'],1).ljust(32,b'\0'),ck(s['previous_justified_checkpoint']),ck(s['current_justified_checkpoint']),ck(s['finalized_checkpoint']),packed(ints(s['inactivity_scores']),8*2**40,len(s['inactivity_scores'])),committee(s['current_sync_committee']),committee(s['next_sync_committee']),execution(s['latest_execution_payload_header']),uint(s['next_withdrawal_index']),uint(s['next_withdrawal_validator_index']),seq([H(hx(x['block_summary_root'],32)+hx(x['state_summary_root'],32)) for x in s['historical_summaries']],2**24)]
 assert len(r)==28;return r

def attestation(a):
 b=hx(a['aggregation_bits']);bits=int.from_bytes(b,'little');assert bits>0;length=bits.bit_length()-1;assert length<=2048
 raw=(bits^(1<<length)).to_bytes((length+7)//8,'little')
 br=packed(raw,256,length);d=a['data'];dr=tree([uint(d['slot']),uint(d['index']),hx(d['beacon_block_root'],32),ck(d['source']),ck(d['target'])])
 return tree([br,dr,vector(hx(a['signature'],96))])
def payload_header(p):
 h={k:v for k,v in p.items() if k not in ['transactions','withdrawals']}
 h['transactions_root']='0x'+seq([packed(hx(t),2**30,len(hx(t))) for t in p['transactions']],2**20).hex()
 h['withdrawals_root']='0x'+seq([tree([uint(w['index']),uint(w['validator_index']),hx(w['address'],20).ljust(32,b'\0'),uint(w['amount'])]) for w in p['withdrawals']],16).hex()
 return h

def body_roots(b):
 for k in ['proposer_slashings','attester_slashings','deposits','voluntary_exits','bls_to_execution_changes']:assert not b[k], 'unsupported nonempty devnet body list '+k
 ag=b['sync_aggregate'];return [vector(hx(b['randao_reveal'],96)),eth1(b['eth1_data']),hx(b['graffiti'],32),seq([],16),seq([],2),seq([attestation(a) for a in b['attestations']],128),seq([],16),seq([],16),H(vector(hx(ag['sync_committee_bits'],64))+vector(hx(ag['sync_committee_signature'],96))),execution(payload_header(b['execution_payload'])),seq([],16)]
def branch(leaves,index):
 layer=list(leaves);layer += [ZERO]*((1<<(len(layer)-1).bit_length())-len(layer));nodes=[]
 while len(layer)>1:
  nodes.append('0x'+layer[index^1].hex());index//=2;layer=[H(layer[j]+layer[j+1]) for j in range(0,len(layer),2)]
 return nodes

def get(p):
 with opener.open((API or endpoint('e2c-cl',5052))+p,timeout=30) as r:return json.load(r)
def raw(kind,identity,obj):
 # Deterministic compression; immutable raw response body for independent audit.
 p=DEST/(kind+'-'+str(identity).replace('0x','')+'.json.gz');b=gzip.compress(json.dumps(obj,separators=(',',':')).encode(),mtime=0)
 if p.exists():
  prior=json.loads(gzip.decompress(p.read_bytes()));assert prior['version']==obj['version'] and prior['data']==obj['data'] # status/finalized metadata may advance; preserve first response bytes
 else:p.write_bytes(b)
def block(identity):
 j=get('/eth/v2/beacon/blocks/'+str(identity));assert j['version']=='capella';b=j['data']['message'];raw('block',b['slot'],j);return b

def header(b):
 br=body_roots(b['body']);h={'slot':b['slot'],'proposer_index':b['proposer_index'],'parent_root':b['parent_root'],'state_root':b['state_root'],'body_root':'0x'+tree(br).hex()}
 # Independent consensus-client header root, not just our own construction.
 actual=get('/eth/v1/beacon/headers/'+b['slot'])['data'];assert '0x'+beacon(h).hex()==actual['root'],'block/body root mismatch'
 assert actual['header']['message']==h
 return dict(beacon=h,execution=payload_header(b['body']['execution_payload']),execution_branch=branch(br,9))
def state(b):
 j=get('/eth/v2/debug/beacon/states/'+b['slot']);assert j['version']=='capella';s=j['data'];raw('state',b['slot'],j);r=state_roots(s);assert '0x'+tree(r).hex()==b['state_root'],'full BeaconState SSZ mismatch';return s,r

def bootstrap():
 h=get('/eth/v1/beacon/headers/finalized')['data'];assert int(h['header']['message']['slot'])>0,'wait for real non-genesis finality'
 b=block(h['root']);s,r=state(b)
 return h['root'],dict(header=header(b),current_sync_committee=s['current_sync_committee'],current_sync_committee_branch=branch(r,22))
def update():
 # Aggregate in actual signed child block signs its actual parent's beacon root.
 head=block('head');parent=block(head['parent_root']);assert int(head['slot'])==int(parent['slot'])+1,'wait for consecutive actual blocks'
 s,r=state(parent);f=block(s['finalized_checkpoint']['root']);a=header(parent);fh=header(f)
 return dict(attested_header=a,finalized_header=fh,next_sync_committee=s['next_sync_committee'],next_sync_committee_branch=branch(r,23),finality_branch=['0x'+uint(s['finalized_checkpoint']['epoch']).hex()]+branch(r,20),sync_aggregate=head['body']['sync_aggregate'],signature_slot=head['slot'])

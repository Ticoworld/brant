"""Audit saved native evidence, distinguishing principal transfers from probes."""
import json,hashlib,sys
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def load(n):return json.loads((R/'evidence'/n).read_text())
j=load('chain-'+(sys.argv[1] if len(sys.argv)>1 else 'pos-settlement-verified')+'.json')
assert not j.get('failure'),j.get('failure')
for row in j['transactions']:assert row['status']['status']=='committed' and row['cycles']<70000000
for row in j['rejections']:
 e=json.loads(row['error']);assert e['code'] in [-301,-302],e
assert len(j.get('settlements',[])) in [0,2]
if j.get('offlineReplay'):
 assert j['offlineReplay']['transactions']==len(j['transactions'])
 assert j['offlineReplay']['negativeCases']==len(j['rejections'])
 assert len([r for r in j['transactions'] if r.get('independentPrincipalObservation')])==2
if j.get('settlements'):
 assert sorted(s['status'] for s in j['settlements'])==[2,3]
 roots=[r for r in j['transactions'] if '-update-' in r['name']]
 assert len(roots)==2
 for st in j['settlements']:
  row=next(r for r in j['transactions'] if r['hash']==st['hash'])
  assert row['tx']['inputs'][0]['previous_output']['tx_hash']==next(t['point']['txHash'] for t in j['trades'] if t['id']==st['id'])
  assert row['tx']['outputs'][0]['capacity']==hex(int(st['principalShannons']))
  assert len(row['tx']['outputs'])==1
  assert st['root']['txHash']==roots[0]['hash'] and roots[1]['hash']!=st['root']['txHash']
  assert j['transactions'].index(row)>j['transactions'].index(roots[1])
 for p in j['proofs']:
  root=next(r for r in roots if r['hash']==p['root']['txHash'])
  data=bytes.fromhex(root['tx']['outputs_data'][1][2:]);assert data[32:64].hex()==p['block']['stateRoot'][2:]
  assert int.from_bytes(data[64:72],'little')==int(p['block']['number'],16) and data[72:].hex()==p['block']['hash'][2:]
  assert int(p['proof']['storageProof'][0]['value'],16)!=0
summary=dict(committedTransactions=len(j['transactions']),expectedNodeRejections=len(j['rejections']),principalSettlements=j.get('settlements',[]),transactions=[{k:r[k] for k in ['name','cycles','bytes']} for r in j['transactions']],evmGasFeesWei=sum(int(e['fee']) for e in j.get('evm',[])),ckbFeesShannons=sum(int(r.get('feeShannons',1000000)) for r in j['transactions']),classification='Actual private-PoS finalized principal fill and unfilled refund' if j.get('settlements') else ('Fresh native replay of actual private-PoS consensus and both principal transfers' if j.get('offlineReplay') else 'Historical-root authorization and principal rejection only'))
out=R/'evidence'/('summary-'+j['runName']+'.json');out.write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))

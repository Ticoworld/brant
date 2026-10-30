from pathlib import Path
import json,hashlib,sys
R=Path(__file__).resolve().parents[1];label=sys.argv[1] if len(sys.argv)>1 else 'live-recovered';j=json.loads((R/f'evidence/chain-{label}.json').read_text());assert not j.get('failure'),j.get('failure')
for r in j['transactions']:assert r['status']['status']=='committed' and r['cycles']<=70000000
for r in j['rejections']:assert json.loads(r['error'])['code'] in [-301,-302]
if j.get('reproduction'):
 assert len(j['transactions'])==j['reproduction']['capturedTransactions'] and len(j['rejections'])==j['reproduction']['negativeCases']
 assert len([r for r in j['transactions'] if r.get('independentPrincipalObservation')]) in [2,4]
else:
 assert len(j['settlements'])==4 and j['user']['ethereumNonceBefore']==j['user']['ethereumNonceAfter']==0
 a,b,d,c=j['trades'];assert a['terms']==b['terms'] and a['commitment']==b['commitment'] and a['point']['txHash']==b['point']['txHash'] and a['point']['index']!=b['point']['index'] and a['id']!=b['id']
 for t in j['trades']:
  terms=bytes.fromhex(t['terms'][2:]);assert len(terms)==536 and hashlib.sha256(terms).hexdigest()==t['commitment'][2:] and len(bytes.fromhex(t['commitment'][2:]))==32 and terms[192:224]==bytes(32)
  expected=hashlib.sha256(terms[:480]+bytes.fromhex(t['point']['txHash'][2:])+int(t['point']['index'],16).to_bytes(32,'big')).hexdigest();assert t['id'][2:]==expected
  f=next(x for x in j['transactions'] if x['hash']==t['point']['txHash']);idx=int(t['point']['index'],16);o=f['tx']['outputs'][idx];assert o['type'] is None and f['tx']['outputs_data'][idx]=='0x' and o['lock']['args']==t['commitment'] and int(o['capacity'],16)==10001000000
 for s in j['settlements']:
  t=next(t for t in j['trades'] if t['label']==s['label']);r=next(r for r in j['transactions'] if r['hash']==s['hash']);assert len(r['tx']['inputs'])==len(r['tx']['outputs'])==1
  assert r['tx']['inputs'][0]['previous_output']=={'tx_hash':t['point']['txHash'],'index':t['point']['index']} and int(r['tx']['outputs'][0]['capacity'],16)==10000000000
  w=bytes.fromhex(r['tx']['witnesses'][0][2:]);assert w[1:537].hex()==t['terms'][2:] and w[537:569].hex()==t['point']['txHash'][2:] and int.from_bytes(w[569:573],'little')==int(t['point']['index'],16)
  p=next(p for p in j['proofs'] if p['label']==t['label'] and p['mode']==s['mode'] and p['root']['txHash']==r['tx']['cell_deps'][0]['out_point']['tx_hash']);value=int(p['proof']['storageProof'][0]['value'],16);assert value==(int(t['id'],16) if s['mode'] else 0)
  if not s['mode']:assert int(p['block']['timestamp'],16)>t['order']['deadline']
 for test in j['capacityTests']:assert test['oneShannonBelowRejected'] and int(test['minimumShannons'])==(7300000000 if test['bytes']==32 else 6100000000)
summary=dict(run=label,nativeTransactions=len(j['transactions']),nativeRejections=len(j['rejections']),nativeFeesShannons=len(j['transactions'])*1000000,transactions=[{k:r[k] for k in ['name','cycles','bytes']} for r in j['transactions']],identity=j.get('identity'),capacityTests=j.get('capacityTests'),settlements=j.get('settlements'),deliveries=j.get('deliveries'),evmReceipts=len(j.get('evm',[])),evmGas=sum(int(r['receipt']['gasUsed']) for r in j.get('evm',[])),evmFeesWei=sum(int(r['fee']) for r in j.get('evm',[])),evmGasPerReceipt=[dict(name=r['name'],gas=int(r['receipt']['gasUsed']),feeWei=r['fee']) for r in j.get('evm',[])],reproduction=j.get('reproduction'))
(R/f'evidence/summary-{label}.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))

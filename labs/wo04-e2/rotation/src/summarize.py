"""Audit the actual committed transaction chain and produce compact results."""
import os,json,hashlib,struct,re
from pathlib import Path
R=Path(__file__).resolve().parents[1];label=os.environ.get('E2B_RUN_NAME','recovery')
x=json.loads((R/f'evidence/chain-{label}.json').read_text());assert not x.get('failure')
assert x['nodeMaxTxVerifyCycles']==70000000
for t in x['transactions']:assert t['status']['status']=='committed' and 0<t['cycles']<=70000000
for r in x['rejections']:
 error=json.loads(r['error']);assert error['code'] in [-301,-302],r
 r['scriptError']=int(re.search(r'see error code (\d+)',r['error'])[1]) if 'see error code' in r['error'] else None
primary=next(l for l in x['lineages'] if l['label']=='primary')
H=lambda b:hashlib.blake2b(b,digest_size=32,person=b'ckb-default-hash').digest()
B=lambda h:bytes.fromhex(h[2:])
boot=next(t for t in x['transactions'] if t['name']=='primary-bootstrap')
inp=boot['tx']['inputs'][0];serialized=struct.pack('<Q',int(inp['since'],16))+B(inp['previous_output']['tx_hash'])+struct.pack('<I',int(inp['previous_output']['index'],16))
assert len(serialized)==44 and serialized==B(primary['serializedFirstCellInput'])
nonce=H(serialized+struct.pack('<Q',0));assert nonce==B(primary['typeId'])
code=B(boot['tx']['outputs'][0]['type']['code_hash']);scriptraw=struct.pack('<IIII',85,16,48,49)+code+bytes([4])+struct.pack('<I',32)+nonce
assert H(scriptraw)==B(primary['identity'])
rows=[next(t for t in x['transactions'] if t['name']==f'primary-update-{i}') for i in range(7)]
fixtures=json.loads((R/'fixtures/sequence.json').read_text());assert [f['participants'] for f in fixtures]==[511,512,511,510,512,512,512]
certs=[t for t in x['transactions'] if t['name'].startswith('primary-certify-')]
states=[boot]+rows;certpoints={}
for c in certs:
 a=B(c['tx']['outputs'][0]['type']['args']);v=int.from_bytes(a[64:72],'little');p=int.from_bytes(a[72:80],'little');source=states[v]
 assert c['tx']['cell_deps'][0]['out_point']=={'tx_hash':source['hash'],'index':'0x0'}
 s=B(source['tx']['outputs_data'][0]);oldp=int.from_bytes(s[192:200],'little');assert p in [oldp,oldp+1]
 assert a[:32]==B(primary['identity']) and a[32:64]==code and a[80:112]==(s[200:232] if p==oldp else s[232:264])
 certpoints[c['hash']]=c
before=B(boot['tx']['outputs_data'][0]);summary=[]
for i,t in enumerate(rows):
 assert t['tx']['inputs'][0]['previous_output']=={'tx_hash':states[i]['hash'],'index':'0x0'}
 assert t['tx']['outputs'][0]['type']==boot['tx']['outputs'][0]['type']
 after=B(t['tx']['outputs_data'][0]);assert after==(R/f'fixtures/state-{i+1}.bin').read_bytes()
 cp=t['tx']['cell_deps'][0]['out_point'];assert cp['index']=='0x0';c=certpoints[cp['tx_hash']];cd=B(c['tx']['outputs_data'][0]);p=int.from_bytes(cd[80:88],'little');assert p==fixtures[i]['signingPeriod']
 oldp=int.from_bytes(before[192:200],'little');assert cd[88:120]==(before[200:232] if p==oldp else before[232:264])
 advanced=int.from_bytes(after[80:88],'little')>int.from_bytes(before[80:88],'little')
 if advanced:
  rt=t['tx']['outputs'][1]['type'];a=B(rt['args']);assert rt['code_hash']=='0x'+code.hex() and a[:32]==B(primary['identity']) and a[32:64]==code and a[64:72]==after[72:80] and a[72:104]==after[88:120]
  assert B(t['tx']['outputs_data'][1])==hashlib.sha256(after[8:40]+B(primary['identity'])).digest()+after[120:192]
 else:assert i==0
 summary.append({'index':i,'participants':fixtures[i]['participants'],'cyclesAllScripts':t['cycles'],'transactionBytes':t['bytes'],'witnessBytes':len(B(t['tx']['witnesses'][0])),'stateVersion':i+1,'finalizedSlot':int.from_bytes(after[80:88],'little'),'period':int.from_bytes(after[192:200],'little'),'rootPublished':advanced,'transactionHash':t['hash']})
 before=after
assert x['recovery']['reloadedStateVersion']==1 and x['recovery']['certificationNotYetPerformed']
bins=json.loads((R/'evidence/binaries-final.json').read_text())
if (R/f'evidence/binaries-{label}.json').exists():bins=json.loads((R/f'evidence/binaries-{label}.json').read_text())
assert next(b for b in bins if b['name']=='bundle')['codeHash']=='0x'+code.hex()
result={'run':label,'startingCheckpoint':'9380e624636de55db315ba1e68b3f5ac057ed30c','committedTransactions':len(x['transactions']),'rejectedNodeCases':len(x['rejections']),'sevenUpdateChain':summary,'typeIDExact44ByteCellInputAnd8ByteIndexIndependentlyChecked':True,'hostSelectedReplacementCommittees':False,'canonicalAuthority':primary['identity'],'finalExecutionRoot':'0x'+before[120:152].hex(),'finalizedBeaconSlot':int.from_bytes(before[80:88],'little'),'finalStateVersion':int.from_bytes(before[72:80],'little'),'committeeCertification':[{'name':t['name'],'cyclesAllScripts':t['cycles'],'bytes':t['bytes']} for t in certs],'recovery':x['recovery'],'allocatedCapacityCKB':{'state':1000,'eachCertificate':1000,'eachRoot':1000,'primaryRetainedCells':14000},'derivedOccupiedCapacityCKB':{'state':386,'certificate':482,'root':282,'bundleCodeCell':next(b['bytes'] for b in bins if b['name']=='bundle')+41},'feePerTransactionShannons':1000000,'rejectionCodes':[{'name':r['name'],'scriptError':r['scriptError']} for r in x['rejections']],'liveE1PrincipalPayoutDemonstrated':False}
(R/f'evidence/summary-{label}.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['rejectionCodes']},indent=2))

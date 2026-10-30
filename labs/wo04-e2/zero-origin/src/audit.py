"""Audit actually committed native and EVM evidence, transaction roles and time bounds."""
import sys,json,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[1];label=sys.argv[1] if len(sys.argv)>1 else 'live-02';j=json.loads((R/f'evidence/chain-{label}.json').read_text());assert not j.get('failure'),j.get('failure')
for r in j['transactions']:assert r['status']['status']=='committed' and r['cycles']<70000000
for r in j['rejections']:assert json.loads(r['error'])['code'] in [-301,-302]
if j.get('reproduction'):
 assert j['reproduction']['capturedTransactions']==8 and j['reproduction']['allTransactions']==len(j['transactions']) and j['reproduction']['allNegativeCases']==len(j['rejections'])
 assert len([r for r in j['transactions'] if r.get('independentPrincipalObservation')])==2
else:
 assert len(j['settlements'])==2 and sorted(s['mode'] for s in j['settlements'])==[0,1]
 assert j['user']['ethereumNonceBefore']==j['user']['ethereumNonceAfter']==0 and j['user']['ethereumTransactions']==0
 assert not any(e['receipt']['from'].lower()==j['user']['address'].lower() for e in j['evm'])
 assert not any('open' in e['name'].lower() or 'expir' in e['name'].lower() for e in j['evm'])
 assert j['unfilledOrderEthereumTransactions']==0
 for p in j['proofs']:
  b=bytes.fromhex(p['timestampProof'][2:]);assert len(b)==720
  assert int.from_bytes(b[112+288:112+296],'little')==int(p['block']['timestamp'],16)
  t=next(t for t in j['trades'] if t['id']==p['id']);mode=p['mode'];value=int(p['proof']['storageProof'][0]['value'],16)
  assert value==(int(t['id'],16) if mode else 0)
  rootrow=next(r for r in j['transactions'] if r['hash']==p['root']['txHash']);data=bytes.fromhex(rootrow['tx']['outputs_data'][1][2:]);assert data[32:64].hex()==p['block']['stateRoot'][2:] and int.from_bytes(data[64:72],'little')==int(p['block']['number'],16) and data[72:].hex()==p['block']['hash'][2:]
  if p['index']==1 and mode==0:assert int(p['block']['timestamp'],16)>t['order']['deadline']
  if p['index']==0 and mode==0:assert int(p['block']['timestamp'],16)<=t['order']['deadline']
 for s in j['settlements']:
  t=next(t for t in j['trades'] if t['label']==s['label']);r=next(r for r in j['transactions'] if r['hash']==s['hash']);assert r['tx']['inputs'][0]['previous_output']['tx_hash']==t['point']['txHash'];assert int(r['tx']['outputs'][0]['capacity'],16)==int(t['order']['ckbAmount']);assert len(r['tx']['outputs'])==1
  if s['mode']==0:
   for e in j['evm']:
    assert not any(len(l.get('topics',[]))>1 and l['topics'][1].lower()==t['id'].lower() for l in e['receipt']['logs']), 'unfilled id appears in Filled receipt'
 core=[e for e in j['evm'] if e['name'] in ['deploy-ControlledUSDC','deploy-OutcomesV2','maker-amortizable-approval','MAKER-REAL-USDC-DELIVERY']]
 protocol=[e for e in core if e['name']=='MAKER-REAL-USDC-DELIVERY']
 j['auditCosts']={'coreEvmReceiptsWithSetup':len(core),'coreEvmGasWithSetup':sum(int(e['receipt']['gasUsed']) for e in core),'coreEvmFeesWithSetupWei':sum(int(e['fee']) for e in core),'perFilledOrderEvmTransactions':len(protocol),'perFilledOrderGas':sum(int(e['receipt']['gasUsed']) for e in protocol),'perFilledOrderFeeWei':sum(int(e['fee']) for e in protocol),'perUnfilledOrderEvmTransactions':0,'userEthereumGas':0,'allEvmReceiptsWithAdversarialTests':len(j['evm']),'allEvmGas':sum(int(e['receipt']['gasUsed']) for e in j['evm']),'allEvmFeesWei':sum(int(e['fee']) for e in j['evm'])}
summary={'run':label,'committedTransactions':len(j['transactions']),'nativeRejections':len(j['rejections']),'feesShannons':len(j['transactions'])*1000000,'transactions':[{k:r[k] for k in ['name','cycles','bytes']} for r in j['transactions']],'swapSettlements':j.get('settlements',[]),'delivery':j.get('delivery'),'user':j.get('user'),'costs':j.get('auditCosts'),'reproduction':j.get('reproduction')}
(R/f'evidence/summary-{label}.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary,indent=2))

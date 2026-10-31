from pathlib import Path
import json,hashlib,subprocess
R=Path(__file__).resolve().parents[1];j=json.loads((R/'evidence/chain-recovery-final.json').read_text());assert not j.get('failure')
assert len(j['settlements'])==4 and sorted(s['mode'] for s in j['settlements'])==[0,0,1,1]
assert len({s['id'] for s in j['settlements']})==4
for t in j['trades']:
 assert t['fundingSignatureVerified'] and t['source']=='fresh canonical CKB RPC funding witness only'
 assert len(bytes.fromhex(t['terms'][2:]))==536
 assert hashlib.sha256(bytes.fromhex(t['terms'][2:])).hexdigest()==t['commitment'][2:]
 assert int(t['principal'])==10000000000 and int(t['feeReserve'])==1000000
for s in j['settlements']:assert int(s['received']['output']['capacity'],16)==10000000000
for t in [t for t in j['trades'] if any(s['id']==t['id'] and s['mode']==1 for s in j['settlements'])]:
 receipt=next(e['receipt'] for e in j['evm'] if e['name']=='MAKER-DELIVERY-'+t['label']);address='0x'+bytes.fromhex(t['terms'][2:])[76:96].hex()
 logs=[l for l in receipt['logs'] if l['address'].lower()==address.lower() and len(l['topics'])==4 and l['topics'][1].lower()==t['id'].lower()];assert len(logs)==1
 log=logs[0];assert log['topics'][2][-40:].lower()==t['order']['maker'][2:].lower() and log['topics'][3][-40:].lower()==t['order']['recipient'][2:].lower()
 data=bytes.fromhex(log['data'][2:]);assert len(data)==64 and '0x'+data[12:32].hex()==t['order']['asset'].lower() and int.from_bytes(data[32:],'big')==int(t['order']['amount'])
for s in [s for s in j['settlements'] if s['mode']==0]:
 t=next(t for t in j['trades'] if t['id']==s['id']);proof=next(p for p in j['proofs'] if p['id']==s['id'] and p['index']==1);assert int(proof['block']['timestamp'],16)>int(t['order']['deadline'])
assert j['user']['ethereumTransactions']==0
assert all(t['cycles']<=70000000 for t in j['transactions'])
for x in j['recoveryOverhead']:assert x['sameRawHash'] and x['feeBeforeShannons']==x['feeAfterShannons']=='1000000'
assert not list((R/'fixtures').glob('recovery-*.json')) or all(p.name=='recovery-config.json' for p in (R/'fixtures').glob('recovery-*.json'))
for label in ['filled-A','identical-B','filled-D','unfilled-C']:
 trace=json.loads((R/f'evidence/recovery-rpc-{label}.json').read_text());assert {'get_transaction','get_block','get_live_cell','get_block_hash'}<=set(t['method'] for t in trace)
# Witness terms, OutPoints, timestamp proof and actual storage proof all checked by
# the unchanged native consumer. Raw positive transactions are included in the trace.
r=dict(actualSettlements=4,principalCKBPerSettlement=100,makerPayouts=2,userRefunds=2,customerEthereumTransactions=0,sourceOrderFilesRequired=False,actualNativeTransactions=len(j['transactions']),nativeRejectedCases=len(j['rejections']),recoveryRejectedCases=len(j['recoveryRejections']),fixedFeesCKB=len(j['transactions'])*.01,evmGas=sum(int(x['receipt']['gasUsed']) for x in j['evm']),evmFeeWei=str(sum(int(x['fee']) for x in j['evm'])),fundingOverhead=j['recoveryOverhead'],publicationIdentity=j['finalState']['identity'],scope='Fresh actual private PoS delivery and finalized CKB settlement; same original funded cells recovered after interruption')
(R/'evidence/result.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))

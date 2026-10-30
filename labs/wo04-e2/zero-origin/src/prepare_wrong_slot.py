"""Find a real other-slot proof that does not prove the committed filled slot.
JSON's requested slot label is not trusted; proof validity is checked cryptographically.
"""
import sys,json,ctypes,subprocess,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[1];j=json.loads((R/'evidence/chain-live-02.json').read_text());p=next(p for p in j['proofs'] if p['mode']==1)
address=p['proof']['address'];code=p['proof']['codeHash'];root=p['block']['stateRoot'];slot=p['slot'];lib=ctypes.CDLL(str(R/'build/mpt_native.so'));buf=ctypes.create_string_buffer
hx=lambda x:bytes.fromhex(x[2:]);wire=lambda ns:len(ns).to_bytes(2,'little')+b''.join(len(hx(n)).to_bytes(2,'little')+hx(n) for n in ns)
for i in range(16):
 other='0x'+hashlib.sha256(b'wrong fixed storage slot '+bytes([i])).hexdigest()
 proof=json.loads(subprocess.check_output([str(R/'../.venv/bin/python'),str(R/'src/get_proof.py'),address,other,p['block']['number']]))
 w=wire(proof['accountProof'])+wire(proof['storageProof'][0]['proof']);present=ctypes.c_int(-1);out=buf(32)
 r=lib.check(buf(w),len(w),buf(hx(root)),buf(hx(address)),buf(hx(code)),buf(hx(slot)),out,ctypes.byref(present))
 if r:
  destination=R/'fixtures/wrong-slot-proof.json';record=dict(expectedSlot=slot,queriedSlot=other,proof=proof,nativeParserError=r,wire='0x'+w.hex(),timestampProof=p['timestampProof'],source='Independent real eth_getProof at exact authenticated execution block')
  destination.write_text(json.dumps(record,indent=2)+'\n');print('Other-slot proof rejected for immutable expected slot',r);break
else:raise AssertionError('all selected node paths also proved the actual slot; choose other authenticated proof')

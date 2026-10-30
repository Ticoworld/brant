from pathlib import Path
import json,hashlib,subprocess,ctypes,os
R=Path(__file__).resolve().parents[1];E=R.parent;E1=E.parent/'wo04-e1'
env=os.environ.copy();env.update(ZIG_GLOBAL_CACHE_DIR='/tmp/zig-global',ZIG_LOCAL_CACHE_DIR='/tmp/zig-identity')
subprocess.run([str(E/'tools/python/ziglang/zig'),'cc','-shared','-fPIC','-O2','-I'+str(E1/'contracts'),str(R/'contracts/identity_native.c'),'-o',str(R/'build/identity.so')],env=env,check=True)
lib=ctypes.CDLL(str(R/'build/identity.so'));buf=ctypes.create_string_buffer;j=json.loads((R/'evidence/chain-live-02.json').read_text());rows=[]
for t in j['trades']:
 terms=bytes.fromhex(t['terms'][2:]);tx=bytes.fromhex(t['point']['txHash'][2:]);index=int(t['point']['index'],16)
 for i in [index,0,1,255,256,2**32-1]:
  p=tx+i.to_bytes(4,'little');out=buf(32);lib.identify(buf(terms),buf(p),out);expected=hashlib.sha256(terms[:480]+tx+i.to_bytes(32,'big')).digest();assert out.raw==expected
  if i==index:assert '0x'+out.raw.hex()==t['id']
 rows.append(dict(label=t['label'],point=t['point'],id=t['id']))
a,b=j['trades'][:2];assert a['terms']==b['terms'] and a['commitment']==b['commitment'] and a['point']['txHash']==b['point']['txHash'] and a['id']!=b['id']
report=dict(checkedActualEthereumAndNativeIds=rows,indexBoundaryVectors=[0,1,255,256,2**32-1],nativeVsCanonicalABI=True,sameTxDistinctOutputIndexBinding=True,noFundingHashCircularity='Base preimage contains no funding transaction hash/index; full identifier is derived only after raw funding transaction construction')
(R/'evidence/identity-tests.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))

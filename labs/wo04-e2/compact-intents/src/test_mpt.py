"""Independent py-trie comparison against native C. Unit roots are NOT payout roots."""
from pathlib import Path
import sys,ctypes,json,subprocess,os,random
R=Path(__file__).resolve().parents[1];E=R.parent;E1=E.parent/'wo04-e1';sys.path.insert(0,str(R.parent/'zero-origin/tools/python'));sys.path.insert(0,str(R/'tools/python'))
import rlp
from trie import HexaryTrie
from eth_hash.auto import keccak
cmd=[str(E/'tools/python/ziglang/zig'),'cc','-shared','-fPIC','-O2','-I'+str(R/'contracts'),'-I'+str(E1/'deps/ckb-c-stdlib'),str(R/'contracts/mpt_native.c'),'-o',str(R/'build/mpt_native.so')]
env=os.environ.copy();env.update(ZIG_GLOBAL_CACHE_DIR='/tmp/zig-global',ZIG_LOCAL_CACHE_DIR='/tmp/zig-mpt');subprocess.run(cmd,env=env,check=True)
lib=ctypes.CDLL(str(R/'build/mpt_native.so'));buf=ctypes.create_string_buffer
wire=lambda nodes:len(nodes).to_bytes(2,'little')+b''.join(len(v).to_bytes(2,'little')+v for v in map(rlp.encode,nodes))
address=bytes.fromhex('11'*20);code=keccak(b'controlled code');rows=[];checks=0

def call(w,root,slot,codehash=code):
 global checks;checks+=1;present=ctypes.c_int(-1);out=buf(32);r=lib.check(buf(w),len(w),buf(root),buf(address),buf(codehash),buf(slot),out,ctypes.byref(present));return r,present.value,out.raw
vectors=[]
for name,slots,target in [('empty-storage',{},0),('included-single',{0:77},0),('leaf-divergence',{0:77},1),('included-branch',{j:j+1 for j in range(32)},7),('absent-branch',{j:j+1 for j in range(32)},97)]:
 t=HexaryTrie({})
 for k,v in slots.items():t[keccak(k.to_bytes(32,'big'))]=rlp.encode(v)
 slot=target.to_bytes(32,'big');proof=t.get_proof(keccak(slot));expected=HexaryTrie.get_from_proof(t.root_hash,keccak(slot),proof)
 a=HexaryTrie({});a[keccak(address)]=rlp.encode([b'',b'',t.root_hash,code]);w=wire(a.get_proof(keccak(address)))+wire(proof)
 result=call(w,a.root_hash,slot);assert result[0]==0 and bool(result[1])==bool(expected),(name,result)
 if expected:assert int.from_bytes(result[2],'big')==rlp.decode(expected,sedes=rlp.sedes.big_endian_int)
 for n in range(len(w)):assert call(w[:n],a.root_hash,slot)[0]!=0,(name,'truncated',n)
 assert call(w+b'\x00',a.root_hash,slot)[0]!=0
 assert call(w,a.root_hash,slot,bytes.fromhex('22'*32))[0]==31
 for i in range(len(w)):
  bad=bytearray(w);bad[i]^=1;assert call(bytes(bad),a.root_hash,slot)[0]!=0,(name,'mutated',i)
 rows.append(dict(name=name,nodes=len(proof),bytes=len(w),present=bool(expected)))
 vectors.append(dict(name=name,wire=w.hex(),stateRoot=a.root_hash.hex(),slot=slot.hex()))
# Missing account can be a valid account non-inclusion, but may NEVER refund.
a=HexaryTrie({});a[keccak(bytes.fromhex('33'*20))]=rlp.encode([b'',b'',keccak(rlp.encode(b'')),code]);w=wire(a.get_proof(keccak(address)))+b'\x00\x00';assert call(w,a.root_hash,bytes(32))[0]==30
# Explicit raw fixed-key tests: embedded references, extension divergence and empty branch.
rawrows=[]
for name,keys,target in [('inline-extension',[bytes(31)+bytes([x]) for x in [1,2]],bytes(31)+b'\x03'),('inline-inclusion',[bytes(31)+bytes([x]) for x in [1,2]],bytes(31)+b'\x01'),('extension-divergence',[bytes(31)+bytes([x]) for x in [1,2]],b'\x01'+bytes(31)),('branch-empty',[bytes([0])+bytes(31),bytes([0x10])+bytes(31)],bytes([0x20])+bytes(31))]:
 t=HexaryTrie({})
 for k in keys:t[k]=b'\x01'
 proof=t.get_proof(target);w=wire(proof);present=ctypes.c_int(-1);r=lib.rawcheck(buf(w),len(w),buf(t.root_hash),buf(target),ctypes.byref(present));expected=HexaryTrie.get_from_proof(t.root_hash,target,proof);assert r==0 and bool(present.value)==bool(expected),(name,r,present.value)
 omitted=tuple(node for i,node in enumerate(proof) if i==0 or len(rlp.encode(node))>=32);compact=wire(omitted);p2=ctypes.c_int(-1);r2=lib.rawcheck(buf(compact),len(compact),buf(t.root_hash),buf(target),ctypes.byref(p2));assert r2==0 and p2.value==present.value
 rawrows.append(dict(name=name,nodes=len(proof),bytes=len(w),present=bool(expected),inlineNodesIncludedAndOmittedAccepted=True))
# Malformed compact flags/empty extension/invalid references authenticated under unit roots.
for node in [[b'\x40',b'x'],[b'\x00',bytes(32)],[b'\x11',b'bad']]:
 w=wire([node]);r=lib.rawcheck(buf(w),len(w),buf(keccak(rlp.encode(node))),buf(bytes(32)),ctypes.byref(ctypes.c_int()));assert r!=0
out=dict(comparator='trie3.1.0 HexaryTrie.get_from_proof',nativeChecks=checks,validVectors=rows,rawFixedKeyCases=rawrows,missingAccountRefundRejected=True,malformedAuthenticatedNodesRejected=3,allTruncationsAndSingleBitMutationsRejected=True,scope='Parser tests only; generated roots are NOT consensus fixtures')
(R/'fixtures/mpt-vectors.json').write_text(json.dumps(dict(address=address.hex(),codeHash=code.hex(),vectors=vectors),indent=2)+'\n');(R/'evidence/mpt-tests.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))

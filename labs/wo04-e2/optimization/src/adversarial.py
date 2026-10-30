"""Construct invalid points without inventing valid Ethereum signatures."""
import ctypes,sys
from pathlib import Path
from py_ecc.bls.hash_to_curve import map_to_curve_G2
from py_ecc.optimized_bls12_381 import FQ2,normalize,multiply,curve_order,is_inf
from py_ecc.bls.g2_primitives import G2_to_signature
O=Path(__file__).resolve().parents[1];sys.path.insert(0,str(O.parent/'src'))
from reference import *
from prepare_vm import serial_beacon
lib=ctypes.CDLL(str(O/'build/libblst.so'))
def encode(b,g):
 p=ctypes.create_string_buffer(96 if g==1 else 192);assert getattr(lib,f'blst_p{g}_uncompress')(p,ctypes.create_string_buffer(b))==0
 u=ctypes.create_string_buffer(96 if g==1 else 192);getattr(lib,f'blst_p{g}_affine_serialize')(u,p);return u.raw
p=map_to_curve_G2(FQ2([1,2]));assert not is_inf(multiply(p,curve_order))
x,y=normalize(p);u=b''.join(int(v).to_bytes(48,'big') for v in [x.coeffs[1],x.coeffs[0],y.coeffs[1],y.coeffs[0]])
c=G2_to_signature(p);point=ctypes.create_string_buffer(192)
assert lib.blst_p2_deserialize(point,ctypes.create_string_buffer(u))==0
assert lib.blst_p2_affine_in_g2(point)==0
w=bytearray((O/'fixtures/512.bin').read_bytes());w[1176:1272]=c;w[1368:1560]=u
(O/'fixtures/signature-oncurve-nonsubgroup.bin').write_bytes(w)
b=load('bootstrap');Store(b) # Fixed upstream checkpoint and committee branch.
co=b['current_sync_committee'];kr=tree([vector(hx(k,48)) for k in co['pubkeys']]);agg=hx(co['aggregate_pubkey'],48);ua=encode(agg,1)
packet=serial_beacon(b['header']['beacon'])+b''.join(hx(v,32) for v in b['current_sync_committee_branch'])+kr+agg+ua
assert len(packet)==448
out=b'E2COM01\0'+committee(co)+kr+agg+ua+uint(int(b['header']['beacon']['slot'])//8192)[:8]+bytes.fromhex(CHECKPOINT)+uint(1)[:8]
assert len(out)==264
(O/'fixtures/certificate.bin').write_bytes(packet);(O/'fixtures/certificate-output.bin').write_bytes(out)

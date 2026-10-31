"""Build a distinct explicitly configured devnet program, never the mainnet bundle."""
from pathlib import Path
import os,subprocess,hashlib,json
R=Path(__file__).resolve().parents[1];E=R.parent/'wo04-e2';E1=E.parent/'wo04-e1';B=R/'build/devnet'
env=os.environ.copy();env.update(ZIG_GLOBAL_CACHE_DIR='/tmp/zig-global',ZIG_LOCAL_CACHE_DIR='/tmp/zig-e2c-devnet')
base=[str(E/'tools/python/ziglang/zig'),'cc','-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-O2','-nostdlib','-fno-builtin','-ffunction-sections','-fdata-sections','-D__BLST_NO_ASM__','-D__BLST_NO_CPUID__','-DE2_RV64_LIMBS','-DAFFINE','-DMULTI','-I'+str(E1/'deps/ckb-c-stdlib'),'-I'+str(E1/'deps/ckb-c-stdlib/libc'),'-I'+str(E1/'deps/ckb-c-stdlib/molecule'),'-I'+str(R/'contracts'),'-I'+str(E1/'contracts'),'-I'+str(E/'vendor/blst/bindings'),'-I'+str(B)]
subprocess.run(base+['-DCKB_DECLARATION_ONLY','-c',str(E/'vendor/blst/src/server.c'),'-o',str(B/'blst.o')],env=env,check=True)
metrics=[]
for name in ['bundle','settlement','settlement20']:
 if name!='bundle':
  (B/(name+'.c')).write_bytes((R/'contracts/settlement.c').read_bytes())
 cmd=base+(['-DCOMMIT_BYTES=20'] if name=='settlement20' else [])+[str(B/(name+'.c')),str(B/'blst.o'),'-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000','-o',str(B/name)]
 subprocess.run(cmd,env=env,check=True);b=(B/name).read_bytes();h=hashlib.blake2b(b,digest_size=32,person=b'ckb-default-hash').digest()
 metrics.append(dict(name=name,bytes=len(b),codeHash='0x'+h.hex(),sha256=hashlib.sha256(b).hexdigest()))
 if name=='bundle':
  for role in ['state','certificate','root']:(B/role).write_bytes(b)
  (B/'publisher.h').write_text('static const uint8_t publisher[32]={'+','.join(str(x) for x in h)+'};\n')
destination=R/'evidence/devnet-binaries.json';encoded=json.dumps(metrics,indent=2)+'\n'
if destination.exists():assert destination.read_text()==encoded,'binary identity changed'
else:destination.write_text(encoded)

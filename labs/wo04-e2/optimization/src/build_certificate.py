import os,subprocess,sys
from pathlib import Path
O=Path(__file__).resolve().parents[1];E=O.parent;E1=E.parent/'wo04-e1'
env=os.environ.copy();env.update(ZIG_GLOBAL_CACHE_DIR='/tmp/zig-global',ZIG_LOCAL_CACHE_DIR='/tmp/zig-e2-opt')
base=[str(E/'tools/python/ziglang/zig'),'cc','-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-O2','-nostdlib','-fno-builtin','-ffunction-sections','-fdata-sections','-D__BLST_NO_ASM__','-D__BLST_NO_CPUID__','-DE2_RV64_LIMBS','-I'+str(E1/'deps/ckb-c-stdlib'),'-I'+str(E1/'deps/ckb-c-stdlib/libc'),'-I'+str(E1/'contracts'),'-I'+str(E/'vendor/blst/bindings'),'-Icontracts']
subprocess.run(base+['-DCKB_DECLARATION_ONLY','-c',str(E/'vendor/blst/src/server.c'),'-o','build/blst.o'],cwd=O,env=env,check=True)

subprocess.run(base+['contracts/committee.c','build/blst.o','-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000','-o','build/committee'],cwd=O,env=env,check=True)
import hashlib
h=hashlib.blake2b((O/'build/committee').read_bytes(),digest_size=32,person=b'ckb-default-hash').digest()
(O/'build/certificate_hash.h').write_text('static const unsigned char certificate_hash[32]={'+','.join(str(x) for x in h)+'};\n')
subprocess.run(base+['-Ibuild','contracts/reuse.c','build/blst.o','-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000','-o','build/reuse'],cwd=O,env=env,check=True)

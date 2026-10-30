import os,subprocess,sys
from pathlib import Path
O=Path(__file__).resolve().parents[1];E=O.parent;E1=E.parent/'wo04-e1'
env=os.environ.copy();env.update(ZIG_GLOBAL_CACHE_DIR='/tmp/zig-global',ZIG_LOCAL_CACHE_DIR='/tmp/zig-e2-opt')
base=[str(E/'tools/python/ziglang/zig'),'cc','-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-O2','-nostdlib','-fno-builtin','-ffunction-sections','-fdata-sections','-D__BLST_NO_ASM__','-D__BLST_NO_CPUID__','-DE2_RV64_LIMBS','-I'+str(E1/'deps/ckb-c-stdlib'),'-I'+str(E1/'deps/ckb-c-stdlib/libc'),'-I'+str(E1/'contracts'),'-I'+str(E/'vendor/blst/bindings'),'-Icontracts']
subprocess.run(base+['-DCKB_DECLARATION_ONLY','-c',str(E/'vendor/blst/src/server.c'),'-o','build/blst.o'],cwd=O,env=env,check=True)
for n in ['512','511','510']:
 for mode,flags in [('compressed',[]),('affine',['-DAFFINE']),('profile-c',['-DPROFILE']),('profile-a',['-DPROFILE','-DAFFINE']),('affine-multi',['-DAFFINE','-DMULTI']),('profile-multi',['-DAFFINE','-DMULTI','-DPROFILE'])]:
  subprocess.run(base+flags+['-Ibuild/'+n,'contracts/partial.c','build/blst.o','-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000','-o',f'build/{n}/{mode}'],cwd=O,env=env,check=True)

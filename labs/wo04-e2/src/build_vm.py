from pathlib import Path
import os
import subprocess
ROOT=Path(__file__).resolve().parents[1]
E1=ROOT.parent/'wo04-e1'
(ROOT/'build').mkdir(exist_ok=True)
env=os.environ.copy()
env.update(ZIG_GLOBAL_CACHE_DIR='/tmp/zig-global',ZIG_LOCAL_CACHE_DIR='/tmp/zig-e2')
zig=ROOT/'tools/python/ziglang/zig'
if not zig.exists():zig=E1/'tools/python/ziglang/zig'
base=[str(zig),'cc','-target','riscv64-freestanding',
      '-mcpu=generic_rv64+m+c','-O2','-nostdlib','-fno-builtin',
      '-ffunction-sections','-fdata-sections','-D__BLST_NO_ASM__','-D__BLST_NO_CPUID__',
      '-I'+str(E1/'deps/ckb-c-stdlib'),'-I'+str(E1/'deps/ckb-c-stdlib/libc'),
      '-I'+str(E1/'contracts'),'-Ivendor/blst/bindings','-Ibuild',
      '-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000']
for name,defines in [('direct',[]),('subtract',['-DSUBTRACT_ABSENT']),('direct64',['-DE2_RV64_LIMBS']),('subtract64',['-DSUBTRACT_ABSENT','-DE2_RV64_LIMBS']),('witness64',['-DE2_RV64_LIMBS','-DSUBTRACT_ABSENT']),('memory64',['-DE2_RV64_LIMBS','-DSUBTRACT_ABSENT','-DSTACK_WATERMARK']),('fast64',['-DE2_RV64_LIMBS','-DFULL_PARTICIPATION'])]:
    subprocess.run([x for x in base if not x.startswith('-Wl,')]+defines+['-DCKB_DECLARATION_ONLY','-c','vendor/blst/src/server.c','-o','build/blst-'+name+'.o'],cwd=ROOT,env=env,check=True)
    cmd=base+defines+([] if name in ('witness64','fast64') else ['-DEMBEDDED'])+['contracts/update.c','build/blst-'+name+'.o','-o','build/'+name]
    print(' '.join(cmd),flush=True)
    subprocess.run(cmd,cwd=ROOT,env=env,check=True)

import os,subprocess,hashlib,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];E=R.parent;E1=E.parent/'wo04-e1'
env=os.environ.copy();env.update(ZIG_GLOBAL_CACHE_DIR='/tmp/zig-global',ZIG_LOCAL_CACHE_DIR='/tmp/zig-e2b')
base=[str(E/'tools/python/ziglang/zig'),'cc','-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-O2','-nostdlib','-fno-builtin','-ffunction-sections','-fdata-sections','-D__BLST_NO_ASM__','-D__BLST_NO_CPUID__','-DE2_RV64_LIMBS','-DAFFINE','-DMULTI','-I'+str(E1/'deps/ckb-c-stdlib'),'-I'+str(E1/'deps/ckb-c-stdlib/libc'),'-I'+str(E1/'deps/ckb-c-stdlib/molecule'),'-I'+str(E1/'contracts'),'-I'+str(E/'vendor/blst/bindings'),'-Icontracts','-Ibuild']
subprocess.run(base+['-DCKB_DECLARATION_ONLY','-c',str(E/'vendor/blst/src/server.c'),'-o','build/blst.o'],cwd=R,env=env,check=True)
metrics=[]
for name in ['bundle','root_probe']:
 subprocess.run(base+['contracts/'+name+'.c','build/blst.o','-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000','-o','build/'+name],cwd=R,env=env,check=True)
 b=(R/'build'/name).read_bytes();h=hashlib.blake2b(b,digest_size=32,person=b'ckb-default-hash').digest()
 if name=='bundle':
  for role in ['state','certificate','root']:(R/'build'/role).write_bytes(b)
  (R/'build/root_hash.h').write_text('static const uint8_t root_hash[32]={'+','.join(str(x) for x in h)+'};\n')
 (R/f'build/{name}_hash.h').write_text('static const uint8_t '+name+'_hash[32]={'+','.join(str(x) for x in h)+'};\n')
 metrics.append({'name':name,'bytes':len(b),'codeHash':'0x'+h.hex(),'sha256':hashlib.sha256(b).hexdigest()})
(R/'evidence/binaries-bundle.json').write_text(json.dumps(metrics,indent=2)+'\n')

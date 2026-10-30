from pathlib import Path
import os,subprocess,json,hashlib
R=Path(__file__).resolve().parents[1];E=R.parent;E1=E.parent/'wo04-e1'
(R/'build').mkdir(exist_ok=True)
env=os.environ.copy();env.update(ZIG_GLOBAL_CACHE_DIR='/tmp/zig-global',ZIG_LOCAL_CACHE_DIR='/tmp/zig-e2c')
records=[]
for name in ['settlement','history_probe']:
 cmd=[str(E/'tools/python/ziglang/zig'),'cc','-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-O2','-nostdlib','-fno-builtin','-ffunction-sections','-fdata-sections','-I'+str(E1/'deps/ckb-c-stdlib'),'-I'+str(E1/'deps/ckb-c-stdlib/libc'),'-I'+str(E1/'contracts'),'-I'+str(R/'contracts'),str(R/'contracts'/f'{name}.c'),'-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000','-o',str(R/'build'/name)]
 subprocess.run(cmd,env=env,check=True);b=(R/'build'/name).read_bytes()
 records.append(dict(name=name,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),codeHash='0x'+hashlib.blake2b(b,digest_size=32,person=b'ckb-default-hash').hexdigest()))
(R/'evidence/build.json').write_text(json.dumps(records,indent=2)+'\n')

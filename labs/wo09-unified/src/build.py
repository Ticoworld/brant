from pathlib import Path
import subprocess,json,hashlib
p=Path(__file__).resolve().parents[1];repo=p.parents[1];base=repo/'labs/rebuild/mechanisms'
zig=str(base/'tools/python/ziglang/zig')
cmd=[zig,'cc','-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-Oz','-nostdlib','-fno-builtin','-fdata-sections','-ffunction-sections','-I'+str(base/'deps/ckb-c-stdlib'),'-I'+str(base/'deps/ckb-c-stdlib/libc'),'-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000','-o',str(p/'build/cohort'),str(p/'contracts/cohort.c')]
subprocess.run(cmd,check=True)
b=(p/'build/cohort').read_bytes();(p/'build/manifest.json').write_text(json.dumps({'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'command':cmd},indent=2)+'\n')
print(len(b),hashlib.sha256(b).hexdigest())

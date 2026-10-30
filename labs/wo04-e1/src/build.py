from pathlib import Path
import subprocess,json,hashlib
p=Path(__file__).resolve().parents[1];records=[]
for name in ['settlement','checkpoint','deny','reservation']:
 cmd=[str(p/'tools/python/ziglang/zig'),'cc','-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-O2','-nostdlib','-fno-builtin','-fdata-sections','-ffunction-sections','-Ideps/ckb-c-stdlib','-Ideps/ckb-c-stdlib/libc','-Icontracts','-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000','-o','build/'+name,'contracts/'+name+'.c']
 subprocess.run(cmd,cwd=p,check=True);b=(p/'build'/name).read_bytes();records.append({'name':name,'command':cmd,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
(p/'evidence/build.json').write_text(json.dumps(records,indent=2)+'\n')

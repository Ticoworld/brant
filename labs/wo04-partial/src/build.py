from pathlib import Path
import subprocess,json,hashlib
p=Path(__file__).resolve().parents[1];zig=p/'tools/python/ziglang/zig'
cmd=[str(zig),'cc','-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-O2','-nostdlib','-fno-builtin','-fdata-sections','-ffunction-sections','-Ideps/ckb-c-stdlib','-Ideps/ckb-c-stdlib/libc','-Ideps/monocypher','-Wl,--gc-sections','-Wl,-e,_start','-Wl,--strip-all','-Wl,--image-base=0x10000','-o','build/ckb-escrow','contracts/session.c','deps/monocypher/monocypher.c','deps/monocypher/monocypher-ed25519.c']
common=cmd[:cmd.index('-Wl,--gc-sections')]
for stem in ['monocypher','monocypher-ed25519']:
 subprocess.run(common+['-DCKB_DECLARATION_ONLY','-c','deps/monocypher/'+stem+'.c','-o','build/'+stem+'.o'],cwd=p,check=True)
cmd=cmd[:-2]+['build/monocypher.o','build/monocypher-ed25519.o']
subprocess.run(cmd,cwd=p,check=True)
(p/'evidence/build.json').write_text(json.dumps({'command':cmd,'sha256':hashlib.sha256((p/'build/ckb-escrow').read_bytes()).hexdigest(),'bytes':(p/'build/ckb-escrow').stat().st_size},indent=2)+'\n')

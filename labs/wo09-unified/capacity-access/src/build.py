from pathlib import Path
import subprocess,hashlib,json
p=Path(__file__).resolve().parents[1];repo=p.parents[2];base=repo/'labs/rebuild/mechanisms';zig=str(base/'tools/python/ziglang/zig')
assert subprocess.check_output([zig,'version'],text=True).strip()=='0.14.1'
cmd=[zig,'build-obj',str(p/'contracts/auth.zig'),'-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-O','ReleaseSmall','-femit-bin='+str(p/'build/auth.o')]
subprocess.run(cmd,check=True)
cmd2=[zig,'cc','-target','riscv64-freestanding','-mcpu=generic_rv64+m+c','-Oz','-nostdlib','-fno-builtin','-I'+str(base/'deps/ckb-c-stdlib'),'-I'+str(base/'deps/ckb-c-stdlib/libc'),'-Wl,-e,_start','-Wl,--gc-sections','-Wl,--strip-all','-Wl,--image-base=0x10000','-o',str(p/'build/pool'),str(p/'contracts/pool.c'),str(p/'build/auth.o')]
subprocess.run(cmd2,check=True);b=(p/'build/pool').read_bytes();(p/'build/manifest.json').write_text(json.dumps(dict(bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),commands=[cmd,cmd2],signature_library='Zig0.14.1 std.crypto.sign.Ed25519',qualification='Native CKB0.210.0 and independent Node/OpenSSL Ed25519 verified in preserved evidence; research only',source_sha256={str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in list((p/'contracts').glob('*'))+list((p/'research').glob('*'))},common_header_sha256=hashlib.sha256((repo/'labs/wo09-open-markets/contracts/common.h').read_bytes()).hexdigest()),indent=2)+'\n');print(len(b),hashlib.sha256(b).hexdigest())

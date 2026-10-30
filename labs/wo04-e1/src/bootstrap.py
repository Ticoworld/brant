#!/usr/bin/env python3
"""Download exact test tools, verify CKB archive, no public-chain transactions."""
import pathlib,urllib.request,hashlib,tarfile,subprocess,sys
p=pathlib.Path(__file__).resolve().parents[1];d=p/'tools';d.mkdir(exist_ok=True)
u='https://github.com/nervosnetwork/ckb/releases/download/v0.210.0/ckb_v0.210.0_x86_64-unknown-linux-gnu.tar.gz';a=d/'ckb.tar.gz'
if not a.exists():a.write_bytes(urllib.request.urlopen(u,timeout=120).read())
assert hashlib.sha256(a.read_bytes()).hexdigest()=='68a94c191109bae172f8dcb71828dbdf0383e2c314e0658743db217472b27bdf'
b=d/'ckb';b.mkdir(exist_ok=True)
with tarfile.open(a) as t:
 member=next(m for m in t.getmembers() if pathlib.PurePosixPath(m.name).name=='ckb' and m.isfile());(b/'ckb').write_bytes(t.extractfile(member).read());(b/'ckb').chmod(0o755)
subprocess.run([sys.executable,'-m','pip','install','--target',str(d/'python'),'ziglang==0.14.1'],check=True)
subprocess.run(['npm','ci','--ignore-scripts'],cwd=p,check=True)
print('Pinned tools prepared; run python3 src/build.py, node src/compile.cjs, python3 src/launch.py')

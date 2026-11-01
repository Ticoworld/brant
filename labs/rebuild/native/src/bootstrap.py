"""Acquire pinned official CKB only; npm ci separately preserves lockfile integrity."""
from pathlib import Path
from urllib.request import urlopen
import hashlib,tarfile,subprocess
root=Path(__file__).resolve().parents[1]
tools=root/'tools';tools.mkdir(exist_ok=True)
archive=tools/'ckb.tar.gz'
if not archive.exists():
    archive.write_bytes(urlopen('https://github.com/nervosnetwork/ckb/releases/download/v0.210.0/ckb_v0.210.0_x86_64-unknown-linux-gnu.tar.gz',timeout=120).read())
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='68a94c191109bae172f8dcb71828dbdf0383e2c314e0658743db217472b27bdf'
with tarfile.open(archive) as tar:
    member=next(m for m in tar.getmembers() if m.isfile() and Path(m.name).name=='ckb')
    binary=tools/'ckb';binary.write_bytes(tar.extractfile(member).read());binary.chmod(0o755)
subprocess.run([str(binary),'--version'],check=True)

#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/pip install -r requirements.lock
.venv/bin/pip install --target tools/python ziglang==0.14.1
.venv/bin/python - <<'PY'
import hashlib,pathlib,tarfile,urllib.request
p=pathlib.Path('tools/debugger.tar.gz');p.parent.mkdir(exist_ok=True)
if not p.exists():
    p.write_bytes(urllib.request.urlopen('https://github.com/nervosnetwork/ckb-standalone-debugger/releases/download/v1.1.0/ckb-debugger_v1.1.0_x86_64-unknown-linux-gnu.tar.gz',timeout=120).read())
assert hashlib.sha256(p.read_bytes()).hexdigest()=='b3ce795891c9e8b86ef18bb775006578ebdd9182ceffac2b33f7518afed1fefb'
out=pathlib.Path('tools/debugger');out.mkdir(exist_ok=True)
with tarfile.open(p) as t:
    member=next(m for m in t.getmembers() if pathlib.PurePosixPath(m.name).name=='ckb-debugger' and m.isfile())
    b=out/'ckb-debugger';b.write_bytes(t.extractfile(member).read());b.chmod(0o755)
PY
sha256sum -c fixtures/SHA256SUMS
# mock_tx.cjs and devnet.cjs reuse E1's pinned SDK and verified CKB binary.
# Follow docs/CLOUD_SETUP_RESULT.md if those ignored dependencies are absent.

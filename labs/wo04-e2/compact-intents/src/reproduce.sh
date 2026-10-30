#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export P1_RUN_NAME="${P1_RUN_NAME:-offline-$(date -u +%Y%m%dT%H%M%S)}"
[[ "$P1_RUN_NAME" =~ ^[A-Za-z0-9_-]+$ ]]
[ ! -e "evidence/chain-$P1_RUN_NAME.json" ]
(cd fixtures && sha256sum -c SHA256SUMS)
python src/native.py
../.venv/bin/python devnet/prepare.py offline
python devnet/build.py
node src/compile.cjs
node src/verify_deployment.cjs --offline
../.venv/bin/python src/test_identity.py
../.venv/bin/python src/test_mpt.py
../.venv/bin/python devnet/verify.py
node src/replay.cjs
python src/audit.py "$P1_RUN_NAME"
(cd fixtures && sha256sum -c SHA256SUMS)

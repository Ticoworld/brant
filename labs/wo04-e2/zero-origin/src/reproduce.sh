#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export E2D_RUN_NAME="${E2D_RUN_NAME:-offline-$(date -u +%Y%m%dT%H%M%S)}"
[[ "$E2D_RUN_NAME" =~ ^[A-Za-z0-9_-]+$ ]]
[ ! -e "evidence/chain-$E2D_RUN_NAME.json" ]
(cd fixtures && sha256sum -c SHA256SUMS)
(cd references && sha256sum -c SHA256SUMS)
python src/native.py
../.venv/bin/python devnet/prepare.py offline
python devnet/build.py
node src/compile.cjs
node src/verify_deployment.cjs --offline
../.venv/bin/python src/test_mpt.py
../.venv/bin/python devnet/verify.py
node src/replay.cjs
python src/audit.py "$E2D_RUN_NAME"

#!/usr/bin/env bash
# Replay captured GENUINE private-PoS consensus and settlement evidence offline.
set -euo pipefail
cd "$(dirname "$0")/.."
export E2C_RUN_NAME="${E2C_RUN_NAME:-offline-$(date -u +%Y%m%dT%H%M%S)}"
[[ "$E2C_RUN_NAME" =~ ^[A-Za-z0-9_-]+$ ]]
[ ! -e "evidence/chain-$E2C_RUN_NAME.json" ]
(cd fixtures/devnet && sha256sum -c SHA256SUMS)
python src/native.py
../.venv/bin/python devnet/prepare.py offline
python devnet/build.py
node src/compile.cjs
../.venv/bin/python devnet/verify.py
node src/replay-pos.cjs
python src/audit.py "$E2C_RUN_NAME"

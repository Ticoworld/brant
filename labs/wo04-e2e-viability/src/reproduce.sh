#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export P1_RUN_NAME="${P1_RUN_NAME:-offline-$(date -u +%Y%m%dT%H%M%S)}"
[ ! -e "evidence/chain-$P1_RUN_NAME.json" ]
sha256sum -c fixtures/SHA256SUMS
python src/native.py
../wo04-e2/.venv/bin/python devnet/prepare.py offline
python devnet/build.py
node src/compile.cjs
node src/verify_deployment.cjs --offline
node src/test_recovery.cjs
node src/test_saved_recovery.cjs
python src/audit_authority.py
python src/model.py
../wo04-e2/.venv/bin/python devnet/verify.py
node src/replay.cjs
python src/audit_result.py
sha256sum -c fixtures/SHA256SUMS

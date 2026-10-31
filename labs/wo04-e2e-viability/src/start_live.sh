#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Bounded real-finality wait. No synthetic checkpoints or signature generation.
for attempt in $(seq 1 100); do
  if ../wo04-e2/.venv/bin/python devnet/prepare.py bootstrap > evidence/bootstrap.log 2>&1; then break; fi
  if [ "$attempt" = 100 ]; then cat evidence/bootstrap.log; exit 1; fi
  sleep 5
done
python devnet/build.py
P1_RUN_NAME="${P1_RUN_NAME:-recovery-live-02}" node src/run.cjs

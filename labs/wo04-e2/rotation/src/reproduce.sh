#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build evidence
export E2B_RUN_NAME="${E2B_RUN_NAME:-reproduce-$(date -u +%Y%m%dT%H%M%S)}"
export ZIG_GLOBAL_CACHE_DIR=/tmp/zig-global
export ZIG_LOCAL_CACHE_DIR=/tmp/zig-native
(cd .. && sha256sum -c fixtures/SHA256SUMS)
sha256sum -c fixtures/SHA256SUMS
sha256sum -c references/SHA256SUMS
../tools/python/ziglang/zig cc -shared -fPIC -O2 -mno-sha -mno-adx -D__BLST_PORTABLE__ -D__BLST_NO_ASM__ -D__BLST_NO_CPUID__ ../vendor/blst/src/server.c -o build/libblst.so
../.venv/bin/python src/prepare.py > "evidence/prepare-$E2B_RUN_NAME.log" 2>&1
sha256sum -c fixtures/SHA256SUMS
../.venv/bin/python src/build.py > "evidence/build-$E2B_RUN_NAME.log" 2>&1
node src/run.cjs > "evidence/run-$E2B_RUN_NAME.log" 2>&1
../.venv/bin/python src/fork_reference.py > "evidence/fork-$E2B_RUN_NAME.log" 2>&1
../.venv/bin/python src/summarize.py > "evidence/summary-$E2B_RUN_NAME.log" 2>&1

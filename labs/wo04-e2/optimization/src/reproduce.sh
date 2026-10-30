#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build evidence
# Existing pinned E2 Python/blst/Zig and E1 CKB/SDK dependencies are required.
# Their installation is documented in ../README.md; no fallback rebuild is needed.
(cd .. && sha256sum -c fixtures/SHA256SUMS)
sha256sum -c fixtures/SHA256SUMS
export ZIG_GLOBAL_CACHE_DIR=/tmp/zig-global
export ZIG_LOCAL_CACHE_DIR=/tmp/zig-native
../tools/python/ziglang/zig cc -shared -fPIC -O2 -mno-sha -mno-adx -D__BLST_PORTABLE__ -D__BLST_NO_ASM__ -D__BLST_NO_CPUID__ ../vendor/blst/src/server.c -o build/libblst.so
../.venv/bin/python src/prepare.py
../.venv/bin/python src/adversarial.py
sha256sum -c fixtures/SHA256SUMS
../.venv/bin/python src/build.py
../.venv/bin/python src/build_certificate.py
node src/mock.cjs
../.venv/bin/python src/run.py
for n in 512 511 510; do node src/devnet.cjs "$n"; done
node src/certificate_node.cjs
node src/capacity_node.cjs 510
../.venv/bin/python src/summarize.py

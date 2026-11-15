#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.."
up=labs/wo15-r6-secp-upstream
[ "$(git -C "$up" rev-parse HEAD)" = 72eb92fca090700dcb398cd8cad8fbd8bad40355 ]
[ "$(git -C "$up/deps/secp256k1" rev-parse HEAD)" = 3ffde18a060aaf4df5b81e7d88355f1e99874650 ]
cd "$up/deps/secp256k1"
# Windows Git CRLF checkout cannot be consumed by autotools.
git ls-files -z | xargs -0 sed -i 's/\r$//'
bash autogen.sh
bash configure --with-bignum=no --enable-ecmult-static-precomputation --enable-endomorphism --enable-module-recovery --with-asm=no
make src/ecmult_static_pre_context.h src/ecmult_static_context.h
cd ../..
mkdir -p build
gcc -O2 -Ic -Ideps/secp256k1 -Ideps/secp256k1/src c/dump_secp256k1_data.c -o build/dump_secp256k1_data
build/dump_secp256k1_data

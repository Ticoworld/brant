#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; base="$here/../rebuild/mechanisms"; zig="${ZIG_BIN:-$base/tools/python/ziglang/zig}"; std="$base/deps/ckb-c-stdlib"; mkdir -p "$here/build"
flags=(-target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -nostdlib -fno-builtin -fdata-sections -ffunction-sections -I"$std" -I"$std/libc" -Wl,--gc-sections -Wl,-e,_start -Wl,--strip-all -Wl,--image-base=0x10000)
"$zig" cc "${flags[@]}" -o "$here/build/custody" "$here/custody.c"
TRADE_NATIVE_ROOT="${TRADE_NATIVE_ROOT:-$here/../rebuild/native}" node "$here/gen_hash.cjs" > "$here/build/custody_hash.h"
"$zig" cc "${flags[@]}" -I"$here/build" -o "$here/build/market_shared" "$here/market_shared.c"
for name in marker_candidate owner_lineage_candidate; do "$zig" cc "${flags[@]}" -o "$here/build/$name" "$here/../wo16-launch-v2/$name.c"; done

#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; base="$here/../rebuild/mechanisms"; zig="${ZIG_BIN:-$base/tools/python/ziglang/zig}"; std="$base/deps/ckb-c-stdlib"; mkdir -p "$here/build"
flags=(-target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -nostdlib -fno-builtin -fdata-sections -ffunction-sections -I"$std" -I"$std/libc" -Wl,--gc-sections -Wl,-e,_start -Wl,--strip-all -Wl,--image-base=0x10000)
up="${TRADE_SECP_ROOT:-$here/../wo17c-offline/tools/ckb-system-scripts}"
[[ "$(git -C "$up" rev-parse HEAD)" == 72eb92fca090700dcb398cd8cad8fbd8bad40355 ]]
[[ "$(git -C "$up/deps/secp256k1" rev-parse HEAD)" == 3ffde18a060aaf4df5b81e7d88355f1e99874650 ]]
"$zig" cc "${flags[@]}" -o "$here/build/custody_marker" "$here/custody_marker.c"
"$zig" cc "${flags[@]}" -I"$here/../wo15-merkle-intent/r6/build" -I"$up/c" -I"$up/deps/secp256k1" -I"$up/deps/secp256k1/src" -o "$here/build/custody" "$here/custody.c"
TRADE_NATIVE_ROOT="${TRADE_NATIVE_ROOT:-$here/../rebuild/native}" node "$here/gen_codes.cjs" > "$here/build/codes.h"
"$zig" cc "${flags[@]}" -I"$here/build" -o "$here/build/market" "$here/market.c"
for name in marker_candidate owner_lineage_candidate; do "$zig" cc "${flags[@]}" -o "$here/build/$name" "$here/../wo16-launch-v2/$name.c"; done

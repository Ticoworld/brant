#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../.." && pwd)"
zig="${ZIG_BIN:-$root/labs/rebuild/mechanisms/tools/python/ziglang/zig-x86_64-linux-0.14.1/zig}"
std="$root/labs/rebuild/mechanisms/deps/ckb-c-stdlib"
out="${TRADE_GATE2_BUILD_DIR:-$here/build}"
up="${TRADE_SECP_ROOT:-$root/labs/wo17c-offline/tools/ckb-system-scripts}"
[[ "$(git -C "$up" rev-parse HEAD)" == 72eb92fca090700dcb398cd8cad8fbd8bad40355 ]]
[[ "$(git -C "$up/deps/secp256k1" rev-parse HEAD)" == 3ffde18a060aaf4df5b81e7d88355f1e99874650 ]]
mkdir -p "$out"
flags=(-target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -nostdlib -fno-builtin -fdata-sections -ffunction-sections -I"$std" -I"$std/libc" -Wl,--gc-sections -Wl,-e,_start -Wl,--strip-all -Wl,--image-base=0x10000)
"$zig" cc "${flags[@]}" -o "$out/custody_marker" "$root/labs/trade-v2-token/custody_marker.c"
"$zig" cc "${flags[@]}" -I"$root/labs/wo15-merkle-intent/r6/build" -I"$up/c" -I"$up/deps/secp256k1" -I"$up/deps/secp256k1/src" -o "$out/custody_smt" "$here/custody_smt.c"
TRADE_NATIVE_ROOT="$root/labs/rebuild/native" TRADE_GATE2_BUILD_DIR="$out" node "$here/gen_codes.cjs" > "$out/codes.h"
"$zig" cc "${flags[@]}" -I"$out" -o "$out/market_smt" "$here/market_smt.c"
"$zig" cc "${flags[@]}" -o "$out/marker_candidate" "$root/labs/wo16-launch-v2/marker_candidate.c"
"$zig" cc "${flags[@]}" -o "$out/owner_lineage_candidate" "$root/labs/wo16-launch-v2/owner_lineage_candidate.c"
sha256sum "$out"/*

#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="${TRADE_MECHANISMS_ROOT:-$here/../rebuild/mechanisms}"
zig="$root/tools/zig-x86_64-linux-0.14.1/zig"
std="$root/deps/ckb-c-stdlib"
mkdir -p "$here/build"
for name in one_shot_owner market; do
  "$zig" cc -target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -nostdlib -fno-builtin -fdata-sections -ffunction-sections -I"$std" -I"$std/libc" -Wl,--gc-sections -Wl,-e,_start -Wl,--strip-all -Wl,--image-base=0x10000 -o "$here/build/$name" "$here/$name.c"
done

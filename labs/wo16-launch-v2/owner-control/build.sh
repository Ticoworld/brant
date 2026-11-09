#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
zig="${ZIG_BIN:-$root/rebuild/mechanisms/tools/python/ziglang/zig}"
mkdir -p "$here/../build"
"$zig" cc -target riscv64-linux-musl -mcpu=generic_rv64+m+c -O2 -g0 -nostdlib -fPIC -shared -Wl,--strip-debug -Wl,--hash-style=sysv -Wl,-z,max-page-size=4096 -Wl,-T,"$here/link.ld" -o "$here/../build/owner_control.so" "$here/validate.c"

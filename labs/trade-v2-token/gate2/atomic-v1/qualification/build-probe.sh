#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../../.." && pwd)"
: "${ZIG_BIN:?Set ZIG_BIN to pinned Zig 0.14.1}"
: "${LLD_BIN:?Set LLD_BIN to LLVM lld 18}"
out="$here/../build"
std="$root/labs/rebuild/mechanisms/deps/ckb-c-stdlib"
mkdir -p "$out"
"$ZIG_BIN" cc -c -DCKB_NO_ENTRY_GP -target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -fno-builtin -fPIC -I"$std" -I"$std/libc" -o "$out/probe.o" "$here/enhanced_owner_probe.c"
"$LLD_BIN" -shared -Bsymbolic --hash-style=sysv --strip-all -z max-page-size=4096 -T "$root/labs/wo16-launch-v2/owner-control/link.ld" -o "$out/atomic_owner_probe" "$out/probe.o"

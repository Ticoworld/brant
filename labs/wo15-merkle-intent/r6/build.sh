#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
up=wo15-r6-secp-upstream
zig=rebuild/mechanisms/tools/zig-x86_64-linux-0.14.1/zig
std=rebuild/mechanisms/deps/ckb-c-stdlib
out=wo15-merkle-intent/r6/build
mkdir -p "$out"
"$zig" cc -target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -nostdlib -fno-builtin -fdata-sections -ffunction-sections -I"$std" -I"$std/libc" -I"$up/c" -I"$up/build" -I"$up/deps/secp256k1" -I"$up/deps/secp256k1/src" -Wl,--gc-sections -Wl,-e,_start -Wl,--strip-all -Wl,--image-base=0x10000 -o "$out/merkle_intent" wo15-merkle-intent/r6/candidate.c
sha256sum "$out/merkle_intent"

#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
zig=../rebuild/mechanisms/tools/zig-x86_64-linux-0.14.1/zig
mkdir -p build
"$zig" test contracts/secp_auth.zig
"$zig" build-obj contracts/secp_auth.zig -target riscv64-freestanding -mcpu=generic_rv64+m+c -O ReleaseSmall -femit-bin=build/secp_auth.o
"$zig" cc -target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -nostdlib -fno-builtin -fdata-sections -ffunction-sections -I../rebuild/mechanisms/deps/ckb-c-stdlib -I../rebuild/mechanisms/deps/ckb-c-stdlib/libc -Wl,--gc-sections -Wl,-e,_start -Wl,--strip-all -Wl,--image-base=0x10000 -o build/merkle_intent contracts/merkle_intent.c build/secp_auth.o
sha256sum build/merkle_intent

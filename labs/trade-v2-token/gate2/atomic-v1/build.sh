#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../../../.." && pwd)"
: "${ZIG_BIN:?pinned Zig 0.14.1}" "${LLD_BIN:?LLVM 18 lld}"
out="$here/build"; std="$root/labs/rebuild/mechanisms/deps/ckb-c-stdlib"
flags=(-target riscv64-freestanding -mcpu=generic_rv64+m+c -O2 -fno-builtin -I"$std" -I"$std/libc")
"$ZIG_BIN" cc "${flags[@]}" -nostdlib -DBRANT_ATOMIC_MARKER -Wl,--gc-sections -Wl,-e,_start -Wl,--strip-all -Wl,--image-base=0x10000 -o "$out/custody_marker" "$root/labs/trade-v2-token/custody_marker.c"
TRADE_NATIVE_ROOT="$root/labs/rebuild/native" TRADE_GATE2_BUILD_DIR="$out" node "$here/../gen_codes.cjs" > "$out/codes.h"
"$ZIG_BIN" cc "${flags[@]}" -nostdlib -I"$out" -Wl,--gc-sections -Wl,-e,_start -Wl,--strip-all -Wl,--image-base=0x10000 -o "$out/market_smt" "$here/../market_smt.c"
node - "$root" "$out" <<'JS'
const [root,out]=process.argv.slice(2),fs=require('fs'),C=require(root+'/labs/rebuild/native/src/lib.cjs');
fs.writeFileSync(out+'/atomic_codes.h',[['atomic_market_code','market_smt'],['atomic_custody_code','custody_smt'],['atomic_marker_code','custody_marker'],['atomic_market_marker_code','marker_candidate']].map(([n,f])=>`static const uint8_t ${n}[32]={${[...C.b(C.hash(fs.readFileSync(out+'/'+f)))].join(',')}};`).join('\n'));
JS
"$ZIG_BIN" cc "${flags[@]}" -c -fPIC -DCKB_NO_ENTRY_GP -I"$out" -o "$out/initializer.o" "$here/atomic_initializer.c"
"$LLD_BIN" -shared -Bsymbolic --hash-style=sysv --strip-all -z max-page-size=4096 -T "$root/labs/wo16-launch-v2/owner-control/link.ld" -o "$out/atomic_initializer" "$out/initializer.o"
readelf -r "$out/atomic_initializer"

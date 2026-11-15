#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"; up="${TRADE_SECP_ROOT:-$here/tools/ckb-system-scripts}"
if [[ ! -d "$up/.git" ]]; then mkdir -p "$(dirname "$up")"; git clone --no-checkout https://github.com/nervosnetwork/ckb-system-scripts.git "$up"; git -C "$up" checkout --detach 72eb92fca090700dcb398cd8cad8fbd8bad40355; git -C "$up" submodule update --init deps/secp256k1; fi
[[ "$(git -C "$up" rev-parse HEAD)" == 72eb92fca090700dcb398cd8cad8fbd8bad40355 ]]
[[ "$(git -C "$up/deps/secp256k1" rev-parse HEAD)" == 3ffde18a060aaf4df5b81e7d88355f1e99874650 ]]
cd "$up/deps/secp256k1"
gcc -O2 -I. -Isrc src/gen_pre_context.c -o "$up/gen-pre-context"
gcc -O2 -I. -Isrc src/gen_context.c -o "$up/gen-context"
"$up/gen-pre-context"
"$up/gen-context"

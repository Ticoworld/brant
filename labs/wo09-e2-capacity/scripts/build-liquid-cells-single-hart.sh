#!/usr/bin/env bash
set -euo pipefail

: "${LIQUID_CELLS_SOURCE:?set this to a clean pinned Liquid-Cells checkout}"
: "${TRADE_ZIG_BIN:?set this to the verified Zig 0.14.1 binary}"
: "${TRADE_CARGO_BIN:?set this to the isolated Rust 1.99.1 cargo binary}"
: "${TRADE_RUSTUP_HOME:?set this to the isolated Rustup home}"
: "${CARGO_HOME:?set this to the isolated Cargo home}"
OUTPUT_BIN=${LIQUID_CELLS_ANCHOR_OUTPUT:-"$(pwd)/labs/wo09-e2-capacity/build/liquid-cells-anchor-single-hart"}
EXPECTED_COMMIT=47492b51673c94635ab23de2c55477625e94ccbf
actual=$(git -C "$LIQUID_CELLS_SOURCE" rev-parse HEAD)
[[ "$actual" == "$EXPECTED_COMMIT" ]] || { echo "wrong upstream revision: $actual" >&2; exit 2; }
[[ -z "$(git -C "$LIQUID_CELLS_SOURCE" status --porcelain)" ]] || { echo "upstream checkout must be clean" >&2; exit 2; }
[[ "$("$TRADE_ZIG_BIN" version)" == "0.14.1" ]] || { echo "expected Zig 0.14.1" >&2; exit 2; }

tmp=$(mktemp -d "${TMPDIR:-/tmp}/trade-liquid-cells-single-hart.XXXXXX")
trap 'echo "single-hart build workspace preserved at $tmp" >&2' EXIT
mkdir "$tmp/source"
git -C "$LIQUID_CELLS_SOURCE" archive "$EXPECTED_COMMIT" | tar -x -C "$tmp/source"
contract="$tmp/source/crates/ckb-contract"
export RUSTUP_HOME="$TRADE_RUSTUP_HOME"
export PATH="$(dirname "$TRADE_CARGO_BIN"):$PATH"
"$TRADE_CARGO_BIN" fetch --locked --manifest-path "$contract/Cargo.toml"
bytes_dir=$(find "$CARGO_HOME/registry/src" -type d -path '*/bytes-1.11.1' -print -quit)
[[ -n "$bytes_dir" ]] || { echo "pinned bytes 1.11.1 was not populated in CARGO_HOME" >&2; exit 2; }
cp -a "$bytes_dir" "$tmp/bytes-single-hart"
cp "$(dirname "$0")/ckbvm-single-hart/single_threaded_atomic.rs" "$tmp/bytes-single-hart/src/"
python3 - "$tmp/bytes-single-hart/src/loom.rs" <<'PY'
import pathlib, sys
p = pathlib.Path(sys.argv[1])
s = p.read_text()
old = "pub(crate) use core::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};"
new = '''mod single_threaded_atomic { include!("single_threaded_atomic.rs"); }
        pub(crate) use single_threaded_atomic::{AtomicPtr, AtomicUsize};
        pub(crate) use core::sync::atomic::Ordering;'''
if s.count(old) != 1:
    raise SystemExit("bytes 1.11.1 loom.rs did not match the audited import")
p.write_text(s.replace(old, new))
PY

sed -i 's/,+forced-atomics//' "$contract/.cargo/config.toml"
cat >> "$contract/Cargo.toml" <<EOF

[patch.crates-io]
bytes = { path = "$tmp/bytes-single-hart" }
EOF

wrapper="$tmp/cross"
mkdir "$wrapper"
cat > "$wrapper/riscv64-unknown-elf-gcc" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
args=()
for arg in "$@"; do
  case "$arg" in
    --target=riscv64) args+=("--target=riscv64-freestanding") ;;
    -march=rv64imc_zba_zbb_zbc_zbs) args+=("-mcpu=baseline_rv64-a-f-d+zba+zbb+zbc+zbs" "-mabi=lp64") ;;
    *) args+=("$arg") ;;
  esac
done
exec "$TRADE_ZIG_BIN" cc "${args[@]}"
SH
cat > "$wrapper/riscv64-unknown-elf-ar" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
exec "$TRADE_ZIG_BIN" ar "$@"
SH
chmod +x "$wrapper/riscv64-unknown-elf-gcc" "$wrapper/riscv64-unknown-elf-ar"
export PATH="$wrapper:$(dirname "$TRADE_CARGO_BIN"):$PATH"

# Cargo config is crate-local; build from the contract directory so -a takes effect.
cd "$contract"
"$TRADE_CARGO_BIN" clean
"$TRADE_CARGO_BIN" build --release --target riscv64imac-unknown-none-elf
mkdir -p "$(dirname "$OUTPUT_BIN")"
cp target/riscv64imac-unknown-none-elf/release/liquid-cells-anchor "$OUTPUT_BIN"
sha256sum "$OUTPUT_BIN"

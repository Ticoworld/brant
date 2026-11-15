#!/usr/bin/env bash
set -euo pipefail

: "${LIQUID_CELLS_DIR:?set LIQUID_CELLS_DIR to a checkout of the pinned upstream repository}"
: "${TRADE_ZIG_BIN:?set TRADE_ZIG_BIN to the verified Zig 0.14.1 binary}"
: "${TRADE_CARGO_BIN:?set TRADE_CARGO_BIN to the Rust 1.99.1 cargo binary}"
: "${TRADE_RUSTUP_HOME:?set TRADE_RUSTUP_HOME to the isolated Rust toolchain directory}"

EXPECTED_COMMIT=47492b51673c94635ab23de2c55477625e94ccbf
ACTUAL_COMMIT=$(git -C "$LIQUID_CELLS_DIR" rev-parse HEAD)
if [[ "$ACTUAL_COMMIT" != "$EXPECTED_COMMIT" ]]; then
  echo "wrong Liquid Cells revision: $ACTUAL_COMMIT" >&2
  exit 2
fi
if [[ -n "$(git -C "$LIQUID_CELLS_DIR" status --porcelain)" ]]; then
  echo "upstream checkout is modified; refusing to run" >&2
  exit 2
fi
if [[ "$($TRADE_ZIG_BIN version)" != "0.14.1" ]]; then
  echo "expected Zig 0.14.1" >&2
  exit 2
fi

TRADE_WRAPPER_DIR=$(mktemp -d "${TMPDIR:-/tmp}/trade-wo09-zig-riscv.XXXXXX")
trap 'rm -rf "$TRADE_WRAPPER_DIR"' EXIT
cat > "$TRADE_WRAPPER_DIR/riscv64-unknown-elf-gcc" <<'WRAPPER'
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
WRAPPER
cat > "$TRADE_WRAPPER_DIR/riscv64-unknown-elf-ar" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
exec "$TRADE_ZIG_BIN" ar "$@"
WRAPPER
chmod +x "$TRADE_WRAPPER_DIR/riscv64-unknown-elf-gcc" "$TRADE_WRAPPER_DIR/riscv64-unknown-elf-ar"
export TRADE_ZIG_BIN
export RUSTUP_HOME="$TRADE_RUSTUP_HOME"
export PATH="$TRADE_WRAPPER_DIR:$(dirname "$TRADE_CARGO_BIN"):$PATH"

CONTRACT_MANIFEST="$LIQUID_CELLS_DIR/crates/ckb-contract/Cargo.toml"
TEST_MANIFEST="$LIQUID_CELLS_DIR/crates/ckb-contract-tests/Cargo.toml"
"$TRADE_CARGO_BIN" clean --manifest-path "$CONTRACT_MANIFEST"
"$TRADE_CARGO_BIN" build --release --target riscv64imac-unknown-none-elf --manifest-path "$CONTRACT_MANIFEST"
for suite in forceexit withdrawal anchor; do
  "$TRADE_CARGO_BIN" test --manifest-path "$TEST_MANIFEST" --test "$suite"
done

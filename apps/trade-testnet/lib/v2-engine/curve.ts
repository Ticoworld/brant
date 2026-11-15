// Arithmetic mirrors the single-owner continuation in gate2/market_smt.c.
const U64 = (1n << 64n) - 1n;
export type Curve = { base: bigint; step: bigint; supply: bigint; inventory: bigint };
export function quote(curve: Curve, side: "buy" | "sell", quantity: bigint): bigint {
  const { base, step, supply, inventory } = curve;
  if (base <= 0n || step <= 0n || base > U64 || step > U64 || supply <= 0n || supply > 0xffffffffn || inventory < 0n || inventory > supply || quantity <= 0n) throw Error("Invalid curve or quantity");
  const sold = supply - inventory;
  if (quantity > (side === "buy" ? inventory : sold)) throw Error("Quantity exceeds available curve inventory");
  const start = side === "buy" ? sold : sold - quantity;
  const price = base * quantity + step * (quantity * start + quantity * (quantity - 1n) / 2n);
  if (price > U64) throw Error("Quote exceeds contract arithmetic range");
  return price;
}

// Gate 2 lock args: anchor hash, base, step, supply, marker hash.
export function decodeCurve(args: string, inventoryData: string): Curve {
  const bytes = (hex: string, length: number) => {
    if (!new RegExp(`^0x[0-9a-fA-F]{${length * 2}}$`).test(hex)) throw Error("Invalid Gate 2 data length");
    return Uint8Array.from(hex.slice(2).match(/../g)!, x => parseInt(x, 16));
  };
  const a = bytes(args, 88), d = bytes(inventoryData, 48);
  const read = (v: Uint8Array, offset: number, length: number) => { let n = 0n; for (let i = length - 1; i >= 0; i--) n = (n << 8n) | BigInt(v[offset + i]); return n; };
  const curve = { base: read(a, 32, 8), step: read(a, 40, 8), supply: read(a, 48, 8), inventory: read(d, 0, 16) };
  if (curve.inventory > U64 || curve.inventory > curve.supply || !curve.base || !curve.step || !curve.supply || curve.supply > 0xffffffffn) throw Error("Invalid Gate 2 market state");
  return curve;
}

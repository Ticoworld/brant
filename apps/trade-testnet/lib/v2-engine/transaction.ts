import { quote, type Curve } from './curve.ts';

// The caller must independently verify the lineage and proof against canonical
// history. This function does not sign, broadcast, or authenticate its inputs.
export type Cell = { outPoint: { txHash: string; index: string }; capacity: bigint; lock: unknown; type?: unknown; data: string };
export type Transition = { curve: Curve; cells: [Cell, Cell, Cell, Cell, Cell]; custodyAmount: bigint; newRoot: string; witness: string; fee: bigint; side: 'buy' | 'sell'; quantity: bigint };
const LIMIT = 1_000_000n, MAX = (1n << 64n) - 1n;
const hash = /^0x[0-9a-fA-F]{64}$/;
function le(n: bigint, bytes: number) {
  if (n < 0n || n >= 1n << BigInt(bytes * 8)) throw Error('Integer out of range');
  return Array.from({length: bytes}, (_, i) => Number((n >> BigInt(8 * i)) & 255n).toString(16).padStart(2, '0')).join('');
}
export function buildTransition(t: Transition) {
  const [market, marker, custody, custodyMarker, wallet] = t.cells;
  if (!hash.test(t.newRoot) || !/^0x(?:[0-9a-fA-F]{2})+$/.test(t.witness)) throw Error('Invalid proof');
  if (!/^0x[0-9a-fA-F]{96}$/.test(market.data) || !/^0x[0-9a-fA-F]{96}$/.test(custody.data)) throw Error('Invalid singleton data');
  if (t.fee < 0n || t.fee > LIMIT || t.custodyAmount < 0n || t.custodyAmount > MAX) throw Error('Invalid fee or custody amount');
  const points = t.cells.map(c => `${c.outPoint.txHash.toLowerCase()}:${BigInt(c.outPoint.index)}`);
  if (new Set(points).size !== 5 || t.cells.some(c => !hash.test(c.outPoint.txHash) || c.capacity < 0n || c.capacity > MAX)) throw Error('Invalid input cells');
  const amount = quote(t.curve, t.side, t.quantity), buy = t.side === 'buy';
  const nextInventory = t.curve.inventory + (buy ? -t.quantity : t.quantity);
  const nextCustody = t.custodyAmount + (buy ? t.quantity : -t.quantity);
  const marketCapacity = market.capacity + (buy ? amount : -amount);
  const walletCapacity = wallet.capacity + (buy ? -amount : amount) - t.fee;
  if (nextCustody < 0n || nextCustody > MAX || marketCapacity < 0n || marketCapacity > MAX || walletCapacity < 0n || walletCapacity > MAX) throw Error('Insufficient capacity or balance');
  const output = (cell: Cell, capacity = cell.capacity) => ({ capacity: `0x${capacity.toString(16)}`, lock: cell.lock, ...(cell.type ? {type: cell.type} : {}) });
  return {
    amount,
    inputs: t.cells.map(c => ({ previousOutput: c.outPoint, since: '0x0' })),
    outputs: [output(market, marketCapacity), output(marker), output(custody), output(custodyMarker), output(wallet, walletCapacity)],
    outputsData: ['0x' + le(nextInventory, 16) + market.data.slice(34), marker.data, '0x' + le(nextCustody, 16) + t.newRoot.slice(2), custodyMarker.data, wallet.data],
    witnesses: ['0x', '0x', '0x', '0x', '0x', t.witness],
  };
}

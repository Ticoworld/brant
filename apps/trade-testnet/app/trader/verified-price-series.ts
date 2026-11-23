import {quote} from '../../lib/v2-engine/curve.ts';
import {PUDGE_GATE2_INITIALIZATION, PUDGE_GATE2_REGISTRY_ID} from '../../lib/v2-engine/pudge-public-registry.ts';
import type {MarketData, TradeEvent} from './types';

export const intervals = {'1m': 60, '5m': 300, '1h': 3600, '4h': 14400, '1D': 86400} as const;
export type Timeframe = keyof typeof intervals;
export type PriceBar = {
  time: number;
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
  volume: bigint;
  quantity: bigint;
  buys: number;
  sells: number;
};

export function executionKey(event: TradeEvent) {
  return event.hash.toLowerCase() + ':' + (event.executionIndex ?? 0);
}

export function buildVerifiedPriceSeries(market: MarketData, timeframe: Timeframe) {
  if (market.historyState !== 'verified' || !market.history.length) return null;
  try {
    const {history} = market;
    const first = history[0];
    if (first.side !== 'buy' || first.executionIndex !== undefined ||
      (market.id === PUDGE_GATE2_REGISTRY_ID && first.hash.toLowerCase() !== PUDGE_GATE2_INITIALIZATION)) return null;

    const {base, step, supply, sold: finalSold} = {
      base: BigInt(market.curve.base), step: BigInt(market.curve.step),
      supply: BigInt(market.curve.supply), sold: BigInt(market.curve.sold),
    };
    if (supply !== BigInt(market.supply) || supply - finalSold !== BigInt(market.inventory)) return null;
    let sold = history.reduce((position, event) => position + (event.side === 'buy' ? -1n : 1n) * BigInt(event.quantity), finalSold);
    if (sold !== 0n) return null;

    const bars: PriceBar[] = [];
    const seen = new Set<string>();
    let previousTime = -1n;
    let previousBlock = -1n;
    let previous: TradeEvent | undefined;
    const interval = BigInt(intervals[timeframe]);
    for (const event of history) {
      const quantity = BigInt(event.quantity);
      const amount = BigInt(event.amountShannons);
      const timestamp = BigInt(event.timestampMs);
      const block = BigInt(event.blockNumber);
      const key = executionKey(event);
      if (event.status !== 'confirmed' || (event.side !== 'buy' && event.side !== 'sell') ||
        quantity <= 0n || timestamp <= 0n || timestamp > 8_640_000_000_000_000n || timestamp < previousTime ||
        block < 0n || block < previousBlock || seen.has(key)) return null;
      if (event.executionIndex !== undefined && (!Number.isSafeInteger(event.executionIndex) || event.executionIndex < 0 ||
        event.executionIndex !== (previous?.hash === event.hash ? (previous.executionIndex ?? -1) + 1 : 0))) return null;
      if (previous?.hash === event.hash && (event.executionIndex === undefined || previous.executionIndex === undefined ||
        timestamp !== previousTime || block !== previousBlock)) return null;
      if (quote({base, step, supply, inventory: supply - sold}, event.side, quantity) !== amount) return null;

      const open = base + step * sold;
      sold += event.side === 'buy' ? quantity : -quantity;
      const close = base + step * sold;
      const high = open > close ? open : close;
      const low = open < close ? open : close;
      const time = Number(timestamp / (interval * 1000n) * interval);
      const buys = event.side === 'buy' ? 1 : 0;
      const sells = 1 - buys;
      const last = bars.at(-1);
      if (last?.time === time) {
        if (high > last.high) last.high = high;
        if (low < last.low) last.low = low;
        last.close = close;
        last.volume += amount;
        last.quantity += quantity;
        last.buys += buys;
        last.sells += sells;
      } else {
        bars.push({time, open, high, low, close, volume: amount, quantity, buys, sells});
      }
      seen.add(key);
      previousTime = timestamp;
      previousBlock = block;
      previous = event;
    }

    const latest = sold < supply ? base + step * sold : null;
    if (sold !== finalSold || (latest !== null && latest !== BigInt(market.buyOneShannons))) return null;
    return {bars, latest, executions: history};
  } catch {
    return null;
  }
}

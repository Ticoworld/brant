import assert from 'node:assert/strict';
import {buildVerifiedPriceSeries} from '../app/trader/verified-price-series.ts';
import {PUDGE_GATE2_INITIALIZATION} from '../lib/v2-engine/pudge-public-registry.ts';
import type {MarketData, TradeEvent} from '../app/trader/types.ts';

const ckb = 100_000_000n;
const midnight = Date.UTC(2026, 10, 1);
function trade(hash: string, side: TradeEvent['side'], quantity: number, amount: bigint, minute: number, block: number, executionIndex?: number): TradeEvent {
  return {hash, side, quantity: String(quantity), amountShannons: String(amount * ckb),
    timestampMs: String(midnight + minute * 60_000), blockNumber: String(block),
    status:'confirmed', owner:'fixture', executionIndex};
}
const launch = trade(PUDGE_GATE2_INITIALIZATION, 'buy', 7, 91n, 0, 1);
const buy = trade('z-buy', 'buy', 2, 35n, 1, 2);
const sell = trade('a-sell', 'sell', 1, 18n, 1, 2);
const market = {
  id:'pudge-xudt', historyState:'verified', supply:'2000', inventory:'1992',
  curve:{base:String(10n * ckb), step:String(ckb), supply:'2000', sold:'8'},
  history:[launch, buy, sell], buyOneShannons:String(18n * ckb),
} as MarketData;
const result = buildVerifiedPriceSeries(market, '1m');
assert(result);
assert.equal(result.latest, 18n * ckb);
assert.deepEqual(result.bars, [
  {time:midnight/1000, open:10n*ckb, high:17n*ckb, low:10n*ckb, close:17n*ckb, volume:91n*ckb, quantity:7n, buys:1, sells:0},
  {time:midnight/1000+60, open:17n*ckb, high:19n*ckb, low:17n*ckb, close:18n*ckb, volume:53n*ckb, quantity:3n, buys:1, sells:1},
]);
assert.deepEqual(result.executions, [launch,buy,sell]);
const separated = {...market, history:[launch,buy,{...sell,timestampMs:String(midnight+121*60_000)}]};
assert.deepEqual(buildVerifiedPriceSeries(separated,'1m')?.bars.map(bar => bar.close), [17n,19n,18n].map(n => n*ckb));
assert.deepEqual(buildVerifiedPriceSeries(separated,'1h')?.bars.map(bar => bar.time), [midnight/1000,midnight/1000+7200]);
for (const frame of ['5m','4h','1D'] as const) {
  const grouped = buildVerifiedPriceSeries(market,frame)?.bars;
  assert.equal(grouped?.length,1);
  assert.equal(grouped[0].volume,144n*ckb);
}
const batchA = trade('batch','buy',1,17n,1,2,0);
const batchB = trade('batch','buy',1,18n,1,2,1);
assert.equal(buildVerifiedPriceSeries({...market,history:[launch,batchA,batchB,sell]},'4h')?.bars[0].buys,3);

for (const bad of [
  {...market,history:[]},
  {...market,historyState:'unavailable' as const},
  {...market,history:[launch,{...buy,amountShannons:'0'},sell]},
  {...market,history:[launch,buy,{...sell,amountShannons:String(17n*ckb)}]},
  {...market,history:[launch,sell,buy]},
  {...market,history:[launch,buy,buy,sell]},
  {...market,history:[launch,batchB,batchA,sell]},
  {...market,history:[launch,buy,{...sell,timestampMs:String(midnight-1)}]},
  {...market,history:[{...launch,hash:'wrong-initializer'},buy,sell]},
  {...market,history:[buy,sell]},
  {...market,inventory:'1991'},
  {...market,buyOneShannons:String(19n*ckb)},
]) assert.equal(buildVerifiedPriceSeries(bad,'4h'),null);

console.log('PASS verified price series · launch, execution order, OHLCV, UTC buckets, duplicates and quote checks');

import assert from 'node:assert/strict';
import {deriveMarketLiquidity,deriveTradeFunding,PUDGE_TRADE_CHANGE_CAPACITY,PUDGE_TRADE_FEE} from '../lib/v2-engine/market-capacity.ts';
import {resolvePudgeTokenMetadata} from '../lib/pudge-market-metadata.ts';

const genesis='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
const market='0x94eb3a5227c80a2d65cb2713df29a800e859a8bd36c47fb367e79f5bbe62ea0e';
const type='0xa706188a0d74a200306109a88fd7835b75eff42f35e9983fa0d3c2138e181ddb';
const initialization='0xc37029b982276a7c3e126a5658510fda1cd5f2963caf650b04f397a8484c7d2a';
const unit=100_000_000n;

assert.deepEqual(deriveMarketLiquidity((391n*unit).toString(),(300n*unit).toString()),{
  marketCellCapacity:(391n*unit).toString(),marketCapacityFloorShannons:(300n*unit).toString(),reserveShannons:(91n*unit).toString(),
});
assert.throws(()=>deriveMarketLiquidity('29999999999','30000000000'),/initialization capacity/);
assert.deepEqual(deriveTradeFunding(80n*unit,PUDGE_TRADE_CHANGE_CAPACITY,PUDGE_TRADE_FEE),{hasFundingCell:true,availableToTrade:1_899_000_000n});
assert.deepEqual(deriveTradeFunding(PUDGE_TRADE_CHANGE_CAPACITY+PUDGE_TRADE_FEE-1n,PUDGE_TRADE_CHANGE_CAPACITY,PUDGE_TRADE_FEE),{hasFundingCell:false,availableToTrade:0n});
assert.deepEqual(deriveTradeFunding(PUDGE_TRADE_CHANGE_CAPACITY+PUDGE_TRADE_FEE,PUDGE_TRADE_CHANGE_CAPACITY,PUDGE_TRADE_FEE),{hasFundingCell:true,availableToTrade:0n});

assert.equal(resolvePudgeTokenMetadata({genesis,marketScriptHash:market,tokenTypeHash:type,initializationTransactionHash:initialization}).symbol,'RVK');
assert.equal(resolvePudgeTokenMetadata({genesis,marketScriptHash:market,tokenTypeHash:'0x'+'00'.repeat(32),initializationTransactionHash:initialization}).symbol,'xUDT');
console.log('Pudge accounting and metadata checks passed');

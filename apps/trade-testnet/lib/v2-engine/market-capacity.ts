const UNIT=100_000_000n;
// A plain secp256k1 lock-only output with empty data occupies 61 CKB.
export const PUDGE_TRADE_CHANGE_CAPACITY=61n*UNIT;
export const PUDGE_TRADE_FEE=1_000_000n;

export function deriveMarketLiquidity(cellCapacity:string,floorCapacity:string){
  const capacity=BigInt(cellCapacity),floor=BigInt(floorCapacity);
  if(capacity<0n||floor<0n||capacity<floor)throw Error('Market Cell is below its confirmed initialization capacity');
  return {marketCellCapacity:capacity.toString(),marketCapacityFloorShannons:floor.toString(),reserveShannons:(capacity-floor).toString()};
}

export function deriveTradeFunding(maxPlainCellCapacity:bigint,changeCapacity:bigint,fee:bigint){
  if(maxPlainCellCapacity<0n||changeCapacity<0n||fee<0n)throw Error('Invalid wallet funding capacity');
  const minimum=changeCapacity+fee,hasFundingCell=maxPlainCellCapacity>=minimum;
  return {hasFundingCell,availableToTrade:hasFundingCell?maxPlainCellCapacity-minimum:0n};
}

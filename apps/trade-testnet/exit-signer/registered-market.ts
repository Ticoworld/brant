import {ccc} from '@ckb-ccc/core';
import {deriveMarketIdentity} from '../lib/v2-engine/initialization.ts';
import {
  PUDGE_GATE2_ANCHOR, PUDGE_GATE2_CODES, PUDGE_GATE2_GENESIS, PUDGE_GATE2_INITIALIZATION,
  PUDGE_GATE2_JOURNAL, PUDGE_GATE2_STAGE_TXS, PUDGE_GATE2_XUDT_DEP,
} from '../lib/v2-engine/pudge-public-registry.ts';

const identity = deriveMarketIdentity({
  anchor: PUDGE_GATE2_ANCHOR, genesis: PUDGE_GATE2_GENESIS,
  base: 1000000000n, step: 100000000n, supply: 2000n,
  codes: {...PUDGE_GATE2_CODES, owner: PUDGE_GATE2_CODES.ownerLock},
});
const secpHash = '0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37';
const dependencies = [
  {dep: {outPoint: {txHash: secpHash, index: 0}, depType: 'depGroup'}, hash: '0xf66ca3517241864672b7f47d093aec4d6d4d07824068993eacd728eb9078e236'},
  ...[[0, PUDGE_GATE2_CODES.custody], [2, PUDGE_GATE2_CODES.custodyMarker]].map(([index, hash]) =>
    ({dep: {outPoint: {txHash: PUDGE_GATE2_STAGE_TXS.code, index}, depType: 'code'}, hash})),
  {dep: PUDGE_GATE2_XUDT_DEP, hash: PUDGE_GATE2_CODES.xudt},
] as const;

export function checkRegisteredTransaction(tx: ccc.Transaction) {
  if (tx.headerDeps.length !== 1 || tx.headerDeps[0] !== PUDGE_GATE2_GENESIS) {
    throw Error('Withdrawal requires the registered Pudge genesis header');
  }
  const [custody, marker, destination] = tx.outputs;
  if (custody?.type?.hash() !== identity.token.hash() || destination?.type?.hash() !== identity.token.hash()) {
    throw Error('Token type is not registered RVK');
  }
  if (custody.lock.hash() !== identity.custody.hash() || marker?.lock.hash() !== identity.custody.hash() ||
      marker?.type?.hash() !== identity.custodyMarker.hash() || tx.outputsData[1] !== identity.custodyMarkerData) {
    throw Error('Custody does not match the registered RVK/CKB market');
  }
  const points = tx.inputs.map(input => input.previousOutput);
  if (tx.version !== 0n || tx.inputs.some(input => input.since !== 0n) ||
      new Set(points.map(point => point.txHash + ':' + point.index)).size !== 3) {
    throw Error('Unexpected withdrawal input layout');
  }
  if (tx.cellDeps.length !== dependencies.length || dependencies.some(({dep}) =>
    tx.cellDeps.filter(actual => actual.depType === dep.depType &&
      actual.outPoint.eq(dep.outPoint as ccc.OutPointLike)).length !== 1)) {
    throw Error('Unexpected withdrawal code dependency');
  }
}

type EvidenceClient = Pick<ccc.Client, 'getTransactionNoCache' | 'getBlockByNumberNoCache' | 'getHeaderByNumberNoCache' | 'getCellLive'>;
export async function verifyRegisteredMarket(client: EvidenceClient) {
  const expectedBlock = PUDGE_GATE2_JOURNAL.entries[3].blockHash;
  const [genesis, receipt, ...live] = await Promise.all([
    client.getHeaderByNumberNoCache(0),
    client.getTransactionNoCache(PUDGE_GATE2_INITIALIZATION),
    ...dependencies.map(({dep}) => client.getCellLive(dep.outPoint as ccc.OutPointLike, true, true)),
  ]);
  if (genesis?.hash !== PUDGE_GATE2_GENESIS || receipt?.status !== 'committed' ||
      receipt.blockHash !== expectedBlock || receipt.blockNumber == null) {
    throw Error('Registered Pudge initialization is unavailable');
  }
  const block = await client.getBlockByNumberNoCache(receipt.blockNumber);
  const initial = block?.transactions.find(tx => tx.hash() === PUDGE_GATE2_INITIALIZATION);
  if (block?.header.hash !== expectedBlock || !initial ||
      initial.outputs[0]?.lock.hash() !== identity.market.hash() ||
      initial.outputs[0]?.type?.hash() !== identity.token.hash() ||
      initial.outputs[1]?.type?.hash() !== identity.marker.hash() ||
      initial.outputs[2]?.lock.hash() !== identity.custody.hash() ||
      initial.outputs[2]?.type?.hash() !== identity.token.hash() ||
      initial.outputs[3]?.lock.hash() !== identity.custody.hash() ||
      initial.outputs[3]?.type?.hash() !== identity.custodyMarker.hash() ||
      initial.outputsData[3] !== identity.custodyMarkerData) {
    throw Error('Canonical RVK initialization identity mismatch');
  }
  if (dependencies.some(({hash}, index) => !live[index] || ccc.hashCkb(live[index]!.outputData) !== hash)) {
    throw Error('Registered withdrawal dependency is unavailable or changed');
  }
}

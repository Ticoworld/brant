import { ccc } from '@ckb-ccc/core';
import { cccA } from '@ckb-ccc/core/advanced';
import { decodeCurve, quote, type Curve } from './curve.ts';
import { discoverCustodyPair, discoverMarketPair, type Point } from './lineage.ts';
import { loadLocalMarketConfig } from './local-market-config.ts';
import { readLiveSingletons } from './live.ts';

type Rpc = (method: string, params: unknown[]) => Promise<unknown>;
type RpcScript = { code_hash: string; hash_type: string; args: string };
type RpcOutput = { capacity: string; lock: RpcScript; type?: RpcScript | null };
type RpcInput = { previous_output: Point };
type RpcTransaction = {
  hash: string;
  inputs: RpcInput[];
  outputs: RpcOutput[];
  outputs_data: string[];
  witnesses: string[];
};
type TransactionResult = {
  transaction?: RpcTransaction;
  tx_status?: { status?: string; block_hash?: string };
};
type Header = { hash?: string; number?: string };
type LocalConfig = Awaited<ReturnType<typeof loadLocalMarketConfig>>;

export type LocalMarketSnapshot = {
  id: string;
  initTxHash: string;
  curve: Curve;
  buyOne: bigint;
  sellOne: bigint;
  balance: bigint;
  activity: LocalActivity[];
};

export type LocalActivity = {
  kind: 'launch' | 'buy' | 'sell';
  block: bigint;
  transactionHash: string;
  quantity?: bigint;
  amount?: bigint;
};

export function createLocalRpc(): Rpc {
  return async (method, params) => {
    const response = await fetch('/api/local-rpc', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    const body = await response.json();
    if (!response.ok || body.error) throw Error(body.error?.message || 'Local RPC unavailable');
    return body.result;
  };
}

function key(point: Point) {
  return `${point.tx_hash.toLowerCase()}:${BigInt(point.index)}`;
}

function asScript(value?: RpcScript | null) {
  if (!value) return null;
  return ccc.Script.from({
    codeHash: value.code_hash as ccc.Hex,
    hashType: value.hash_type as ccc.HashType,
    args: value.args as ccc.Hex,
  });
}

function sameScript(a?: RpcScript | null, b?: RpcScript | null) {
  const left = asScript(a);
  const right = asScript(b);
  return left === null ? right === null : right !== null && left.hash() === right.hash();
}

function readLittleEndian(hex: string) {
  const bytes = hex.match(/../g);
  if (!bytes) throw Error('Invalid transaction data');
  return BigInt(`0x${bytes.reverse().join('')}`);
}

function writeLittleEndian(value: bigint, bytes: number) {
  return Array.from({ length: bytes }, (_, index) =>
    Number((value >> BigInt(index * 8)) & 255n).toString(16).padStart(2, '0'),
  ).join('');
}

function parseProofWitness(value: string) {
  const witness = value.toLowerCase();
  if (!/^0x544d5331010[0-4]0100[0-9a-f]+$/.test(witness)) throw Error('Invalid market transition witness');
  const proofLength = Number(readLittleEndian(witness.slice(18, 26)));
  if (!Number.isSafeInteger(proofLength)) throw Error('Invalid market proof length');
  const tailStart = 2 + (12 + 96 + proofLength) * 2;
  if (witness.length < tailStart) throw Error('Truncated market transition witness');
  const oldValue = witness.slice(90, 154);
  const newValue = witness.slice(154, 218);
  return {
    operation: Number.parseInt(witness.slice(12, 14), 16),
    owner: `0x${witness.slice(26, 90)}`,
    oldBalance: readLittleEndian(oldValue.slice(0, 16)),
    newBalance: readLittleEndian(newValue.slice(0, 16)),
    tail: witness.slice(tailStart),
  };
}

async function loadCanonicalTransaction(rpc: Rpc, hash: string) {
  const row = await rpc('get_transaction', [hash]) as TransactionResult;
  if (row?.tx_status?.status !== 'committed' || !row.tx_status.block_hash || !row.transaction) {
    throw Error('Required local transaction is not committed');
  }
  const header = await rpc('get_header', [row.tx_status.block_hash]) as Header;
  if (!header.number || header.hash?.toLowerCase() !== row.tx_status.block_hash.toLowerCase()) {
    throw Error('Transaction block is unavailable');
  }
  const canonicalHash = await rpc('get_block_hash', [header.number]);
  if (typeof canonicalHash !== 'string' || canonicalHash.toLowerCase() !== header.hash.toLowerCase()) {
    throw Error('Transaction block is not canonical');
  }
  const transaction = row.transaction;
  const parsed = ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(transaction as never));
  if (parsed.hash().toLowerCase() !== hash.toLowerCase() || transaction.hash.toLowerCase() !== hash.toLowerCase()) {
    throw Error('Transaction hash mismatch');
  }
  return { transaction, block: BigInt(header.number) };
}

async function loadSnapshot(rpc: Rpc, config: LocalConfig) {
  const market = await discoverMarketPair(rpc, [config.initial[0], config.initial[1]]);
  const custody = await discoverCustodyPair(rpc, { tx_hash: market[0].tx_hash, index: '0x2' });
  const state = await readLiveSingletons(rpc, [...market, ...custody], config.genesis);
  return {
    id: asScript(state.cells[0].output.lock)?.hash() || '',
    initTxHash: config.initializationTransactionHash || '',
    curve: state.curve,
    buyOne: quote(state.curve, 'buy', 1n),
    sellOne: quote(state.curve, 'sell', 1n),
  };
}

export async function discoverLocalMarket(rpc: Rpc) {
  const config = await loadLocalMarketConfig(rpc);
  return { config, snapshot: await loadSnapshot(rpc, config) };
}

/** Rebuild this owner's balance and activity by scanning committed market lineage. */
export async function recoverLocalOwnerJourney(rpc: Rpc, owner: string): Promise<LocalMarketSnapshot> {
  if (!/^0x[0-9a-f]{64}$/i.test(owner)) throw Error('Connect a wallet to verify this account');
  const config = await loadLocalMarketConfig(rpc);
  const initHash = config.initializationTransactionHash;
  if (!initHash || config.initial.some((point: Point, index: number) => point.tx_hash.toLowerCase() !== initHash.toLowerCase() || BigInt(point.index) !== BigInt(index))) {
    throw Error('Verified local initialization is unavailable');
  }
  const initial = await loadCanonicalTransaction(rpc, initHash);
  const initialProof = parseProofWitness(initial.transaction.witnesses[3] || '');
  if (initialProof.operation !== 0 || initialProof.oldBalance !== 0n || initialProof.newBalance <= 0n) {
    throw Error('Initial owner transition is invalid');
  }
  let balance = initialProof.owner.toLowerCase() === owner.toLowerCase() ? initialProof.newBalance : 0n;
  let statePoints: Point[] = config.initial.map((point: Point) => ({ ...point }));
  let stateTransaction = initial.transaction;
  const activity: LocalActivity[] = [{ kind: 'launch', block: initial.block, transactionHash: initHash }];
  const tip = await rpc('get_tip_header', []) as Header;
  if (!tip.number || !tip.hash) throw Error('Private chain tip is unavailable');
  const lastHeight = BigInt(tip.number);
  if (lastHeight < initial.block || lastHeight - initial.block > 100000n) throw Error('Local market history exceeds the scan limit');

  for (let height = initial.block + 1n; height <= lastHeight; height++) {
    const block = await rpc('get_block_by_number', [`0x${height.toString(16)}`]) as { header?: Header; transactions?: RpcTransaction[] };
    if (!block.header?.number || BigInt(block.header.number) !== height || !Array.isArray(block.transactions)) {
      throw Error('Private market history is unavailable');
    }
    for (const transaction of block.transactions) {
      const consumed = statePoints.map((point) => transaction.inputs.some((input) => key(input.previous_output) === key(point)));
      if (!consumed.some(Boolean)) continue;
      if (!consumed.every(Boolean) || transaction.inputs.length !== 5 || transaction.outputs.length !== 5 || transaction.outputs_data.length !== 5) {
        throw Error('Market singleton lineage is incomplete');
      }
      if (statePoints.some((point, index) => key(transaction.inputs[index].previous_output) !== key(point))) {
        throw Error('Market transaction input order changed');
      }
      const parsed = ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(transaction as never));
      if (parsed.hash().toLowerCase() !== transaction.hash.toLowerCase()) throw Error('Market transaction hash mismatch');
      for (let index = 0; index < 4; index++) {
        const previous = stateTransaction.outputs[Number(BigInt(statePoints[index].index))];
        if (!previous || !sameScript(previous.lock, transaction.outputs[index].lock) || !sameScript(previous.type, transaction.outputs[index].type)) {
          throw Error('Market singleton identity changed');
        }
      }

      const proof = parseProofWitness(transaction.witnesses[5] || '');
      const side = proof.operation === 1 ? 'buy' : proof.operation === 4 ? 'sell' : null;
      if (!side) throw Error('Unexpected market transition');
      const quantity = side === 'buy' ? proof.newBalance - proof.oldBalance : proof.oldBalance - proof.newBalance;
      if (quantity <= 0n || proof.owner.toLowerCase() !== asScript(transaction.outputs[4].lock)?.hash().toLowerCase() || transaction.outputs[4].type || transaction.outputs_data[4] !== '0x') {
        throw Error('Market owner transition is invalid');
      }
      const oldMarket = stateTransaction.outputs[Number(BigInt(statePoints[0].index))];
      const oldCustody = stateTransaction.outputs[Number(BigInt(statePoints[2].index))];
      const oldMarketData = stateTransaction.outputs_data[Number(BigInt(statePoints[0].index))];
      const oldCustodyData = stateTransaction.outputs_data[Number(BigInt(statePoints[2].index))];
      const curve = decodeCurve(oldMarket.lock.args, oldMarketData);
      const amount = quote(curve, side, quantity);
      const expectedMarketCapacity = BigInt(oldMarket.capacity) + (side === 'buy' ? amount : -amount);
      const expectedInventory = curve.inventory + (side === 'buy' ? -quantity : quantity);
      const oldCustodyAmount = readLittleEndian(oldCustodyData.slice(2, 34));
      const expectedCustodyAmount = oldCustodyAmount + (side === 'buy' ? quantity : -quantity);
      const nextMarketData = transaction.outputs_data[0];
      const nextCustodyData = transaction.outputs_data[2];
      if (BigInt(transaction.outputs[0].capacity) !== expectedMarketCapacity ||
          readLittleEndian(nextMarketData.slice(2, 34)) !== expectedInventory ||
          nextMarketData.slice(34).toLowerCase() !== oldMarketData.slice(34).toLowerCase() ||
          readLittleEndian(nextCustodyData.slice(2, 34)) !== expectedCustodyAmount ||
          [1, 2, 3].some((index) => BigInt(transaction.outputs[index].capacity) !== BigInt(stateTransaction.outputs[Number(BigInt(statePoints[index].index))].capacity)) ||
          transaction.outputs_data[1].toLowerCase() !== stateTransaction.outputs_data[Number(BigInt(statePoints[1].index))].toLowerCase() ||
          transaction.outputs_data[3].toLowerCase() !== stateTransaction.outputs_data[Number(BigInt(statePoints[3].index))].toLowerCase()) {
        throw Error('Committed market accounting differs from its transition');
      }

      if (side === 'sell' && proof.tail !== `${writeLittleEndian(quantity, 8)}${writeLittleEndian(amount, 8)}`) {
        throw Error('Sell payout witness differs from market terms');
      }
      if (side === 'buy' && proof.tail !== '') throw Error('Unexpected buy witness suffix');

      const walletPoint = transaction.inputs[4].previous_output;
      const walletPrevious = await loadCanonicalTransaction(rpc, walletPoint.tx_hash);
      const walletIndex = Number(BigInt(walletPoint.index));
      const walletCell = walletPrevious.transaction.outputs[walletIndex];
      if (!walletCell || walletCell.type || walletPrevious.transaction.outputs_data[walletIndex]?.toLowerCase() !== '0x' ||
          !sameScript(walletCell.lock, transaction.outputs[4].lock) || asScript(walletCell.lock)?.hash().toLowerCase() !== proof.owner.toLowerCase() ||
          transaction.outputs[4].type || transaction.outputs_data[4].toLowerCase() !== walletPrevious.transaction.outputs_data[walletIndex].toLowerCase()) {
        throw Error('Trade funding owner mismatch');
      }
      const expectedWalletCapacity = BigInt(walletCell.capacity) + (side === 'buy' ? -amount : amount) - 100000n;
      if (BigInt(transaction.outputs[4].capacity) !== expectedWalletCapacity) throw Error('Owner trade capacity differs from market terms');
      const inputCapacity = statePoints.reduce((total, point, index) =>
        total + BigInt(stateTransaction.outputs[Number(BigInt(point.index))].capacity), 0n) + BigInt(walletCell.capacity);
      const outputCapacity = transaction.outputs.reduce((total, output) => total + BigInt(output.capacity), 0n);
      if (inputCapacity - outputCapacity !== 100000n) throw Error('Unexpected local trade fee');

      if (proof.owner.toLowerCase() === owner.toLowerCase()) {
        if (proof.oldBalance !== balance) throw Error('Owner balance history is discontinuous');
        balance = proof.newBalance;
        activity.push({ kind: side, block: height, transactionHash: transaction.hash, quantity, amount });
      }
      statePoints = [0, 1, 2, 3].map((index) => ({ tx_hash: transaction.hash, index: `0x${index.toString(16)}` }));
      stateTransaction = transaction;
    }
  }

  const [market, custody] = await Promise.all([
    discoverMarketPair(rpc, [config.initial[0], config.initial[1]]),
    discoverCustodyPair(rpc, statePoints[2]),
  ]);
  const latest = [...market, ...custody];
  if (latest.some((point, index) => key(point) !== key(statePoints[index]))) throw Error('Recovered history does not reach the live market');
  const state = await readLiveSingletons(rpc, latest as [Point, Point, Point, Point], config.genesis);
  const tipAgain = await rpc('get_tip_header', []) as Header;
  if (tipAgain.hash?.toLowerCase() !== tip.hash.toLowerCase()) throw Error('Private chain changed during recovery');
  return {
    id: asScript(state.cells[0].output.lock)?.hash() || '',
    initTxHash: initHash,
    curve: state.curve,
    buyOne: quote(state.curve, 'buy', 1n),
    sellOne: quote(state.curve, 'sell', 1n),
    balance,
    activity,
  };
}

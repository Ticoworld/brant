import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {verifyInitializationSignature} from '../lib/v2-engine/initialization-signature.ts';
import {providerFailure, SigningDiagnostic} from './diagnostics.ts';

const standard = '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8';
const hash = /^0x[0-9a-f]{64}$/;
function requireReview(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}
function decimal(value: unknown) {
  requireReview(typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value), 'Invalid review amount');
  return BigInt(value);
}
function amount(data: string) {
  return BigInt('0x' + ccc.bytesFrom(data).slice(0, 16).reverse().reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), ''));
}
export function readReview(raw: string, genesis: string) {
  const file = JSON.parse(raw);
  requireReview(file?.format === 'trade-v2-withdrawal-review-v1' && hash.test(file.genesis_hash) &&
    hash.test(file.owner_lock_hash) && hash.test(file.transaction_hash), 'Invalid withdrawal review');
  requireReview(file.genesis_hash === genesis, 'Wrong review network');
  const tx = ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(file.transaction));
  requireReview(tx.hash() === file.transaction_hash && tx.inputs.length === 3 && tx.outputs.length === 4 &&
    tx.outputsData.length === 4 && tx.headerDeps.every(header => header === genesis) &&
    tx.witnesses.length === 4 && tx.witnesses.slice(0, 3).every(value => value === '0x'),
  'Unexpected withdrawal transaction or witness layout');
  const [custody, marker, destination, change] = tx.outputs;
  const owner = destination.lock;
  requireReview(owner.codeHash === standard && owner.hashType === 'type' && /^0x[0-9a-f]{40}$/.test(owner.args) &&
    owner.hash() === file.owner_lock_hash && change.lock.hash() === owner.hash(), 'Unsupported or mismatched owner lock');
  const proof = tx.witnesses[3];
  requireReview(/^0x544d5331[0-9a-f]{2}0501/.test(proof) && proof.length >= 218 &&
    proof.slice(26, 90) === owner.hash().slice(2), 'Invalid TMS1 withdrawal witness');
  const quantity = decimal(file.quantity);
  const funding = decimal(file.funding_capacity);
  const fee = decimal(file.fee);
  const occupied = BigInt(destination.occupiedSize + 16) * 100000000n;
  const changeOccupied = BigInt(change.occupiedSize) * 100000000n;
  requireReview(custody.lock.hash() === marker.lock.hash() && custody.lock.args.slice(130, 194) === genesis.slice(2) &&
    custody.type && marker.type && destination.type?.hash() === custody.type.hash() && !change.type &&
    tx.outputsData[2].length === 34 && tx.outputsData[3] === '0x' && quantity > 0n && amount(tx.outputsData[2]) === quantity &&
    occupied === decimal(file.external_occupied_capacity) && destination.capacity === occupied &&
    changeOccupied === decimal(file.change_occupied_capacity) && change.capacity >= changeOccupied &&
    change.capacity === decimal(file.change_capacity) && fee > 0n && fee <= 1000000n &&
    funding === occupied + change.capacity + fee, 'Review amounts or output scripts differ from the transaction');
  return {tx, owner, genesis, quantity, funding, fee, occupied};
}

type Review = ReturnType<typeof readReview>;
type Wallet = Pick<ccc.Signer,'isConnected'|'getRecommendedAddressObj'> & {
  provider: {signTransaction(tx: ccc.TransactionLike): Promise<ccc.TransactionLike>};
};
type Chain = Pick<ccc.Client,'getHeaderByNumber'|'getCellLive'>;
export async function checkWallet(review: Review, wallet: Wallet, chain: Chain) {
  let connected, address;
  try {
    connected = await wallet.isConnected();
    if (connected) address = await wallet.getRecommendedAddressObj();
  } catch (error) {
    throw providerFailure('Wallet identity check', error);
  }
  if (!address) throw new SigningDiagnostic('Wallet identity check. Connect UTXO Global on CKB testnet');
  if (address.script.hash() !== review.owner.hash()) {
    throw new SigningDiagnostic('Wallet identity check. Wrong wallet account or unsupported lock');
  }
  if ((await chain.getHeaderByNumber(0))?.hash !== review.genesis) {
    throw new SigningDiagnostic('Wallet identity check. Wrong RPC genesis');
  }
  return address.toString();
}
export async function signReview(review: Review, wallet: Wallet, chain: Chain) {
  await checkWallet(review, wallet, chain);
  const {tx} = review;
  const inputs = await Promise.all(tx.inputs.map(input => chain.getCellLive(input.previousOutput, true, true)));
  const [custody, marker, funding] = inputs;
  requireReview(custody && marker && funding, 'A reviewed input is no longer live');
  requireReview(inputs.every((cell, index) => cell?.outPoint?.eq(tx.inputs[index].previousOutput) &&
    cell.cellOutput && typeof cell.outputData === 'string'), 'Missing or inconsistent live input metadata');
  requireReview([custody, marker].every((cell, index) => {
    const output = tx.outputs[index];
    return cell.cellOutput.lock.hash() === output.lock.hash() &&
      cell.cellOutput.type?.hash() === output.type?.hash() && cell.cellOutput.capacity === output.capacity;
  }) && custody.outputData.length === 98 && tx.outputsData[0].length === 98 &&
    amount(custody.outputData) - amount(tx.outputsData[0]) === review.quantity && marker.outputData === tx.outputsData[1] &&
    funding.cellOutput.lock.hash() === review.owner.hash() && !funding.cellOutput.type &&
    funding.outputData === '0x' && funding.cellOutput.capacity === review.funding, 'Live input identity or accounting changed');
  const prepared = tx.clone();
  [custody, marker, funding].forEach((cell, index) => {
    prepared.inputs[index].cellOutput = cell.cellOutput.clone();
    prepared.inputs[index].outputData = cell.outputData;
  });
  requireReview(![custody, marker].some(cell => cell.cellOutput.lock.eq(review.owner)),
    'Unexpected owner signing group');
  prepared.setWitnessArgs(2, ccc.WitnessArgs.from({lock: '0x' + '00'.repeat(65)}));
  await checkWallet(review, wallet, chain);
  let response;
  try {
    response = await wallet.provider.signTransaction(prepared);
  } catch (error) {
    throw providerFailure('Wallet approval', error);
  }
  let signed;
  try {
    if (!response || !Array.isArray(response.inputs) || !Array.isArray(response.outputs) ||
        !Array.isArray(response.outputsData) || !Array.isArray(response.witnesses)) {
      throw Error('Missing transaction fields');
    }
    signed = ccc.Transaction.from(response);
  } catch {
    throw new SigningDiagnostic('Wallet response. Malformed signed transaction');
  }
  await checkWallet(review, wallet, chain);
  try {
    verifyInitializationSignature(tx, signed, [custody.cellOutput, marker.cellOutput, funding.cellOutput], 2, review.owner.hash());
  } catch {
    throw new SigningDiagnostic('Local signature verification. Wallet changed reviewed fields or returned an invalid signature');
  }
  return cccA.JsonRpcTransformers.transactionFrom(signed);
}

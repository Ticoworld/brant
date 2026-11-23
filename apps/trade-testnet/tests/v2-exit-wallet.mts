import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {UtxoGlobal} from '@ckb-ccc/utxo-global';
import {readReview, signReview} from '../exit-signer/review.ts';

const receipt = JSON.parse(readFileSync(new URL('../evidence/v2-independent-recovery-1794492388055/withdrawal.json', import.meta.url), 'utf8'));
const signed = ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(receipt.transaction));
const genesis = receipt.genesis_hash;
const tx = signed.clone();
tx.witnesses[2] = '0x';
const [custody, marker, owner, change] = tx.outputs;
const fixture = {
  format: 'trade-v2-withdrawal-review-v1',
  genesis_hash: genesis, owner_lock_hash: owner.lock.hash(), transaction_hash: tx.hash(),
  quantity: receipt.quantity, funding_capacity: (owner.capacity + change.capacity + BigInt(receipt.fee)).toString(),
  external_occupied_capacity: owner.capacity.toString(), change_occupied_capacity: '6100000000',
  change_capacity: change.capacity.toString(), fee: receipt.fee,
  transaction: cccA.JsonRpcTransformers.transactionFrom(tx),
};
const read = (value = fixture) => readReview(JSON.stringify(value), genesis);
const review = read();
assert.throws(() => readReview('{', genesis), SyntaxError);
assert.throws(() => read({...fixture, genesis_hash: '0x' + '00'.repeat(32)}), /Wrong review network/);
assert.throws(() => read({...fixture, fee: '1'}), /Review amounts/);
const node = new ccc.ClientPublicTestnet({fallbacks: []});
let connected = true;
let network = 'nervos_testnet';
let account = owner.lock;
let rpcGenesis = genesis;
let approve = async (_request: ccc.TransactionLike) => signed.clone();
let calls = 0;
const provider: ConstructorParameters<typeof UtxoGlobal.SignerCkb>[1] = {
  requestAccounts: async () => [],
  getAccount: async () => [new ccc.Address(account, node.addressPrefix).toString()],
  getPublicKey: async () => [],
  connect: async () => {}, isConnected: async () => connected,
  getNetwork: async () => network, switchNetwork: async () => {throw Error('Unexpected switch');},
  signMessage: async () => {throw Error('Unexpected message signing');},
  async signTransaction(request) {
    calls++;
    assert.deepEqual(cccA.JsonRpcTransformers.transactionFrom(ccc.Transaction.from(request)), fixture.transaction);
    return approve(request);
  },
  on: () => provider, removeListener: () => provider,
};
const wallet = new UtxoGlobal.SignerCkb(node, provider);
const priorCustody = '0x' + Number(receipt.quantity).toString(16).padStart(2, '0') + tx.outputsData[0].slice(4);
const cells = [
  {cellOutput: custody, outputData: priorCustody},
  {cellOutput: marker, outputData: tx.outputsData[1]},
  {cellOutput: ccc.CellOutput.from({capacity: fixture.funding_capacity, lock: owner.lock}), outputData: '0x'},
];
const chain = {
  getHeaderByNumber: async () => ({hash: rpcGenesis}) as ccc.ClientBlockHeader,
  getCellLive: async (outPoint: ccc.OutPointLike) => {
    const index = tx.inputs.findIndex(input => input.previousOutput.eq(outPoint));
    return ccc.Cell.from({...cells[index], outPoint});
  },
};
const sign = () => signReview(review, wallet, chain);
assert.deepEqual(JSON.parse(JSON.stringify(await sign())), receipt.transaction);
connected = false;
await assert.rejects(sign, /Connect UTXO/);
connected = true;
network = 'nervos';
await assert.rejects(sign, /CKB testnet/);
network = 'nervos_testnet';
rpcGenesis = '0x' + '00'.repeat(32);
await assert.rejects(sign, /Wrong RPC genesis/);
rpcGenesis = genesis;
account = ccc.Script.from({...owner.lock, args: '0x' + '00'.repeat(20)});
await assert.rejects(sign, /Wrong wallet account/);
account = owner.lock;
assert.equal(calls, 1);
approve = async () => {throw Error('Owner rejected approval');};
await assert.rejects(sign, /Owner rejected approval/);
approve = async () => {connected = false; return signed.clone();};
await assert.rejects(sign, /Connect UTXO/);
connected = true;
approve = async () => {
  account = ccc.Script.from({...owner.lock, args: '0x' + '00'.repeat(20)});
  return signed.clone();
};
await assert.rejects(sign, /Wrong wallet account/);
account = owner.lock;
for (const mutate of [
  (result: ccc.Transaction) => {result.outputs[3].capacity -= 1n;},
  (result: ccc.Transaction) => {result.outputs[2].lock = custody.lock;},
  (result: ccc.Transaction) => {result.witnesses[3] = '0x';},
]) {
  approve = async () => {const result = signed.clone(); mutate(result); return result;};
  await assert.rejects(sign, /Wallet changed reviewed/);
}
console.log('Mock UTXO Global signer accepted the exact transaction and preserved TMS1. Negative cases passed.');

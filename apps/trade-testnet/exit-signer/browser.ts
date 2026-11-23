import {ccc} from '@ckb-ccc/core';
import {UtxoGlobal} from '@ckb-ccc/utxo-global';
import {PUDGE_GATE2_GENESIS} from '../lib/v2-engine/pudge-public-registry.ts';
import {checkWallet, readReview, signReview} from './review.ts';
import {checkRegisteredTransaction, verifyRegisteredMarket} from './registered-market.ts';

const rpc = new ccc.ClientPublicTestnet({url: 'https://testnet.ckb.dev/', fallbacks: []});
const file = document.querySelector<HTMLInputElement>('#file')!;
const connect = document.querySelector<HTMLButtonElement>('#connect')!;
const sign = document.querySelector<HTMLButtonElement>('#sign')!;
const status = document.querySelector('#status')!;
const details = document.querySelector('#details')!;
let review: ReturnType<typeof readReview> | undefined;
let wallet: UtxoGlobal.SignerCkb | undefined;
let stopWatching: (() => void) | undefined;
let generation = 0;
let busy = false;

function run(action: () => Promise<void>) {
  if (busy) return;
  busy = file.disabled = connect.disabled = sign.disabled = true;
  void action().catch(error => { status.textContent = error instanceof Error ? error.message : 'Operation failed'; })
    .finally(() => {
      busy = file.disabled = false;
      connect.disabled = !review;
      sign.disabled = !wallet;
    });
}

file.onchange = () => run(async () => {
  stopWatching?.();
  stopWatching = undefined;
  review = wallet = undefined;
  details.replaceChildren();
  const selected = file.files?.[0];
  if (!selected || selected.size > 65536) throw Error('Choose a withdrawal review JSON file under 64 KiB');
  const imported = readReview(await selected.text(), PUDGE_GATE2_GENESIS);
  checkRegisteredTransaction(imported.tx);
  status.textContent = 'Checking registered market on Pudge…';
  await verifyRegisteredMarket(rpc);
  const funding = imported.tx.inputs[2].previousOutput;
  for (const [label, value] of [
    ['Network', 'CKB Pudge'], ['Verified market', 'Roveko Genesis · RVK/CKB'],
    ['Verified RVK type script hash', imported.tx.outputs[2].type!.hash()],
    ['Transaction hash', imported.tx.hash()],
    ['Destination', new ccc.Address(imported.owner, rpc.addressPrefix).toString()],
    ['Quantity', imported.quantity + ' RVK'], ['Funding Cell', funding.txHash + ':' + funding.index],
    ['Funding capacity', ccc.fixedPointToString(imported.funding) + ' CKB'],
    ['Returned change', ccc.fixedPointToString(imported.tx.outputs[3].capacity) + ' CKB'],
    ['Token Cell occupied capacity', ccc.fixedPointToString(imported.occupied) + ' CKB'],
    ['Network fee', ccc.fixedPointToString(imported.fee) + ' CKB'],
  ]) {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    details.append(term, description);
  }
  review = imported;
  status.textContent = 'Review imported. Check the details before connecting.';
});

connect.onclick = () => run(async () => {
  stopWatching?.();
  stopWatching = undefined;
  wallet = undefined;
  const candidate = UtxoGlobal.getUtxoGlobalSigners(rpc).find(item => item.signer instanceof UtxoGlobal.SignerCkb)?.signer;
  if (!(candidate instanceof UtxoGlobal.SignerCkb) || typeof candidate.provider?.signTransaction !== 'function') {
    throw Error('Compatible UTXO Global CKB extension unavailable');
  }
  await candidate.provider.connect();
  if (await candidate.provider.getNetwork() !== 'nervos_testnet') throw Error('Switch UTXO Global to CKB testnet');
  const address = await checkWallet(review!, candidate, rpc);
  generation++;
  const connectedGeneration = generation;
  const invalidate = () => {
    if (generation !== connectedGeneration) return;
    generation++;
    wallet = undefined;
    sign.disabled = true;
    status.textContent = 'Wallet changed. Connect again.';
  };
  stopWatching = candidate.onReplaced(invalidate);
  wallet = candidate;
  status.textContent = 'Connected ' + address;
});

sign.onclick = () => run(async () => {
  const approved = review!;
  const session = generation;
  await verifyRegisteredMarket(rpc);
  if (session !== generation) throw Error('Wallet changed during verification');
  const signed = await signReview(approved, wallet!, rpc);
  if (session !== generation) throw Error('Wallet changed during approval');
  const url = URL.createObjectURL(new Blob([JSON.stringify(signed, null, 2)], {type:'application/json'}));
  const download = document.createElement('a');
  download.href = url;
  download.download = approved.tx.hash() + '.signed.json';
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Verified signed transaction exported.';
});

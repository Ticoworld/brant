import {ccc} from '@ckb-ccc/core';
import {UtxoGlobal} from '@ckb-ccc/utxo-global';
import {PUDGE_GATE2_GENESIS} from '../lib/v2-engine/pudge-public-registry.ts';
import {checkWallet, readReview, signReview} from './review.ts';
import {checkRegisteredTransaction, verifyRegisteredMarket} from './registered-market.ts';
import {providerFailure, SigningDiagnostic} from './diagnostics.ts';

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

function run(stage: string, action: () => Promise<void>) {
  if (busy) return;
  busy = file.disabled = connect.disabled = sign.disabled = true;
  void action().catch(error => {
    status.textContent = error instanceof SigningDiagnostic ? error.message :
      stage === 'Review import' && error instanceof Error ? error.message : `${stage} failed.`;
  })
    .finally(() => {
      busy = file.disabled = false;
      connect.disabled = !review;
      sign.disabled = !wallet;
    });
}

file.onchange = () => run('Review import', async () => {
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

connect.onclick = () => run('Wallet connection', async () => {
  stopWatching?.();
  stopWatching = undefined;
  wallet = undefined;
  const candidate = UtxoGlobal.getUtxoGlobalSigners(rpc).find(item => item.signer instanceof UtxoGlobal.SignerCkb)?.signer;
  if (!(candidate instanceof UtxoGlobal.SignerCkb) || typeof candidate.provider?.signTransaction !== 'function') {
    throw new SigningDiagnostic('Wallet connection. Compatible UTXO Global CKB extension unavailable');
  }
  let network;
  try {
    await candidate.provider.connect();
    network = await candidate.provider.getNetwork();
  } catch (error) {
    throw providerFailure('Wallet connection', error);
  }
  if (network !== 'nervos_testnet') throw new SigningDiagnostic('Wallet connection. Switch UTXO Global to CKB testnet');
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

sign.onclick = () => run('Signing or export', async () => {
  const approved = review!;
  const session = generation;
  const selectedWallet = wallet!;
  try {
    await verifyRegisteredMarket(rpc);
  } catch {
    throw new SigningDiagnostic('Registered market verification failed');
  }
  if (session !== generation) throw new SigningDiagnostic('Wallet account or network changed during verification');
  let signed;
  try {
    signed = await signReview(approved, selectedWallet, rpc);
  } catch (error) {
    if (session !== generation) throw new SigningDiagnostic('Wallet account or network changed during signing');
    if (error instanceof SigningDiagnostic) throw error;
    throw new SigningDiagnostic('Live input or network verification failed');
  }
  if (session !== generation) throw new SigningDiagnostic('Wallet account or network changed during signing');
  const url = URL.createObjectURL(new Blob([JSON.stringify(signed, null, 2)], {type:'application/json'}));
  const download = document.createElement('a');
  download.href = url;
  download.download = approved.tx.hash() + '.signed.json';
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'Verified signed transaction exported.';
});

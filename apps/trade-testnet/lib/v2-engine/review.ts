import { ccc } from '@ckb-ccc/core';
import { buildTransition, type Transition } from './transaction.ts';

/** Construct the reviewed transaction locally after the caller has verified
 * chain lineage and the proof against the live custody root. */
export function buildReviewedTransaction(t: Transition, deps: ccc.CellDepLike[], genesis: string, ownerLockHash: string) {
  if (!/^0x[0-9a-f]{64}$/i.test(genesis) || !/^0x[0-9a-f]{64}$/i.test(ownerLockHash)) throw Error('Invalid network or owner');
  const witness = t.witness.slice(2).toLowerCase();
  if (!/^544d5331010[14]0100/.test(witness) || witness.slice(24,88) !== ownerLockHash.slice(2).toLowerCase()) throw Error('Proof owner or format mismatch');
  if (parseInt(witness.slice(10,12),16) !== (t.side === 'buy' ? 1 : 4)) throw Error('Proof operation mismatch');
  const read64 = (hex:string) => BigInt('0x'+(hex.match(/../g) || []).reverse().join(''));
  const oldBalance = read64(witness.slice(88,104)), newBalance = read64(witness.slice(152,168));
  if (newBalance - oldBalance !== (t.side === 'buy' ? t.quantity : -t.quantity)) throw Error('Proof quantity mismatch');
  const owner = ccc.Script.from(t.cells[4].lock as ccc.ScriptLike);
  if (owner.hash().toLowerCase() !== ownerLockHash.toLowerCase()) throw Error('Funding cell owner mismatch');
  const built = buildTransition(t);
  const proofLength = Number(read64(witness.slice(16,24)));
  const extra = witness.slice((12 + 96 + proofLength) * 2);
  if (!Number.isSafeInteger(proofLength) || witness.length < (12 + 96 + proofLength) * 2 || (t.side === 'buy' && extra.length)) throw Error('Invalid proof length');
  if (t.side === 'sell') {
    if (extra.length !== 32 || read64(extra.slice(0,16)) !== t.quantity || read64(extra.slice(16,32)) !== built.amount) throw Error('Sell payout bound mismatch');
  }
  const tx = ccc.Transaction.from({inputs:built.inputs,outputs:built.outputs as ccc.CellOutputLike[],outputsData:built.outputsData as ccc.Hex[],witnesses:built.witnesses as ccc.Hex[],cellDeps:deps,headerDeps:[genesis as ccc.Hex]});
  tx.outputs.forEach((output, i) => {
    const dataBytes = (tx.outputsData[i].length - 2) / 2;
    if (output.capacity !== BigInt(built.outputs[i].capacity)) throw Error('Output occupied capacity changed the reviewed transaction');
    if (output.capacity < BigInt(output.occupiedSize + dataBytes) * 100_000_000n) throw Error('Output capacity is below occupied capacity');
  });
  return { transaction:tx, amount:built.amount, fee:t.fee, genesis, custodyRoot:'0x'+t.cells[2].data.slice(34) };
}

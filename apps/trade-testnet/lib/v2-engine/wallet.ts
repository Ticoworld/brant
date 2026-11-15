import { ccc } from '@ckb-ccc/core';

type Rpc = (method: string, params: unknown[]) => Promise<unknown>;
type Wallet = { signTransaction(tx: ccc.Transaction): Promise<ccc.Transaction>; client: { sendTransaction(tx: ccc.Transaction): Promise<ccc.Hex> } };
type Review = { transaction: ccc.Transaction; genesis: string; custodyRoot: string; fee: bigint };

/** Submit only a previously reviewed transaction. The caller must validate the
 * deployed scripts, canonical lineage and proof before presenting the review. */
export async function signAndSubmitReviewed(review: Review, wallet: Wallet, rpc: Rpc): Promise<ccc.Hex> {
  const tx = review.transaction;
  if (tx.inputs.length !== 5 || tx.outputs.length !== 5 || tx.witnesses.length !== 6 || !/^0x[0-9a-f]{64}$/i.test(review.genesis) || !/^0x[0-9a-f]{64}$/i.test(review.custodyRoot) || review.fee < 0n || review.fee > 1_000_000n) throw Error('Invalid V2 transaction review');
  const rawHash = tx.hash(), proofWitness = tx.witnesses[5];
  const check = async () => {
    const genesis = await rpc('get_block_hash', ['0x0']);
    if (typeof genesis !== 'string' || genesis.toLowerCase() !== review.genesis.toLowerCase()) throw Error('Wallet network changed');
    let capacity = 0n;
    for (let i = 0; i < tx.inputs.length; i++) {
      const pt = tx.inputs[i].previousOutput;
      const row = await rpc('get_live_cell', [{tx_hash:pt.txHash,index:ccc.numToHex(pt.index)}, true]) as { status?: string; cell?: {output: {capacity: string}; data: {content: string}} };
      if (row?.status !== 'live' || !row.cell) throw Error('A reviewed input is no longer live; rebuild and review again');
      capacity += BigInt(row.cell.output.capacity);
      if (i === 2 && row.cell.data.content.slice(34).toLowerCase() !== review.custodyRoot.slice(2).toLowerCase()) throw Error('Custody root changed; rebuild and review again');
    }
    if (capacity - tx.outputs.reduce((n, output) => n + output.capacity, 0n) !== review.fee) throw Error('Transaction fee changed');
  };
  await check();
  const signed = await wallet.signTransaction(tx);
  if (signed.hash() !== rawHash || signed.witnesses.length !== 6 || signed.witnesses[5] !== proofWitness) throw Error('Wallet changed reviewed transaction or proof');
  await check();
  return wallet.client.sendTransaction(signed);
}

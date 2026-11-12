import { ccc } from '@ckb-ccc/core';
import type { Cell } from './transaction.ts';

/** Build an unsigned Gate 2 owner withdrawal after canonical proof replay.
 * The caller must revalidate inputs and the root before signing and submission. */
export function buildWithdrawal(cells: [Cell, Cell, Cell], quantity: bigint, root: string, witness: string, fee: bigint, deps: ccc.CellDepLike[], genesis: string, ownerHash: string) {
  const [custody, marker, funding] = cells;
  const h = /^0x[0-9a-f]{64}$/i;
  if (!h.test(root) || !h.test(genesis) || !h.test(ownerHash) || quantity <= 0n || quantity > (1n << 64n) - 1n || fee < 0n || fee > 1000000n) throw Error('Invalid withdrawal parameters');
  if (!/^0x[0-9a-f]{96}$/i.test(custody.data) || !/^0x544d533101050100[0-9a-f]+$/i.test(witness)) throw Error('Invalid custody data or withdrawal proof');
  const w = witness.slice(2).toLowerCase();
  const read = (s: string) => BigInt('0x' + (s.match(/../g) || []).reverse().join(''));
  if (w.slice(24,88) !== ownerHash.slice(2).toLowerCase() || read(w.slice(88,104)) - read(w.slice(152,168)) !== quantity) throw Error('Proof owner or quantity mismatch');
  const proofLength = Number(read(w.slice(16,24)));
  if (!Number.isSafeInteger(proofLength) || w.length !== (12 + 96 + proofLength) * 2) throw Error('Invalid proof length');
  if (ccc.Script.from(funding.lock as ccc.ScriptLike).hash().toLowerCase() !== ownerHash.toLowerCase() || funding.type || funding.data !== '0x') throw Error('Funding cell is not owner plain capacity');
  const current = read(custody.data.slice(2,34));
  if (quantity > current || !custody.type) throw Error('Insufficient custody amount');
  const le = (n: bigint, bytes: number) => Array.from({length:bytes},(_,i)=>Number((n >> BigInt(i*8)) & 255n).toString(16).padStart(2,'0')).join('');
  const owner = ccc.Script.from(funding.lock as ccc.ScriptLike);
  const token = ccc.CellOutput.from({capacity:0,lock:owner,type:custody.type as ccc.ScriptLike});
  const tokenCapacity = BigInt(token.occupiedSize + 16) * 100000000n;
  if (funding.capacity < tokenCapacity + fee) throw Error('Insufficient funding capacity');
  const outputs = [
    {capacity:custody.capacity,lock:custody.lock,type:custody.type},
    {capacity:marker.capacity,lock:marker.lock,type:marker.type},
    {capacity:tokenCapacity,lock:owner,type:custody.type},
    {capacity:funding.capacity-tokenCapacity-fee,lock:owner},
  ];
  const tx = ccc.Transaction.from({inputs:cells.map(c=>({previousOutput:c.outPoint,since:0})),outputs:outputs as ccc.CellOutputLike[],outputsData:[('0x'+le(current-quantity,16)+root.slice(2)) as ccc.Hex,marker.data as ccc.Hex,('0x'+le(quantity,16)) as ccc.Hex,'0x'],witnesses:['0x','0x','0x',witness as ccc.Hex],cellDeps:deps,headerDeps:[genesis as ccc.Hex]});
  tx.outputs.forEach((o,i)=>{if (o.capacity !== outputs[i].capacity || o.capacity < BigInt(o.occupiedSize+(tx.outputsData[i].length-2)/2)*100000000n) throw Error('Invalid output occupied capacity');});
  return {transaction:tx,fee,tokenCapacity,custodyRoot:'0x'+custody.data.slice(34),quantity};
}

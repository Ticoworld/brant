import { ccc } from '@ckb-ccc/core';
import type { Cell } from './transaction.ts';

type Rpc = (method: string, params: unknown[]) => Promise<unknown>;
/** Select an explicitly supplied live, plain standard-secp cell owned by the
 * connected wallet. Callers must repeat this check immediately before signing. */
export async function readFundingCell(rpc: Rpc, point: {txHash: string; index: string}, ownerHash: string): Promise<Cell> {
  if (!/^0x[0-9a-f]{64}$/i.test(point.txHash) || !/^0x[0-9a-f]+$/i.test(point.index) || !/^0x[0-9a-f]{64}$/i.test(ownerHash)) throw Error('Invalid funding identity');
  const row = await rpc('get_live_cell', [{tx_hash:point.txHash,index:point.index},true]) as {status?:string; cell?:{output:{capacity:string;lock:{code_hash:string;hash_type:string;args:string};type:unknown};data:{content:string}}};
  if (row?.status !== 'live' || !row.cell || row.cell.output.type || row.cell.data.content !== '0x') throw Error('Funding cell is unavailable or not plain');
  const raw = row.cell.output.lock;
  if (raw.code_hash.toLowerCase() !== '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8' || raw.hash_type !== 'type' || !/^0x[0-9a-f]{40}$/i.test(raw.args)) throw Error('Gate 2 requires a standard CKB secp owner');
  const lock = ccc.Script.from({codeHash:raw.code_hash,hashType:'type',args:raw.args});
  if (lock.hash().toLowerCase() !== ownerHash.toLowerCase()) throw Error('Funding cell does not belong to connected wallet');
  return {outPoint:point,capacity:BigInt(row.cell.output.capacity),lock,data:'0x'};
}

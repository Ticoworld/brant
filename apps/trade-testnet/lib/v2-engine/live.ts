import { decodeCurve } from './curve.ts';

type Point = { tx_hash: string; index: string };
type RpcCell = { output: { capacity: string; lock: {code_hash: string; hash_type: string; args: string}; type: unknown }; data: {content: string} };
type Rpc = (method: string, params: unknown[]) => Promise<unknown>;
const hex32 = /^0x[0-9a-f]{64}$/i;
const quantity = /^0x[0-9a-f]+$/i;

/** Read a specified Gate 2 singleton set; identities still require independent
 * lineage and binary verification before this state can authorize a trade. */
export async function readLiveSingletons(rpc: Rpc, points: [Point, Point, Point, Point], expectedGenesis: string) {
  const [genesis,...rows]=await Promise.all([rpc('get_block_hash',['0x0']),...points.map(point=>rpc('get_live_cell',[point,true]))]);
  return validateLiveSingletons(points,expectedGenesis,genesis,rows);
}

export function validateLiveSingletons(points:[Point,Point,Point,Point],expectedGenesis:string,genesis:unknown,rows:unknown[]){
  if (!hex32.test(expectedGenesis) || points.some(p => !hex32.test(p.tx_hash) || !quantity.test(p.index))) throw Error('Invalid network or outpoint');
  if (new Set(points.map(p => `${p.tx_hash.toLowerCase()}:${BigInt(p.index)}`)).size !== 4) throw Error('Duplicate singleton outpoints');
  if (typeof genesis !== 'string' || genesis.toLowerCase() !== expectedGenesis.toLowerCase()) throw Error('Wrong CKB genesis');
  if(rows.length!==points.length)throw Error('Incomplete singleton snapshot');
  const cells = rows.map((row) => {
    const result = row as {status?: string; cell?: RpcCell};
    if (result?.status !== 'live' || !result.cell?.output || !result.cell.data || !quantity.test(result.cell.output.capacity)) throw Error('Singleton is dead or unavailable; refresh the quote');
    return result.cell;
  });
  const market = cells[0];
  const curve = decodeCurve(market.output.lock.args, market.data.content);
  if (!/^0x[0-9a-f]{96}$/i.test(cells[2].data.content)) throw Error('Invalid custody data');
  const custodyBytes = cells[2].data.content.slice(2);
  const custodyAmount = BigInt('0x' + custodyBytes.slice(0, 32).match(/../g)!.reverse().join(''));
  if (custodyAmount > (1n << 64n) - 1n || custodyAmount > curve.supply - curve.inventory) throw Error('Invalid custody amount');
  return { genesis, points, cells, curve, custodyAmount, custodyRoot: '0x' + custodyBytes.slice(32) };
}

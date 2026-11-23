import { ccc } from '@ckb-ccc/core';

type Rpc = (method:string, params:unknown[])=>Promise<unknown>;
type ExpectedCell = { outPoint:{txHash:string;index:string}; capacity:bigint; lock:ccc.ScriptLike; type?:ccc.ScriptLike; data:string };
type Dependency = {outPoint:{txHash:string;index:string}; dataHash:string};
const h=/^0x[0-9a-f]{64}$/i;
/** Freshness and identity check, not a proof of RPC honesty or consensus finality.
 * Run before review, again before signature, and immediately before broadcast. */
export async function verifyInitializationLive(rpc:Rpc, genesis:string, inputs:ExpectedCell[], dependencies:Dependency[], timing?: (name:string, ms:number)=>void) {
  if(!inputs.length) throw Error('Missing initialization identity');
  await verifyInitializationCells(rpc, genesis, inputs, dependencies, timing);
}

export async function verifyInitializationDependencies(rpc:Rpc, genesis:string, dependencies:Dependency[]) {
  await verifyInitializationCells(rpc, genesis, [], dependencies);
}

async function verifyInitializationCells(rpc:Rpc, genesis:string, inputs:ExpectedCell[], dependencies:Dependency[], timing?: (name:string, ms:number)=>void) {
  if(!h.test(genesis)||!dependencies.length) throw Error('Missing initialization identity');
  const g=await rpc('get_block_hash',['0x0']);
  if(typeof g!=='string'||g.toLowerCase()!==genesis.toLowerCase()) throw Error('Wrong genesis');
  const seen=new Set<string>();
  const point=(p:{txHash:string;index:string})=>{
    if(!h.test(p.txHash)||!/^0x[0-9a-f]+$/i.test(p.index))throw Error('Invalid outpoint');
    return {tx_hash:p.txHash,index:'0x'+BigInt(p.index).toString(16)};
  };
  const inputsStarted = performance.now();
  const points=inputs.map(expected=>{
    const p=point(expected.outPoint), key=`${p.tx_hash.toLowerCase()}:${p.index}`;
    if(seen.has(key))throw Error('Duplicate input'); seen.add(key);
    return {expected,p};
  });
  for (let offset=0;offset<points.length;offset+=4) {
    await Promise.all(points.slice(offset,offset+4).map(async ({expected,p})=>{
    const row=await rpc('get_live_cell',[p,true]) as {status?:string;cell?:{output:{capacity:string;lock:ccc.ScriptLike;type?:ccc.ScriptLike|null};data:{content:string}}};
    if(row?.status!=='live'||!row.cell)throw Error('Initialization input is no longer live');
    const {output,data}=row.cell;
    const decode=(s:ccc.ScriptLike)=>{const x=s as unknown as {code_hash?:string;hash_type?:string;args:string};return x.code_hash?{codeHash:x.code_hash,hashType:x.hash_type,args:x.args} as ccc.ScriptLike:s;};
    if(BigInt(output.capacity)!==expected.capacity||ccc.Script.from(decode(output.lock)).hash()!==ccc.Script.from(expected.lock).hash()||Boolean(output.type)!==Boolean(expected.type)|| (output.type&&expected.type&&ccc.Script.from(decode(output.type)).hash()!==ccc.Script.from(expected.type).hash())||data.content.toLowerCase()!==expected.data.toLowerCase())throw Error('Initialization input differs from review');
    }));
  }
  timing?.('inputs', performance.now() - inputsStarted);
  const depsStarted = performance.now();
  for (let offset=0;offset<dependencies.length;offset+=4) {
    await Promise.all(dependencies.slice(offset,offset+4).map(async dep=>{
    if(!h.test(dep.dataHash))throw Error('Invalid dependency hash');
    const row=await rpc('get_live_cell',[point(dep.outPoint),true]) as {status?:string;cell?:{data:{content:string}}};
    if(row?.status!=='live'||!row.cell||ccc.hashCkb(row.cell.data.content as ccc.Hex).toLowerCase()!==dep.dataHash.toLowerCase())throw Error('Initialization dependency unavailable or changed');
    }));
  }
  timing?.('dependencies', performance.now() - depsStarted);
}

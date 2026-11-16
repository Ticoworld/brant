import {NextResponse} from 'next/server';
export const runtime='nodejs';
const allowed=new Set(['get_block_hash','get_block_by_number','get_tip_header','get_header','get_transaction','get_live_cell','get_cells','get_indexer_tip','tx_pool_info']);
export async function POST(request:Request){
  let input:{method?:string;params?:unknown[]};
  try {input=await request.json();} catch {return NextResponse.json({error:'Invalid JSON'}, {status:400});}
  if(!input || !allowed.has(input.method||'') || !Array.isArray(input.params) || JSON.stringify(input.params).length>8192) return NextResponse.json({error:'Unsupported RPC request'}, {status:400});
  try {
    const response=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:input.method,params:input.params}),cache:'no-store',signal:AbortSignal.timeout(15000)});
    const body=await response.json();
    if(!response.ok || body.error){
      const rpcError=body?.error as {code?:unknown;message?:unknown}|undefined;
      const code=typeof rpcError?.code==='number'?` (${rpcError.code})`:'';
      const detail=typeof rpcError?.message==='string'?` ${rpcError.message.replace(/[\r\n\t\0-\x1f\x7f]/g,' ').slice(0,180)}`:'';
      return NextResponse.json({error:`Pudge ${input.method} RPC failed${code}.${detail}`}, {status:502});
    }
    return NextResponse.json({result:body.result},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:`Pudge ${input.method} RPC unavailable`}, {status:502});}
}

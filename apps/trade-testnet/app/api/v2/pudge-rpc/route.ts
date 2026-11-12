import {NextResponse} from 'next/server';
export const runtime='nodejs';
const allowed=new Set(['get_block_hash','get_tip_header','get_live_cell','get_cells','get_indexer_tip','tx_pool_info']);
export async function POST(request:Request){
  let input:{method?:string;params?:unknown[]};
  try {input=await request.json();} catch {return NextResponse.json({error:'Invalid JSON'}, {status:400});}
  if(!input || !allowed.has(input.method||'') || !Array.isArray(input.params) || JSON.stringify(input.params).length>8192) return NextResponse.json({error:'Unsupported RPC request'}, {status:400});
  try {
    const response=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:input.method,params:input.params}),cache:'no-store',signal:AbortSignal.timeout(15000)});
    const body=await response.json();
    if(!response.ok || body.error) return NextResponse.json({error:'Pudge RPC request failed'}, {status:502});
    return NextResponse.json({result:body.result},{headers:{'Cache-Control':'no-store'}});
  } catch {return NextResponse.json({error:'Pudge RPC unavailable'}, {status:502});}
}

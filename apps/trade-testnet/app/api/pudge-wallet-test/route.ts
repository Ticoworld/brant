import {localRequest} from '../../../lib/r7-local-request';
export const runtime='nodejs';
export async function GET(req:Request){
 if(process.env.PUDGE_WALLET_TEST!=='1'||!localRequest(req))return new Response('Disabled',{status:403});
 try {const call=async(method:string,params:unknown[])=>{const r=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store'});const j=await r.json();if(!r.ok||j.error)throw Error(j.error?.message||'Pudge RPC unavailable');return j.result;};
 const [g,cell,dep,pool]=await Promise.all([call('get_block_by_number',['0x0']),call('get_live_cell',[{tx_hash:'0x97d3e78286547e06c342db1007c041b4aabb927dea943aa760d28ff61ec02670',index:'0x0'},true]),call('get_live_cell',[{tx_hash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:'0x0'},true]),call('tx_pool_info',[])]);
 if(g.header.hash!=='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606'||dep.status!=='live'||cell.status!=='live')throw Error('Wrong network or input/dependency no longer live');
 const o=cell.cell.output;if(o.lock.code_hash!=='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'||o.lock.hash_type!=='type'||o.lock.args!=='0x36ef38ed06300fa0f357f1f360b897c476c5c4f9'||o.type||cell.cell.data.content!=='0x'||BigInt(o.capacity)!==10000n*100000000n)throw Error('Input changed or is not the expected plain cell');
 return Response.json({genesis:g.header.hash,capacity:o.capacity,minFeeRate:pool.min_fee_rate});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Pudge check failed'},{status:503});}
}

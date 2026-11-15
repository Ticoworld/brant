import { localRequest } from '../../../../lib/r7-local-request';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:Request) {
  if(process.env.R7_LOCAL_ENABLED!=='1'||!localRequest(req))return new Response('Disabled',{status:403});
  try {
    const url=new URL(process.env.R7_LOCAL_RPC||'http://127.0.0.1:19224');
    if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password)throw Error('Only loopback RPC permitted');
    const genesis=process.env.R7_LOCAL_GENESIS;if(!genesis||!/^0x[0-9a-f]{64}$/.test(genesis))throw Error('Private genesis required');
    const call=async(method:string,params:unknown[])=>{const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store'});if(!r.ok)throw Error('RPC unavailable');return r.json();};
    const [g,info]=await Promise.all([call('get_block_by_number',['0x0']),call('get_blockchain_info',[])]);
    if(g.result?.header?.hash!==genesis||info.result?.chain!=='ckb_dev')throw Error('RPC is not the configured private devnet');
    if(Number(req.headers.get('content-length')||0)>200000)throw Error('Request too large');
    const j=await req.json();if(!Array.isArray(j.params)||!['get_block_by_number','get_transaction','get_live_cell','get_tip_header','get_cells','send_transaction','estimate_cycles'].includes(j.method))throw Error('RPC method disabled');
    if(j.method==='get_cells'){
      const search=j.params[0],script=search?.script;if(search?.script_type!=='lock'||search.script_search_mode!=='exact'||!script||j.params[3])throw Error('Unsupported cell search');
      const tip=await call('get_tip_header',[]);const height=BigInt(tip.result.number),objects=[];
      for(let h=height;h>=0n&&height-h<10000n;h--){const b=await call('get_block_by_number',['0x'+h.toString(16)]);for(const tx of [...b.result.transactions].reverse())for(let i=0;i<tx.outputs.length;i++){const out=tx.outputs[i];if(out.lock.code_hash!==script.code_hash||out.lock.hash_type!==script.hash_type||out.lock.args!==script.args)continue;const p={tx_hash:tx.hash,index:'0x'+i.toString(16)},live=await call('get_live_cell',[p,true]);if(live.result?.status==='live')objects.push({output:out,output_data:tx.outputs_data[i],out_point:p});}}
      if(height>=10000n)throw Error('Cell scan bound exceeded');return Response.json({jsonrpc:'2.0',id:j.id,result:{objects,last_cursor:'0x'}});
    }
    const result=await call(j.method,j.params);return Response.json({...result,id:j.id});
  }catch(e){return Response.json({jsonrpc:'2.0',id:null,error:{code:-32000,message:String(e)}},{status:400});}
}

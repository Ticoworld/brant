import {getPudgeMarketDataForManifest,getPublishedPudgeMarketData} from '../../../../lib/pudge-market-service.ts';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^0x[0-9a-f]{64}$/.test(id))return Response.json({error:'Invalid market identity'},{status:404});
  try{return Response.json(await getPublishedPudgeMarketData(id),{headers:{'Cache-Control':'no-store'}});}
  catch{return Response.json({error:'Verified market recovery unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params,body=await request.json() as {manifest?:unknown};
    if(typeof body?.manifest!=='string'||body.manifest.length>65_536)throw Error('A valid market manifest is required');
    const market=await getPudgeMarketDataForManifest(body.manifest);
    if(id.toLowerCase()!==market.id.toLowerCase())return Response.json({error:'Market identity does not match this route'},{status:404,headers:{'Cache-Control':'no-store'}});
    return Response.json(market,{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    const message=error instanceof Error?error.message:'Pudge market verification failed';
    return Response.json({error:message},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}

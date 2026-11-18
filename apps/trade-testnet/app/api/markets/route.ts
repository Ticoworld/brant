import {after} from 'next/server';
import {getPudgeDisplaySnapshot,getPudgeMarketData} from '../../../lib/pudge-market-service.ts';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request){
  try{
    if(new URL(request.url).searchParams.get('display')==='1'){
      const snapshot=await getPudgeDisplaySnapshot();
      if(snapshot){
        after(async()=>{await getPudgeMarketData().catch(()=>{});});
        return Response.json(snapshot,{headers:{'Cache-Control':'no-store','X-Roveko-State':'display-snapshot'}});
      }
    }
    return Response.json(await getPudgeMarketData(),{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    const message=error instanceof Error?error.message:'Pudge market verification failed';
    return Response.json({error:message},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}

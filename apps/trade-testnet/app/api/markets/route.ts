import {getPudgeMarketData} from '../../../lib/pudge-market-service.ts';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(){
  try{
    return Response.json(await getPudgeMarketData(),{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    const message=error instanceof Error?error.message:'Pudge market verification failed';
    return Response.json({error:message},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}

import { markets } from '../../../../lib/r7-offers-server';
import { localRequest } from '../../../../lib/r7-local-request';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request) { if(!localRequest(req))return new Response('Forbidden',{status:403});try{return Response.json(await markets());}catch(e){return Response.json({error:String(e)},{status:400});} }

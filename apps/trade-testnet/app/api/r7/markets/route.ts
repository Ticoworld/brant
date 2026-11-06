import { markets } from '../../../../lib/r7-offers-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request) { const u=new URL(req.url);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||req.headers.get('origin')&&req.headers.get('origin')!==u.origin)return new Response('Forbidden',{status:403});try{return Response.json(await markets());}catch(e){return Response.json({error:String(e)},{status:400});} }

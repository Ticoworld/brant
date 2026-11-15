import { offers, publish } from '../../../../lib/r7-offers-server';
import { localRequest } from '../../../../lib/r7-local-request';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const allowed=localRequest;
export async function GET(req:Request) { if(!allowed(req))return new Response('Forbidden',{status:403});try{return Response.json(await offers(new URL(req.url).searchParams.get('vault')||''));}catch(e){return Response.json({error:String(e)},{status:400});} }
export async function POST(req:Request) { if(!allowed(req))return new Response('Forbidden',{status:403});try {if(Number(req.headers.get('content-length')||0)>8192)throw Error('Request too large');const body=await req.json();return Response.json(await publish(body.terms,body.signature));}catch(e){return Response.json({error:String(e)},{status:400});} }

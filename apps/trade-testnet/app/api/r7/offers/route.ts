import { offers, publish } from '../../../../lib/r7-offers-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
function allowed(req:Request) { const u=new URL(req.url);return ['localhost','127.0.0.1','[::1]'].includes(u.hostname) && (!req.headers.get('origin') || req.headers.get('origin')===u.origin); }
export async function GET(req:Request) { if(!allowed(req))return new Response('Forbidden',{status:403});try{return Response.json(await offers(new URL(req.url).searchParams.get('vault')||''));}catch(e){return Response.json({error:String(e)},{status:400});} }
export async function POST(req:Request) { if(!allowed(req))return new Response('Forbidden',{status:403});try {if(Number(req.headers.get('content-length')||0)>8192)throw Error('Request too large');const body=await req.json();return Response.json(await publish(body.terms,body.signature));}catch(e){return Response.json({error:String(e)},{status:400});} }

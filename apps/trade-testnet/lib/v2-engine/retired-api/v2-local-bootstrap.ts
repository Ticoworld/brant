import { readFile } from 'node:fs/promises';
export async function GET() {
  if (process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_LOCAL_FIXTURE !== '1' || !process.env.V2_LOCAL_BOOTSTRAP) return new Response('Disabled', {status:404});
  try {
    const config = JSON.parse(await readFile(process.env.V2_LOCAL_BOOTSTRAP, 'utf8'));
    return Response.json({genesis:config.genesis, deps:config.deps, funding:config.funding.outPoint, codeFunding:{txHash:config.funding.outPoint.txHash,index:'0x5'}, initial:config.initial.slice(0,4).map((x:{outPoint:{txHash:string;index:string}})=>({tx_hash:x.outPoint.txHash,index:x.outPoint.index}))});
  } catch { return new Response('Local bootstrap unavailable', {status:503}); }
}

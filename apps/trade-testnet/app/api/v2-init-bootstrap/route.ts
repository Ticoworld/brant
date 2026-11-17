import {readFile} from 'node:fs/promises';
export const dynamic='force-dynamic';
/** Only public fixture identities; never expose this route in a production build. */
export async function GET(){
 if(process.env.NODE_ENV==='production'||process.env.NEXT_PUBLIC_LOCAL_FIXTURE!=='1'||!process.env.ROVEKO_INIT_BOOTSTRAP)return new Response('Disabled',{status:404});
 try{const f=JSON.parse(await readFile(process.env.ROVEKO_INIT_BOOTSTRAP,'utf8'));return Response.json({genesis:f.genesis,hashes:f.hashes,deps:f.deps,wallets:f.wallets},{headers:{'Cache-Control':'no-store'}});}catch{return new Response('Fixture unavailable',{status:503});}
}

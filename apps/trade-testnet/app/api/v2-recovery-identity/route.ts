import { readFile } from 'node:fs/promises';
export async function GET(){
  if(process.env.NODE_ENV==='production'||process.env.NEXT_PUBLIC_LOCAL_FIXTURE!=='1'||!process.env.V2_LOCAL_BOOTSTRAP)return new Response('Disabled',{status:404});
  try{const c=JSON.parse(await readFile(process.env.V2_LOCAL_BOOTSTRAP,'utf8'));const snake=(s:{codeHash:string;hashType:string;args:string})=>({code_hash:s.codeHash,hash_type:s.hashType,args:s.args});return Response.json({genesis:c.genesis,initializationTransactionHash:c.initializationTransactionHash,custodyLock:snake(c.scripts.custody),xudtType:snake(c.scripts.token)},{headers:{'Cache-Control':'no-store'}});}catch{return new Response('Recovery identity unavailable',{status:503});}
}

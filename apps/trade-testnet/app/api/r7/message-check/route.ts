import { spawn } from 'node:child_process';
import path from 'node:path';
import { localRequest } from '../../../../lib/r7-local-request';
export const runtime='nodejs';
export const dynamic='force-dynamic';
let busy=false;
export async function POST(req:Request) {
 if(process.env.R7_LOCAL_ENABLED!=='1'||!localRequest(req))return new Response('Disabled',{status:403});
 if(busy)return Response.json({error:'Verifier busy'},{status:409});
 const body=await req.text();if(body.length>8192)return new Response('Too large',{status:413});
 let input:unknown;try{input=JSON.parse(body)}catch{return new Response('Invalid JSON',{status:400});}
 busy=true;
 try{
  const script=path.resolve(process.cwd(),'../../labs/wo15-merkle-intent/r7-message-check/run.cjs');
  const result=await new Promise<string>((resolve,reject)=>{
   const child=spawn(process.execPath,[script],{stdio:['pipe','pipe','pipe']});let out='',err='';
   const timer=setTimeout(()=>{child.kill('SIGTERM');reject(Error('Verifier timed out'));},90000);
   child.stdout.on('data',d=>{out+=d;if(out.length>100000)child.kill('SIGTERM')});
   child.stderr.on('data',d=>{err+=d;if(err.length>100000)child.kill('SIGTERM')});
   child.on('error',reject);child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error(err.slice(-1000)||'Verifier failed'));resolve(out.trim().split('\n').at(-1)||'');});
   child.stdin.end(JSON.stringify(input));
  });
  return Response.json(JSON.parse(result));
 }catch(e){return Response.json({error:String(e)},{status:400});}finally{busy=false;}
}

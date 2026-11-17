import {access} from 'node:fs/promises';
import path from 'node:path';

function binaryName(name:string){return process.platform==='win32'?`${name}.exe`:name;}

async function firstAvailable(paths:string[]){
  for(const candidate of paths){try{await access(candidate);return candidate;}catch{}}
  return undefined;
}

export async function resolveGate2NativeTools(){
  const root=path.resolve(process.cwd(),'../../labs/trade-v2-token/gate2');
  const smt=await firstAvailable([
    process.env.ROVEKO_SMT_BINARY||'',
    path.join(root,'smt-tools','target','release',binaryName('trade-v2-smt-tools')),
  ].filter(Boolean));
  const recovery=await firstAvailable([
    process.env.ROVEKO_PROOF_BINARY||'',
    path.join(root,'browser-proof','target','release',binaryName('trade-v2-recovery')),
    path.join(root,'recovery','target','release',binaryName('trade-v2-recovery')),
  ].filter(Boolean));
  return {smt,recovery};
}

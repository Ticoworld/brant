// Read-only benchmark. Run from apps/trade-testnet with Node 24.
import {getPudgeMarketData} from '../lib/pudge-market-service.ts';
import {POST} from '../app/api/v2/pudge-proof/route.ts';
import {PUDGE_GATE2_OWNER} from '../lib/v2-engine/pudge-public-registry.ts';

const fetchRpc=globalThis.fetch;
let calls=0;
globalThis.fetch=(...args)=>{calls++;return fetchRpc(...args);};
async function time(label:string,operation:()=>Promise<unknown>){
  const start=performance.now();
  calls=0;
  await operation();
  console.log(label,{ms:Math.round(performance.now()-start),inProcessHttp:calls});
}
let market!:Awaited<ReturnType<typeof getPudgeMarketData>>;
const read=async()=>{market=await getPudgeMarketData();};
const proof=async()=>{
  const response=await POST(new Request('http://localhost/api/v2/pudge-proof',{
    method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},
    body:JSON.stringify({manifest:market.manifest,owner:PUDGE_GATE2_OWNER,side:'buy',quantity:'1'}),
  }));
  if(!response.ok)throw Error(await response.text());
  const result=await response.json();
  if(result.proof.old_root!==market.custodyRoot)throw Error('Custody root differs from the market read');
  console.log('owner balance',result.proof.owner.balance);
};
await time('market first',read);
await time('market warm',read);
await time('market parallel',()=>Promise.all([read(),read()]));
await time('proof first',proof);
await time('proof warm',proof);
await time('proof parallel',()=>Promise.all([proof(),proof()]));

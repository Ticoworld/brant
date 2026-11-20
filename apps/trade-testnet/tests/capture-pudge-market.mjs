import {getPudgeMarketData,getPudgeMarketDataForManifest} from '../lib/pudge-market-service.ts';
import {readFile,writeFile} from 'node:fs/promises';
const original=globalThis.fetch;
const fixture=new URL('./fixtures/pudge-market-rpc.json',import.meta.url);
const rows=JSON.parse(await readFile(fixture,'utf8'));
let calls=0;
globalThis.fetch=async (url,options)=>{
 if(url!=='https://testnet.ckb.dev/')throw Error('Capture budget exceeded');
 const input=JSON.parse(options.body);
 const requests=Array.isArray(input)?input:[input];
 if(requests.every(r=>Object.hasOwn(rows,JSON.stringify([r.method,r.params])))){
  const cached=requests.map(r=>({id:r.id,result:rows[JSON.stringify([r.method,r.params])]}));
  return Response.json(Array.isArray(input)?cached:cached[0]);
 }
 if(++calls>50)throw Error('Additional capture budget exceeded');
 const response=await original('https://testnet.ckb.dev/rpc',options);
 const body=await response.clone().json();
 for(const request of Array.isArray(input)?input:[input]){
  const row=Array.isArray(body)?body.find(item=>item.id===request.id):body;
  if(row?.result!==undefined)rows[JSON.stringify([request.method,request.params])]=row.result;
 }
 return response;
};
try{
 const market=await getPudgeMarketData();
 await getPudgeMarketDataForManifest(JSON.stringify(market.manifest));
 console.log(market.historyState,market.inventory,market.custody,market.history.map(event=>event.hash));
}finally{
 await writeFile(fixture,JSON.stringify(rows));
}

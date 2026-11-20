import assert from 'node:assert/strict';
import {POST} from '../app/api/v2/pudge-proof/route.ts';

function request(body:string,ip:string,headers:Record<string,string>={}){
  return new Request('http://localhost:8080/api/v2/pudge-proof',{method:'POST',headers:{origin:'https://roveko.example','sec-fetch-site':'same-origin','content-type':'application/json','x-real-ip':ip,...headers},body});
}

process.env.RAILWAY_PUBLIC_DOMAIN='roveko.example';
assert.equal((await POST(request('{}','203.0.113.1',{origin:'https://attacker.example'}))).status,403);
assert.equal((await POST(request('{}','203.0.113.2',{'content-type':'text/plain'}))).status,415);
assert.equal((await POST(request('{','203.0.113.3'))).status,400);

const oversized=request(' '.repeat(65537),'203.0.113.4');
assert.equal((await POST(oversized)).status,400);

const owner=`0x${'11'.repeat(32)}`;
const unregistered=JSON.stringify({owner,side:'buy',quantity:'1',manifest:{genesis:`0x${'22'.repeat(32)}`,codeDeploymentTransactionHash:`0x${'33'.repeat(32)}`,initializationTransactionHash:`0x${'44'.repeat(32)}`}});
assert.equal((await POST(request(unregistered,'203.0.113.5'))).status,403);

for(let i=0;i<12;i++)assert.equal((await POST(request('{}','203.0.113.6',{'x-forwarded-for':`198.51.100.${i+1}` }))).status,400);
const rejected=await POST(request('{}','203.0.113.6',{'x-forwarded-for':'198.51.100.99'}));
assert.equal(rejected.status,429);
assert.equal(rejected.headers.get('retry-after'),'60');
assert.equal((await POST(request('{}','203.0.113.7'))).status,400);
console.log('Pudge proof endpoint enforced HTTPS origin and client rate limits despite varying forwarded headers');

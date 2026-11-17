import assert from 'node:assert/strict';
import {POST} from '../lib/v2-engine/retired-api/v2-pudge-init-proof.ts';
assert(process.env.ROVEKO_SMT_BINARY&&process.env.ROVEKO_PROOF_BINARY&&process.env.ROVEKO_RECOVERY_COLLECTOR,'Set proof tool paths');
const body={anchor:{txHash:'0x'+'11'.repeat(32),index:'0x1'},owner:'0x'+'22'.repeat(32)};
const request=(payload:unknown,origin='http://127.0.0.1:3000')=>new Request('http://127.0.0.1:3000/api/v2/pudge-init-proof',{method:'POST',headers:{host:'127.0.0.1:3000',origin,'content-type':'application/json'},body:JSON.stringify(payload)});
const response=await POST(request(body));assert.equal(response.status,200);const proof=await response.json();assert.equal(proof.owner,body.owner);assert.match(proof.newRoot,/^0x[0-9a-f]{64}$/i);assert.match(proof.witness,/^0x544d5331/i);
assert.equal((await POST(request({...body,owner:'invalid'}))).status,400);
assert.equal((await POST(request(body,'https://example.com'))).status,403);
console.log('Pudge initial proof checks passed');

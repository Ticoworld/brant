import assert from 'node:assert/strict';
import {POST as localRpc} from '../app/api/local-rpc/route.ts';
import {GET as bootstrap} from '../app/api/v2-local-bootstrap/route.ts';
import {GET as recovery} from '../app/api/v2-recovery-identity/route.ts';
Object.assign(process.env,{NODE_ENV:'production'});process.env.NEXT_PUBLIC_LOCAL_FIXTURE='1';process.env.ROVEKO_LOCAL_PROOFS='1';process.env.ROVEKO_LOCAL_BROADCAST='1';
const request=new Request('http://127.0.0.1/api/local-rpc',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
assert.equal((await localRpc(request)).status,404);assert.equal((await bootstrap()).status,404);assert.equal((await recovery()).status,404);
console.log('production fixture endpoint gates passed');

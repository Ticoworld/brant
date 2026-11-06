import assert from 'node:assert/strict';
import {localRequest} from '../lib/r7-local-request.ts';
const request=(host:string,origin:string)=>new Request('http://localhost:3102/',{headers:{host,origin}});
assert(localRequest(request('127.0.0.1:3102','http://127.0.0.1:3102')));
assert(localRequest(request('localhost:3102','http://localhost:3102')));
assert(!localRequest(request('127.0.0.1:3102','http://evil.example')));
assert(!localRequest(request('evil.example','http://evil.example')));
assert(!localRequest(request('127.0.0.1:3102','http://localhost:3102')));
console.log('R7 local request origin checks passed');

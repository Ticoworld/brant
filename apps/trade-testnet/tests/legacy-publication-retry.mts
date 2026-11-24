import assert from 'node:assert/strict';
import {launchOperations} from '../lib/v2-engine/launch-operations-server.ts';
import {LaunchPublicationError,publicationRecovery} from '../lib/v2-engine/launch-publication-errors.ts';
const hash=(v:string)=>'0x'+v.repeat(64),owner=hash('1'),market=hash('2');
let sends=0,closes=0;
const operation=launchOperations({genesis:hash('3'),quantity:7n,
 rpc:async()=>{throw Error('Retry without authorization must not query chain');},
 proof:async()=>{throw Error('Legacy publication retry must not generate a launch');},
 send:async()=>{sends++;throw Error('Publication must not submit a transaction');},
 openStore:()=>({find:()=>({scope:{owner,market},hashes:{},journal:{entries:[]}}),readPublicationAuthorization:()=>null,close:()=>{closes++;}} as unknown as ReturnType<Parameters<typeof launchOperations>[0]['openStore']>),
});
await assert.rejects(()=>operation('retry-publication',{owner,market}),error=>error instanceof LaunchPublicationError&&error.code==='publication_signature');
assert.equal(sends,0);assert.equal(closes,1);
assert.match(publicationRecovery.publication_signature,/Do not relaunch/);
console.log('Legacy retry without saved authorization fails safely and cannot broadcast.');

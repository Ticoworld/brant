import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createWriteStream,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const app=fileURLToPath(new URL('..',import.meta.url)),folder=resolve(app,'../../releases/atomic-pudge-rc1'),base='http://127.0.0.1:3144',temp=mkdtempSync(join(tmpdir(),'brant-rc-production-'));
const env={...process.env,NODE_ENV:'production',BRANT_LAUNCH_WRITES:'0',BRANT_ATOMIC_PUDGE_QUALIFICATION:'0',BRANT_LAUNCH_APPROVED_CREATOR:'',BRANT_LAUNCH_SQLITE_PATH:join(temp,'launch.sqlite'),BRANT_LAUNCH_PROOF_ORIGIN:base};
for(const name of ['BRANT_ISOLATED_CONFIG','BRANT_ISOLATED_TEST','NEXT_PUBLIC_BRANT_ISOLATED_TEST','NEXT_PUBLIC_BRANT_ISOLATED_GENESIS','R7_NEXT_DIST_DIR'])delete env[name];
const log=createWriteStream(join(folder,'production-smoke.txt'));
const child=spawn(process.execPath,[join(app,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3144'],{cwd:app,env,detached:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log);child.stderr.pipe(log);
try{
 let ready=false;for(let i=0;i<120;i++){if(child.exitCode!==null)throw Error('Production server exited');try{const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break;}}catch{}await delay(500);}assert(ready);
 const page=await fetch(base+'/launch');assert.equal(page.status,200);const html=await page.text();assert(!html.includes('>Isolated<'));
 const responses=[];for(const action of ['submit','resubmit']){const r=await fetch(base+'/api/v2/launch/'+action,{method:'POST',headers:{origin:base,'sec-fetch-site':'same-origin','content-type':'application/json'},body:'{}'});assert.equal(r.status,403);assert.equal((await r.json()).error,'Launch execution is disabled');responses.push({action,status:r.status});}
 const retry=await fetch(base+'/api/v2/launch/retry-publication',{method:'POST',headers:{origin:base,'sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({owner:'0x'+'11'.repeat(32),market:'0x'+'22'.repeat(32)})});assert.equal(retry.status,200);assert.equal(await retry.json(),null);
 writeFileSync(join(folder,'production-verification.json'),JSON.stringify({verified:true,node:process.version,mode:'production',isolatedOverrides:false,qualificationEnabled:false,launchWritesEnabled:false,health:200,launch:200,responses,legacyRetryRecognized:true,legacyUnknownSessionReturnsNull:true,legacyRetryHTTP:retry.status,temporaryDatabase:temp,publicTransactions:false,limitations:['This is a local production runtime smoke test, not a Railway deployment or hosted CKBM retry.']},null,2)+'\n');console.log('Production runtime passed: Pudge UI, writes closed, legacy retry recognized and fail-closed.');
}finally{if(child.exitCode===null){process.kill(-child.pid,'SIGTERM');for(let i=0;i<100&&child.exitCode===null;i++)await delay(100);if(child.exitCode===null)process.kill(-child.pid,'SIGKILL');}log.end();}

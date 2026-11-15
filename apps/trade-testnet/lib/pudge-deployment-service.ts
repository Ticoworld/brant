import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createDeploymentService} from './deployment-service';

const dbPath=()=>path.resolve(process.cwd(),'pudge-deployment-attempts.sqlite');
export const pudgeDeploymentService=createDeploymentService({
 rpc:async(method,params)=>{const r=await fetch('https://testnet.ckb.dev/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store'});const j=await r.json();if(!r.ok||j.error)throw Error(j.error?.message||'Pudge RPC unavailable');return j.result},
 genesis:'0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606',network:'pudge',
 owner:{codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:'0x36ef38ed06300fa0f357f1f360b897c476c5c4f9'},
 funding:{txHash:'0x3fa9dd0155936e0dacc9bf5e57a4785c3d6d66191a7560f1ff5ec6a6b04954f3',index:2,capacity:9999986100000n},
 dependency:{txHash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:0},
 code:()=>readFile(path.resolve(process.cwd(),'../../labs/wo15-merkle-intent/r7/build/merkle_intent')),
 codeHash:'0x6870b841e2b873ca563b95313bcac6f20e299d17c395e1f907d0723d4fa16c36',codeLength:51072,codeCapacity:5113300000000n,
 broadcastAuthorized:()=>process.env.PUDGE_R7_BROADCAST_ENABLED==='1',
 journal:{
  reserve(funding,hash){const db=new DatabaseSync(dbPath());try{db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS attempts (hash TEXT PRIMARY KEY, attempted INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS funding_guard (funding TEXT PRIMARY KEY, hash TEXT NOT NULL)');db.exec('BEGIN IMMEDIATE');try{const inserted=db.prepare('INSERT OR IGNORE INTO funding_guard VALUES (?,?)').run(funding,hash);if(!inserted.changes)throw Error('Funding input already attempted; reconcile before retry');db.prepare('INSERT OR IGNORE INTO attempts VALUES (?,?)').run(hash,Date.now());db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}finally{db.close()}},
  has(hash){const db=new DatabaseSync(dbPath());try{return !!db.prepare('SELECT hash FROM attempts WHERE hash=?').get(hash)}finally{db.close()}}
 },
 manifest:{async write(value){const file=path.resolve(process.cwd(),'r7-pudge-verified.json'),content=JSON.stringify(value,null,2);try{await writeFile(file,content,{flag:'wx'})}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST'||await readFile(file,'utf8')!==content)throw Error('Existing deployment manifest differs; manual review required')}}}
});

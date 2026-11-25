import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {openAtomicLaunchDelivery} from '../lib/v2-engine/atomic-launch-delivery.ts';
const source=resolve(process.argv[2]);
const path=join(mkdtempSync(join(tmpdir(),'brant-review-migration-')),'copy.sqlite');
copyFileSync(source,path);
let db=new DatabaseSync(path);
// Optionally combine genuine retained legacy rows with the retained atomic
// record in the disposable copy; neither source database is ever modified.
if(process.argv[3]){
 const legacySource=new DatabaseSync(resolve(process.argv[3]),{readOnly:true});
 for(const {name} of legacySource.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'shared_launch%'").all()){
  assert(/^shared_launch(?:_[a-z]+)*$/.test(name));
  for(const row of legacySource.prepare(`SELECT * FROM ${name}`).all()){
   const columns=Object.keys(row);assert(columns.every(column=>/^[a-z_]+$/.test(column)));
   db.prepare(`INSERT OR IGNORE INTO ${name} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...Object.values(row));
  }
 }
 legacySource.close();
}
const original=db.prepare('SELECT market,tx_hash,snapshot FROM atomic_launch_delivery ORDER BY market').all();
const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'shared_launch%'").all();
const legacy=tables.map(({name})=>({name,rows:db.prepare(`SELECT * FROM ${name}`).all()}));db.close();
let store=openAtomicLaunchDelivery(path,async()=>{throw Error('Migration must not query a chain');});store.close();
db=new DatabaseSync(path);
assert.deepEqual(db.prepare('SELECT market,tx_hash,snapshot FROM atomic_launch_delivery ORDER BY market').all(),original);
for(const {name,rows} of legacy)assert.deepEqual(db.prepare(`SELECT * FROM ${name}`).all(),rows);
const row=original[0];assert(row,'Representative atomic record required');
const snapshot=JSON.parse(row.snapshot);
snapshot.state='reviewed';delete snapshot.signed;delete snapshot.publication;delete snapshot.receipt;
db.prepare('UPDATE atomic_launch_delivery SET snapshot=? WHERE market=?').run(JSON.stringify(snapshot),row.market);db.close();
store=openAtomicLaunchDelivery(path,async()=>{throw Error('Cancellation must not query a chain');});
assert.equal(store.cancel(row.market,snapshot.owner).state,'cancelled');
assert.equal(store.cancel(row.market,snapshot.owner).state,'cancelled');store.close();
db=new DatabaseSync(path);
assert.equal(db.prepare('SELECT count(*) AS n FROM atomic_launch_funding WHERE market=?').get(row.market).n,0);
snapshot.state='submitted';snapshot.signed=snapshot.reviewed;
db.prepare('UPDATE atomic_launch_delivery SET snapshot=? WHERE market=?').run(JSON.stringify(snapshot),row.market);db.close();
store=openAtomicLaunchDelivery(path,async()=>{throw Error('No chain access');});
assert.throws(()=>store.cancel(row.market,snapshot.owner),/must be reconciled/);store.close();
db=new DatabaseSync(path);
snapshot.state='reviewed';delete snapshot.signed;snapshot.reviewId='expired-fixture';snapshot.expiresAt=Date.now()-1;
db.prepare('UPDATE atomic_launch_delivery SET snapshot=? WHERE market=?').run(JSON.stringify(snapshot),row.market);db.close();
store=openAtomicLaunchDelivery(path,async()=>{throw Error('Expiration must not query a chain');});
assert.equal(store.read(row.market,snapshot.owner).state,'cancelled');store.close();
db=new DatabaseSync(path);
assert.equal(db.prepare("SELECT reason FROM atomic_launch_review_history WHERE review_id='expired-fixture'").get().reason,'expired');db.close();
console.log(JSON.stringify({migration:'passed',atomicRecords:original.length,legacyTables:legacy.length,unsignedCancellation:'passed',submittedPreserved:'passed',sourceUnchanged:true}));

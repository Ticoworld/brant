// Validate saved evidence; optional VM_RUNNER re-executes existing fixtures without a CKB node.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),assert=require('node:assert/strict'),cp=require('child_process'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../..');
const native=path.join(root,'labs/wo09-e2-capacity/evidence/e3-genuine-fixture-merge-1793632183354');
const vm=path.join(root,'labs/wo09-e3/evidence/merge-vm-1793632167062');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const events=read(native+'/events.json'),m=read(native+'/merge-result.json');
assert.equal(events.length,8);assert(events.every(x=>x.committed.tx_status.status==='committed'));
assert.equal(events.at(-1).hash,m.exit);assert.equal(events.at(-1).label,'genuine_1000_shannon_claim_merged_into_owner_cell');
assert.equal(BigInt(m.recipient_after)-BigInt(m.recipient_before),1000n);
const exit=events.at(-1).tx;assert.equal(BigInt(exit.outputs[1].capacity),BigInt(m.recipient_after));
assert.equal(exit.inputs.length,3);assert.equal(exit.outputs.length,3);
assert.equal(exit.outputs[1].lock.args,'0x'+require(path.join(root,'labs/rebuild/native/node_modules/@nervosnetwork/ckb-sdk-utils')).blake160(require(path.join(root,'labs/rebuild/native/node_modules/@nervosnetwork/ckb-sdk-utils')).privateKeyToPublicKey('0x'+'2'.padStart(64,'0')),'hex'));
const deploy=events[0].tx.outputsData[0];assert.equal(crypto.createHash('sha256').update(Buffer.from(deploy.slice(2),'hex')).digest('hex'),m.binary_sha256);
const history=read(native+'/history-reconstruction/history-reconstruction.json');assert.deepEqual(history.checkpoint_transactions.map(x=>x.hash),m.checkpoints);
const prior=events.at(-2).tx;
assert.equal(BigInt(prior.outputs[0].capacity)-BigInt(exit.outputs[0].capacity),1000n);
const sponsorInput=events[0].tx.outputs[1].capacity; // deployment change belongs to role 2; lock deployment spends this again
const sponsorBefore=events[1].tx.outputs[1].capacity;
assert.equal(BigInt(sponsorBefore)-BigInt(exit.outputs[2].capacity),BigInt(m.sponsor_fee_shannons));
const raw=zlib.gunzipSync(fs.readFileSync(native+'/raw.jsonl.gz')).toString().trim().split('\n').map(JSON.parse);
for(const event of events)assert(raw.some(r=>r.method==='get_transaction'&&r.params[0]===event.hash&&r.response.result?.tx_status?.status==='committed'),event.hash);
const summary=read(vm+'/summary.json');let rerun=0;
for(const result of summary.results){const f=fs.readdirSync(vm).find(f=>f.endsWith('-'+result.label+'.json'));assert(f,result.label);const saved=read(vm+'/'+f+'.result.json');assert.deepEqual(saved,Object.fromEntries(Object.entries(result).filter(([k])=>k!=='label')));
 if(process.env.VM_RUNNER){const stdout=cp.execFileSync(process.env.VM_RUNNER,[vm+'/'+f],{encoding:'utf8'});const got=JSON.parse(stdout.trim().split('\n').at(-1));assert.equal(got.accepted,result.accepted,result.label);if(!got.accepted)assert.equal(got.error,result.error,result.label);rerun++;}}
const report={classification:'RECOVERED_EVIDENCE_VALIDATION',native_committed_transactions:events.length,native_exit:m.exit,native_claim_shannons:'1000',recipient_delta_shannons:'1000',sponsor_fee_shannons:m.sponsor_fee_shannons,checkpoint_fixture_count:4,vm_saved_results:summary.results.length,vm_reexecuted:rerun,limitations:['VM context snapshots are constructed; roots evolve but outpoints are reset between cases','No 0.1 or 1 CKB native checkpoint account proved','Original self-paid fee mode rejects; no corrected mechanism yet','No funded-cell-free recovery solution proved']};
fs.writeFileSync(path.join(root,'labs/wo09-e3/evidence/recovery-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));

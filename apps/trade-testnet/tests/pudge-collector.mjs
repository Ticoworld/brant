import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('collector retries transient failures, preserves order, and rejects a broken chain', async () => {
 const dir=await mkdtemp(path.join(os.tmpdir(),'pudge-collector-test-'));
 const h=c=>'0x'+c.repeat(64), lock={code_hash:h('1'),hash_type:'data1',args:'0x'+'00'.repeat(128)}, token={code_hash:h('2'),hash_type:'data1',args:'0x'}, marker={code_hash:h('3'),hash_type:'data1',args:'0x'};
 const tx={hash:h('a'),version:'0x0',cell_deps:[],header_deps:[],inputs:[],outputs:[{lock,type:token,capacity:'0x1'},{lock,type:marker,capacity:'0x1'}],outputs_data:['0x01','0x'],witnesses:[]};
 let attempts=0,broken=false,indexMismatch=false;
 const server=http.createServer(async(req,res)=>{let raw='';for await(const x of req)raw+=x;const {method,params,id}=JSON.parse(raw);let result,error;
  if(method==='get_tip_header')result={number:'0x2',hash:h('d')};
  else if(method==='get_indexer_tip')result={block_number:'0x2',block_hash:h('d')};
  else if(method==='get_transactions')result={objects:[{tx_hash:h('a'),block_number:'0x1',tx_index:indexMismatch?'0x1':'0x0'}],last_cursor:'0x'};
  else if(method==='get_cells')result={objects:[{out_point:{tx_hash:h('a'),index:'0x0'}}]};
  else if(method==='get_transaction')result={transaction:tx,tx_status:{status:'committed',block_number:'0x1',block_hash:h('c')}};
  else if(method==='get_live_cell')result={status:'live',cell:{output:tx.outputs[0],data:{content:'0x01'}}};
  else if(method==='get_block_by_number'){if(params[0]==='0x2'&&++attempts===1)error={code:-1,message:'temporary'};else result=params[0]==='0x1'?{header:{number:'0x1',hash:h('c'),parent_hash:h('b')},transactions:[tx]}:{header:{number:'0x2',hash:h('d'),parent_hash:broken?h('e'):h('c')},transactions:[]};}
  res.setHeader('content-type','application/json');res.end(JSON.stringify({jsonrpc:'2.0',id,...(error?{error}:{result})}));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  await writeFile(path.join(dir,'lock.json'),JSON.stringify(lock));await writeFile(path.join(dir,'token.json'),JSON.stringify(token));
  const run=()=>new Promise(resolve=>{const out=path.join(dir,`bundle-${broken}.json`);const child=spawn(process.execPath,['lib/v2-engine/pudge-recover.cjs','collect-blocks','--node',`http://127.0.0.1:${server.address().port}`,'--init',h('a'),'--owner',h('f'),'--custody-lock',path.join(dir,'lock.json'),'--xudt-type',path.join(dir,'token.json'),'--out',out],{env:{...process.env,ROVEKO_PROOF_BINARY:path.join(dir,'missing-verifier')}});let err='';child.stderr.on('data',x=>err+=x);child.on('close',code=>resolve({code,err,out}));});
  const first=await run();assert.notEqual(first.code,0);assert.match(first.err,/build verifier first/);const bundle=JSON.parse(await readFile(first.out,'utf8'));assert.equal(bundle.collection.scanned_blocks,2);assert.equal(bundle.history[0].tx_hash,h('a'));assert(attempts>=2);
  broken=true;const second=await run();assert.notEqual(second.code,0);assert.match(second.err,/discontinuous block history/);
  broken=false;
  const indexed=()=>new Promise(resolve=>{const out=path.join(dir,`indexed-${indexMismatch}.json`),url=`http://127.0.0.1:${server.address().port}`;const child=spawn(process.execPath,['lib/v2-engine/pudge-recover.cjs','collect','--node',url,'--indexer',url,'--init',h('a'),'--owner',h('f'),'--custody-lock',path.join(dir,'lock.json'),'--xudt-type',path.join(dir,'token.json'),'--out',out],{env:{...process.env,ROVEKO_PROOF_BINARY:path.join(dir,'missing-verifier')}});let err='';child.stderr.on('data',x=>err+=x);child.on('close',code=>resolve({code,err,out}));});
  const third=await indexed();assert.match(third.err,/build verifier first/);assert.equal(JSON.parse(await readFile(third.out,'utf8')).history[0].tx_hash,h('a'));
  indexMismatch=true;const fourth=await indexed();assert.notEqual(fourth.code,0);assert.match(fourth.err,/valid transaction hash|absent or differs/);
 } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});

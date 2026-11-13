// Disposable node only. Uses the public Gate 2 fixture key; never use on Pudge.
const fs=require('node:fs'),path=require('node:path');
const {ccc}=require('@ckb-ccc/core');
const C=require(process.env.TRADE_NATIVE_ROOT+'/src/lib.cjs');
const signGroup=require(process.env.TRADE_NATIVE_ROOT+'/node_modules/@nervosnetwork/ckb-sdk-core/lib/signWitnessGroup.js').default;
const dir=process.env.ROVEKO_BOOTSTRAP,bin=process.env.TRADE_GATE2_BUILD_DIR;
if(!dir||!bin)throw Error('Set ROVEKO_BOOTSTRAP and TRADE_GATE2_BUILD_DIR');
const state=JSON.parse(fs.readFileSync(path.join(dir,'browser-bootstrap.json')));
if(state.rpc!=='http://127.0.0.1:19224')throw Error('Isolated localhost RPC required');
let id=0;async function rpc(method,params=[]){const r=await fetch(state.rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params})});const j=await r.json();if(j.error)throw Error(JSON.stringify(j.error));return j.result;}
async function main(){
 const genesis=await rpc('get_block_hash',['0x0']);if(genesis!==state.genesis||genesis==='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606')throw Error('Wrong chain');
 const fund=JSON.parse(fs.readFileSync(path.join(dir,'events.jsonl'),'utf8').split('\n')[0]);
 const previous={txHash:fund.hash,index:'0x5'}, live=await rpc('get_live_cell',[C.snake(previous),true]);
 if(live.status!=='live'||live.cell.output.lock.args!==C.locks[2].args||live.cell.output.type||live.cell.data.content!=='0x')throw Error('Fixture funding mismatch');
 const names=['custody_smt','market_smt','custody_marker','marker_candidate','owner_lineage_candidate'];
 const data=names.map(n=>C.hx(fs.readFileSync(path.join(bin,n))));
 for(let i=0;i<names.length;i++)if(C.hash(C.b(data[i]))!==state.hashes[names[i]])throw Error('Binary mismatch');
 const capacity=data.map(d=>BigInt((d.length-2)/2+61)*C.UNIT),total=capacity.reduce((a,b)=>a+b,0n),input=BigInt(live.cell.output.capacity),fee=1000000n;
 const genesisBlock=await rpc('get_block_by_number',['0x0']);
 const tx={version:'0x0',cellDeps:[{outPoint:{txHash:genesisBlock.transactions[1].hash,index:'0x0'},depType:'depGroup'}],headerDeps:[],inputs:[{previousOutput:previous,since:'0x0'}],outputs:[...capacity.map(c=>({capacity:C.hex(c),lock:C.locks[2]})),{capacity:C.hex(input-total-fee),lock:C.locks[2]}],outputsData:[...data,'0x'],witnesses:['0x']};
 const digest=C.U.rawTransactionToHash(tx);tx.witnesses[0]=signGroup(C.keys[2],digest,[{lock:'',inputType:'',outputType:''}])[0];
 const size=ccc.Transaction.from(tx).toBytes().length,report={scope:'disposable localhost only',genesis,hash:digest,sizeBytes:size,feeShannons:String(fee),outputCapacityShannons:String(total),dataBytes:data.map(x=>(x.length-2)/2)};
 try{report.estimate=await rpc('estimate_cycles',[C.snake(tx)]);report.submitted=await rpc('send_transaction',[C.snake(tx),'passthrough']);let found;for(let i=0;i<30;i++){await rpc('generate_block');found=await rpc('get_transaction',[report.submitted]);if(found?.tx_status?.status==='committed'){report.committed=found.tx_status;break;}}if(!report.committed)throw Error('Not committed');const canonicalBlockHash=await rpc('get_block_hash',[found.tx_status.block_number]);if(canonicalBlockHash!==found.tx_status.block_hash)throw Error('Block is not canonical');const cells=[];for(let i=0;i<names.length;i++){const cell=await rpc('get_live_cell',[{tx_hash:report.submitted,index:C.hex(i)},true]);if(cell.status!=='live'||cell.cell.data.hash!==state.hashes[names[i]])throw Error('Live code hash mismatch');cells.push(cell);}fs.writeFileSync(path.join(dir,'code-size-canonical.json'),JSON.stringify({tx:found,canonicalBlockHash,cells},null,2));}catch(e){report.error=String(e);}
 fs.writeFileSync(path.join(dir,'code-size-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.error||!report.committed)process.exitCode=1;
}main().catch(e=>{console.error(e);process.exitCode=1;});

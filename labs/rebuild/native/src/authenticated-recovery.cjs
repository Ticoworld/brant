// Recovery policy verifier for public disposable private-chain fixtures.
// Trust root: operator-retained policy + trusted local node pinned by genesis.
// This is a client signing policy, NOT an on-chain A2 LO-01 correction.
const C=require('./lib.cjs'),assert=require('node:assert/strict');
const signGroup=require(C.path.join(C.path.dirname(require.resolve('@nervosnetwork/ckb-sdk-core')),'signWitnessGroup.js')).default;
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),pointKey=p=>p.txHash+':'+BigInt(p.index);
function reference(data,point){const d=C.b(data);assert.equal(d.length,89,'ORDER_ENCODING');const action=d.readUInt32LE(16);if(action===0){assert.equal(d.subarray(20,52).toString('hex'),'00'.repeat(32),'MINT_PADDING');const n=BigInt(point.index)+BigInt(d.readInt32LE(52));assert(n>=0n,'MINT_DISTANCE');return {txHash:point.txHash,index:C.hex(n)};}assert.equal(action,1,'ORDER_ACTION');return {txHash:C.hx(d.subarray(20,52)),index:C.hex(d.readUInt32LE(52))};}
async function authorize(policy,rpc){
 assert.equal(policy.schema,1);assert.equal(policy.domain,'trade-disposable-private-devnet');assert.equal(policy.a2.codeHash,'0x49dfb6afee5cc8ac4225aeea8cb8928b150caf3cd92fea33750683c74b13254a');assert.equal(policy.a2.hashType,'data1');assert.equal(policy.a2.args,'0x');
 assert.equal(C.U.scriptToHash(policy.owner),C.U.scriptToHash(C.locks[policy.fixtureRole]),'OWNER_ROLE');assert.equal(C.U.scriptToHash(policy.recipient),C.U.scriptToHash(policy.owner),'INTENDED_RECIPIENT');
 assert.equal((await rpc('get_block_by_number',['0x0'])).header.hash,policy.genesis,'CHAIN_DOMAIN');
 const fetched=new Map(),trace=[],visited=new Set();
 async function transaction(hash){if(fetched.has(hash))return fetched.get(hash);const r=await rpc('get_transaction',[hash]);assert.equal(r?.tx_status?.status,'committed','COMMITTED_HISTORY_REQUIRED');const t=C.camel(r.transaction);for(const d of t.cellDeps)if(d.depType==='dep_group')d.depType='depGroup';assert.equal(C.U.rawTransactionToHash(t),hash,'HISTORY_HASH');fetched.set(hash,t);return t;}
 function actualCell(t,p){const i=Number(BigInt(p.index));assert(t.outputs[i],'OUTPUT_INDEX');return {...t.outputs[i],data:t.outputsData[i],outPoint:p};}
 const mint=await transaction(policy.mintTxHash);assert.equal(C.U.rawTransactionToHash(policy.retainedMint),policy.mintTxHash,'TRUSTED_MINT_HASH');assert.equal(policy.master.txHash,policy.mintTxHash,'TRUSTED_MASTER');
 const master=actualCell(mint,policy.master);assert.equal(C.U.scriptToHash(master.lock),C.U.scriptToHash(policy.owner),'MASTER_OWNER');assert.equal(C.U.scriptToHash(master.type),C.U.scriptToHash(policy.a2),'MASTER_TYPE');
 const rootPoint={txHash:policy.mintTxHash,index:C.hex(policy.mintOrderIndex)},root=actualCell(mint,rootPoint);assert.equal(C.b(root.data).readUInt32LE(16),0,'ROOT_MINT');assert.equal(pointKey(reference(root.data,rootPoint)),pointKey(policy.master),'ROOT_PAIR');
 async function visit(point,depth=0){assert(depth<256,'HISTORY_BOUND');const key=pointKey(point);assert(!visited.has(key),'HISTORY_CYCLE');visited.add(key);const t=await transaction(point.txHash),o=actualCell(t,point);
  assert.equal(C.U.scriptToHash(o.lock),C.U.scriptToHash(policy.a2),'ORDER_CODE');assert.equal(C.U.scriptToHash(o.type),policy.assetTypeHash,'ASSET_DOMAIN');assert.equal(pointKey(reference(o.data,point)),pointKey(policy.master),'MASTER_LINEAGE');assert.equal(C.b(o.data).subarray(56).toString('hex'),C.b(root.data).subarray(56).toString('hex'),'ORDER_TERMS');
  trace.push(point);if(key===pointKey(rootPoint))return o;assert.equal(C.b(o.data).readUInt32LE(16),1,'UNTRUSTED_MINT');
  const parents=[];for(const input of t.inputs){const previous=await transaction(input.previousOutput.txHash),pc=actualCell(previous,input.previousOutput);if(C.U.scriptToHash(pc.lock)!==C.U.scriptToHash(policy.a2))continue;const ref=reference(pc.data,input.previousOutput);if(pointKey(ref)===pointKey(policy.master))parents.push(input.previousOutput);}
  assert.equal(parents.length,1,'AUTHENTIC_PREDECESSOR_REQUIRED');await visit(parents[0],depth+1);return o;
 }
 const order=await visit(policy.currentOrder);
 for(const c of [master,order]){const live=await rpc('get_live_cell',[C.snake(c.outPoint),true]);assert.equal(live.status,'live','LIVE_CELL_REQUIRED');const actual=C.camel(live.cell.output);assert.equal(C.U.scriptToHash(actual.lock),C.U.scriptToHash(c.lock));assert.equal(C.U.scriptToHash(actual.type),C.U.scriptToHash(c.type));assert.equal(BigInt(actual.capacity),BigInt(c.capacity));assert.equal(live.cell.data.content,c.data,'LIVE_DATA');}
 const fee=BigInt(policy.fee);assert(fee>=0n&&fee<=1000000n,'FEE_BOUND');const capacity=BigInt(master.capacity)+BigInt(order.capacity)-fee;assert.equal(capacity,BigInt(policy.expectedCKB),'INTENDED_CKB');const udt=C.b(order.data).readBigUInt64LE(0)+(C.b(order.data).readBigUInt64LE(8)<<64n);assert.equal(udt,BigInt(policy.expectedTokens),'INTENDED_TOKENS');
 const t={version:'0x0',cellDeps:policy.cellDeps,headerDeps:[],inputs:[master,order].map(c=>({previousOutput:c.outPoint,since:'0x0'})),outputs:[{capacity:C.hex(capacity),lock:policy.recipient,type:order.type}],outputsData:[C.hx(C.le(udt,16))],witnesses:['0x','0x']};
 // Dependency hashes are pinned to policy code cells, live validation is delegated to node/VM.
 assert.equal(policy.cellDeps.length,3,'DEPENDENCY_POLICY');return {tx:t,inputs:[master,order],audit:{genesis:policy.genesis,retainedMint:policy.mintTxHash,master:policy.master,currentOrder:policy.currentOrder,trace,recipient:policy.recipient,expectedCKB:capacity.toString(),expectedTokens:udt.toString(),scope:'Authenticated retained-mint client policy on trusted private RPC; no on-chain LO-01 fix'}};
}
async function main(){const policy=JSON.parse(C.fs.readFileSync(process.argv[2])),log=process.argv[3];assert(log,'Raw audit path required');const rpc=async(method,params)=>{const r=await fetch('http://127.0.0.1:19224',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();C.fs.appendFileSync(log,JSON.stringify({method,params,response:j})+'\n');if(j.error)throw Error(j.error.message);return j.result;};const result=await authorize(policy,rpc);result.tx.witnesses[0]=signGroup(C.keys[policy.fixtureRole],C.U.rawTransactionToHash(result.tx),[{lock:'',inputType:'',outputType:''}])[0];process.stdout.write(JSON.stringify(result));}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={authorize,reference};

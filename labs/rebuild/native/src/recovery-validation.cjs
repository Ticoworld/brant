// Non-sensitive offline policy mutations against captured private-node replies.
// No forged chain transaction or exploit is constructed/submitted.
const C=require('./lib.cjs'),assert=require('node:assert/strict'),z=require('zlib'),{authorize}=require('./authenticated-recovery.cjs');
async function validate(dir){const p=JSON.parse(C.fs.readFileSync(dir+'/authenticated-recovery-policy.json')),raw=C.fs.readFileSync(dir+'/authenticated-recovery-rpc.jsonl','utf8').trim().split('\n').map(JSON.parse);const map=new Map(raw.map(r=>[JSON.stringify([r.method,r.params]),r.response.result]));const rpc=async(m,a)=>{const r=map.get(JSON.stringify([m,a]));assert(r!==undefined,'MISSING_RPC');return structuredClone(r);};const good=await authorize(p,rpc),cases=[];
 async function deny(name,policy=p,adapt=rpc,pattern=/.*/){await assert.rejects(()=>authorize(policy,adapt),pattern);cases.push(name);}
 const change=(field,value)=>({...p,[field]:value});
 await deny('wrong_genesis',change('genesis','0x'+'00'.repeat(32)),rpc,/CHAIN_DOMAIN/);
 await deny('wrong_recipient',change('recipient',C.locks[1]),rpc,/INTENDED_RECIPIENT/);
 await deny('wrong_amount',change('expectedCKB',(BigInt(p.expectedCKB)-1n).toString()),rpc,/INTENDED_CKB/);
 await deny('wrong_tokens',change('expectedTokens',(BigInt(p.expectedTokens)+1n).toString()),rpc,/INTENDED_TOKENS/);
 await deny('excess_fee',change('fee','1000001'),rpc,/FEE_BOUND/);
 await deny('wrong_owner',change('owner',C.locks[1]),rpc,/OWNER_ROLE/);
 await deny('dead_order',p,async(m,a)=>m==='get_live_cell'&&a[0].tx_hash===p.currentOrder.txHash?{status:'dead'}:rpc(m,a),/LIVE_CELL_REQUIRED/);
 await deny('missing_history',p,async(m,a)=>m==='get_transaction'&&a[0]===p.mintTxHash?null:rpc(m,a),/COMMITTED_HISTORY_REQUIRED/);
 await deny('altered_history_reply',p,async(m,a)=>{const r=await rpc(m,a);if(m==='get_transaction'&&a[0]===p.currentOrder.txHash)r.transaction.outputs[0].capacity='0x1';return r;},/HISTORY_HASH/);
 const broken=structuredClone(p);broken.retainedMint.outputs[0].capacity='0x1';await deny('altered_retained_mint',broken,rpc,/TRUSTED_MINT_HASH/);
 return {status:'PASS',positiveTraceLength:good.audit.trace.length,negativePolicyCases:cases,scope:'Captured RPC policy validation, not an on-chain LO-01 reproduction/correction'};}
if(require.main===module)validate(process.argv[2]).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e);process.exitCode=1;});module.exports={validate};

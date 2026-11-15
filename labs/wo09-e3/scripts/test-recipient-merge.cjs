// Constructed Keccak SMT states, full secp script execution; NOT checkpointed lifecycle evidence.
const path=require('path'),fs=require('fs'),cp=require('child_process');
const {C,Engine,cell,assert}=require('../../wo09-e2-capacity/src/engine.cjs');
const {keccak256}=require(path.join(C.ROOT,'node_modules/ethers'));
const H=b=>Buffer.from(keccak256(b).slice(2),'hex'), hx=b=>'0x'+b.toString('hex');
const num=(n,s)=>Buffer.from(BigInt(n).toString(16).padStart(s*2,'0'),'hex');
const empty=Array(257);empty[256]=Buffer.alloc(32);for(let d=255;d>=0;d--)empty[d]=H(Buffer.concat([empty[d+1],empty[d+1]]));
const bit=(k,d)=>(k[d>>3]>>(7-(d%8)))&1;
function leaf(r){return r.balance===0n?Buffer.alloc(32):H(Buffer.concat([num(r.balance,16),num(0,8)]));}
function root(rs,d=0){if(!rs.length)return empty[d];if(d===256)return leaf(rs[0]);return H(Buffer.concat([root(rs.filter(r=>!bit(r.key,d)),d+1),root(rs.filter(r=>bit(r.key,d)),d+1)]));}
function proof(rs,key,d=0){if(d===256)return [];const side=bit(key,d);return [root(rs.filter(r=>bit(r.key,d)!==side),d+1),...proof(rs.filter(r=>bit(r.key,d)===side),key,d+1)];}
function data(rs){return hx(Buffer.concat([root(rs),num(4,8),num(rs.reduce((s,r)=>s+r.balance,0n),16),num(0,16),num(3,8)]));}
(async()=>{const e=new Engine('e3-merge-vm');try{
 await e.start();const bin=process.env.DERIVATIVE_BIN;assert(bin);await e.deploy('anchor',bin);await e.deploy('as',path.resolve(__dirname,'../../wo04-partial/config/always_success'));
 const out=path.resolve(__dirname,'../evidence/merge-vm-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const base=[];function add(tx,hash){tx.outputs.forEach((o,i)=>base.push({out_point:{tx_hash:hash,index:C.hex(i)},output:C.snake(o),data:tx.outputs_data?.[i]||tx.outputsData?.[i]||'0x'}));}
 e.gen.transactions.forEach(t=>add(t,t.hash));e.events.forEach(ev=>add(ev.committed.transaction,ev.hash));
 const records=[10000000n,100000000n,10000000000n].map((balance,i)=>({balance,key:H(C.b(C.U.privateKeyToPublicKey(C.keys[i])))}));
 const result=[];let count=0;
 function anchor(rs){return cell(500n*C.UNIT+rs.reduce((s,r)=>s+r.balance,0n),e.codes.as.script,e.codes.anchor.script,data(rs));}
 function op(c,n){return {...c,outPoint:{txHash:'0x'+n.toString(16).padStart(64,'0'),index:'0x0'}};}
 function stored(c){return {out_point:C.snake(c.outPoint),output:C.snake({capacity:C.hex(c.capacity),lock:c.lock,...(c.type?{type:c.type}:{})}),data:c.data||'0x'};}
 function build(rs,role,mutate=()=>{},sign=true){const next=rs.map((r,i)=>({...r,balance:i===role?0n:r.balance}));const a=op(anchor(rs),9000);const recipient=op(cell(100n*C.UNIT,C.locks[role]),9001);const payer=op(cell(1000n*C.UNIT,C.locks[(role+1)%3]),9002);
  const payload=hx(Buffer.concat([C.b(C.U.privateKeyToPublicKey(C.keys[role])),num(rs[role].balance,16),num(0,8),...proof(rs,rs[role].key)]));
  let inputs=[{...a,since:'0x20000000000000b7'},recipient,payer];let outputs=[anchor(next),cell(recipient.capacity+rs[role].balance,recipient.lock),cell(payer.capacity-C.fee,payer.lock)];
  let tx=e.tx(inputs,outputs,[e.dep('anchor'),e.dep('as')],[{lock:'',inputType:payload,outputType:''},'0x','0x']);mutate(tx,inputs);if(sign)tx=e.sign(tx,inputs,[role,(role+1)%3]);tx.witnesses=tx.witnesses.map(w=>typeof w==='string'?w:C.U.serializeWitnessArgs(w));return {tx,inputs,next};}
 function run(label,b,expected,pattern){const file=path.join(out,String(++count).padStart(2,'0')+'-'+label+'.json');C.write(file,{classification:'CONSTRUCTED_STATE_CKB_TESTTOOL',cells:[...base,...b.inputs.filter((_,i)=>!b.omitAnchor||i!==0).map(stored)],transaction:C.snake(b.tx)});const stdout=cp.execFileSync(process.env.VM_RUNNER,[file],{encoding:'utf8'});const r=JSON.parse(stdout.trim().split('\n').at(-1));C.write(file+'.result.json',r);assert.equal(r.accepted,expected,label+': '+r.error);if(pattern)assert.match(r.error,pattern,label);result.push({label,...r});console.log(label,r.accepted,r.error||r.cycles);return r;}
 for(const role of [0,1]){
 run('claim_'+role+'_full_signed_merge',build(records,role),true);
 const missing=build(records,role);missing.tx.witnesses[1]='0x';run('claim_'+role+'_missing_signature',missing,false,/Inputs\[1\].Lock/);
 const invalid=build(records,role);const w=invalid.tx.witnesses[1];invalid.tx.witnesses[1]=w.slice(0,-2)+(w.endsWith('00')?'01':'00');run('claim_'+role+'_invalid_signature',invalid,false,/Inputs\[1\].Lock/);
 }
 const mutateTests={overflow:(t,ins)=>{ins[1].capacity=(1n<<64n)-1n;},ambiguous_inputs:(t,ins)=>{const extra=op(cell(100n*C.UNIT,C.locks[0]),9003);ins.push(extra);t.inputs.push({previousOutput:extra.outPoint,since:"0x0"});t.witnesses.push("0x");t.outputs[2].capacity=C.hex(BigInt(t.outputs[2].capacity)+extra.capacity);},wrong_amount:t=>t.outputs[1].capacity=C.hex(BigInt(t.outputs[1].capacity)-1n),excess_amount:t=>t.outputs[1].capacity=C.hex(BigInt(t.outputs[1].capacity)+1n),wrong_identity:t=>t.outputs[1].lock=C.locks[2],changed_data:t=>t.outputsData[1]='0x00',changed_type:t=>t.outputs[1].type=e.codes.as.script,wrong_root:t=>t.outputsData[0]='0x'+'01'.repeat(32)+t.outputsData[0].slice(66),other_liability:t=>{const r=records.map((r,i)=>({...r,balance:i===0?0n:i===2?r.balance-1n:r.balance}));t.outputsData[0]=data(r);},ambiguous_outputs:t=>{t.outputs.push({...t.outputs[1]});t.outputsData.push('0x');t.outputs[2].capacity=C.hex(BigInt(t.outputs[2].capacity)-BigInt(t.outputs[1].capacity));}};
 for(const [name,fn]of Object.entries(mutateTests))run(name,build(records,0,fn),false,/67|63|64/);
 const nextAlice=records.map((r,i)=>({...r,balance:i===0?0n:r.balance}));const staleBob=build(records,1);staleBob.inputs[0].data=data(nextAlice);run('stale_bob_proof_after_alice_exit',staleBob,false,/62/);const replay=build(records,0);replay.inputs[0].data=data(nextAlice);run('duplicate_claim_old_proof_against_successor',replay,false,/62/);const spent=build(records,0);spent.omitAnchor=true;run('spent_anchor_resolution',spent,false,/UNKNOWN_INPUT/);
 const selfFee=build(records,1);selfFee.inputs.pop();selfFee.tx.inputs.pop();selfFee.tx.outputs.pop();selfFee.tx.outputsData.pop();selfFee.tx.witnesses.pop();selfFee.tx.outputs[1].capacity=C.hex(BigInt(selfFee.tx.outputs[1].capacity)-C.fee);selfFee.tx=e.sign(selfFee.tx,selfFee.inputs,[1]);selfFee.tx.witnesses=selfFee.tx.witnesses.map(w=>typeof w==='string'?w:C.U.serializeWitnessArgs(w));run('self_paid_fee_original_derivative',selfFee,false,/67/);
 for(const order of [[0,1,2],[2,1,0]]){let rs=records.map(r=>({...r}));for(const role of order){run('order_'+order.join('')+'_owner_'+role,build(rs,role),true);rs=rs.map((r,i)=>({...r,balance:i===role?0n:r.balance}));}assert.equal(rs.reduce((s,r)=>s+r.balance,0n),0n);}
 C.write(path.join(out,'summary.json'),{classification:'CONSTRUCTED_STATE_CKB_TESTTOOL',results:result,claims_shannons:records.map(r=>r.balance.toString()),fee_shannons:C.fee.toString(),limitations:['VM contexts are constructed independently; no committed checkpoint creation','same-anchor consumption requires separate live-cell resolution validation','self-paid fee mode not implemented','no no-funded-Cell solution demonstrated']});console.log('EVIDENCE',out);e.close();
}catch(err){e.close(err);console.error(err);process.exitCode=1;}})();

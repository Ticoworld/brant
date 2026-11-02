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
 const saved=path.resolve(__dirname,'../evidence/merge-vm-1793632167062/01-claim_0_full_signed_merge.json');
 const fixture=JSON.parse(fs.readFileSync(saved));
 e.codes=C.camel(JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../wo09-e2-capacity/evidence/e3-merge-vm-1793632165569/codes.json'))));
 e.secp=C.camel(fixture.transaction.cell_deps[0]);e.secp.depType='depGroup';
 const base=fixture.cells.slice(0,-3);
 const binary=fs.readFileSync(process.env.DERIVATIVE_BIN);const codeCell=base.find(c=>c.out_point.tx_hash===e.codes.anchor.outPoint.txHash&&c.out_point.index===e.codes.anchor.outPoint.index);assert(codeCell);codeCell.data=hx(binary);codeCell.output.capacity=C.hex(BigInt(binary.length+200)*C.UNIT);e.codes.anchor.script.codeHash=C.hash(binary);e.codes.anchor.hash=C.hash(binary);

 const out=path.resolve(__dirname,'../evidence/bounded-fee-vm-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const records=[10000000n,100000000n,10000000000n].map((balance,i)=>({balance,key:H(C.b(C.U.privateKeyToPublicKey(C.keys[i])))}));
 const result=[];let count=0;
 function anchor(rs){return cell(500n*C.UNIT+rs.reduce((s,r)=>s+r.balance,0n),e.codes.as.script,e.codes.anchor.script,data(rs));}
 function op(c,n){return {...c,outPoint:{txHash:'0x'+n.toString(16).padStart(64,'0'),index:'0x0'}};}
 function stored(c){return {out_point:C.snake(c.outPoint),output:C.snake({capacity:C.hex(c.capacity),lock:c.lock,...(c.type?{type:c.type}:{})}),data:c.data||'0x'};}
 function build(rs,role,mutate=()=>{},sign=true){const next=rs.map((r,i)=>({...r,balance:i===role?0n:r.balance}));const a=op(anchor(rs),9000);const recipient=op(cell(100n*C.UNIT,C.locks[role]),9001);const payer=op(cell(1000n*C.UNIT,C.locks[(role+1)%3]),9002);
  const payload=hx(Buffer.concat([C.b(C.U.privateKeyToPublicKey(C.keys[role])),num(rs[role].balance,16),num(0,8),...proof(rs,rs[role].key)]));
  let inputs=[{...a,since:'0x20000000000000b7'},recipient,payer];let outputs=[anchor(next),cell(recipient.capacity+rs[role].balance,recipient.lock),cell(payer.capacity-C.fee,payer.lock)];
  let tx=e.tx(inputs,outputs,[e.dep('anchor'),e.dep('as')],[{lock:'',inputType:payload,outputType:''},'0x','0x']);mutate(tx,inputs);if(sign)tx=e.sign(tx,inputs,[role,(role+1)%3]);tx.witnesses=tx.witnesses.map(w=>typeof w==='string'?w:C.U.serializeWitnessArgs(w));return {tx,inputs,next};}
 function run(label,b,expected,pattern){const file=path.join(out,String(++count).padStart(2,'0')+'-'+label+'.json');C.write(file,{classification:'CONSTRUCTED_STATE_CKB_TESTTOOL',cells:b.contextCells||[...base,...b.inputs.filter((_,i)=>!b.omitAnchor||i!==0).map(stored)],transaction:C.snake(b.tx)});const stdout=cp.execFileSync(process.env.VM_RUNNER,[file],{encoding:'utf8'});const r=JSON.parse(stdout.trim().split('\n').at(-1));C.write(file+'.result.json',r);assert.equal(r.accepted,expected,label+': '+r.error);if(pattern)assert.match(r.error,pattern,label);result.push({label,...r});console.log(label,r.accepted,r.error||r.cycles);return r;}

 function resign(b,role){b.tx=e.sign(b.tx,b.inputs,[role]);b.tx.witnesses=b.tx.witnesses.map(w=>typeof w==='string'?w:C.U.serializeWitnessArgs(w));return b;}
 function self(rs,role,fee){const b=build(rs,role);b.inputs.pop();b.tx.inputs.pop();b.tx.outputs.pop();b.tx.outputsData.pop();b.tx.witnesses.pop();b.tx.outputs[1].capacity=C.hex(BigInt(b.tx.outputs[1].capacity)-fee);return resign(b,role);}
 for(const role of [0,1]){
  for(const fee of [0n,1n,1000n,1000000n]){const b=self(records,role,fee);const r=run('claim_'+role+'_fee_'+fee,b,true);assert.equal(r.fee_shannons,fee.toString());}
  run('claim_'+role+'_fee_over_cap',self(records,role,1000001n),false,/67/);
  const missing=self(records,role,1000n);missing.tx.witnesses[1]='0x';run('claim_'+role+'_missing_authorization',missing,false,/Inputs\[1\].Lock/);
  const bad=self(records,role,1000n);const w=bad.tx.witnesses[1];bad.tx.witnesses[1]=w.slice(0,-2)+(w.endsWith('00')?'01':'00');run('claim_'+role+'_invalid_signature',bad,false,/Inputs\[1\].Lock/);
  const tampered=self(records,role,1000n);tampered.tx.outputs[1].capacity=C.hex(BigInt(tampered.tx.outputs[1].capacity)-1n);run('claim_'+role+'_fee_changed_after_signing',tampered,false,/Inputs\[1\].Lock/);
 }
 const tiny=records.map((r,i)=>({...r,balance:i===0?1000n:r.balance}));run('tiny_claim_fee_equals_claim',self(tiny,0,1000n),true);run('tiny_claim_fee_exceeds_claim_below_cap',self(tiny,0,1001n),false,/67/);
 const additional=build(records,0);additional.tx.outputs[1].capacity=C.hex(BigInt(additional.tx.outputs[1].capacity)-1000n);additional.tx=e.sign(additional.tx,additional.inputs,[0,1]);additional.tx.witnesses=additional.tx.witnesses.map(w=>typeof w==='string'?w:C.U.serializeWitnessArgs(w));run('deducted_merge_with_additional_input_and_output',additional,false,/67/);
 const extraOutput=self(records,0,1000n);extraOutput.inputs[1].capacity+=100n*C.UNIT;extraOutput.tx.outputs[1].capacity=C.hex(BigInt(extraOutput.tx.outputs[1].capacity)+39n*C.UNIT);extraOutput.tx.outputs.push({capacity:C.hex(61n*C.UNIT),lock:C.locks[2]});extraOutput.tx.outputsData.push('0x');resign(extraOutput,0);run('fee_mode_with_extra_destination',extraOutput,false,/67/);
 const other=self(records,0,1000n);const altered=records.map((r,i)=>({...r,balance:i===0?0n:i===2?r.balance-1n:r.balance}));other.tx.outputsData[0]=data(altered);resign(other,0);run('fee_mode_altered_other_liability',other,false,/63/);
 const replay=self(records,0,1000n);replay.inputs[0].data=data(records.map((r,i)=>({...r,balance:i===0?0n:r.balance})));run('fee_mode_duplicate_old_claim_proof',replay,false,/62/);
 const wrong=self(records,0,1000n);wrong.tx.outputs[1].lock=C.locks[2];resign(wrong,0);run('fee_mode_wrong_recipient',wrong,false,/67/);
 const duplicate=self(records,0,1000n);const extra=op(cell(100n*C.UNIT,C.locks[0]),9009);duplicate.inputs.push(extra);duplicate.tx.inputs.push({previousOutput:extra.outPoint,since:'0x0'});duplicate.tx.witnesses.push('0x');duplicate.tx.outputs[1].capacity=C.hex(BigInt(duplicate.tx.outputs[1].capacity)+100n*C.UNIT);resign(duplicate,0);run('fee_mode_ambiguous_owner_inputs',duplicate,false,/67/);
 run('sponsor_fallback_with_fee_extension',build(records,0),true);
 C.write(path.join(out,'summary.json'),{classification:'CONSTRUCTED_STATE_CKB_TESTTOOL',binary_sha256:C.crypto.createHash('sha256').update(binary).digest('hex'),binary_bytes:binary.length,results:result,cap_shannons:'1000000',notes:['No native-chain execution in this fee experiment','Zero-fee acceptance is VM-only, not mempool relay assurance','Exact-claim sponsored fallback remains; uniqueness unchanged','100 percent claim fee allowed only within cap; may be uneconomic']});console.log('EVIDENCE',out);
}catch(err){e.close(err);console.error(err);process.exitCode=1;}})();

// One additional fee-point test; does not claim mempool relay.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const {C,Engine,assert}=require('../../wo09-e2-capacity/src/engine.cjs');
const e=new Engine('e3-offline-fee-point');
const dir=path.resolve(__dirname,'../evidence/practical-fee-'+Date.now());fs.mkdirSync(dir,{recursive:true});
const source=path.resolve(__dirname,'../evidence/bounded-fee-vm-1793634662957');const results=[];
for(const [role,file] of [[0,'03-claim_0_fee_1000.json'],[1,'11-claim_1_fee_1000.json']]){
 const fixture=JSON.parse(fs.readFileSync(path.join(source,file)));const tx=C.camel(fixture.transaction);tx.cellDeps.forEach(d=>{if(d.depType==='dep_group')d.depType='depGroup'});
 const inputs=tx.inputs.map(i=>{const c=fixture.cells.find(c=>c.out_point.tx_hash===i.previousOutput.txHash&&c.out_point.index===i.previousOutput.index);return {...C.camel(c.output),capacity:BigInt(c.output.capacity),data:c.data,outPoint:i.previousOutput};});
 tx.outputs[1].capacity=C.hex(BigInt(tx.outputs[1].capacity)-9000n);const signed=e.sign(tx,inputs,[role]);signed.witnesses=signed.witnesses.map(w=>typeof w==='string'?w:C.U.serializeWitnessArgs(w));fixture.transaction=C.snake(signed);
 const name=path.join(dir,'claim-'+role+'.json');C.write(name,fixture);const stdout=cp.execFileSync(process.env.VM_RUNNER,[name],{encoding:'utf8'});const result=JSON.parse(stdout.trim().split('\n').at(-1));assert(result.accepted);assert.equal(result.fee_shannons,'10000');const bytes=(C.U.serializeTransaction(signed).length-2)/2;C.write(name+'.result.json',result);results.push({role,...result,bytes});
}
C.write(path.join(dir,'summary.json'),{classification:'CONSTRUCTED_STATE_CKB_TESTTOOL',results,relay_status:'UNTESTED; 10000 shannons exceeds size-based fee at saved configuration 1000 shannons/KB'});console.log(dir,results);

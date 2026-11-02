const {C,Engine,cell,assert}=require('./engine.cjs');
const e=new Engine('state-free-wallet-swap'),U=C.UNIT,F=C.fee;
(async()=>{try{await e.start();const minted=[];
for(const role of [0,1]){const w=e.wallets[2],type={...e.codes.xudt.script,args:C.U.scriptToHash(C.locks[2])},amount=role?20000n:10000n;const r=await e.send('issue_xudt_for_'+role,e.sign(e.tx([w],[cell(200n*U,C.locks[role],type,C.hx(C.le(amount,16))),cell(w.capacity-200n*U-F,C.locks[2])],[e.dep('xudt')]),[w],[2]));e.wallets[2]=r[1];minted[role]=r[0];}
const w0=e.wallets[0],w1=e.wallets[1],t0=minted[0],t1=minted[1];const inputs=[w0,w1,t0,t1],outputs=[cell(w0.capacity-5n*U-F/2n,C.locks[0]),cell(w1.capacity+5n*U-F/2n,C.locks[1]),cell(t0.capacity,C.locks[1],t0.type,C.hx(C.le(20000n,16))),cell(t1.capacity,C.locks[0],t1.type,C.hx(C.le(10000n,16)))];
const tx=e.sign(e.tx(inputs,outputs,[e.dep('xudt')]),inputs,[0,1]);assert.equal(inputs.length,outputs.length);assert.equal(outputs.reduce((s,x)=>s+x.capacity,0n),inputs.reduce((s,x)=>s+x.capacity,0n)-F);
const invalid=structuredClone(tx);invalid.outputs[1].capacity=C.hex(BigInt(invalid.outputs[1].capacity)-U);await e.reject('stale_or_mutated_receipt_body',invalid,/ValidationFailure/);
const noBuyer=structuredClone(tx);noBuyer.witnesses[1]='0x';await e.reject('missing_buyer_authorization',noBuyer,/ValidationFailure/);
const spent=await e.send('four_cell_reuse_atomic_ckb_xudt_swap',tx);assert.equal(spent.length,4);e.events[0].properties={input_cells:4,output_cells:4,added_cells:0,reused_normal_wallet_cells:2,reused_asset_cells:2,fee_shannons:String(F)};e.save();
// The confirmed transaction consumed every input; any earlier draft is stale.
const stale=structuredClone(tx);stale.witnesses=[];await e.reject('replay_consumed_wallet_inputs',stale,/Dead|dead|Unknown|unknown/,'send_transaction');e.close();}catch(err){e.close(err);console.error(err);process.exitCode=1;}})();

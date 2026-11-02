const {C,Engine,cell,assert}=require('./engine.cjs');
const e=new Engine(process.env.WO09_HYBRID?'hybrid-claim-settlement':'funded-claims'),U=C.UNIT,F=1000000n,face=850000000n;
const u=n=>C.le(BigInt(n),8),cat=(...x)=>Buffer.concat(x.map(x=>typeof x==='string'?C.b(x):x));
const data=(units,m)=>C.hx(cat(u(face),u(units),u(m)));
const id=(w,i=0)=>C.hash(cat(u(0),C.b(w.outPoint.txHash),C.le(BigInt(w.outPoint.index),4),u(i)));
(async()=>{try{await e.start();await e.deploy('funded_claim',e.build+'/funded_claim');
const maturity=BigInt((await e.rpc('get_tip_header')).number)+30n,ws=[...e.wallets],type={...e.codes.funded_claim.script,args:id(ws[0])};
const notes=[1,1,2,2].map(r=>cell(1000n*U,C.locks[r],type,data(100,maturity)));
const out=await e.send('four_individually_funded_launch_claims',e.sign(e.tx(ws,[...notes,cell(ws[0].capacity+600n*U-F,C.locks[0]),cell(ws[1].capacity-2300n*U,C.locks[1]),cell(ws[2].capacity-2300n*U,C.locks[2])],[e.dep('funded_claim')]),ws,[0,1,2]));
e.wallets=out.slice(4);const live=out.slice(0,4);
// Full-body, independently signed exchange of two funded notes and actual CKB.
let token=null;if(process.env.WO09_HYBRID){const issuer=e.wallets[0],xt={...e.codes.xudt.script,args:C.U.scriptToHash(C.locks[0])},issued=await e.send('issue_separate_authority_xudt',e.sign(e.tx([issuer],[cell(200n*U,C.locks[2],xt,C.hx(C.le(1000000n,16))),cell(issuer.capacity-200n*U-F,C.locks[0])],[e.dep('xudt')]),[issuer],[0]));token=issued[0];e.wallets[0]=issued[1];}
const payer=e.wallets[2],swapIns=[live[0],live[2],payer],swapOut=[{...live[0],lock:C.locks[2]},{...live[2],lock:C.locks[1]},cell(250n*U,C.locks[1]),cell(payer.capacity-250n*U-F,C.locks[2])];
if(token){swapIns.push(token);swapOut.splice(2,0,cell(200n*U,C.locks[1],token.type,C.hx(C.le(10000n,16))),cell(200n*U,C.locks[2],token.type,C.hx(C.le(990000n,16))));swapOut[swapOut.length-1].capacity-=200n*U;}
const swap=e.sign(e.tx(swapIns,swapOut,[e.dep('funded_claim'),...(token?[e.dep('xudt')]:[])]),swapIns,[1,2]);
if(token){const inflated=structuredClone(swap);inflated.outputsData[2]=C.hx(C.le(10001n,16));await e.reject('hybrid_xudt_conservation',e.sign(inflated,swapIns,[1,2]),/ValidationFailure/);}const unsigned=structuredClone(swap);unsigned.witnesses[0]='0x';await e.reject('claim_exchange_missing_holder_signature',unsigned,/ValidationFailure/);
const staleBody=structuredClone(swap);staleBody.outputs[staleBody.outputs.length-1].capacity=C.hex(BigInt(staleBody.outputs.at(-1).capacity)-1n);await e.reject('signature_does_not_authorize_modified_body',staleBody,/Inputs\[[01]\]\.Lock.*error code -31.*9bd7e06f/);
const swapped=await e.send(token?'atomic_claim_xudt_ckb_settlement':'atomic_two_owner_claim_exchange_with_cash',swap);live[0]=swapped[0];live[2]=swapped[1];e.wallets[2]=swapped[swapped.length-1];
function redeem(note,units,role,sponsor=false){const old=BigInt(C.b(note.data).readBigUInt64LE(8)),remain=old-BigInt(units),payout=BigInt(units)*face,ins=[{...note,since:C.hex(maturity)}];let outputs=remain?[{...note,capacity:note.capacity-payout,data:data(remain,maturity)},cell(payout-F,C.locks[role])]:[cell(note.capacity-F,C.locks[role])];if(sponsor){const w=e.wallets[role];ins.push(w);outputs[outputs.length-1].capacity+=w.capacity;}return {ins,tx:e.sign(e.tx(ins,outputs,[e.dep('funded_claim')]),ins,[role])};}
const mintWallet=e.wallets[0],hidden=e.sign(e.tx([mintWallet],[cell(1000n*U,C.locks[0],type,data(100,maturity)),cell(mintWallet.capacity-1000n*U-F,C.locks[0])],[e.dep('funded_claim')]),[mintWallet],[0]);await e.reject('original_issuer_cannot_remint_existing_identity',hidden,/error code 17/);
let test=redeem(live[0],10,2);await e.reject('redeem_before_maturity',test.tx,/Immature|immature/,'send_transaction');const zero=structuredClone(test.tx);zero.inputs[0].since='0x0';await e.reject('redeem_without_required_since',e.sign(zero,test.ins,[2]),/error code 19/);
// Add real funding so supply rejection is not an imbalance rejection.
const wallet=e.wallets[2];const extra=e.sign(e.tx([live[0],wallet],[{...live[0],data:data(101,maturity),capacity:live[0].capacity+face},cell(wallet.capacity-face-F,C.locks[2])],[e.dep('funded_claim')]),[live[0],wallet],[2]);await e.reject('additional_units_after_mint',extra,/error code 18/);
while(BigInt((await e.rpc('get_tip_header')).number)<maturity)await e.mine();
const wrong=structuredClone(test.tx);wrong.outputs[1].lock=C.locks[0];await e.reject('redemption_diverted_to_creator',e.sign(wrong,test.ins,[2]),/error code 26/);
const excessFee=structuredClone(test.tx);excessFee.outputs[1].capacity=C.hex(BigInt(excessFee.outputs[1].capacity)-1n);await e.reject('redemption_fee_above_bound',e.sign(excessFee,test.ins,[2]),/error code 26/);
const small=redeem(live[0],1,2);await e.reject('small_payout_below_occupied_capacity',small.tx,/capacity|Capacity/,'send_transaction');
const sponsored=redeem(live[0],1,2,true),r=await e.send('small_redemption_merged_with_holder_wallet',sponsored.tx);live[0]=r[0];e.wallets[2]=r[1];
const partial=redeem(live[1],10,1),p=await e.send('unsponsored_partial_redemption',partial.tx);live[1]=p[0];assert.equal(p[1].capacity,85n*U-F);
for(let i=0;i<4;i++){const role=[2,1,1,2][i],n=BigInt(C.b(live[i].data).readBigUInt64LE(8)),final=redeem(live[i],n,role),r=await e.send('independent_final_redemption_'+i,final.tx);assert.equal(r[0].capacity,live[i].capacity-F);}
e.close();}catch(err){e.close(err);console.error(err);process.exitCode=1;}})();

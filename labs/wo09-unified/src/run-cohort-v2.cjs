const path=require('path'),fs=require('fs'),cp=require('child_process');
const {C,Engine,cell,assert}=require('../../wo09-e2-capacity/src/engine.cjs');
const e=new Engine('unified-cohort');const dest=path.resolve(__dirname,'../evidence/cohort-'+Date.now());fs.renameSync(e.out,dest);e.out=dest;
const U=C.UNIT,F=10000n;
const key4='0x'+'4'.padStart(64,'0');C.keys.push(key4);C.locks.push({codeHash:C.locks[0].codeHash,hashType:'type',args:'0x'+C.U.blake160(C.U.privateKeyToPublicKey(key4),'hex')});
const owners=C.locks.map(C.U.scriptToHash);const zero='0x'+'00'.repeat(32);
function encode(s){return C.hx(Buffer.concat([Buffer.from('TCW0001\0'),C.b(owners[0]),C.b(owners[3]),C.le(s.k),C.le(s.phase),C.le(0),...s.r.flatMap(r=>[C.b(r.owner),C.le(r.p),C.le(r.b)])]));}
let state={k:378n*U,phase:0n,r:[0,1,2].map(()=>({owner:zero,p:0n,b:0n}))};let vault;
function recover(name){const hash=e.events.at(-1).hash;const result=JSON.parse(cp.execFileSync(process.execPath,[path.resolve(__dirname,'recover-live.cjs'),hash,vault.type.codeHash,vault.type.args,e.out+'/'+name+'.json'],{encoding:'utf8'}));assert.equal(result.total,liability(state).toString());state={k:BigInt(result.k),phase:BigInt(result.phase),r:result.r.map(r=>({...r,p:BigInt(r.p),b:BigInt(r.b)}))};}
function clone(){return structuredClone(state);}
function liability(s){return s.r.reduce((a,r)=>a+(s.phase?r.b:r.p),0n);}
function vc(s){return cell(s.k+liability(s),vault.lock,vault.type,encode(s));}
function tx(ins,outs,roles){return e.sign(e.tx(ins,outs,[e.dep('cohort')]),ins,roles);}
async function rejection(name,t,code,method='estimate_cycles'){await e.reject(name,t,new RegExp(code),method);}
(async()=>{try{await e.start();await e.deploy('cohort',path.resolve(__dirname,'../build/cohort'));
 const w=e.wallets[0];const id=C.hash(Buffer.concat([C.le(0),C.b(w.outPoint.txHash),C.le(BigInt(w.outPoint.index),4),C.le(0)]));const script={...e.codes.cohort.script,args:id};vault=cell(state.k,script,script,encode(state));assert.equal(C.occupied(vault),state.k);
 const formed=await e.send('create_unique_empty_market_and_fund_creator_wallet',tx([w],[vault,cell(100n*U,C.locks[3]),cell(w.capacity-state.k-100n*U-F,w.lock)],[0]));vault=formed[0];e.wallets[3]=formed[1];e.wallets[0]=formed[2];
 for(const [i,p] of [[0,12500000n],[1,125000000n],[2,12500000000n]]){const next=clone();next.r[i]={owner:owners[i],p,b:p*4n/5n};const w=e.wallets[i];const ins=[vault,w],outs=[vc(next),cell(w.capacity-p-F,w.lock)];
 if(i===0){const bad=structuredClone(outs);bad[0].data=encode({...next,r:next.r.map((r,j)=>j===0?{...r,b:r.b+1n}:r)});await rejection('reject_unfunded_entitlement_during_enrollment',tx(ins,bad,[i]),'33|50');}
 const r=await e.send('enroll_independent_owner_'+i,tx(ins,outs,[i]));vault=r[0];e.wallets[i]=r[1];state=next;}
 const gross=state.r.reduce((s,r)=>s+r.p-r.b,0n);const active=clone();active.phase=1n;let creator=e.wallets[3];
 const activation=tx([vault,creator],[vc(active),cell(creator.capacity+gross-F,creator.lock)],[3]);
 const steal=structuredClone(activation);steal.outputs[0].capacity=C.hex(BigInt(steal.outputs[0].capacity)-1n);steal.outputs[1].capacity=C.hex(BigInt(steal.outputs[1].capacity)+1n);await rejection('reject_creator_taking_protected_shannon',e.sign(steal,[vault,creator],[3]),'33');
 let rr=await e.send('release_only_unprotected_creator_proceeds',activation);vault=rr[0];e.wallets[3]=rr[1];state=active;assert.equal(gross,2527500000n);
 // Construct Bob's independent request before Alice spends the shared vault.
 function redeemBuild(i,role,amount){const next=clone();next.r[i].b-=amount;const w=e.wallets[role];return {next,ins:[vault,w],t:tx([vault,w],[vc(next),cell(w.capacity+amount-F,w.lock)],[role])};}
 const staleBob=redeemBuild(1,1,state.r[1].b);
 const alice=redeemBuild(0,0,state.r[0].b/2n);
 const wrong=structuredClone(alice.t);wrong.outputs[1].capacity=C.hex(BigInt(wrong.outputs[1].capacity)-1000001n);await rejection('reject_excess_fee_deduction',e.sign(wrong,alice.ins,[0]),'31');
 const tinyFee=redeemBuild(0,0,1n);await rejection('reject_fee_exceeding_one_shannon_redemption',tinyFee.t,'74');
 const badData=structuredClone(alice.t);badData.outputsData[0]='0x00';await rejection('reject_malformed_state_data',e.sign(badData,alice.ins,[0]),'33');
 const replaced=structuredClone(alice.t);replaced.outputs[0].lock={...replaced.outputs[0].lock,codeHash:'0x'+'00'.repeat(32)};await rejection('reject_covenant_lock_replacement',e.sign(replaced,alice.ins,[0]),'12');
 const redirected=structuredClone(alice.t);redirected.outputs[1].lock=C.locks[2];await rejection('reject_redemption_redirected_to_other_owner',e.sign(redirected,alice.ins,[0]),'70');
 const missing=structuredClone(alice.t);missing.witnesses[1]='0x';await rejection('reject_redemption_without_owner_signature',missing,'Lock|lock');
 const earlyClose=tx([vault,e.wallets[0]],[cell(vault.capacity+e.wallets[0].capacity-F,C.locks[0])],[0]);await rejection('reject_closure_with_outstanding_rights',earlyClose,'32');
 rr=await e.send('alice_small_partial_self_paid_redemption',alice.t);vault=rr[0];e.wallets[0]=rr[1];state=alice.next;recover('recover_after_alice_partial');
 await rejection('bob_stale_shared_input',staleBob.t,'Unknown|OutPoint|Dead|spent','send_transaction');
 // Alice atomically sells her remaining right to Bob for actual CKB.
 let assigned=clone();assigned.r[0].owner=owners[1];const price=1000000n;const seller=e.wallets[0],buyer=e.wallets[1];const saleIns=[vault,seller,buyer];const sale=tx(saleIns,[vc(assigned),cell(seller.capacity+price,seller.lock),cell(buyer.capacity-price-F,buyer.lock)],[0,1]);
 const unpaid=structuredClone(sale);unpaid.outputs[1].capacity=C.hex(seller.capacity);unpaid.outputs[2].capacity=C.hex(buyer.capacity-F);await rejection('reject_assignment_without_positive_consideration',e.sign(unpaid,saleIns,[0,1]),'61');
 const unsigned=structuredClone(sale);unsigned.witnesses[1]='0x';await rejection('reject_missing_seller_authorization',unsigned,'Lock|lock');
 rr=await e.send('atomic_paid_assignment_of_remaining_alice_right_to_bob',sale);vault=rr[0];e.wallets[0]=rr[1];e.wallets[1]=rr[2];state=assigned;recover('recover_after_paid_assignment');
 const staleOwner=redeemBuild(0,0,state.r[0].b);await rejection('reject_former_owner_after_paid_assignment',staleOwner.t,'70');
 for(const [i,role]of [[1,1],[0,1],[2,2]]){const b=redeemBuild(i,role,state.r[i].b);rr=await e.send('redeem_right_'+i+'_by_current_owner_'+role,b.t);vault=rr[0];e.wallets[role]=rr[1];state=b.next;}
 assert.equal(liability(state),0n);assert.equal(vault.capacity,state.k);
 const badClose=tx([vault,e.wallets[0]],[cell(e.wallets[0].capacity+state.k-F,C.locks[2])],[0]);await rejection('reject_cushion_return_to_final_claimant_instead_of_funder',badClose,'32');
 const cushionWallet=e.wallets[0];const close=tx([vault,cushionWallet],[cell(cushionWallet.capacity+state.k-F,cushionWallet.lock)],[0]);
 rr=await e.send('lawful_final_closure_returns_cushion_to_its_funder',close);
 await rejection('reject_reuse_of_closed_market_input',close,'Unknown|OutPoint|Dead|spent','send_transaction');
 C.write(e.out+'/lifecycle.json',{classification:'ACTUAL_CKB_0210_PRIVATE_CHAIN',creator_gross_shannons:gross.toString(),protected_initial_shannons:'10110000000',cushion_shannons:state.k.toString(),wallet_fee_each_shannons:F.toString(),remaining_liability:'0',binary:e.codes.cohort,notes:['Fixed three-record directly validated cohort; no Merkle tree or SP1','All financial transitions committed; all code roles use covenant identity','Record owners and transfers authenticated by actual secp input scripts','No claim of production security, competing native market throughput or commercial demand']});e.close();
}catch(err){e.close(err);console.error(err);process.exitCode=1;}})();

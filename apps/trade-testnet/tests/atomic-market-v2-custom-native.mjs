import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {ccc} from '@ckb-ccc/core';
import {planAtomicLaunchV2,verifyAtomicMetadataAuthorization} from '../lib/v2-engine/atomic-launch-v2.ts';
export async function runSharedLaunch({rpc:chainRpc,genesis,hashes,deps,wallets,locks,cell,tx,sign,commit,makeProof,le,out,secp}){
 const counts={};const started=performance.now();const rpc=async(method,params)=>{counts[method]=(counts[method]||0)+1;return chainRpc(method,params)};
 const U=100000000n,fee=1000000n,S=1234n,h=b=>ccc.hexFrom(b),b=x=>Buffer.from(ccc.bytesFrom(x)),hash=x=>ccc.hashCkb(x),sh=x=>ccc.Script.from(x).hash(),cat=(...v)=>Buffer.concat(v);
 const split=await commit('fixture_fragment_creator_funding',sign(tx([wallets[0]],[cell(800n*U,locks[0]),cell(800n*U,locks[0]),cell(wallets[0].capacity-1600n*U-fee,locks[0])]),[wallets[0]],[0]));
 const creatorInputs=split.slice(0,2);
 const anchor=split[0],ab=cat(b(anchor.outPoint.txHash),le(BigInt(anchor.outPoint.index),4));
 const marker={codeHash:hashes.marker_candidate,hashType:'data1',args:hash(cat(le(0n),ab,le(1n)))};
 const market={codeHash:hashes.market_smt,hashType:'data1',args:h(cat(b(hash(ab)),le(3n*U),le(2n*U),le(S),b(sh(marker))))};
 const owner={codeHash:hashes.atomic_initializer,hashType:'data1',args:h(cat(ab,b(sh(market)),le(S),le(300n*U)))};
 const token={codeHash:hashes.xudt,hashType:'data1',args:sh(owner)};
 const cm={codeHash:hashes.custody_marker,hashType:'data1',args:sh(market)};
 const custody={codeHash:hashes.custody_smt,hashType:'data1',args:h(cat(b(sh(market)),b(sh(token)),b(genesis),b(sh(cm))))};
 const md=h(cat(b(sh(market)),b(sh(token)))),cd=h(cat(b(sh(custody)),b(sh(token))));
 const domain={genesis_hash:genesis,market_script_hash:sh(market),xudt_type_script_hash:sh(token),custody_marker_type_hash:sh(cm)};
 const data=(v,r)=>h(cat(le(v,16),b(r))),iv=v=>h(cat(le(v,16),b(sh(cm))));
 const table=fields=>{let off=4*(fields.length+1);const offsets=fields.map(f=>{const n=off;off+=b(f).length;return le(BigInt(n),4)});return h(cat(le(BigInt(off),4),...offsets,...fields.map(b)))};
 const ws=table([ccc.Script.from(owner).toHex(),'0x','0x','0x04000000']);
 let leaf={owner:sh(locks[0]),balance:7n,revision:0n};
 const proof=makeProof(domain,0,[],[leaf],le(63n*U));
 const depMap={market:'market_smt',marker:'marker_candidate',custody:'custody_smt',custodyMarker:'custody_marker',initializer:'atomic_initializer',xudt:'xudt'};
 const dependencies=Object.fromEntries(Object.entries(depMap).map(([k,v])=>[k,{...deps[v],dataHash:hashes[v]}]));
 const secpCell=await rpc('get_live_cell',[{tx_hash:secp.outPoint.txHash,index:secp.outPoint.index},true]);
 dependencies.secp={...secp,dataHash:hash(secpCell.cell.data.content)};
 const planStarted=performance.now(),beforePlanCounts={...counts};
 const plan=await planAtomicLaunchV2(rpc,{isolatedDevelopment:true,metadata:{name:"Atomic fixture",ticker:"ATM"},genesis,anchor,funding:[split[1]],supply:S,base:3n*U,step:2n*U,quantity:7n,fee,dependencies,proof:async(d,o,q,price)=>{assert.deepEqual(d,domain);assert.equal(o,leaf.owner);assert.equal(q,7n);assert.equal(price,63n*U);return {witness:proof.witness,newRoot:proof.root}}});
 const plannerMetrics={elapsedMs:performance.now()-planStarted,rpcCounts:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v-(beforePlanCounts[k]||0)]))};
 assert.equal(plan.scripts.market.hash(),sh(market));assert.equal(plan.scripts.token.hash(),sh(token));
 const init=(await plan.prepare());
 // Adapt CCC to the existing native signer's camel-case JSON transaction shape.
 const {cccA}=await import('@ckb-ccc/core/advanced');
 const raw=cccA.JsonRpcTransformers.transactionFrom(init);
 const camel=x=>Array.isArray(x)?x.map(camel):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),camel(v)])):x==='dep_group'?'depGroup':x;
 const nativeInit=camel(raw);
 const reject=async(label,t,inputs,role)=>{let error;try{await rpc('estimate_cycles',[snake(sign(t,inputs,[role]))])}catch(e){error=String(e)}assert(error,label+' accepted');writeFileSync(join(out,label+'.json'),JSON.stringify({label,error},null,2))};
 function snake(x){if(Array.isArray(x))return x.map(snake);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),snake(v)]));return x==='depGroup'?'dep_group':x}
 // Balanced mutations must fail in native validation, without consuming the anchor.
 let bad=structuredClone(nativeInit);bad.outputsData[0]=iv(1228n);await reject('atomic-inflated-supply',bad,creatorInputs,0);
 bad=structuredClone(nativeInit);bad.outputs[0].capacity='0x'+(362n*U).toString(16);bad.outputs[4].capacity='0x'+(BigInt(nativeInit.outputs[4].capacity)+U).toString(16);await reject('atomic-wrong-reserve',bad,creatorInputs,0);
 bad=structuredClone(nativeInit);bad.outputsData[2]=data(7n,'0x'+'01'.repeat(32));await reject('atomic-wrong-root',bad,creatorInputs,0);
 bad=structuredClone(nativeInit);bad.witnesses.splice(creatorInputs.length,1);await reject('atomic-withheld-proof',bad,creatorInputs,0);
 bad=structuredClone(nativeInit);bad.headerDeps=['0x'+'00'.repeat(32)];await reject('atomic-wrong-genesis',bad,creatorInputs,0);
 bad=structuredClone(nativeInit);bad.outputs[4].capacity='0x'+(BigInt(nativeInit.outputs[4].capacity)-1n).toString(16);await reject('atomic-excess-fee',bad,creatorInputs,0);
 const signed=sign(nativeInit,creatorInputs,[0]);await plan.verifySigned(ccc.Transaction.from(signed));
 assert.equal(verifyAtomicMetadataAuthorization(ccc.Transaction.from(signed),creatorInputs,{genesis,market:sh(market),owner:leaf.owner}).ticker,'ATM');
 const changed=ccc.Transaction.from(signed);changed.setWitnessArgsAt(0,{...changed.getWitnessArgs(0),outputType:'0x'});
 await assert.rejects(()=>plan.verifySigned(changed));
 let state=await commit('atomic_market_initialization',signed);
 const receipts=[];async function record(label,cells){const r=await rpc('get_transaction',[cells[0].outPoint.txHash]);assert.equal(r.tx_status.status,'committed');assert.equal(await rpc('get_block_hash',[r.tx_status.block_number]),r.tx_status.block_hash);receipts.push({label,receipt:r});}
 await record('initialization',state);
 // Verify occupied capacity with CCC, independently from nominal reserve floor.
 const occupied=state.slice(0,4).map(c=>{const output=ccc.CellOutput.from({capacity:c.capacity,lock:c.lock,type:c.type});const minimum=output.occupiedSize+b(c.data).length;assert(c.capacity>=BigInt(minimum)*U);return {capacity:String(c.capacity),occupiedBytes:Number(minimum)}});
 for(const selling of [false,true]){
  const next={...leaf,balance:leaf.balance+(selling?-1n:1n),revision:leaf.revision+1n};
  const p=makeProof(domain,selling?4:1,[leaf],[next],selling?cat(le(1n),le(17n*U)):Buffer.alloc(0));
  const inputs=state,price=17n*U,inv=selling?1227n:1226n;
  const t=tx(inputs,[cell(BigInt(state[0].capacity)+(selling?-price:price),market,token,iv(inv)),cell(300n*U,market,marker,md),cell(350n*U,custody,token,data(next.balance,p.root)),cell(350n*U,custody,cm,cd),cell(BigInt(state[4].capacity)+(selling?price:-price)-fee,locks[0])],[deps.market_smt,deps.marker_candidate,deps.custody_smt,deps.custody_marker,deps.xudt]);t.headerDeps=[genesis];t.witnesses.push(p.witness);
  state=await commit(selling?'atomic_market_sell':'atomic_market_buy',sign(t,inputs,[0]));leaf=next;await record(selling?'sell':'buy',state);
 }
 const next={...leaf,balance:6n,revision:leaf.revision+1n},p=makeProof(domain,5,[leaf],[next]);
 const inputs=[state[2],state[3],state[4]];
 const t=tx(inputs,[cell(350n*U,custody,token,data(6n,p.root)),cell(350n*U,custody,cm,cd),cell(142n*U,locks[0],token,h(le(1n,16))),cell(BigInt(state[4].capacity)-142n*U-fee,locks[0])],[deps.custody_smt,deps.custody_marker,deps.xudt]);t.witnesses.push(p.witness);
 const withdrawn=await commit('atomic_market_withdrawal',sign(t,inputs,[0]));await record('withdrawal',withdrawn);
 assert.equal(1227n+6n+1n,S);assert.equal(BigInt(state[0].capacity)-300n*U,63n*U);
 writeFileSync(join(out,'atomic-market-qualification.json'),JSON.stringify({metrics:{scope:"native harness using application planner, not HTTP/browser latency",planner:plannerMetrics,rpcCounts:counts,elapsedMs:performance.now()-started},genesis,hashes,scripts:{market,owner,token,custody,marker,cm},initial:{supply:'1234',inventory:'1227',custody:'7',reserveShannons:String(63n*U),floorShannons:String(300n*U),occupied},final:{inventory:'1227',custody:'6',external:'1',reserveShannons:String(63n*U)},receipts},null,2));
}

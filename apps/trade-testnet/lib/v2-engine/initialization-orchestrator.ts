import {ccc} from '@ckb-ccc/core';
import {buildInitializationSetup,buildIssuance,buildFirstPurchase} from './initialization.ts';
import {verifyInitializationLive} from './initialization-live.ts';
import {nextInitializationStage,verifyInitializationStage} from './initialization-lifecycle.ts';

type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
type Cell=Parameters<typeof verifyInitializationLive>[2][number];
type Dep=Parameters<typeof verifyInitializationLive>[3][number];
type Previous=Parameters<typeof nextInitializationStage>[0];
type Setup=Parameters<typeof buildInitializationSetup>[0];
type Issuance=Parameters<typeof buildIssuance>[0];
type Purchase=Parameters<typeof buildFirstPurchase>[0];
type Request={stage:'setup';params:Setup;previous?:Previous}|{stage:'issuance';params:Issuance;previous:Previous}|{stage:'purchase';params:Purchase;previous:Previous};
type PriorReview={transaction:ccc.Transaction;requiredInputs:{txHash:string;index:string}[];liveIndices:number[]};
const PUDGE='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
const key=(p:{txHash:string;index:string})=>`${p.txHash.toLowerCase()}:${BigInt(p.index)}`;

/** Prepare an unsigned local-fixture stage. It does not authenticate a proof,
 * verify a signature, broadcast, or validate the prior receipt's authenticity.
 * The caller must independently authenticate all of those before proceeding. */
export async function prepareLocalInitializationStage(rpc:Rpc,genesis:string,request:Request,inputs:Cell[],deps:Dep[],prior?:PriorReview){
  if(process.env.NEXT_PUBLIC_LOCAL_FIXTURE!=='1'||typeof window==='undefined'||!['localhost','127.0.0.1','[::1]'].includes(window.location.hostname)||!/^0x[0-9a-f]{64}$/i.test(genesis)||genesis.toLowerCase()===PUDGE)throw Error('Private local fixture required');
  const tx=request.stage==='setup'?buildInitializationSetup(request.params):request.stage==='issuance'?buildIssuance(request.params):buildFirstPurchase(request.params);
  if(request.stage==='purchase'&&request.params.genesis.toLowerCase()!==genesis.toLowerCase())throw Error('Purchase genesis mismatch');
  const actual=tx.inputs.map(i=>key({txHash:i.previousOutput.txHash,index:ccc.numToHex(i.previousOutput.index)}));
  const expected=inputs.map(i=>key(i.outPoint));
  if(actual.length!==expected.length||actual.some((v,i)=>v!==expected[i]))throw Error('Reviewed input mismatch');
  const source=request.stage==='setup'?request.params.inputs:request.stage==='issuance'?[request.params.anchor,request.params.ownerCell]:[request.params.inventory,request.params.marker,request.params.buyer];
  const script=(s:unknown)=>s?ccc.Script.from(s as ccc.ScriptLike).hash().toLowerCase():'';
  if(source.some((c,i)=>c.capacity!==inputs[i].capacity||script(c.lock)!==script(inputs[i].lock)||script(c.type)!==script(inputs[i].type)||c.data.toLowerCase()!==inputs[i].data.toLowerCase()))throw Error('Reviewed input content mismatch');
  if(request.stage!=='setup'){
    if(!prior||!request.previous||prior.transaction.hash().toLowerCase()!==request.previous.txHash.toLowerCase())throw Error('Prior reviewed transaction required');
    const expectedStage=request.stage==='issuance'?'setup':'issuance';
    const requiredIndices=request.stage==='issuance'?[0,1]:[0,1];
    if(prior.liveIndices.join(',')!==requiredIndices.join(','))throw Error('Prior successor selection mismatch');
    const checked=await verifyInitializationStage(rpc,genesis,expectedStage,prior.transaction,prior.requiredInputs,prior.liveIndices);
    if(checked.blockHash.toLowerCase()!==request.previous.blockHash.toLowerCase()||checked.outputs.some((p,i)=>key(p)!==key(request.previous!.outputs[i])))throw Error('Prior receipt changed');
    if(request.stage==='issuance'){
      if(script(prior.transaction.outputs[0].lock)!==request.params.identity.owner.hash().toLowerCase()||prior.transaction.outputsData[0]!=='0x'||prior.transaction.outputs[0].type)throw Error('Setup owner lineage mismatch');
    }else{
      if(script(prior.transaction.outputs[0].lock)!==request.params.identity.market.hash().toLowerCase()||script(prior.transaction.outputs[0].type)!==request.params.identity.token.hash().toLowerCase()||script(prior.transaction.outputs[1].type)!==request.params.identity.marker.hash().toLowerCase())throw Error('Issuance lineage mismatch');
    }
  }
  nextInitializationStage(request.previous,request.stage,inputs.map(i=>i.outPoint));
  const actualDeps=tx.cellDeps.map(d=>key({txHash:d.outPoint.txHash,index:ccc.numToHex(d.outPoint.index)}));
  const expectedDeps=deps.map(d=>key(d.outPoint));
  if(actualDeps.length!==expectedDeps.length||actualDeps.some((v,i)=>v!==expectedDeps[i]))throw Error('Reviewed dependency mismatch');
  const expectedCount=request.stage==='setup'?1:request.stage==='issuance'?4:6;
  if(tx.cellDeps.length!==expectedCount||tx.cellDeps[0].depType!=='depGroup'||tx.cellDeps.slice(1).some(d=>d.depType!=='code'))throw Error('Incorrect dependency type or count');
  const id=request.params.identity;
  const codes=request.stage==='setup'?[]:request.stage==='issuance'?[id.owner,id.token,id.marker]:[id.market,id.marker,id.custody,id.custodyMarker,id.token];
  if(codes.some(s=>s.hashType!=='data1'||!deps.some(d=>d.dataHash.toLowerCase()===s.codeHash.toLowerCase())))throw Error('Required code dependency missing');
  if(request.stage==='purchase'){
    const response=await fetch('/api/v2-init-proof',{method:'POST'});if(!response.ok)throw Error('Initial proof verification unavailable');
    const p=await response.json();
    if(typeof p?.witness!=='string'||typeof p?.newRoot!=='string'||p.witness.toLowerCase()!==request.params.witness.toLowerCase()||p.newRoot.toLowerCase()!==request.params.newRoot.toLowerCase()||p.owner?.toLowerCase()!==ccc.Script.from(inputs[2].lock).hash().toLowerCase())throw Error('Initial proof mismatch');
  }
  await verifyInitializationLive(rpc,genesis,inputs,deps);
  return {stage:request.stage,transaction:tx,hash:tx.hash(),inputs:expected,dependencies:expectedDeps,requiresProofAuthentication:request.stage==='purchase'};
}

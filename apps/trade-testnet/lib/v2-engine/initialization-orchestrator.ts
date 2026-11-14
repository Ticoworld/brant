import {ccc} from '@ckb-ccc/core';
import {buildInitializationSetup,buildIssuance,buildFirstPurchase,deriveMarketIdentity} from './initialization.ts';
import {verifyInitializationLive} from './initialization-live.ts';
import {nextInitializationStage,verifyInitializationStage} from './initialization-lifecycle.ts';
import {readFundingCell} from './funding.ts';

type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
type Cell=Parameters<typeof verifyInitializationLive>[2][number];
type Dep=Parameters<typeof verifyInitializationLive>[3][number];
type Previous=Parameters<typeof nextInitializationStage>[0];
type Setup=Parameters<typeof buildInitializationSetup>[0];
type Issuance=Parameters<typeof buildIssuance>[0];
type Purchase=Parameters<typeof buildFirstPurchase>[0];
type Request={stage:'setup';params:Setup;previous?:Previous}|{stage:'issuance';params:Issuance;previous:Previous}|{stage:'purchase';params:Purchase;previous:Previous};
type PriorReview={transaction:ccc.Transaction;requiredInputs:{txHash:string;index:string}[];liveIndices:number[]};
type InitialProof={owner:string;witness:string;newRoot:string};
const PUDGE='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
const key=(p:{txHash:string;index:string})=>`${p.txHash.toLowerCase()}:${BigInt(p.index)}`;

/** Prepare an unsigned local-fixture stage. It does not authenticate a proof,
 * verify a signature, broadcast, or validate the prior receipt's authenticity.
 * The caller must independently authenticate all of those before proceeding. */
async function prepareInitializationStage(rpc:Rpc,genesis:string,request:Request,inputs:Cell[],deps:Dep[],prior:PriorReview|undefined,verifyProof:()=>Promise<InitialProof>){
  if(!/^0x[0-9a-f]{64}$/i.test(genesis))throw Error('Invalid genesis');
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
    const p=await verifyProof();
    if(typeof p?.witness!=='string'||typeof p?.newRoot!=='string'||p.witness.toLowerCase()!==request.params.witness.toLowerCase()||p.newRoot.toLowerCase()!==request.params.newRoot.toLowerCase()||p.owner?.toLowerCase()!==ccc.Script.from(inputs[2].lock).hash().toLowerCase())throw Error('Initial proof mismatch');
  }
  await verifyInitializationLive(rpc,genesis,inputs,deps);
  return {stage:request.stage,transaction:tx,hash:tx.hash(),inputs:expected,dependencies:expectedDeps,requiresProofAuthentication:request.stage==='purchase'};
}

export async function prepareLocalInitializationStage(rpc:Rpc,genesis:string,request:Request,inputs:Cell[],deps:Dep[],prior?:PriorReview){
  if(process.env.NEXT_PUBLIC_LOCAL_FIXTURE!=='1'||typeof window==='undefined'||!['localhost','127.0.0.1','[::1]'].includes(window.location.hostname)||!/^0x[0-9a-f]{64}$/i.test(genesis)||genesis.toLowerCase()===PUDGE)throw Error('Private local fixture required');
  return prepareInitializationStage(rpc,genesis,request,inputs,deps,prior,async()=>{
    const response=await fetch('/api/v2-init-proof',{method:'POST'});if(!response.ok)throw Error('Initial proof verification unavailable');
    return response.json();
  });
}

/** Pudge preparation is read-only. The caller must still validate the wallet
 * signature, the complete user review and submission recovery before sending. */
export async function preparePudgeInitializationStage(rpc:Rpc,request:Request,inputs:Cell[],deps:Dep[],prior?:PriorReview){
 const codes={market:'0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770',marker:'0xd09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2',owner:'0xf8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53',custody:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',custodyMarker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95'};
 const raw=request.params.identity.owner.args.slice(2,74);
 if(!/^[0-9a-f]{72}$/i.test(raw))throw Error('Invalid anchor identity');
 const anchor={txHash:'0x'+raw.slice(0,64),index:'0x'+raw.slice(64).match(/../g)!.reverse().join('')};
 const id=deriveMarketIdentity({anchor,genesis:PUDGE,base:1000000000n,step:100000000n,supply:2000n,codes});
 const actual=request.params.identity;
 for(const name of ['marker','market','owner','token','custodyMarker','custody'] as const)if(actual[name].hash().toLowerCase()!==id[name].hash().toLowerCase())throw Error('Pudge market identity mismatch');
 if(actual.markerData.toLowerCase()!==id.markerData.toLowerCase()||actual.custodyMarkerData.toLowerCase()!==id.custodyMarkerData.toLowerCase())throw Error('Pudge marker data mismatch');
 if(deps[0]?.outPoint.txHash.toLowerCase()!=='0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37'||BigInt(deps[0].outPoint.index)!==0n||deps[0].dataHash.toLowerCase()!=='0xf66ca3517241864672b7f47d093aec4d6d4d07824068993eacd728eb9078e236')throw Error('Pudge secp dependency mismatch');
 if(request.stage==='setup'){
  if(key(request.params.anchor)!==key(anchor)||!inputs.length)throw Error('Reserved anchor mismatch');
  await readFundingCell(rpc,anchor,ccc.Script.from(inputs[0].lock).hash());
 }else if(request.stage==='issuance'){
  if(key(request.params.anchor.outPoint)!==key(anchor)||request.params.supply!==2000n)throw Error('Issuance anchor or supply mismatch');
 }else{
  if(request.params.supply!==2000n||request.params.quantity!==7n||request.params.price!==9100000000n||!prior||prior.transaction.inputs.length!==2||key(request.params.buyer.outPoint)!==key({txHash:prior.transaction.inputs[1].previousOutput.txHash,index:'0x1'}))throw Error('Purchase lineage or terms mismatch');
 }
 return prepareInitializationStage(rpc,PUDGE,request,inputs,deps,prior,async()=>{
  const owner=ccc.Script.from(inputs[2].lock).hash(),response=await fetch('/api/v2/pudge-init-proof',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({anchor,owner})});
  if(!response.ok)throw Error('Pudge initial proof verification unavailable');
  const proof=await response.json();
  if(proof.genesis!==PUDGE||proof.market!==id.market.hash()||proof.custody!==id.custody.hash())throw Error('Pudge proof domain mismatch');
  return proof;
 });
}

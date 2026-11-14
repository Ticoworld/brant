import {ccc} from '@ckb-ccc/core';
import {cccA} from '@ckb-ccc/core/advanced';
import {buildFirstPurchase,buildInitializationSetup,buildIssuance,deriveMarketIdentity} from './initialization.ts';
import {reconcileCodeAttempt} from './deployment-verification.ts';
import {parseWizard,type WizardJournal} from './wizard-journal.ts';
import type {DeploymentAttempt} from './deployment-journal.ts';

type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
const genesis='0x10639e0895502b5688a6be8cf69460d76541bfa4821629d86d62ba0aae3f9606';
const hashes={custody:'0xeb824875d13277957fbca6b683cfb20d7a3232de4d1737fe5a3a20dbad858000',market:'0xdfeb6731293b4cc42bd09823806c284a7bd796ec1a88bd93769955864983a770',custodyMarker:'0x21c973369f41486cd7d45b6a8aac18894b0f8bab69aea1e023e6a639baa7eadc',marker:'0xd09213f4c7755a004bb17d0866ac170b6a459e36e17a76df66079f9426604fd2',owner:'0xf8679f2ffc2a07f6ff3e8ec71ddd8eb7f807d0c0c6f3482cf9e9fbe6af57da53',xudt:'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95'};
const secp={outPoint:{txHash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:'0x0'},depType:'depGroup' as const};
const xudt={outPoint:{txHash:'0xbf6fb538763efec2a70a6a3dcb7242787087e1030c4e7d86585bc63a9d337f5f',index:'0x0'},depType:'code' as const};
const key=(p:{txHash:string;index:string})=>`${p.txHash.toLowerCase()}:${BigInt(p.index)}`;
const input=(tx:ccc.Transaction,i:number)=>({txHash:tx.inputs[i].previousOutput.txHash,index:ccc.numToHex(tx.inputs[i].previousOutput.index)});
const sum=(a:bigint[])=>a.reduce((x,y)=>x+y,0n);

/** Rebuild each claimed stage from canonical transaction history. This is a
 * read-only recovery check; no saved browser receipt is accepted as proof. */
export async function recoverPudgeHistory(rpc:Rpc,attempt:DeploymentAttempt,rawWizard:WizardJournal,proof: (anchor:{txHash:string;index:string},owner:string)=>Promise<{owner:string;newRoot:string;witness:string}>,options:{requireSuccessors?:boolean}={}) {
 const journal=parseWizard(JSON.stringify(rawWizard));
 if(!attempt.anchor||attempt.genesis.toLowerCase()!==genesis||journal.genesis.toLowerCase()!==genesis||journal.owner.toLowerCase()!==attempt.owner.toLowerCase()||journal.entries[0]?.txHash.toLowerCase()!==attempt.txHash.toLowerCase())throw Error('Deployment recovery identity mismatch');
 const expected=[hashes.custody,hashes.market,hashes.custodyMarker,hashes.marker,hashes.owner];
 if(attempt.codeHashes.length!==expected.length||attempt.codeHashes.some((h,i)=>h.toLowerCase()!==expected[i]))throw Error('Pinned code identities differ');
 const code=await reconcileCodeAttempt(rpc,attempt),anchor=attempt.anchor,id=deriveMarketIdentity({anchor,genesis,base:1000000000n,step:100000000n,supply:2000n,codes:hashes});
 if(journal.entries[0].blockHash&&journal.entries[0].blockHash.toLowerCase()!==code.blockHash.toLowerCase())throw Error('Recorded code block changed');
 const codeDep=(index:number)=>({outPoint:{txHash:attempt.txHash,index:'0x'+index.toString(16)},depType:'code' as const});
 const cache=new Map<string,{tx:ccc.Transaction;blockHash:string}>();
 async function canonical(hash:string){
  const cached=cache.get(hash.toLowerCase());if(cached)return cached;
  const row=await rpc('get_transaction',[hash]) as {transaction?:unknown;tx_status?:{status?:string;block_hash?:string}};
  if(row?.tx_status?.status!=='committed'||!row.tx_status.block_hash||!row.transaction)throw Error('Stage or predecessor is not committed');
  const tx=ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(row.transaction as never));if(tx.hash().toLowerCase()!==hash.toLowerCase())throw Error('Canonical transaction identity mismatch');
  const header=await rpc('get_header',[row.tx_status.block_hash]) as {hash?:string;number?:string};
  if(!header?.number||header.hash?.toLowerCase()!==row.tx_status.block_hash.toLowerCase()||String(await rpc('get_block_hash',[header.number])).toLowerCase()!==row.tx_status.block_hash.toLowerCase())throw Error('Stage block is not canonical');
  const value={tx,blockHash:row.tx_status.block_hash};cache.set(hash.toLowerCase(),value);return value;
 }
 async function cell(point:{txHash:string;index:string}){
  const source=(await canonical(point.txHash)).tx,index=Number(BigInt(point.index)),output=source.outputs[index];if(!output||!Number.isSafeInteger(index))throw Error('Missing predecessor output');
  return {outPoint:point,capacity:output.capacity,lock:output.lock,...(output.type?{type:output.type}:{}),data:source.outputsData[index]};
 }
 async function live(point:{txHash:string;index:string}){const row=await rpc('get_live_cell',[{tx_hash:point.txHash,index:point.index},true]) as {status?:string};if(row?.status!=='live')throw Error('Required successor is no longer live');}
 async function dependency(point:{txHash:string;index:string},expectedHash:string){const row=await rpc('get_live_cell',[{tx_hash:point.txHash,index:point.index},true]) as {status?:string;cell?:{data?:{content?:string}}};if(row?.status!=='live'||!row.cell?.data?.content||ccc.hashCkb(row.cell.data.content as ccc.Hex).toLowerCase()!==expectedHash)throw Error('Required dependency is unavailable');}
 const codeTx=(await canonical(attempt.txHash)).tx,anchorCell=await cell(anchor);
 if(codeTx.inputs.some((_,i)=>key(input(codeTx,i))===key(anchor))||anchorCell.type||anchorCell.data!=='0x'||ccc.Script.from(anchorCell.lock).hash().toLowerCase()!==attempt.owner.toLowerCase())throw Error('Reserved anchor is invalid or was consumed by code deployment');
 await dependency(secp.outPoint,'0xf66ca3517241864672b7f47d093aec4d6d4d07824068993eacd728eb9078e236');await dependency(xudt.outPoint,hashes.xudt);
 const stages:Record<string,{tx:ccc.Transaction;blockHash:string}>={};
 for(const entry of journal.entries.slice(1)){
  const value=await canonical(entry.txHash),tx=value.tx;
  if(entry.blockHash&&entry.blockHash.toLowerCase()!==value.blockHash.toLowerCase())throw Error('Recorded stage block changed');
  let rebuilt:ccc.Transaction;
  if(entry.stage==='setup'){
   if(tx.outputs.length!==3||!tx.inputs.length)throw Error('Invalid setup shape');
   const inputs=await Promise.all(tx.inputs.map((_,i)=>cell(input(tx,i))));
   if(inputs.some(c=>ccc.Script.from(c.lock).hash().toLowerCase()!==attempt.owner.toLowerCase()))throw Error('Setup owner mismatch');
   const fee=sum(inputs.map(c=>c.capacity))-sum(tx.outputs.map(o=>o.capacity));if(fee<=0n)throw Error('Invalid setup fee');
   rebuilt=buildInitializationSetup({identity:id,anchor,inputs,ownerCapacity:tx.outputs[0].capacity,buyerCapacity:tx.outputs[1].capacity,fee,secpDep:secp});
  }else if(entry.stage==='issuance'){
   const setup=stages.setup?.tx;if(!setup||tx.inputs.length!==2||tx.outputs.length!==3||key(input(tx,0))!==key(anchor)||key(input(tx,1))!==key({txHash:setup.hash(),index:'0x0'}))throw Error('Issuance lineage mismatch');
   const anchorCell=await cell(anchor),ownerCell=await cell({txHash:setup.hash(),index:'0x0'});
   if(ccc.Script.from(anchorCell.lock).hash().toLowerCase()!==attempt.owner.toLowerCase())throw Error('Anchor owner mismatch');
   const fee=anchorCell.capacity+ownerCell.capacity-sum(tx.outputs.map(o=>o.capacity));if(fee<=0n)throw Error('Invalid issuance fee');
   rebuilt=buildIssuance({identity:id,anchor:anchorCell,ownerCell,supply:2000n,inventoryCapacity:tx.outputs[0].capacity,markerCapacity:tx.outputs[1].capacity,fee,deps:[secp,codeDep(4),xudt,codeDep(3)]});
  }else if(entry.stage==='purchase'){
   const setup=stages.setup?.tx,issuance=stages.issuance?.tx;if(!setup||!issuance||tx.inputs.length!==3||tx.outputs.length!==5||key(input(tx,0))!==key({txHash:issuance.hash(),index:'0x0'})||key(input(tx,1))!==key({txHash:issuance.hash(),index:'0x1'})||key(input(tx,2))!==key({txHash:setup.hash(),index:'0x1'}))throw Error('Purchase lineage mismatch');
   const inventory=await cell(input(tx,0)),marker=await cell(input(tx,1)),buyer=await cell(input(tx,2));
   if(ccc.Script.from(buyer.lock).hash().toLowerCase()!==attempt.owner.toLowerCase())throw Error('Purchase owner mismatch');
   const verified=await proof(anchor,attempt.owner);if(verified.owner.toLowerCase()!==attempt.owner.toLowerCase()||verified.witness.toLowerCase()!==tx.witnesses[3]?.toLowerCase())throw Error('Initial proof differs');
   const fee=inventory.capacity+marker.capacity+buyer.capacity-sum(tx.outputs.map(o=>o.capacity));if(fee<=0n)throw Error('Invalid purchase fee');
   rebuilt=buildFirstPurchase({identity:id,inventory,marker,buyer,supply:2000n,quantity:7n,price:9100000000n,custodyCapacity:tx.outputs[2].capacity,custodyMarkerCapacity:tx.outputs[3].capacity,fee,newRoot:verified.newRoot,witness:verified.witness,genesis,deps:[secp,codeDep(1),codeDep(3),codeDep(0),codeDep(2),xudt]});
  }else throw Error('Unexpected stage');
  if(rebuilt.hash().toLowerCase()!==tx.hash().toLowerCase())throw Error('Committed stage differs from reconstructed terms');
  stages[entry.stage]=value;
 }
 const last=journal.entries.at(-1)?.stage;
 if(options.requireSuccessors===false&&last!=='purchase')throw Error('Historical recovery requires completed initialization');
 if(options.requireSuccessors!==false){
  if(last==='code')await live(anchor);
  if(last==='setup'){await live({txHash:stages.setup.tx.hash(),index:'0x0'});await live({txHash:stages.setup.tx.hash(),index:'0x1'});await live(anchor);}
  if(last==='issuance'){await live({txHash:stages.issuance.tx.hash(),index:'0x0'});await live({txHash:stages.issuance.tx.hash(),index:'0x1'});await live({txHash:stages.setup.tx.hash(),index:'0x1'});}
  if(last==='purchase')for(let i=0;i<4;i++)await live({txHash:stages.purchase.tx.hash(),index:'0x'+i.toString(16)});
 }
 return {code,identity:id,stages};
}

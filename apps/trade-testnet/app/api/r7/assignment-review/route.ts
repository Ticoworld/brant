import { readFile } from 'node:fs/promises';
import { ccc } from '@ckb-ccc/core';
import { localRequest } from '../../../../lib/r7-local-request';
import { httpRpc,cat,le,read,fromRpcCell } from '../../../../lib/pudge/market';
import { recoverR7 } from '../../../../lib/r7-recovery';
import { PositionTree,encodePosition } from '../../../../lib/r7-tree';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const external='0xc47b33f79bb3439876bf5be3af7d790eca8ae73779346297b5290ad73e4436ca';
export async function GET(req:Request){
 if(process.env.R7_LOCAL_ENABLED!=='1'||!localRequest(req))return new Response('Disabled',{status:403});
 try{
  const url=new URL(process.env.R7_LOCAL_RPC||'http://127.0.0.1:19224');if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password)throw Error('Loopback RPC required');
  const file=process.env.R7_ASSIGNMENT_REVIEW;if(!file)throw Error('Private fixture review not configured');
  const review=JSON.parse(await readFile(file,'utf8'));const rpc=httpRpc(url.toString());const [genesis,info]=await Promise.all([rpc('get_block_by_number',['0x0']),rpc('get_blockchain_info',[])]);
  if(info.chain!=='ckb_dev'||genesis.header.hash!==review.privateGenesis||genesis.header.hash!==process.env.R7_LOCAL_GENESIS||review.covenant.codeHash!==process.env.R7_LOCAL_CODE_HASH)throw Error('Private network identity mismatch');
  const tx=ccc.Transaction.from(review.transaction);if(tx.inputs.length!==3||tx.outputs.length!==3||tx.witnesses.length!==4||tx.witnesses[0]!=='0x'||tx.witnesses[1]==='0x'||tx.witnesses[2]!=='0x')throw Error('Unexpected transaction shape');
  const id=review.covenant.args,tip=tx.inputs[0].previousOutput.txHash;if(tx.inputs[0].previousOutput.index!==0n)throw Error('Wrong vault input');
  const state=await recoverR7(rpc,tip,review.covenant.codeHash,id,review.privateGenesis);const index=Number(review.position),old=state.tree.records[index];if(!old||old.p!==125000000n||old.b!==100000000n||old.revision!==1n)throw Error('Unexpected position');
  const inputs=[];for(const i of [1,2]){const p=tx.inputs[i].previousOutput;const live=await rpc('get_live_cell',[{tx_hash:p.txHash,index:ccc.numToHex(p.index)},true]);if(live.status!=='live')throw Error('Wallet input is stale');inputs.push(fromRpcCell(live.cell.output,live.cell.data.content,p));}
  const [seller,buyer]=inputs;if(seller.cellOutput.lock.hash()!==old.owner||buyer.cellOutput.lock.hash()!==external||seller.cellOutput.type||buyer.cellOutput.type||seller.outputData!=='0x'||buyer.outputData!=='0x')throw Error('Unexpected participants');
  const price=8000000000n,fee=10000n,next={...old,owner:external as ccc.Hex,revision:old.revision+1n};const tree=new PositionTree(state.tree.n,id);state.tree.records.forEach((r,i)=>tree.set(i,r));const proof=tree.proof(index);tree.set(index,next);
  const data=ccc.bytesFrom(state.cell.data.content);data.set(ccc.bytesFrom(tree.root),128);const payload=ccc.hexFrom(cat(le(4n),le(1n),le(BigInt(index)),encodePosition(old),encodePosition(next),...proof.map(p=>ccc.bytesFrom(p))));
  const vault=fromRpcCell(state.cell.output,state.cell.data.content,tx.inputs[0].previousOutput);const expected=ccc.Transaction.from({inputs:tx.inputs,cellDeps:tx.cellDeps,headerDeps:[],outputs:[vault.cellOutput,{capacity:seller.cellOutput.capacity+price,lock:seller.cellOutput.lock},{capacity:buyer.cellOutput.capacity-price-fee,lock:buyer.cellOutput.lock}],outputsData:[ccc.hexFrom(data),'0x','0x'],witnesses:['0x',tx.witnesses[1],'0x',payload]});
  if(expected.hash()!==tx.hash()||expected.witnesses[3]!==tx.witnesses[3]||review.price!==String(price)||review.fee!==String(fee))throw Error('Assignment differs from verified terms');
  return Response.json({genesis:review.privateGenesis,vault:id,position:index,principal:String(old.p),backing:String(old.b),revision:String(old.revision),price:String(price),fee:String(fee),buyer:external,seller:old.owner,transaction:review.transaction,hash:tx.hash()});
 }catch(e){return Response.json({error:String(e)},{status:400});}
}

import { ccc } from '@ckb-ccc/core';
import { cccA } from '@ckb-ccc/core/advanced';
import { cat, read, type Rpc } from './market.ts';
import { PositionTree, decodePosition, encodePosition } from './r7-tree.ts';
import { verifyAuthorization } from './r7-authorization.ts';

// Replays committed witnesses; callers must independently authenticate the RPC chain.
export async function recoverR7(rpc:Rpc,tip:ccc.Hex,codeHash:ccc.Hex,id:ccc.Hex,genesis:ccc.Hex) {
  const blocks:{hash:ccc.Hex;tx:any;w:Uint8Array}[]=[];let hash=tip;
  for(let n=0;n<10000;n++){
    const result=await rpc('get_transaction',[hash]);
    if(result?.tx_status?.status!=='committed'||!result.transaction)throw Error('Committed history unavailable');
    const tx=result.transaction;
    if(ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(tx)).hash()!==hash)throw Error('History transaction hash mismatch');
    const w=cat(...tx.witnesses.slice(tx.inputs.length).map((v:ccc.Hex)=>ccc.bytesFrom(v)));
    if(w.length<16)throw Error('Missing transition witness');
    blocks.push({hash,tx,w});if(read(w,0)===0n)break;
    if(tx.inputs[0]?.previous_output?.index!=='0x0')throw Error('Invalid vault predecessor');
    hash=tx.inputs[0].previous_output.tx_hash;
    if(n===9999)throw Error('History bound exceeded');
  }
  blocks.reverse();const initial=ccc.bytesFrom(blocks[0].tx.outputs_data[0]);
  if(initial.length!==216||new TextDecoder().decode(initial.slice(0,8))!=='TCM0003\0'||ccc.hexFrom(initial.slice(184,216))!==genesis)throw Error('Wrong R7 state or genesis');
  const count=Number(read(initial,120));const tree=new PositionTree(count,id);
  const immutable=ccc.hexFrom(initial.slice(160,216));let previous='';
  for(const [step,{hash:txHash,tx,w}] of blocks.entries()){
    if(step&&tx.inputs[0].previous_output.tx_hash!==previous)throw Error('History discontinuity');
    const op=Number(read(w,0)),n=Number(read(w,8)),stride=120+32*tree.depth+(op===8?106:0);
    if(n>100||w.length!==16+n*stride||op===7)throw Error('Unsupported or malformed transition');
    for(let j=0;j<n;j++){
      const p=w.slice(16+j*stride,16+(j+1)*stride),i=Number(read(p,0)),old=decodePosition(p.slice(8,64)),next=decodePosition(p.slice(64,120));
      if(i>=tree.n||ccc.hexFrom(encodePosition(tree.records[i]))!==ccc.hexFrom(encodePosition(old))||next.revision!==old.revision+1n)throw Error('Invalid historical leaf');
      const proof=tree.proof(i);for(let d=0;d<tree.depth;d++)if(proof[d]!==ccc.hexFrom(p.slice(120+32*d,152+32*d)))throw Error('Invalid historical proof');
      if(op===8){const off=120+32*tree.depth,price=read(p,off),sig=ccc.hexFrom(p.slice(off+41,off+106));
        const terms={genesis,vault:id,covenant:ccc.Script.from({codeHash,hashType:'data1',args:id}).hash(),position:String(i),seller:old.owner,principal:String(old.p),backing:String(old.b),revision:String(old.revision),price:String(price)};
        const checked=verifyAuthorization(terms,sig);if(checked.publicKey!==ccc.hexFrom(p.slice(off+8,off+41)))throw Error('Maker public key mismatch');
        const out=tx.outputs[j+1],buyer=tx.outputs.at(-1),input=tx.inputs[1]?.previous_output;
        if(!input)throw Error('Missing buyer input');
        const previousBuyer=await rpc('get_transaction',[input.tx_hash]);
        if(previousBuyer?.tx_status?.status!=='committed'||!previousBuyer.transaction||ccc.Transaction.from(cccA.JsonRpcTransformers.transactionTo(previousBuyer.transaction)).hash()!==input.tx_hash)throw Error('Buyer history unavailable');
        const spent=previousBuyer.transaction.outputs[Number(BigInt(input.index))];
        if(!out||!buyer||!spent||out.type||BigInt(out.capacity)<price||ccc.Script.from(cccA.JsonRpcTransformers.scriptTo(out.lock)).hash()!==old.owner||ccc.Script.from(cccA.JsonRpcTransformers.scriptTo(buyer.lock)).hash()!==next.owner||ccc.Script.from(cccA.JsonRpcTransformers.scriptTo(spent.lock)).hash()!==next.owner||old.p!==next.p||old.b!==next.b)throw Error('Invalid sale payout or entitlement');
      }
      tree.set(i,next);
    }
    const out=tx.outputs[0],data=ccc.bytesFrom(tx.outputs_data[0]);
    if(!out||out.type?.code_hash!==codeHash||out.type?.args!==id||JSON.stringify(out.lock)!==JSON.stringify(out.type)||data.length!==216||ccc.hexFrom(data.slice(160,216))!==immutable||ccc.hexFrom(data.slice(128,160))!==tree.root)throw Error('Historical vault identity or root mismatch');
    const phase=read(data,80),principal=tree.records.reduce((v,r)=>v+r.p,0n),backing=tree.records.reduce((v,r)=>v+r.b,0n),occupied=BigInt(tree.records.filter(r=>phase?r.b>0n:r.p>0n).length);
    if(read(data,96)!==principal||read(data,104)!==backing||read(data,112)!==occupied||BigInt(out.capacity)!==read(data,72)+(phase?backing:principal))throw Error('Vault accounting mismatch');
    previous=txHash;
  }
  const live=await rpc('get_live_cell',[{tx_hash:tip,index:'0x0'},true]);
  if(live.status!=='live'||live.cell.data.content!==blocks.at(-1)!.tx.outputs_data[0])throw Error('Stale vault: rebuild from latest live state');
  return {tree,tip,cell:live.cell,history:blocks.map(b=>b.hash)};
}

// First bounded qualification: exact pinned xUDT binary enhanced-owner mode.
// This does not constitute complete atomic market initialization acceptance.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {ccc} from '@ckb-ccc/core';
const table=fields=>{
 const head=4*(fields.length+1);let offset=head;
 const lengths=fields.map(field=>{const current=offset;offset+=ccc.bytesFrom(field).length;return current;});
 const u32=value=>{const b=Buffer.alloc(4);b.writeUInt32LE(value);return b;};
 return ccc.hexFrom(Buffer.concat([u32(offset),...lengths.map(u32),...fields.map(field=>Buffer.from(ccc.bytesFrom(field)))]));
};
export async function runSharedLaunch({rpc,genesis,hashes,deps,secp,wallets,locks,cell,tx,sign,commit,out,le}){
 assert.equal(hashes.xudt,'0x50bd8d6680b8b9cf98b73f3c08faf8b2a21914311954118ad6609be6e78a1b95');
 const input=wallets[0],anchor=ccc.hexFrom(Buffer.concat([Buffer.from(ccc.bytesFrom(input.outPoint.txHash)),le(BigInt(input.outPoint.index),4)]));
 const issuer=ccc.Script.from({codeHash:hashes.atomic_owner_probe,hashType:'data',args:anchor});
 const token=ccc.Script.from({codeHash:hashes.xudt,hashType:'data1',args:issuer.hash()});
 const witness=table([issuer.toHex(),'0x','0x','0x04000000']);
 const transaction=tx([input],[cell(200n*100000000n,locks[0],token,'0x01000000000000000000000000000000'),cell(input.capacity-200n*100000000n-1000000n,locks[0])],[deps.xudt,deps.atomic_owner_probe]);
 transaction.witnesses[0]=ccc.WitnessArgs.from({outputType:witness}).toHex();
 const signed=sign(transaction,[input],[0]);
 assert.equal(ccc.Transaction.from(signed).getWitnessArgs(0).outputType,witness);
 const cells=await commit('atomic-enhanced-owner-binary-probe',signed);
 const row=await rpc('get_transaction',[cells[0].outPoint.txHash]);
 assert.equal(row.tx_status.status,'committed');
 assert.equal(await rpc('get_block_hash',[row.tx_status.block_number]),row.tx_status.block_hash);
 writeFileSync(join(out,'enhanced-owner-qualification.json'),JSON.stringify({qualificationOnly:true,atomicMarketAcceptance:false,genesis,xudt:hashes.xudt,issuer:issuer.toHex(),hash:cells[0].outPoint.txHash,transaction:signed,receipt:row.tx_status},null,2));
}


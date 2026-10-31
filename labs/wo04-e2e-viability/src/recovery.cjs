// E2E v1: bounded canonical recovery records inside standard WitnessArgs.output_type.
const U=require('../../wo04-e1/node_modules/@nervosnetwork/ckb-sdk-utils'),crypto=require('crypto');
const B=h=>{if(!/^0x(?:[a-f0-9]{2})*$/i.test(h))throw Error('hex');return Buffer.from(h.slice(2),'hex');};
const sha=b=>crypto.createHash('sha256').update(b).digest(),hx=b=>'0x'+b.toString('hex');
const magic=Buffer.from('CKBREC01'),u32=n=>{let b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
const camel=x=>x==='dep_group'?'depGroup':Array.isArray(x)?x.map(camel):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),camel(v)])):x;
function encode(records){if(!records.length||records.length>64)throw Error('count');let prev=-1;for(const r of records){if(!Number.isInteger(r.index)||r.index<=prev||r.index>0xffffffff||r.terms.length!==536)throw Error('record');prev=r.index;}return Buffer.concat([magic,u32(records.length),...records.map(r=>Buffer.concat([u32(r.index),r.terms]))]);}
function decode(b){if(b.length<12||!b.subarray(0,8).equals(magic))throw Error('record version');let count=b.readUInt32LE(8);if(!count||count>64||b.length!==12+540*count)throw Error('record size');let out=[],last=-1;for(let i=0;i<count;i++){let o=12+540*i,index=b.readUInt32LE(o);if(index<=last)throw Error('duplicate/unordered index');last=index;out.push({index,terms:b.subarray(o+4,o+540)});}return out;}
function witness(h){let b=B(h);if(b.length<16||b.readUInt32LE(0)!==b.length)throw Error('WitnessArgs length');let off=[4,8,12].map(i=>b.readUInt32LE(i));if(off[0]!==16||off[1]<16||off[2]<off[1]||off[2]>b.length)throw Error('WitnessArgs offsets');return off.map((o,i)=>{let e=i<2?off[i+1]:b.length;if(o===e)return null;if(e-o<4||b.readUInt32LE(o)!==e-o-4)throw Error('BytesOpt');return b.subarray(o+4,e);});}
function id(terms,point){let i=BigInt(point.index);if(i<0n||i>0xffffffffn||B(point.txHash).length!==32)throw Error('OutPoint');let word=Buffer.alloc(32);word.writeUInt32BE(Number(i),28);return hx(sha(Buffer.concat([terms.subarray(0,480),B(point.txHash),word])));}
async function recover(rpc,point,config){
 let genesis=await rpc('get_block_hash',['0x0']);if(genesis!==config.ckbGenesis)throw Error('wrong CKB chain');
 let fetched=await rpc('get_transaction',[point.txHash]);if(!fetched||fetched.tx_status.status!=='committed'||!fetched.transaction)throw Error('funding history unavailable/uncommitted');
 let t=camel(fetched.transaction);if(U.rawTransactionToHash(t)!==point.txHash)throw Error('funding transaction hash');
 const block=await rpc('get_block',[fetched.tx_status.block_hash]);if(!block||!block.transactions.some(x=>x.hash===point.txHash)||await rpc('get_block_hash',[block.header.number])!==fetched.tx_status.block_hash)throw Error('not in canonical committed block');
 let index=Number(BigInt(point.index));if(!Number.isInteger(index)||index<0||index>=t.outputs.length)throw Error('output index');
 let out=t.outputs[index];if(out.type||t.outputsData[index]!=='0x'||out.lock.codeHash!==config.intentCodeHash||out.lock.hashType!=='data2'||B(out.lock.args).length!==32)throw Error('not compact intent');
 // This v1 profile explicitly uses one standard signed funding input/group.
 if(t.inputs.length!==1||t.witnesses.length!==1)throw Error('unsupported funding witness layout');
 const wa=witness(t.witnesses[0]);if(!wa[0]||wa[0].length!==65||wa[1]!==null||!wa[2])throw Error('incompatible WitnessArgs profile');
 // Independently reconstruct the standard sighash-all digest, recover the signer,
 // and match the previous funding cell's standard secp256k1 lock. No fixture key needed.
 const prev=await rpc('get_transaction',[t.inputs[0].previousOutput.txHash]);if(!prev?.transaction)throw Error('funding input history unavailable');
 const previous=prev.transaction.outputs[Number(BigInt(t.inputs[0].previousOutput.index))];
 if(!previous||previous.lock.code_hash!=='0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8'||previous.lock.hash_type!=='type')throw Error('nonstandard funding signer');
 const zero=U.serializeWitnessArgs({lock:'0x'+'00'.repeat(65),inputType:'',outputType:hx(wa[2])}),length=Buffer.alloc(8);length.writeBigUInt64LE(BigInt(B(zero).length));
 const digest=U.blake2b(32,null,null,U.PERSONAL).update(B(point.txHash)).update(length).update(B(zero)).digest('hex');
 const ec=new (require('../../wo04-e1/node_modules/elliptic').ec)('secp256k1');const sig={r:wa[0].subarray(0,32).toString('hex'),s:wa[0].subarray(32,64).toString('hex')};if(wa[0][64]>3)throw Error('signature recovery id');
 let pub;try{pub=ec.recoverPubKey(Buffer.from(digest,'hex'),sig,wa[0][64]).encodeCompressed('hex');}catch(e){throw Error('funding signature');}
 if('0x'+U.blake160('0x'+pub,'hex')!==previous.lock.args||!ec.verify(digest,sig,pub,'hex'))throw Error('funding signature');
 let records=decode(wa[2]),record=records.find(r=>r.index===index);if(!record)throw Error('no record for output');
 for(const r of records){const o=t.outputs[r.index];if(!o||o.type||t.outputsData[r.index]!=='0x'||o.lock.codeHash!==config.intentCodeHash||o.lock.hashType!=='data2'||hx(sha(r.terms))!==o.lock.args)throw Error('record/output commitment mismatch');}
 let terms=record.terms;if(hx(sha(terms))!==out.lock.args)throw Error('commitment');
 if(hx(terms.subarray(160,192))!==genesis||hx(terms.subarray(96,128))!==config.ethGenesis||hx(terms.subarray(128,160))!==config.registry)throw Error('order chain/registry');
 const capacity=terms.readBigUInt64BE(472)+terms.readBigUInt64LE(528);if(BigInt(out.capacity)!==capacity)throw Error('capacity');
 // Live-cell check establishes this is currently spendable, not an already consumed/replaced intent.
 const live=await rpc('get_live_cell',[{tx_hash:point.txHash,index:point.index},true]);if(live.status!=='live'||JSON.stringify(live.cell.output)!==JSON.stringify(fetched.transaction.outputs[index])||live.cell.data.content!=='0x')throw Error('not live original cell');
 const ethers=require('../../wo04-e1/node_modules/ethers'),types=['bytes32','uint256','address','bytes32','bytes32','bytes32','bytes32','bytes32','bytes32','address','uint256','address','address','uint64','uint64'];
 const values=ethers.AbiCoder.defaultAbiCoder().decode(types,hx(terms.subarray(0,480)));
 if(ethers.AbiCoder.defaultAbiCoder().encode(types,values).toLowerCase()!==hx(terms.subarray(0,480)))throw Error('noncanonical ABI');
 if(values[0]!==ethers.sha256(ethers.toUtf8Bytes('CKB-E2D-P1-ORDER-V1'))||BigInt(values[1])!==1337n||values[6]!==ethers.ZeroHash)throw Error('unsupported domain/chain/reserved field');
 if(values[2]===ethers.ZeroAddress||values[7]===ethers.ZeroHash||values[8]===ethers.ZeroHash||values[9]===ethers.ZeroAddress||BigInt(values[10])<=0n||values[11]===ethers.ZeroAddress||values[12]===ethers.ZeroAddress||values[11]===values[12]||BigInt(values[13])<=0n||BigInt(values[14])<=0n||terms.subarray(480,512).equals(Buffer.alloc(32)))throw Error('invalid immutable terms');
 const fields=['ethGenesis','registry','ckbGenesis','fundingId','ckbMaker','ckbRefund','asset','amount','recipient','maker','deadline','ckbAmount'];
 const order=Object.fromEntries(fields.map((k,i)=>[k,typeof values[i+3]==='bigint'?values[i+3].toString():values[i+3]]));
 return {point,id:id(terms,point),terms:hx(terms),commitment:out.lock.args,order,principal:terms.readBigUInt64BE(472).toString(),feeReserve:terms.readBigUInt64LE(528).toString(),fundingBlock:fetched.tx_status.block_hash,records:records.length,fundingSignatureVerified:true,source:'fresh canonical CKB RPC funding witness only'};
}
module.exports={encode,decode,witness,recover,id,camel,B,hx};

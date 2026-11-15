// Local unsigned preview only; no signing or broadcast.
const fs=require('fs'),path=require('path'),{ccc}=require('@ckb-ccc/core');
const code=fs.readFileSync(path.resolve(__dirname,'../../../labs/wo15-merkle-intent/r7/build/merkle_intent'));
const data=ccc.hexFrom(code),expected='0x6870b841e2b873ca563b95313bcac6f20e299d17c395e1f907d0723d4fa16c36';
if(ccc.hashCkb(data)!==expected)throw Error('R7 binary hash mismatch');
const lock={codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:'0x36ef38ed06300fa0f357f1f360b897c476c5c4f9'};
const input=9999986100000n,occupied=51133n*100000000n,rate=1000n;
function make(fee){return ccc.Transaction.from({inputs:[{previousOutput:{txHash:'0x3fa9dd0155936e0dacc9bf5e57a4785c3d6d66191a7560f1ff5ec6a6b04954f3',index:2}}],outputs:[{capacity:occupied,lock},{capacity:input-occupied-fee,lock}],outputsData:[data,'0x'],cellDeps:[{outPoint:{txHash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:0},depType:'depGroup'}],witnesses:[ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex()]});}
const size=BigInt(make(0n).toBytes().length),fee=(size*rate+999n)/1000n,tx=make(fee);
console.log(JSON.stringify({rawHash:tx.hash(),bytesWithPlaceholder:Number(size),feeRateShannonsPerKb:Number(rate),feeShannons:fee.toString(),inputShannons:input.toString(),codeCapacityShannons:occupied.toString(),changeShannons:(input-occupied-fee).toString(),codeHash:expected,transaction:tx},(_,v)=>typeof v==='bigint'?v.toString():v,2));

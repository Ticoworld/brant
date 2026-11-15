// Read-only unsigned Pudge transaction preview. Never signs or broadcasts.
const {ccc}=require('@ckb-ccc/core');
const lock={codeHash:'0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',hashType:'type',args:'0x36ef38ed06300fa0f357f1f360b897c476c5c4f9'};
const tx=ccc.Transaction.from({inputs:[{previousOutput:{txHash:'0x97d3e78286547e06c342db1007c041b4aabb927dea943aa760d28ff61ec02670',index:0}}],outputs:[{capacity:6100000000n,lock},{capacity:993899990000n,lock}],outputsData:['0x','0x'],cellDeps:[{outPoint:{txHash:'0xf8de3bb47d055cdf460d93a2a6e1b05f7432f9777c8c474abf4eec1d4aee5d37',index:0},depType:'depGroup'}],witnesses:[ccc.WitnessArgs.from({lock:'0x'+'00'.repeat(65)}).toHex()]});
console.log(JSON.stringify({rawHash:tx.hash(),bytesWithPlaceholder:tx.toBytes().length,transaction:tx},(_,v)=>typeof v==='bigint'?v.toString():v,2));
